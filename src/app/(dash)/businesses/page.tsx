'use client';
import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Building2, X, Plus } from 'lucide-react';
import {
  AdminApi,
  BUSINESS_SORTS,
  BUSINESS_TYPES,
  SUBSCRIPTION_FILTERS,
  type BusinessSort,
  type BusinessType,
  type SubscriptionFilter,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SubscriptionBadge } from '@/components/ui';
import { Table, THead, TH, TBody, TR, TD } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { Spinner, ErrorState, PageHeader, EmptyState } from '@/components/ui/misc';
import { formatDate, formatDateTime, formatRelative } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';
import { CreateBusinessDialog } from './create-business';
import { useCanEdit } from '@/auth/AuthProvider';
import { ExportButton } from '@/components/export-button';
import { downloadCsv, fetchAll, today } from '@/lib/csv';

const SUBSCRIPTION_LABELS: Record<SubscriptionFilter, string> = {
  active: 'Active',
  trial: 'Trial',
  expiring: 'Expiring in 7 days',
  expired: 'Expired',
  inactive: 'Switched off',
  'no-expiry': 'No expiry',
};

const SORT_LABELS: Record<BusinessSort, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  name: 'Name (A–Z)',
  sales: 'Most sales',
  expiry: 'Expiry date',
};

export default function BusinessesPage() {
  return (
    <Suspense fallback={<Spinner className="py-20" />}>
      <BusinessesList />
    </Suspense>
  );
}

function BusinessesList() {
  const canEdit = useCanEdit();
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | 'active' | 'suspended'>(() => {
    const s = params.get('status');
    return s === 'active' || s === 'suspended' ? s : '';
  });
  const [subscription, setSubscription] = useState<'' | SubscriptionFilter>(() => {
    const q = params.get('subscription');
    return SUBSCRIPTION_FILTERS.includes(q as SubscriptionFilter) ? (q as SubscriptionFilter) : '';
  });
  const [type, setType] = useState<'' | BusinessType>('');
  const [sort, setSort] = useState<BusinessSort>('newest');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const onFilter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const filters = {
    search: search || undefined,
    status: status || undefined,
    subscription: subscription || undefined,
    type: type || undefined,
    sort,
    days: 7,
  };
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-businesses', search, status, subscription, type, sort, page],
    queryFn: () => AdminApi.businesses({ ...filters, page, limit: 20 }),
  });
  const exportCsv = async () => {
    const { rows, truncated } = await fetchAll((p, limit) => AdminApi.businesses({ ...filters, page: p, limit }));
    downloadCsv(
      `businesses-${today()}.csv`,
      ['Name', 'Type', 'Currency', 'Suspended', 'Subscription', 'Paid until', 'Signed up', 'Last active', 'Users', 'Stores', 'Products', 'Sales', 'Payments'],
      rows.map((b) => [
        b.name,
        b.type,
        b.currency,
        b.isSuspended ? 'yes' : 'no',
        b.subscriptionStatus,
        b.subscribedTo ?? '',
        b.createdAt,
        b.lastActiveAt ?? '',
        b._count.users,
        b._count.stores,
        b._count.products,
        b._count.sales,
        b._count.subscriptionPayments,
      ]),
    );
    return { count: rows.length, truncated };
  };

  const hasFilters = Boolean(search || status || subscription || type);

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setSubscription('');
    setType('');
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Businesses"
        description="All registered tenant stores, billing status, and metric counters."
        action={
          <div className="flex flex-wrap gap-2">
            <ExportButton run={exportCsv} />
            {canEdit && (
              <Button className="gap-1.5" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> New business
              </Button>
            )}
          </div>
        }
      />
      {creating && <CreateBusinessDialog onClose={() => setCreating(false)} />}

      {/* Filter and search toolbar */}
      <div className="my-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search businesses…"
            value={search}
            onChange={(e) => onFilter(setSearch)(e.target.value)}
          />
        </div>

        <div className="w-40">
          <Select
            value={status}
            onChange={(e) => onFilter(setStatus)(e.target.value as '' | 'active' | 'suspended')}
          >
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </Select>
        </div>

        <div className="w-48">
          <Select
            value={subscription}
            onChange={(e) => onFilter(setSubscription)(e.target.value as '' | SubscriptionFilter)}
          >
            <option value="">Any subscription</option>
            {SUBSCRIPTION_FILTERS.map((f) => (
              <option key={f} value={f}>
                {SUBSCRIPTION_LABELS[f]}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-40">
          <Select
            value={type}
            onChange={(e) => onFilter(setType)(e.target.value as '' | BusinessType)}
          >
            <option value="">Any type</option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-44">
          <Select
            value={sort}
            onChange={(e) => onFilter(setSort)(e.target.value as BusinessSort)}
          >
            {BUSINESS_SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" /> Clear
          </Button>
        )}
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Spinner className="py-20" />
      ) : data.data.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No businesses found"
          description={hasFilters ? 'Try adjusting your search criteria or clearing filters.' : 'No businesses registered yet.'}
          action={hasFilters ? <Button variant="outline" size="sm" onClick={clearFilters}>Reset filters</Button> : undefined}
        />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <TH>Business</TH>
                <TH>Type</TH>
                <TH className="text-right">Users</TH>
                <TH className="text-right">Products</TH>
                <TH className="text-right">Sales</TH>
                <TH>Status</TH>
                <TH>Subscription</TH>
                <TH>Paid until</TH>
                <TH>Last active</TH>
                <TH>Joined</TH>
              </tr>
            </THead>
            <TBody>
              {data.data.map((b) => (
                <TR
                  key={b.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/businesses/${b.id}`)}
                >
                  <TD className="font-semibold text-foreground">{b.name}</TD>
                  <TD className="text-muted-foreground capitalize">{b.type}</TD>
                  <TD className="text-right font-medium">{b._count.users}</TD>
                  <TD className="text-right font-medium">{b._count.products}</TD>
                  <TD className="text-right font-medium">{b._count.sales}</TD>
                  <TD>
                    {b.isSuspended ? (
                      <Badge tone="destructive">Suspended</Badge>
                    ) : (
                      <Badge tone="success">Active</Badge>
                    )}
                  </TD>
                  <TD>
                    <SubscriptionBadge status={b.subscriptionStatus} />
                  </TD>
                  <TD className="whitespace-nowrap text-muted-foreground">
                    {b.subscribedTo ? formatDate(b.subscribedTo) : 'No expiry'}
                  </TD>
                  <TD className="whitespace-nowrap text-muted-foreground">
                    {b.lastActiveAt ? (
                      <Tooltip content={`Last sign-in or sale: ${formatDateTime(b.lastActiveAt)}`}>
                        <span>{formatRelative(b.lastActiveAt)}</span>
                      </Tooltip>
                    ) : (
                      'Never'
                    )}
                  </TD>
                  <TD className="whitespace-nowrap text-muted-foreground">
                    {formatDate(b.createdAt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {data.data.length} of {data.meta.total} {data.meta.total === 1 ? 'business' : 'businesses'}
            </span>
            <Pagination
              page={data.meta.page}
              pages={data.meta.pages}
              onPage={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
