'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Check, Circle, ClipboardCheck, Phone, Rocket, TriangleAlert, Wallet } from 'lucide-react';
import { AdminApi, type OnboardingRow, type OnboardingScope } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Table, THead, TH, TBody, TR, TD } from '@/components/ui/table';
import { Spinner, ErrorState, PageHeader, EmptyState } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import { SubscriptionBadge } from '@/components/ui';
import { formatDate, formatRelative, cn } from '@/lib/utils';

/** The setup steps, in the order a new shop normally does them. */
const STEPS: { key: keyof OnboardingRow['steps']; label: string }[] = [
  { key: 'products', label: 'Added products' },
  { key: 'firstSale', label: 'Made a first sale' },
  { key: 'staff', label: 'Invited staff' },
  { key: 'shiftClosed', label: 'Closed a shift' },
  { key: 'paid', label: 'Paid' },
];

const SCOPES: { value: OnboardingScope; label: string }[] = [
  { value: 'trial', label: 'On free trial' },
  { value: 'recent', label: 'Signed up in the last 30 days' },
  { value: 'all', label: 'All shops' },
];

/**
 * How far each shop has got with setting up, and which ones are stuck --
 * signed up a few days ago and still no sale. Those are the calls to make
 * before a trial runs out: a shop that sells in its first week tends to stay.
 */
export default function OnboardingPage() {
  const [scope, setScope] = useState<OnboardingScope>('trial');
  const [stuckOnly, setStuckOnly] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-onboarding', scope],
    queryFn: () => AdminApi.onboarding(scope),
  });

  const rows = useMemo(() => {
    const list = (data ?? []).filter((r) => !stuckOnly || r.stuck);
    // Stuck first, then the trial that ends soonest, then the newest signup.
    return [...list].sort(
      (a, b) =>
        Number(b.stuck) - Number(a.stuck) ||
        (a.trialEndsAt ? new Date(a.trialEndsAt).getTime() : Infinity) -
          (b.trialEndsAt ? new Date(b.trialEndsAt).getTime() : Infinity) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [data, stuckOnly]);

  const all = data ?? [];
  const sold = all.filter((r) => r.steps.firstSale).length;
  const paid = all.filter((r) => r.steps.paid).length;
  const stuck = all.filter((r) => r.stuck).length;
  const pct = (n: number) => (all.length ? `${Math.round((n / all.length) * 100)}%` : '—');

  return (
    <div>
      <PageHeader
        title="Onboarding"
        description="How far each shop has got with setting up. Call the stuck ones before their trial ends."
      />

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div className="w-full sm:w-72">
          <Select aria-label="Which shops" value={scope} onChange={(e) => setScope(e.target.value as OnboardingScope)}>
            {SCOPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={stuckOnly}
            onChange={(e) => setStuckOnly(e.target.checked)}
          />
          Stuck only
        </label>
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Spinner className="py-20" />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Shops" value={String(all.length)} sub={SCOPES.find((s) => s.value === scope)!.label} icon={ClipboardCheck} />
            <Stat label="Made a first sale" value={pct(sold)} sub={`${sold} of ${all.length}`} icon={Rocket} />
            <Stat label="Stuck" value={String(stuck)} sub="3+ days, no sale yet" icon={TriangleAlert} warn={stuck > 0} />
            <Stat label="Paying" value={pct(paid)} sub={`${paid} of ${all.length}`} icon={Wallet} />
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title={stuckOnly ? 'Nobody is stuck' : 'No shops here'}
              description={stuckOnly ? 'Every shop in this list has made a sale.' : 'No shop matches this view.'}
            />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Business</TH>
                  <TH>Setup</TH>
                  <TH>First sale</TH>
                  <TH>Plan</TH>
                  <TH>Last active</TH>
                  <TH>Contact</TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <Link href={`/businesses/${r.id}`} className="font-medium text-primary hover:underline">
                        {r.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        Signed up {r.ageDays === 0 ? 'today' : `${r.ageDays} day${r.ageDays === 1 ? '' : 's'} ago`}
                        {r.stuck && <span className="ml-1 font-medium text-warning">· stuck</span>}
                      </div>
                    </TD>
                    <TD>
                      <div className="flex items-center gap-1" aria-label={`${r.done} of ${STEPS.length} setup steps done`}>
                        {STEPS.map((s) => (
                          <Tooltip key={s.key} content={`${s.label}${r.steps[s.key] ? '' : ' — not yet'}`}>
                            <span
                              className={cn(
                                'flex h-6 w-6 items-center justify-center rounded-full',
                                r.steps[s.key] ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {r.steps[s.key] ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-2.5 w-2.5" />}
                            </span>
                          </Tooltip>
                        ))}
                        <span className="ml-1 text-xs text-muted-foreground">
                          {r.done}/{STEPS.length}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {r.counts.products} product{r.counts.products === 1 ? '' : 's'} · {r.counts.staff} user
                        {r.counts.staff === 1 ? '' : 's'}
                      </div>
                    </TD>
                    <TD className="whitespace-nowrap">
                      {r.firstSaleAt ? (
                        <>
                          <div className="text-foreground">{formatDate(r.firstSaleAt)}</div>
                          <div className="text-xs text-muted-foreground">{r.counts.sales} sales so far</div>
                        </>
                      ) : (
                        <span className={r.stuck ? 'font-medium text-warning' : 'text-muted-foreground'}>None yet</span>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap">
                      <SubscriptionBadge status={r.subscriptionStatus} />
                      {r.trialEndsAt && (
                        <div className="mt-0.5 text-xs text-muted-foreground">Trial ends {formatDate(r.trialEndsAt)}</div>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-muted-foreground">
                      {r.lastActiveAt ? formatRelative(r.lastActiveAt) : 'Never'}
                    </TD>
                    <TD className="text-muted-foreground">
                      {r.owner ? <div className="break-all">{r.owner.email}</div> : <div>No active owner</div>}
                      {r.phone && (
                        <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                          <Phone className="h-3 w-3" /> {r.phone}
                        </a>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
          {all.length === 300 && (
            <p className="mt-3 text-xs text-muted-foreground">Showing the newest 300 shops in this view.</p>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  icon: Icon,
  warn,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  warn?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </div>
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            warn ? 'bg-warning/15 text-warning' : 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
