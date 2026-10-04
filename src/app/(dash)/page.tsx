'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Building2,
  Users,
  Package,
  DollarSign,
  Ban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Hourglass,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { AdminApi, businessTypeLabel } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Spinner, ErrorState, PageHeader } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import { formatMoney, formatDate, cn } from '@/lib/utils';

export default function OverviewPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => AdminApi.stats(),
  });

  return (
    <div>
      <PageHeader
        title="Platform Overview"
        description="Global metrics and health across every tenant on the platform."
      />

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Spinner className="py-20" />
      ) : (
        <div className="space-y-6">
          {/* Top High-level Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Businesses"
              value={String(data.businesses)}
              sub="Registered tenants"
              icon={Building2}
              tone="primary"
              href="/businesses"
            />
            <StatCard
              label="Total Users"
              value={String(data.users)}
              sub="Active staff & managers"
              icon={Users}
              tone="default"
            />
            <StatCard
              label="Total Products"
              value={String(data.products)}
              sub="Catalog items"
              icon={Package}
              tone="default"
            />
            <StatCard
              label="Total Sales"
              value={String(data.totalTransactions)}
              sub="Transactions recorded"
              icon={DollarSign}
              tone="success"
            />
          </div>

          {/* Sales by Currency */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Platform Gross Sales</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Aggregated revenue per active currency</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {data.salesByCurrency.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No sales recorded across businesses yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.salesByCurrency.map((row) => (
                    <div
                      key={row.currency}
                      className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30"
                    >
                      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                        {row.currency}
                      </span>
                      <p className="mt-2 text-2xl font-bold tracking-tight">
                        {formatMoney(row.total, row.currency)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.count.toLocaleString()} completed transactions
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tenant Health & Subscriptions */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Tenant & Subscription Status
            </h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <StatCard
                label="Active Tenants"
                hint="Every business that isn't suspended, whatever its subscription state."
                value={String(data.activeBusinesses)}
                sub="Operational"
                icon={CheckCircle2}
                tone="success"
                href="/businesses?status=active"
              />
              <StatCard
                label="Suspended"
                hint="Access locked by a platform admin until the business is reactivated."
                value={String(data.suspendedBusinesses)}
                sub="Access locked"
                icon={Ban}
                tone={data.suspendedBusinesses > 0 ? 'destructive' : 'default'}
                href="/businesses?status=suspended"
              />
              <StatCard
                label="On Trial"
                hint="Subscribed with the end date still ahead and no payment recorded yet."
                value={String(data.subscriptions.trial)}
                sub="Free trial period"
                icon={Hourglass}
                tone="primary"
                href="/businesses?subscription=trial"
              />
              <StatCard
                label="Expiring Soon"
                hint="Has paid before, and the paid-until date falls within the next 7 days."
                value={String(data.subscriptions.expiringSoon)}
                sub="Next 7 days"
                icon={Clock}
                tone={data.subscriptions.expiringSoon > 0 ? 'warning' : 'default'}
                href="/businesses?subscription=expiring"
              />
              <StatCard
                label="Expired"
                hint="The paid-until or trial end date has passed."
                value={String(data.subscriptions.expired)}
                sub="Overdue renewal"
                icon={AlertTriangle}
                tone={data.subscriptions.expired > 0 ? 'destructive' : 'default'}
                href="/businesses?subscription=expired"
              />
              <StatCard
                label="No Subscription"
                hint="The subscription is switched off for this business."
                value={String(data.subscriptions.inactive)}
                sub="Inactive license"
                icon={Ban}
                tone="default"
                href="/businesses?subscription=inactive"
              />
            </div>
          </div>

          {/* Newest Businesses */}
          <Card>
            <CardHeader className="flex-row items-center justify-between border-b border-border py-4">
              <CardTitle className="text-base font-semibold">Newest Businesses</CardTitle>
              <Link
                href="/businesses"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <div className="divide-y divide-border">
              {data.recentBusinesses.map((b) => (
                <Link
                  key={b.id}
                  href={`/businesses/${b.id}`}
                  className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-muted/40"
                >
                  <div>
                    <div className="font-medium text-foreground">{b.name}</div>
                    <div className="text-xs text-muted-foreground">{businessTypeLabel(b.type)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{formatDate(b.createdAt)}</span>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
              {data.recentBusinesses.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No businesses registered yet.
                </p>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  hint,
  value,
  sub,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  /** Exact definition, on hover. The card itself is the trigger: it is a link. */
  hint?: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'primary' | 'default' | 'success' | 'warning' | 'destructive';
  href?: string;
}) {
  const toneClasses = {
    primary: 'bg-primary/10 text-primary',
    default: 'bg-secondary text-secondary-foreground',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
  }[tone];

  const content = (
    <Card className={cn('p-5 transition-all', href && 'hover:border-primary/50 hover:shadow-md cursor-pointer')}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', toneClasses)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );

  const card = href ? <Link href={href}>{content}</Link> : content;
  return hint ? (
    <Tooltip content={hint} className="flex flex-col">
      {card}
    </Tooltip>
  ) : (
    card
  );
}
