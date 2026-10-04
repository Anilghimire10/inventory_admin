'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Mail, Printer, Receipt, Wallet } from 'lucide-react';
import {
  AdminApi,
  apiError,
  receiptLabel,
  SUBSCRIPTION_PAYMENT_METHODS,
  type BusinessDetail,
  type RecordPaymentInput,
  type SubscriptionPaymentMethod, PAYMENT_METHOD_LABELS, pricingCurrency } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/label';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, THead, TH, TBody, TR, TD } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { Spinner, ErrorState, Alert, EmptyState } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { formatMoney, formatDate } from '@/lib/utils';
import { printReceipt } from '@/lib/receipt';
import { Tooltip } from '@/components/ui/tooltip';

const METHOD_LABELS = PAYMENT_METHOD_LABELS;

/** The plans from Settings, for picking a shop's plan. Shared cache with the Settings page. */
export function usePlans() {
  return useQuery({ queryKey: ['admin-settings'], queryFn: () => AdminApi.settings(), select: (s) => s.plans ?? [] });
}

/**
 * Buttons for the subscription card: record money received (which also
 * extends the paid-until date) and send the end-date reminder now.
 */
export function SubscriptionActions({
  business,
  onChanged,
}: {
  business: BusinessDetail;
  onChanged: () => void;
}) {
  const { show: toast } = useToast();
  const [recording, setRecording] = useState(false);

  const remind = useMutation({
    mutationFn: () => AdminApi.sendReminder(business.id),
    onSuccess: (r) => {
      // The API reports per-recipient results rather than failing the whole
      // call, so a partly failed send still has to be said out loud.
      if (r.emailed === 0 && r.failed === 0) {
        toast('Notification posted. No owner has an email address to send to.', 'success');
      } else if (r.failed > 0) {
        toast(`Reminder sent to ${r.emailed} owner(s); ${r.failed} email(s) failed`, 'error');
      } else {
        toast(`Reminder sent to ${r.emailed} owner(s)`, 'success');
      }
      onChanged();
    },
    onError: (e) => toast(apiError(e), 'error'),
  });

  return (
    <>
      <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4">
        <Button size="sm" className="gap-1.5" onClick={() => setRecording(true)}>
          <Wallet className="h-3.5 w-3.5" /> Record payment
        </Button>
        <Tooltip content={business.subscribedTo ? undefined : 'This business has no end date'}>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            loading={remind.isPending}
            // Nothing to remind about without an end date; the API says the same.
            disabled={!business.subscribedTo}
            onClick={() => remind.mutate()}
          >
            <BellRing className="h-3.5 w-3.5" /> Send reminder now
          </Button>
        </Tooltip>
      </div>

      {recording && (
        <RecordPaymentDialog
          business={business}
          onClose={() => setRecording(false)}
          onSaved={(r) => {
            setRecording(false);
            const recorded = `${receiptLabel(r.payment.receiptNo)} recorded. Paid until ${formatDate(r.business.subscribedTo)}`;
            // The payment is saved either way; only the email can fail.
            if (!r.receipt) toast(recorded, 'success');
            else if (r.receipt.error || r.receipt.failed > 0)
              toast(`${recorded}, but the receipt email failed${r.receipt.error ? `: ${r.receipt.error}` : ''}. Resend it from Payments.`, 'error');
            else toast(`${recorded}. Receipt emailed to ${r.receipt.emailed} owner(s)`, 'success');
            onChanged();
          }}
        />
      )}
    </>
  );
}

