'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Ban, CheckCircle2, X } from 'lucide-react';
import { AdminApi, apiError, AdminSaleRow } from '@/lib/api';
import { Card, Badge, Spinner, Button } from '@/components/ui';
import { formatMoney, formatDate, formatDateTime, cn } from '@/lib/utils';

type Tab = 'overview' | 'customers' | 'sales' | 'activity';

export default function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-business', id],
    queryFn: () => AdminApi.business(id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-business', id] });
    qc.invalidateQueries({ queryKey: ['admin-businesses'] });
    qc.invalidateQueries({ queryKey: ['admin-stats'] });
  };
  const suspend = useMutation({
    mutationFn: (isSuspended: boolean) => AdminApi.setSuspended(id, isSuspended),
    onSuccess: invalidate,
    onError: (e) => alert(apiError(e)),
  });
  const subscription = useMutation({
    mutationFn: (v: { isSubscribed: boolean; subscribedTo: string | null }) =>
      AdminApi.setSubscription(id, v.isSubscribed, v.subscribedTo),
    onSuccess: invalidate,
    onError: (e) => alert(apiError(e)),
  });

  if (isLoading || !data) return <Spinner />;

  const subActive =
    data.isSubscribed && (!data.subscribedTo || new Date(data.subscribedTo) > new Date());

  const money = (v: number | string) => formatMoney(v, data.currency);

  return (
    <div className="max-w-5xl">
      <button onClick={() => router.push('/businesses')}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to businesses
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
            {data.isSuspended ? <Badge tone="destructive">Suspended</Badge> : <Badge tone="success">Active</Badge>}
            {subActive ? <Badge tone="primary">Subscribed</Badge> : <Badge tone="muted">Unsubscribed</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.type} · {data.currency} · joined {formatDate(data.createdAt)}
          </p>
        </div>
        {data.isSuspended ? (
          <Button variant="primary" loading={suspend.isPending} onClick={() => suspend.mutate(false)}>
            <CheckCircle2 className="h-4 w-4" /> Reactivate
          </Button>
        ) : (
          <Button variant="destructive" loading={suspend.isPending}
            onClick={() => confirm(`Suspend "${data.name}"? Its users will be locked out.`) && suspend.mutate(true)}>
            <Ban className="h-4 w-4" /> Suspend
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Mini label="Sales value" value={money(data.totalSalesValue)} />
        <Mini label="Transactions" value={String(data.totalTransactions)} />
        <Mini label="Products" value={String(data._count.products)} />
        <Mini label="Customers" value={String(data._count.customers)} />
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-border">
        {(['overview', 'customers', 'sales', 'activity'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium capitalize transition-colors',
              tab === t
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="lg:col-span-2">
              <div className="border-b border-border p-5"><h2 className="font-semibold">Subscription</h2></div>
              <SubscriptionControl
                isSubscribed={data.isSubscribed}
                subscribedTo={data.subscribedTo ?? null}
                pending={subscription.isPending}
                onSave={(isSubscribed, subscribedTo) => subscription.mutate({ isSubscribed, subscribedTo })}
              />
            </Card>
            <Card>
              <div className="border-b border-border p-5"><h2 className="font-semibold">Staff ({data.users.length})</h2></div>
              <ul className="divide-y divide-border">
                {data.users.map((u) => (
                  <li key={u.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="primary">{u.role}</Badge>
                      {!u.isActive && <Badge tone="muted">Inactive</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <div className="border-b border-border p-5"><h2 className="font-semibold">Stores ({data.stores.length})</h2></div>
              <ul className="divide-y divide-border">
                {data.stores.map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-5 py-3">
                    <span className="font-medium">{s.name}</span>
                    {s.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="muted">Inactive</Badge>}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {tab === 'customers' && <CustomersTab id={id} money={money} />}
        {tab === 'sales' && <SalesTab id={id} money={money} />}
        {tab === 'activity' && <ActivityTab id={id} />}
      </div>
    </div>
  );
}

function CustomersTab({ id, money }: { id: string; money: (v: number | string) => string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['admin-business-customers', id, page],
    queryFn: () => AdminApi.customers(id, { page, limit: 20 }),
  });
  if (isLoading || !data) return <Spinner />;
  if (data.data.length === 0) return <Empty label="No customers." />;
  return (
    <Card className="overflow-hidden">
      <DataTable
        head={['Name', 'Contact', 'Sales', 'Owes', 'Joined']}
        rows={data.data.map((c) => [
          <span key="n" className="font-medium">{c.name}</span>,
          <span key="c" className="text-muted-foreground">{c.phone || c.email || '—'}</span>,
          c._count.sales,
          Number(c.creditBalance) > 0 ? <span key="o" className="font-medium text-warning">{money(c.creditBalance)}</span> : '—',
          <span key="d" className="text-muted-foreground">{formatDate(c.createdAt)}</span>,
        ])}
      />
      <Pager meta={data.meta} onPage={setPage} />
    </Card>
  );
}

function SalesTab({ id, money }: { id: string; money: (v: number | string) => string }) {
  const [page, setPage] = useState(1);
  const [openSale, setOpenSale] = useState<AdminSaleRow | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['admin-business-sales', id, page],
    queryFn: () => AdminApi.sales(id, { page, limit: 20 }),
  });
  if (isLoading || !data) return <Spinner />;
  if (data.data.length === 0) return <Empty label="No sales yet." />;
  return (
    <>
      <Card className="overflow-hidden">
        <DataTable
          head={['Receipt', 'Date', 'Customer', 'Cashier', 'Items', 'Payment', 'Total']}
          onRowClick={(i) => setOpenSale(data.data[i])}
          rows={data.data.map((s) => [
            <span key="r" className="font-medium">{s.receiptNo}</span>,
            <span key="d" className="whitespace-nowrap text-muted-foreground">{formatDate(s.createdAt)}</span>,
            s.customer?.name ?? 'Walk-in',
            s.user?.name ?? '—',
            s._count.items,
            <Badge key="p" tone="muted">{s.paymentMethod}</Badge>,
            <span key="t" className="font-medium">{money(s.total)}</span>,
          ])}
        />
        <Pager meta={data.meta} onPage={setPage} />
      </Card>
      {openSale && (
        <SaleModal id={id} saleId={openSale.id} money={money} onClose={() => setOpenSale(null)} />
      )}
    </>
  );
}

function SaleModal({
  id, saleId, money, onClose,
}: {
  id: string; saleId: string; money: (v: number | string) => string; onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-sale', id, saleId],
    queryFn: () => AdminApi.sale(id, saleId),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="max-h-[85vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="font-semibold">{data?.receiptNo ?? 'Sale'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        {isLoading || !data ? <Spinner /> : (
          <div className="p-5">
            <p className="mb-3 text-sm text-muted-foreground">
              {formatDateTime(data.createdAt)} · {data.customer?.name ?? 'Walk-in'} · {data.user?.name ?? '—'}
              {data.store?.name ? ` · ${data.store.name}` : ''}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-1">Item</th>
                  <th className="py-1 text-right">Qty</th>
                  <th className="py-1 text-right">Price</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={it.id} className="border-t border-border/60">
                    <td className="py-1.5">{it.name}{it.returnedQty > 0 && <span className="ml-1 text-xs text-destructive">(−{it.returnedQty} returned)</span>}</td>
                    <td className="py-1.5 text-right">{it.quantity}</td>
                    <td className="py-1.5 text-right text-muted-foreground">{money(it.unitPrice)}</td>
                    <td className="py-1.5 text-right">{money(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
              <Row label="Subtotal" value={money(data.subtotal)} />
              <Row label="Discount" value={money(data.discount)} />
              <Row label="Tax" value={money(data.tax)} />
              <div className="flex justify-between pt-1 text-base font-semibold">
                <span>Total</span><span>{money(data.total)}</span>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function ActivityTab({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['admin-business-activity', id, page],
    queryFn: () => AdminApi.activity(id, { page, limit: 25 }),
  });
  if (isLoading || !data) return <Spinner />;
  if (data.data.length === 0) return <Empty label="No activity recorded." />;
  return (
    <Card className="overflow-hidden">
      <DataTable
        head={['When', 'User', 'Action', 'Details']}
        rows={data.data.map((e) => [
          <span key="w" className="whitespace-nowrap text-muted-foreground">{formatDateTime(e.createdAt)}</span>,
          <span key="u">{e.user?.name ?? e.userName ?? 'Unknown'}{e.user?.role ? ` · ${e.user.role}` : ''}</span>,
          <Badge key="a" tone="primary">{e.action}</Badge>,
          <span key="d" className="text-muted-foreground">{e.summary || `${e.entity ?? ''} ${e.entityId ? '#' + e.entityId.slice(0, 8) : ''}`.trim() || '—'}</span>,
        ])}
      />
      <Pager meta={data.meta} onPage={setPage} />
    </Card>
  );
}

// ---- small shared bits ----

function DataTable({
  head, rows, onRowClick,
}: {
  head: string[];
  rows: React.ReactNode[][];
  onRowClick?: (index: number) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/40">
        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
          {head.map((h) => <th key={h} className="px-5 py-2.5 font-medium">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, i) => (
          <tr
            key={i}
            onClick={onRowClick ? () => onRowClick(i) : undefined}
            className={cn('border-t border-border/60', onRowClick && 'cursor-pointer hover:bg-accent/50')}
          >
            {cells.map((c, j) => <td key={j} className="px-5 py-3">{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Pager({ meta, onPage }: { meta: { page: number; pages: number }; onPage: (p: number) => void }) {
  if (meta.pages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
      <Button variant="outline" className="h-8 px-3" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</Button>
      <span className="text-sm text-muted-foreground">Page {meta.page} of {meta.pages}</span>
      <Button variant="outline" className="h-8 px-3" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>Next</Button>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <Card className="p-10 text-center text-sm text-muted-foreground">{label}</Card>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-muted-foreground"><span>{label}</span><span>{value}</span></div>;
}

function SubscriptionControl({
  isSubscribed,
  subscribedTo,
  pending,
  onSave,
}: {
  isSubscribed: boolean;
  subscribedTo: string | null;
  pending: boolean;
  onSave: (isSubscribed: boolean, subscribedTo: string | null) => void;
}) {
  const [date, setDate] = useState(subscribedTo ? subscribedTo.slice(0, 10) : '');
  return (
    <div className="flex flex-wrap items-end gap-4 p-5">
      <div>
        <p className="mb-1 text-sm font-medium">Active until (optional)</p>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">Leave blank for no expiry. Fonepay payment comes later.</p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="primary"
          loading={pending}
          onClick={() => onSave(true, date || null)}
        >
          {isSubscribed ? 'Update subscription' : 'Activate'}
        </Button>
        {isSubscribed && (
          <Button variant="destructive" loading={pending} onClick={() => onSave(false, null)}>
            Deactivate
          </Button>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </Card>
  );
}
