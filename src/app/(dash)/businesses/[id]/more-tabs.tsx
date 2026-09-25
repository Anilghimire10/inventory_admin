'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, Truck, Clock } from 'lucide-react';
import { AdminApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TH, TBody, TR, TD } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { Spinner, ErrorState, EmptyState } from '@/components/ui/misc';
import { formatDate, formatDateTime, cn } from '@/lib/utils';

// Read-only views of a shop's stock, purchases and tills. Each page load is
// written to the admin log, like the customers tab.

type Money = (v: number | string) => string;

export function ProductsTab({ id, money }: { id: string; money: Money }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-business-products', id, page],
    queryFn: () => AdminApi.products(id, { page, limit: 20 }),
  });
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <Spinner className="py-12" />;
  if (data.data.length === 0) return <EmptyState icon={Package} title="No products in this business" />;

  return (
    <div className="space-y-4">
      <Table>
        <THead>
          <tr>
            <TH>Product</TH>
            <TH>SKU</TH>
            <TH className="text-right">Cost</TH>
            <TH className="text-right">Price</TH>
            <TH className="text-right">On hand</TH>
          </tr>
        </THead>
        <TBody>
          {data.data.map((p) => {
            const low = p.onHand <= p.reorderLevel;
            return (
              <TR key={p.id}>
                <TD>
                  <div className="font-medium text-foreground">
                    {p.name}
                    {p.variantName ? <span className="text-muted-foreground"> · {p.variantName}</span> : null}
                  </div>
                  {!p.isActive && <Badge tone="muted">Inactive</Badge>}
                </TD>
                <TD className="text-muted-foreground">{p.sku || '—'}</TD>
                <TD className="text-right tabular-nums text-muted-foreground">{money(p.costPrice)}</TD>
                <TD className="text-right tabular-nums">{money(p.sellingPrice)}</TD>
                <TD className={cn('text-right tabular-nums', low ? 'font-semibold text-warning' : '')}>
                  {p.onHand} {p.unit}
                  {low && <span className="sr-only"> (at or below reorder level {p.reorderLevel})</span>}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      <Pagination page={data.meta.page} pages={data.meta.pages} onPage={setPage} />
    </div>
  );
}

const PURCHASE_TONE = {
  DRAFT: 'muted',
  ORDERED: 'primary',
  RECEIVED: 'success',
  CANCELLED: 'destructive',
} as const;

export function PurchasesTab({ id, money }: { id: string; money: Money }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-business-purchases', id, page],
    queryFn: () => AdminApi.purchases(id, { page, limit: 20 }),
  });
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <Spinner className="py-12" />;
  if (data.data.length === 0) return <EmptyState icon={Truck} title="No purchases recorded for this business" />;

  return (
    <div className="space-y-4">
      <Table>
        <THead>
          <tr>
            <TH>Date</TH>
            <TH>Reference</TH>
            <TH>Supplier</TH>
            <TH>Store</TH>
            <TH>Status</TH>
            <TH className="text-right">Total</TH>
            <TH className="text-right">Paid</TH>
          </tr>
        </THead>
        <TBody>
          {data.data.map((p) => {
            const owed = Number(p.total) - Number(p.amountPaid);
            return (
              <TR key={p.id}>
                <TD className="whitespace-nowrap text-muted-foreground">{formatDate(p.createdAt)}</TD>
                <TD className="font-medium text-foreground">
                  {p.reference || '—'}
                  <div className="text-xs font-normal text-muted-foreground">{p._count.items} line(s)</div>
                </TD>
                <TD className="text-muted-foreground">{p.supplier?.name ?? '—'}</TD>
                <TD className="text-muted-foreground">{p.store.name}</TD>
                <TD>
                  <Badge tone={PURCHASE_TONE[p.status]}>{p.status.toLowerCase()}</Badge>
                </TD>
                <TD className="text-right tabular-nums">{money(p.total)}</TD>
                <TD className="text-right tabular-nums">
                  {money(p.amountPaid)}
                  {owed > 0.005 && <div className="text-xs text-warning">{money(owed)} owed</div>}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      <Pagination page={data.meta.page} pages={data.meta.pages} onPage={setPage} />
    </div>
  );
}

export function ShiftsTab({ id, money }: { id: string; money: Money }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-business-shifts', id, page],
    queryFn: () => AdminApi.shifts(id, { page, limit: 20 }),
  });
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <Spinner className="py-12" />;
  if (data.data.length === 0) return <EmptyState icon={Clock} title="No shifts recorded for this business" />;

  return (
    <div className="space-y-4">
      <Table>
        <THead>
          <tr>
            <TH>Opened</TH>
            <TH>Closed</TH>
            <TH>Store</TH>
            <TH>Cashier</TH>
            <TH className="text-right">Sales</TH>
            <TH className="text-right">Expected</TH>
            <TH className="text-right">Counted</TH>
            <TH className="text-right">Variance</TH>
          </tr>
        </THead>
        <TBody>
          {data.data.map((s) => {
            const v = s.variance == null ? null : Number(s.variance);
            return (
              <TR key={s.id}>
                <TD className="whitespace-nowrap text-muted-foreground">{formatDateTime(s.openedAt)}</TD>
                <TD className="whitespace-nowrap">
                  {s.closedAt ? (
                    <span className="text-muted-foreground">{formatDateTime(s.closedAt)}</span>
                  ) : (
                    <Badge tone="success">Open</Badge>
                  )}
                </TD>
                <TD className="text-muted-foreground">{s.store.name}</TD>
                <TD className="text-muted-foreground">{s.user.name}</TD>
                <TD className="text-right tabular-nums">{s._count.sales}</TD>
                <TD className="text-right tabular-nums">{s.expectedCash == null ? '—' : money(s.expectedCash)}</TD>
                <TD className="text-right tabular-nums">{s.countedCash == null ? '—' : money(s.countedCash)}</TD>
                <TD
                  className={cn(
                    'text-right tabular-nums',
                    v == null ? 'text-muted-foreground' : v < 0 ? 'text-destructive' : v > 0 ? 'text-success' : '',
                  )}
                >
                  {v == null ? '—' : `${v > 0 ? '+' : ''}${money(v)}`}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      <Pagination page={data.meta.page} pages={data.meta.pages} onPage={setPage} />
    </div>
  );
}