function RecordPaymentDialog({
  business,
  onClose,
  onSaved,
}: {
  business: BusinessDetail;
  onClose: () => void;
  onSaved: (result: Awaited<ReturnType<typeof AdminApi.recordPayment>>) => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<SubscriptionPaymentMethod>('CASH');
  const [periodMode, setPeriodMode] = useState<'months' | 'until'>('months');
  const [months, setMonths] = useState('1');
  const [until, setUntil] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [emailReceipt, setEmailReceipt] = useState(true);
  const { data: plans = [] } = usePlans();
  // The plan it pays for: the shop's own to start; the shop moves onto the one picked.
  const [planId, setPlanId] = useState(business.plan?.id ?? '');
  const plan = plans.find((p) => p.id === planId);

  // What the shop is charged in: NPR, or USD for a shop outside Nepal where the plan has a dollar price.
  const shopCurrency = pricingCurrency(business.currency);
  const currency = shopCurrency === 'USD' && plan?.prices.some((x) => x.amountUsd) ? 'USD' : plan ? 'NPR' : shopCurrency;
  const planPrice = (p: (typeof plans)[number] | undefined, m: number) => {
    const x = p?.prices.find((y) => y.months === m);
    if (!x) return undefined;
    const inUsd = shopCurrency === 'USD' && p!.prices.some((y) => y.amountUsd);
    return inUsd ? (x.amountUsd ?? undefined) : x.amount;
  };
  // Picking a plan or a length fills in that price, while the amount box is still the plan's.
  const priceFor = (id: string, m: string) => planPrice(plans.find((p) => p.id === id), Number(m));
  const repricing = (id: string, m: string) => {
    const next = priceFor(id, m);
    if (next !== undefined && (amount === '' || Number(amount) === priceFor(planId, months))) setAmount(String(next));
  };

  const save = useMutation({
    mutationFn: (dto: RecordPaymentInput) => AdminApi.recordPayment(business.id, dto),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['admin-business-payments', business.id] });
      onSaved(r);
    },
  });

  // Mirrors the API's rule: the new period starts at the current end date if
  // that is still ahead, otherwise today. Shown so the admin can see what a
  // payment will buy before recording it.
  const currentEnd = business.subscribedTo ? new Date(business.subscribedTo) : null;
  const startsFrom =
    business.isSubscribed && currentEnd && currentEnd > new Date() ? currentEnd : new Date();

  const valid =
    Number(amount) > 0 &&
    (periodMode === 'months' ? Number(months) >= 1 && Number(months) <= 36 : !!until);

  return (
    <Dialog open onClose={onClose} title="Record subscription payment" description={business.name}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({
            amount: Number(amount),
            currency,
            method,
            reference: reference.trim() || undefined,
            note: note.trim() || undefined,
            emailReceipt,
            ...(planId ? { planId } : {}),
            ...(periodMode === 'months'
              ? { months: Number(months) }
              : // End of the chosen day, so "paid until the 30th" includes the 30th.
                { periodTo: new Date(`${until}T23:59:59`).toISOString() }),
          });
        }}
      >
        {plans.length > 0 && (
          <Field label="Plan">
            <Select
              value={planId}
              onChange={(e) => {
                repricing(e.target.value, months);
                setPlanId(e.target.value);
              }}
            >
              <option value="">No plan (leave as it is)</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.maxStores === null ? 'unlimited branches' : `${p.maxStores} branch${p.maxStores === 1 ? '' : 'es'}`}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label={`Amount (${currency})`}>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              required
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Paid by">
            <Select value={method} onChange={(e) => setMethod(e.target.value as SubscriptionPaymentMethod)}>
              {SUBSCRIPTION_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABELS[m]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Covers">
            <Select value={periodMode} onChange={(e) => setPeriodMode(e.target.value as 'months' | 'until')}>
              <option value="months">A number of months</option>
              <option value="until">Up to a date</option>
            </Select>
          </Field>
          {periodMode === 'months' ? (
            <Field label="Months">
              <Input
                type="number"
                min="1"
                max="36"
                step="1"
                required
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </Field>
          ) : (
            <Field label="Paid until">
              <Input type="date" required value={until} onChange={(e) => setUntil(e.target.value)} />
            </Field>
          )}
        </div>

        {periodMode === 'months' && (
          <div className="flex gap-2">
            {[1, 3, 12].map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={Number(months) === m ? 'primary' : 'outline'}
                onClick={() => {
                  repricing(planId, String(m));
                  setMonths(String(m));
                }}
              >
                +{m} {m === 1 ? 'month' : 'months'}
                {planPrice(plan, m) !== undefined && (
                  <span className="ml-1 opacity-70">({formatMoney(planPrice(plan, m)!, currency)})</span>
                )}
              </Button>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          The paid period starts {formatDate(startsFrom)}
          {startsFrom === currentEnd ? ', when the current one ends' : ''}.
        </p>
        {business.isSubscribed && !business.subscribedTo && (
          // The API sets the end date to the end of the paid period, so a
          // business on open-ended access gets an expiry it didn't have.
          <Alert className="bg-warning/10 text-warning">
            This business has no end date today. Recording a payment gives it one, at the end of
            the period paid for.
          </Alert>
        )}

        <Field label="Reference (optional)">
          <Input
            placeholder="Receipt or bank reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </Field>
        <Field label="Note (optional)">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <p className="-mt-2 text-xs text-muted-foreground">Only admins see the note; it isn&apos;t printed on the receipt.</p>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={emailReceipt}
            onChange={(e) => setEmailReceipt(e.target.checked)}
          />
          Email the receipt to the owner
        </label>

        {save.error != null && <Alert>{apiError(save.error)}</Alert>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!valid}>
            Record {amount ? formatMoney(Number(amount), currency) : 'payment'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/** Every subscription payment this business has made, newest first. */
export function PaymentsTab({ id }: { id: string }) {
  const { show: toast } = useToast();
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);

  const print = async (paymentId: string) => {
    setBusy(`print:${paymentId}`);
    try {
      printReceipt(await AdminApi.receipt(paymentId));
    } catch (e) {
      toast(apiError(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  const email = async (paymentId: string) => {
    setBusy(`email:${paymentId}`);
    try {
      const r = await AdminApi.emailReceipt(paymentId);
      toast(
        r.failed > 0
          ? `${r.receiptNo}: sent to ${r.emailed} owner(s), ${r.failed} failed`
          : `${r.receiptNo} emailed to ${r.emailed} owner(s)`,
        r.failed > 0 ? 'error' : 'success',
      );
    } catch (e) {
      toast(apiError(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-business-payments', id, page],
    queryFn: () => AdminApi.payments(id, { page, limit: 20 }),
  });

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <Spinner className="py-12" />;
  if (data.data.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No subscription payments recorded"
        description="Use Record payment on the Overview tab when this business pays."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <THead>
          <tr>
            <TH>Receipt</TH>
            <TH>Received</TH>
            <TH className="text-right">Amount</TH>
            <TH>Method</TH>
            <TH>Period</TH>
            <TH>Reference</TH>
            <TH>Recorded by</TH>
            <TH className="text-right">
              <span className="sr-only">Receipt actions</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {data.data.map((p) => (
            <TR key={p.id}>
              <TD className="whitespace-nowrap font-mono text-xs">{receiptLabel(p.receiptNo)}</TD>
              <TD className="whitespace-nowrap text-muted-foreground">{formatDate(p.createdAt)}</TD>
              <TD className="text-right font-semibold text-foreground">
                {formatMoney(p.amount, p.currency)}
              </TD>
              <TD>
                <Badge tone="muted">{METHOD_LABELS[p.method] ?? p.method}</Badge>
              </TD>
              <TD className="whitespace-nowrap text-muted-foreground">
                {formatDate(p.periodFrom)} – {formatDate(p.periodTo)}
                {p.planName && <span className="block text-xs">{p.planName} plan</span>}
              </TD>
              <TD className="text-muted-foreground">
                {p.reference || '—'}
                {p.note && <div className="text-xs">{p.note}</div>}
              </TD>
              <TD className="text-muted-foreground">{p.recordedByAdmin?.name ?? '—'}</TD>
              <TD className="whitespace-nowrap text-right">
                <Tooltip content="Print receipt">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Print ${receiptLabel(p.receiptNo)}`}
                    loading={busy === `print:${p.id}`}
                    onClick={() => print(p.id)}
                  >
                    <Printer className="h-3.5 w-3.5" />
                  </Button>
                </Tooltip>
                <Tooltip content="Email receipt to the owner">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Email ${receiptLabel(p.receiptNo)} to the owner`}
                    loading={busy === `email:${p.id}`}
                    onClick={() => email(p.id)}
                  >
                    <Mail className="h-3.5 w-3.5" />
                  </Button>
                </Tooltip>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Pagination page={data.meta.page} pages={data.meta.pages} onPage={setPage} />
    </div>
  );
}
