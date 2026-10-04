'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Copy, ImageIcon } from 'lucide-react';
import {
  AdminApi,
  PAYMENT_METHOD_LABELS,
  apiError,
  type PaymentClaimRow,
  type PaymentClaimStatus,
} from '@/lib/api';
import { useCanEdit } from '@/auth/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/label';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { Spinner, ErrorState, PageHeader, EmptyState, Alert } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { cn, formatDate, formatDateTime, formatMoney } from '@/lib/utils';
import { Tabs } from '@/components/ui/tabs';

const TABS: { status: PaymentClaimStatus; label: string }[] = [
  { status: 'PENDING', label: 'Waiting' },
  { status: 'CONFIRMED', label: 'Confirmed' },
  { status: 'REJECTED', label: 'Rejected' },
  { status: 'CANCELLED', label: 'Withdrawn' },
];

/** Reasons that cover most rejections, one click away. */
const QUICK_REASONS = [
  'We could not find a payment with this transaction ID.',
  'The amount we received is different from the one reported.',
  'The screenshot does not show a completed payment.',
];

/**
 * Shops that say they've paid ("I've paid" on their Subscription page).
 * Check each against the eSewa, Khalti or bank statement, then Confirm --
 * which records the payment, extends the subscription and emails the
 * receipt -- or Reject with a reason the shop sees. Oldest first.
 */
export default function PaymentClaimsPage() {
  const [status, setStatus] = useState<PaymentClaimStatus>('PENDING');
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState<PaymentClaimRow | null>(null);
  const [rejecting, setRejecting] = useState<PaymentClaimRow | null>(null);
  const canEdit = useCanEdit();
  // "Has it lapsed?" is judged against the time the page opened.
  const [now] = useState(() => Date.now());

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-payment-claims', status, page],
    queryFn: () => AdminApi.paymentClaims({ status, page, limit: 20 }),
  });

  return (
    <div>
      <PageHeader
        title="Payments to confirm"
        description="Shops that say they've paid. Check each one against your eSewa, Khalti or bank statement, then confirm it or say why not."
      />
      {!canEdit && <Alert className="mb-4">Support accounts can see these, but only full admins can confirm or reject them.</Alert>}

      <Tabs
        className="mb-4"
        label="Payment reports"
        items={TABS.map((t) => ({
          id: t.status,
          label: t.label,
          extra:
            t.status === 'PENDING' && !!data?.pendingCount ? (
              <span className="rounded-full bg-primary/10 px-1.5 text-[11px] text-primary">{data.pendingCount}</span>
            ) : null,
        }))}
        value={status}
        onChange={(s) => {
          setStatus(s);
          setPage(1);
        }}
      />

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Spinner className="py-20" />
      ) : data.data.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title={status === 'PENDING' ? 'Nothing waiting' : 'None yet'}
          description={
            status === 'PENDING'
              ? 'When a shop taps "I’ve paid" on its Subscription page, it shows up here.'
              : undefined
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {data.data.map((c) => (
              <ClaimCard
                key={c.id}
                claim={c}
                now={now}
                canEdit={canEdit}
                onConfirm={() => setConfirming(c)}
                onReject={() => setRejecting(c)}
              />
            ))}
          </div>
          <Pagination page={data.meta.page} pages={data.meta.pages} onPage={setPage} />
        </>
      )}

      {confirming && <ConfirmDialog claim={confirming} onClose={() => setConfirming(null)} />}
      {rejecting && <RejectDialog claim={rejecting} onClose={() => setRejecting(null)} />}
    </div>
  );
}

