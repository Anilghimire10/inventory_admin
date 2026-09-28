'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CalendarClock } from 'lucide-react';
import { AdminApi, apiError, type RenewalRow } from '@/lib/api';
import { useCanEdit } from '@/auth/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Table, THead, TH, TBody, TR, TD } from '@/components/ui/table';
import { Spinner, ErrorState, PageHeader, EmptyState, Alert } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { formatDate, formatMoney } from '@/lib/utils';

const WINDOWS = [7, 30, 60, 90];

/** "in 5 days", "today", "3 days ago". */
function when(r: RenewalRow) {
  if (r.daysLeft === 0) return r.overdue ? 'Ended today' : 'Ends today';
  const n = Math.abs(r.daysLeft);
  const days = `${n} day${n === 1 ? '' : 's'}`;
  return r.overdue ? `Ended ${days} ago` : `Ends in ${days}`;
}

/**
 * Who to chase for payment: every subscription ending within the window,
 * and every one already past its end date, soonest first. Pick shops and
 * send them the renewal reminder -- the same bell notice and email as the
 * button on a business page -- in one go.
 */
export default function RenewalsPage() {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const canEdit = useCanEdit();
  const [days, setDays] = useState(30);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-renewals', days],
    queryFn: () => AdminApi.renewals(days),
  });

  const remind = useMutation({
    mutationFn: () => AdminApi.remindBusinesses(Array.from(picked)),
    onSuccess: (r) => {
      setPicked(new Set());
      qc.invalidateQueries({ queryKey: ['admin-renewals'] });
      toast(
        `Reminded ${r.reminded} shop${r.reminded === 1 ? '' : 's'}: ${r.emailed} email${r.emailed === 1 ? '' : 's'} sent` +
          (r.failed ? `, ${r.failed} failed` : '') +
          (r.skipped ? `. ${r.skipped} skipped (no end date)` : ''),
        r.failed ? 'error' : 'success',
      );
    },
    onError: (e) => toast(apiError(e), 'error'),
  });

  const rows = data ?? [];
  const overdue = rows.filter((r) => r.overdue);
  const upcoming = rows.filter((r) => !r.overdue);
  // What the window is expected to bring in if every paying shop renews at
  // its last price, per currency. Trials have no price yet, so they're left out.
  const expected = upcoming.reduce<Record<string, number>>((acc, r) => {
    if (r.lastPayment) acc[r.lastPayment.currency] = (acc[r.lastPayment.currency] ?? 0) + r.lastPayment.amount;
    return acc;
  }, {});

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = (list: RenewalRow[]) =>
    setPicked((p) => {
      const allOn = list.every((r) => p.has(r.id));
      const next = new Set(p);
      list.forEach((r) => (allOn ? next.delete(r.id) : next.add(r.id)));
      return next;
    });

  return (
    <div>
      <PageHeader
        title="Renewals"
        description="Subscriptions ending soon, and ones that already have. Remind shops to pay before they're locked out."
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-48">
          <Select
            aria-label="Ending within"
            value={days}
            onChange={(e) => {
              setDays(Number(e.target.value));
              setPicked(new Set());
            }}
          >
            {WINDOWS.map((d) => (
              <option key={d} value={d}>
                Ending within {d} days
              </option>
            ))}
          </Select>
        </div>
        {canEdit && (
          <Button
            className="gap-1.5"
            disabled={picked.size === 0}
            loading={remind.isPending}
            onClick={() => remind.mutate()}
          >
            <BellRing className="h-4 w-4" /> Remind {picked.size || ''} selected
          </Button>
        )}
        {Object.keys(expected).length > 0 && (
          <span className="text-sm text-muted-foreground">
            Due in this window at last prices:{' '}
            <strong className="text-foreground">
              {Object.entries(expected)
                .map(([cur, total]) => formatMoney(total, cur))
                .join(' + ')}
            </strong>
          </span>
        )}
      </div>

      {!canEdit && <Alert className="mb-4">Support accounts can see renewals but not send reminders.</Alert>}

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Spinner className="py-20" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nothing to renew"
          description={`No subscription ends within ${days} days, and none has lapsed.`}
        />
      ) : (
        <div className="space-y-8">
          {overdue.length > 0 && (
            <Section
              title={`Overdue (${overdue.length})`}
              hint="Past their end date. They keep working until the grace period runs out, then their team can't sign in."
              rows={overdue}
              picked={picked}
              canEdit={canEdit}
              onToggle={toggle}
              onToggleAll={() => toggleAll(overdue)}
            />
          )}
          {upcoming.length > 0 && (
            <Section
              title={`Ending within ${days} days (${upcoming.length})`}
              rows={upcoming}
              picked={picked}
              canEdit={canEdit}
              onToggle={toggle}
              onToggleAll={() => toggleAll(upcoming)}
            />
          )}
          {rows.length === 500 && (
            <p className="text-xs text-muted-foreground">Showing the first 500. Narrow the window to see the rest.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  hint,
  rows,
  picked,
  canEdit,
  onToggle,
  onToggleAll,
}: {
  title: string;
  hint?: string;
  rows: RenewalRow[];
  picked: Set<string>;
  canEdit: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}) {
  const allOn = rows.every((r) => picked.has(r.id));
  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {hint && <p className="mb-2 text-xs text-muted-foreground">{hint}</p>}
      <Table>
        <THead>
          <tr>
            {canEdit && (
              <TH className="w-10">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  aria-label="Select all"
                  checked={allOn}
                  onChange={onToggleAll}
                />
              </TH>
            )}
            <TH>Business</TH>
            <TH>Plan</TH>
            <TH>End date</TH>
            <TH className="text-right">Last paid</TH>
            <TH>Owner</TH>
          </tr>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.id}>
              {canEdit && (
                <TD>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    aria-label={`Select ${r.name}`}
                    checked={picked.has(r.id)}
                    onChange={() => onToggle(r.id)}
                  />
                </TD>
              )}
              <TD>
                <Link href={`/businesses/${r.id}`} className="font-medium text-primary hover:underline">
                  {r.name}
                </Link>
              </TD>
              <TD>
                <Badge tone={r.kind === 'trial' ? 'primary' : 'default'}>{r.kind === 'trial' ? 'Trial' : 'Paying'}</Badge>
              </TD>
              <TD className="whitespace-nowrap">
                <div className={r.overdue || r.daysLeft <= 7 ? 'font-medium text-destructive' : 'text-foreground'}>
                  {when(r)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(r.endsAt)}
                  {r.overdue && ` · locked out ${formatDate(r.accessEndsAt)}`}
                </div>
              </TD>
              <TD className="whitespace-nowrap text-right">
                {r.lastPayment ? (
                  <>
                    <div className="font-medium text-foreground">
                      {formatMoney(r.lastPayment.amount, r.lastPayment.currency)}
                    </div>
                    <div className="text-xs text-muted-foreground">on {formatDate(r.lastPayment.paidAt)}</div>
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TD>
              <TD className="text-muted-foreground">
                {r.owners.length ? (
                  r.owners.map((o) => (
                    <div key={o.email}>
                      {o.email}
                      {!o.emailVerified && <span className="text-xs"> (not verified — no email)</span>}
                    </div>
                  ))
                ) : (
                  <span>No active owner</span>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </section>
  );
}
