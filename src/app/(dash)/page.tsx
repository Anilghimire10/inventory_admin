'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Building2, Users, Package, DollarSign, Ban, CheckCircle2 } from 'lucide-react';
import { AdminApi } from '@/lib/api';
import { Card, Spinner } from '@/components/ui';
import { formatMoney, formatDate, cn } from '@/lib/utils';

export default function OverviewPage() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-stats'], queryFn: () => AdminApi.stats() });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
      <p className="mt-1 text-sm text-muted-foreground">Everything across every business.</p>

      {isLoading || !data ? <Spinner /> : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Businesses" value={String(data.businesses)} icon={Building2} tone="primary" />
            <Stat label="Total users" value={String(data.users)} icon={Users} tone="default" />
            <Stat label="Total products" value={String(data.products)} icon={Package} tone="default" />
            <Stat label="Platform sales" value={formatMoney(data.totalSalesValue)}
              sub={`${data.totalTransactions} transactions`} icon={DollarSign} tone="primary" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Active" value={String(data.activeBusinesses)} icon={CheckCircle2} tone="success" />
            <Stat label="Suspended" value={String(data.suspendedBusinesses)} icon={Ban}
              tone={data.suspendedBusinesses > 0 ? 'destructive' : 'default'} />
          </div>

          <Card className="mt-6">
            <div className="border-b border-border p-5"><h2 className="font-semibold">Newest businesses</h2></div>
            <ul className="divide-y divide-border">
              {data.recentBusinesses.map((b) => (
                <li key={b.id}>
                  <Link href={`/businesses/${b.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-accent">
                    <div>
                      <div className="font-medium">{b.name}</div>
                      <div className="text-xs text-muted-foreground">{b.type}</div>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(b.createdAt)}</span>
                  </Link>
                </li>
              ))}
              {data.recentBusinesses.length === 0 && (
                <li className="px-5 py-6 text-center text-sm text-muted-foreground">No businesses yet.</li>
              )}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({
  label, value, sub, icon: Icon, tone,
}: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'primary' | 'default' | 'success' | 'destructive';
}) {
  const toneClasses = {
    primary: 'bg-primary/10 text-primary',
    default: 'bg-secondary text-secondary-foreground',
    success: 'bg-success/15 text-success',
    destructive: 'bg-destructive/10 text-destructive',
  }[tone];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', toneClasses)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