function ClaimCard({
  claim: c,
  now,
  canEdit,
  onConfirm,
  onReject,
}: {
  claim: PaymentClaimRow;
  now: number;
  canEdit: boolean;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const { show: toast } = useToast();
  const end = c.business.isSubscribed ? c.business.subscribedTo : null;
  const lapsed = !!end && new Date(end).getTime() < now;
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied');
    } catch {
      toast('Couldn’t copy', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/businesses/${c.business.id}`} className="font-semibold text-primary hover:underline">
            {c.business.name}
          </Link>
          <StatusBadge status={c.status} />
          <span className="ml-auto text-xs text-muted-foreground">Reported {formatDateTime(c.createdAt)}</span>
        </div>
        <p className="text-2xl font-semibold tracking-tight">{formatMoney(c.amount, c.currency)}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Paid by</dt>
          <dd>{PAYMENT_METHOD_LABELS[c.method] ?? c.method}</dd>
          {c.reference && (
            <>
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="flex items-center gap-2">
                <span className="font-mono">{c.reference}</span>
                <button type="button" onClick={() => copy(c.reference!)} aria-label="Copy reference" className="text-muted-foreground hover:text-foreground">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </dd>
            </>
          )}
          {(c.months || c.planName) && (
            <>
              <dt className="text-muted-foreground">For</dt>
              <dd>
                {c.planName && <span className="font-medium">{c.planName} plan</span>}
                {c.planName && c.months ? ', ' : ''}
                {c.months ? `${c.months} month${c.months === 1 ? '' : 's'}` : ''}
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">Reported by</dt>
          <dd>{c.submittedByName}</dd>
          <dt className="text-muted-foreground">Paid until now</dt>
          <dd className={cn(lapsed && 'text-destructive')}>
            {end ? `${formatDate(end)}${lapsed ? ' (ended)' : ''}` : 'No end date'}
          </dd>
          {c.note && (
            <>
              <dt className="text-muted-foreground">Note</dt>
              <dd className="whitespace-pre-line">{c.note}</dd>
            </>
          )}
        </dl>
        {c.status === 'REJECTED' && c.rejectReason && (
          <p className="text-sm text-destructive">Rejected: {c.rejectReason}</p>
        )}
        {c.reviewedBy && c.reviewedAt && (
          <p className="text-xs text-muted-foreground">
            {c.status === 'CONFIRMED' ? 'Confirmed' : 'Rejected'} by {c.reviewedBy.name}, {formatDateTime(c.reviewedAt)}
            {c.payment && ` · receipt SUB-${String(c.payment.receiptNo).padStart(6, '0')}`}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-row items-start gap-3 sm:w-44 sm:flex-col sm:items-stretch">
        {c.proofUrl ? (
          <a href={c.proofUrl} target="_blank" rel="noreferrer" className="block" title="Open the screenshot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.proofUrl} alt="Payment screenshot" className="h-32 w-full rounded-md border border-border object-cover sm:h-40" />
          </a>
        ) : (
          <div className="flex h-24 w-full items-center justify-center gap-1 rounded-md border border-dashed border-border text-xs text-muted-foreground">
            <ImageIcon className="h-4 w-4" /> No screenshot
          </div>
        )}
        {c.status === 'PENDING' && canEdit && (
          <div className="flex flex-col gap-2">
            <Button size="sm" onClick={onConfirm}>
              Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={onReject}>
              Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PaymentClaimStatus }) {
  const map: Record<PaymentClaimStatus, { label: string; tone: 'warning' | 'success' | 'destructive' | 'muted' }> = {
    PENDING: { label: 'Waiting', tone: 'warning' },
    CONFIRMED: { label: 'Confirmed', tone: 'success' },
    REJECTED: { label: 'Rejected', tone: 'destructive' },
    CANCELLED: { label: 'Withdrawn', tone: 'muted' },
  };
  return <Badge tone={map[status].tone}>{map[status].label}</Badge>;
}

/** Record the payment: how many months, the amount received, and the receipt. */
function ConfirmDialog({ claim, onClose }: { claim: PaymentClaimRow; onClose: () => void }) {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const [months, setMonths] = useState(String(claim.months ?? 1));
  const [amount, setAmount] = useState(String(claim.amount));
  const [emailReceipt, setEmailReceipt] = useState(true);
  const amountNum = Number(amount);
  const amountOk = Number.isFinite(amountNum) && amountNum > 0;

  const confirm = useMutation({
    mutationFn: () =>
      AdminApi.confirmPaymentClaim(claim.id, {
        months: Number(months),
        ...(amountNum !== claim.amount ? { amount: amountNum } : {}),
        emailReceipt,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-payment-claims'] });
      qc.invalidateQueries({ queryKey: ['admin-business', claim.businessId] });
      const until = res.business.subscribedTo ? ` Paid until ${formatDate(res.business.subscribedTo)}.` : '';
      const mail = res.receipt?.error
        ? ' The receipt email failed; resend it from the business’s Payments tab.'
        : res.receipt?.emailed
          ? ' Receipt emailed.'
          : '';
      toast(`Confirmed.${until}${mail}`, res.receipt?.error ? 'error' : 'success');
      onClose();
    },
    onError: (e) => toast(apiError(e), 'error'),
  });

  return (
    <Dialog open onClose={onClose} title={`Confirm ${claim.business.name}’s payment`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          confirm.mutate();
        }}
      >
        <p className="text-sm text-muted-foreground">
          Only confirm once you&apos;ve found the money in your statement
          {claim.reference ? (
            <>
              {' '}
              (reference <span className="font-mono text-foreground">{claim.reference}</span>)
            </>
          ) : null}
          . This records the payment and extends the subscription
          {claim.planName ? (
            <>
              , and moves the shop onto the <span className="font-medium text-foreground">{claim.planName}</span> plan
            </>
          ) : null}
          .
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Months it pays for">
            <Select value={months} onChange={(e) => setMonths(e.target.value)}>
              {[1, 2, 3, 6, 12, 24].map((m) => (
                <option key={m} value={m}>
                  {m} month{m === 1 ? '' : 's'}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`Amount received (${claim.currency})`}>
            <Input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
        </div>
        {amountOk && amountNum !== claim.amount && (
          <p className="text-xs text-warning">
            Different from the {formatMoney(claim.amount, claim.currency)} the shop reported.
          </p>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={emailReceipt} onChange={(e) => setEmailReceipt(e.target.checked)} />
          Email the receipt to the owner
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={confirm.isPending} disabled={!amountOk}>
            Confirm payment
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/** Say why it couldn't be confirmed: the shop sees this, so be specific. */
function RejectDialog({ claim, onClose }: { claim: PaymentClaimRow; onClose: () => void }) {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const [reason, setReason] = useState('');
  const reject = useMutation({
    mutationFn: () => AdminApi.rejectPaymentClaim(claim.id, reason.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-payment-claims'] });
      toast('Rejected. The shop has been told why.');
      onClose();
    },
    onError: (e) => toast(apiError(e), 'error'),
  });
  return (
    <Dialog open onClose={onClose} title={`Reject ${claim.business.name}’s payment`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          reject.mutate();
        }}
      >
        <p className="text-sm text-muted-foreground">The shop sees this reason and can report the payment again.</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-accent"
            >
              {r}
            </button>
          ))}
        </div>
        <Textarea rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why it couldn’t be confirmed" />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="destructive" loading={reject.isPending} disabled={reason.trim().length < 3}>
            Reject
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
