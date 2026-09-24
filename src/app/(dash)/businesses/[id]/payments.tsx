'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Receipt, Wallet } from 'lucide-react';
import {
  AdminApi,
  apiError,
  SUBSCRIPTION_PAYMENT_METHODS,
  type BusinessDetail,
  type RecordPaymentInput,
  type SubscriptionPaymentMethod,
} from '@/lib/api';
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

const METHOD_LABELS: Record<SubscriptionPaymentMethod, string> = {
  CASH: 'Cash',
  BANK: 'Bank transfer',
  ESEWA: 'eSewa',
  KHALTI: 'Khalti',
  OTHER: 'Other',
};

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
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          loading={remind.isPending}
          // Nothing to remind about without an end date; the API says the same.
          disabled={!business.subscribedTo}
          title={business.subscribedTo ? undefined : 'This business has no end date'}
          onClick={() => remind.mutate()}
        >
          <BellRing className="h-3.5 w-3.5" /> Send reminder now
        </Button>
      </div>

      {recording && (
        <RecordPaymentDialog
          business={business}
          onClose={() => setRecording(false)}
          onSaved={(paidUntil) => {
            setRecording(false);
            toast(`Payment recorded. Paid until ${formatDate(paidUntil)}`, 'success');
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
  onSaved: (paidUntil: string | null) => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<SubscriptionPaymentMethod>('CASH');
  const [periodMode, setPeriodMode] = useState<'months' | 'until'>('months');
  const [months, setMonths] = useState('1');
  const [until, setUntil] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  const save = useMutation({
    mutationFn: (dto: RecordPaymentInput) => AdminApi.recordPayment(business.id, dto),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['admin-business-payments', business.id] });
      onSaved(r.business.subscribedTo);
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
            method,
            reference: reference.trim() || undefined,
            note: note.trim() || undefined,
            ...(periodMode === 'months'
              ? { months: Number(months) }
              : // End of the chosen day, so "paid until the 30th" includes the 30th.
                { periodTo: new Date(`${until}T23:59:59`).toISOString() }),
          });
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label={`Amount (${business.currency})`}>
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
                onClick={() => setMonths(String(m))}
              >
                +{m} {m === 1 ? 'month' : 'months'}
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

        {save.error != null && <Alert>{apiError(save.error)}</Alert>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!valid}>
            Record {amount ? formatMoney(Number(amount), business.currency) : 'payment'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/** Every subscription payment this business has made, newest first. */
export function PaymentsTab({ id }: { id: string }) {
  const [page, setPage] = useState(1);
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
            <TH>Received</TH>
            <TH className="text-right">Amount</TH>
            <TH>Method</TH>
            <TH>Period</TH>
            <TH>Reference</TH>
            <TH>Recorded by</TH>
          </tr>
        </THead>
        <TBody>
          {data.data.map((p) => (
            <TR key={p.id}>
              <TD className="whitespace-nowrap text-muted-foreground">{formatDate(p.createdAt)}</TD>
              <TD className="text-right font-semibold text-foreground">
                {formatMoney(p.amount, p.currency)}
              </TD>
              <TD>
                <Badge tone="muted">{METHOD_LABELS[p.method] ?? p.method}</Badge>
              </TD>
              <TD className="whitespace-nowrap text-muted-foreground">
                {formatDate(p.periodFrom)} – {formatDate(p.periodTo)}
              </TD>
              <TD className="text-muted-foreground">
                {p.reference || '—'}
                {p.note && <div className="text-xs">{p.note}</div>}
              </TD>
              <TD className="text-muted-foreground">{p.recordedByAdmin?.name ?? '—'}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Pagination page={data.meta.page} pages={data.meta.pages} onPage={setPage} />
    </div>
  );
}
