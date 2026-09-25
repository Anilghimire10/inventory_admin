'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Building2, Activity, Sparkles } from 'lucide-react';
import { AdminApi, type GrowthStats } from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, THead, TH, TBody, TR, TD } from '@/components/ui/table';
import { Spinner, ErrorState, PageHeader } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import { formatDate, formatMoney, formatRelative, cn } from '@/lib/utils';

/**
 * Is the platform growing, and which shops are slipping away? Signups per
 * week, how many shops are actually selling, the ones that have gone quiet,
 * and what subscriptions brought in.
 */
export default function GrowthPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-growth'],
    queryFn: () => AdminApi.growth(),
  });

  return (
    <div>
      <PageHeader title="Growth" description="Signups, active shops, shops going quiet, and subscription income." />
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Spinner className="py-20" />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Businesses" value={data.businesses} sub={`${data.newThisMonth} new this month`} icon={Building2} />
            <Stat label="Active" value={data.activeLast7Days} sub="A sale in the last 7 days" icon={Activity} />
            <Stat
              label="Going quiet"
              value={data.atRisk.count}
              sub="Sold before, nothing in 14 days"
              icon={AlertTriangle}
              warn={data.atRisk.count > 0}
            />
            <Stat
              label="Inactive or new"
              value={Math.max(0, data.businesses - data.activeLast7Days - data.atRisk.count)}
              sub="No sale in 7 days, not yet quiet"
              icon={Sparkles}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <SignupsChart weeks={data.signupsByWeek} />
            </Card>
            <Card>
              <PaymentsCard thisMonth={data.paymentsThisMonth} lastMonth={data.paymentsLastMonth} />
            </Card>
          </div>

          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-semibold">Going quiet</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Shops that have sold before but not in the last 14 days, quietest first. Worth a call.
              </p>
            </CardHeader>
            {data.atRisk.businesses.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Every shop that has sold has sold in the last 14 days.</p>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Business</TH>
                    <TH>Last sale</TH>
                  </tr>
                </THead>
                <TBody>
                  {data.atRisk.businesses.map((b) => (
                    <TR key={b.id}>
                      <TD>
                        <Link href={`/businesses/${b.id}`} className="font-medium text-primary hover:underline">
                          {b.name}
                        </Link>
                      </TD>
                      <TD className="text-muted-foreground">
                        {formatRelative(b.lastSaleAt)} · {formatDate(b.lastSaleAt)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
            {data.atRisk.count > data.atRisk.businesses.length && (
              <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                Showing the {data.atRisk.businesses.length} quietest of {data.atRisk.count}.
              </p>
            )}
          </Card>
        </div>
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
  value: number;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  warn?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value.toLocaleString()}</p>
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

const CHART_HEIGHT = 160;

/**
 * Signups per week, one column each. A single series in the theme's primary:
 * no legend (the title names it), columns capped at 24px with a 4px rounded
 * cap and a square foot on one baseline, and only the peak and the latest
 * week labelled -- every column's figure is in its tooltip and in the table.
 */
function SignupsChart({ weeks }: { weeks: GrowthStats['signupsByWeek'] }) {
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const peakIndex = weeks.reduce((best, w, i) => (w.count > weeks[best].count ? i : best), 0);
  const total = weeks.reduce((s, w) => s + w.count, 0);
  const label = (w: { weekStart: string }) =>
    new Date(`${w.weekStart}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

  return (
    <>
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <CardTitle className="text-base font-semibold">Signups per week</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">Last 12 weeks · {total} in total</p>
        </div>
        <button
          type="button"
          onClick={() => setAsTable((t) => !t)}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {asTable ? 'Show chart' : 'Show table'}
        </button>
      </CardHeader>

      {asTable ? (
        <Table>
          <THead>
            <tr>
              <TH>Week of</TH>
              <TH className="text-right">Signups</TH>
            </tr>
          </THead>
          <TBody>
            {weeks.map((w) => (
              <TR key={w.weekStart}>
                <TD>{label(w)}</TD>
                <TD className="text-right tabular-nums">{w.count}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      ) : (
        <div className="px-5 pb-4 pt-6">
          <div
            role="img"
            aria-label={`Signups per week for the last 12 weeks, ${total} in total. Use "Show table" for each week's figure.`}
            className="flex items-end gap-0.5 border-b border-border"
            style={{ height: CHART_HEIGHT }}
          >
            {weeks.map((w, i) => {
              const h = w.count === 0 ? 0 : Math.max(4, Math.round((w.count / max) * (CHART_HEIGHT - 20)));
              const labelled = w.count > 0 && (i === peakIndex || i === weeks.length - 1);
              return (
                <Tooltip
                  key={w.weekStart}
                  content={`Week of ${label(w)}: ${w.count} signup${w.count === 1 ? '' : 's'}`}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                >
                  {/* The whole column slot is the hover target, not just the bar. */}
                  <div tabIndex={0} className="flex h-full w-full flex-col items-center justify-end rounded-sm outline-none focus-visible:bg-accent/60 hover:bg-accent/40">
                    {labelled && <span className="mb-1 text-xs font-medium tabular-nums text-foreground">{w.count}</span>}
                    <div className="w-full max-w-6 rounded-t bg-primary" style={{ height: h }} />
                  </div>
                </Tooltip>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-0.5">
            {weeks.map((w, i) => (
              <span key={w.weekStart} className="min-w-0 flex-1 text-center text-[11px] text-muted-foreground">
                {i % 3 === 0 || i === weeks.length - 1 ? label(w) : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function PaymentsCard({
  thisMonth,
  lastMonth,
}: {
  thisMonth: GrowthStats['paymentsThisMonth'];
  lastMonth: GrowthStats['paymentsLastMonth'];
}) {
  const currencies = Array.from(new Set([...thisMonth, ...lastMonth].map((p) => p.currency))).sort();
  return (
    <>
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="text-base font-semibold">Subscription income</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">Payments recorded in this panel, by month (UTC)</p>
      </CardHeader>
      {currencies.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">No payments recorded this month or last.</p>
      ) : (
        <div className="divide-y divide-border">
          {currencies.map((c) => {
            const now = thisMonth.find((p) => p.currency === c);
            const before = lastMonth.find((p) => p.currency === c);
            return (
              <div key={c} className="px-5 py-4">
                <p className="text-xs font-medium text-muted-foreground">{c}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(now?.total ?? 0, c)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {now?.count ?? 0} payment{now?.count === 1 ? '' : 's'} this month · last month{' '}
                  {formatMoney(before?.total ?? 0, c)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
