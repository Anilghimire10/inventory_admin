'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Ban, CheckCircle2, Eye, Pencil, Store, Users, ShoppingCart } from 'lucide-react';
import {
  AdminApi,
  AdminSaleRow,
  apiError,
  BUSINESS_TYPES,
  SALES_MODELS,
  type BusinessDetail,
  type BusinessType,
  type SalesModel,
  type UpdateBusinessInput,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SubscriptionBadge } from '@/components/ui';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/ui/label';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, THead, TH, TBody, TR, TD } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { Spinner, ErrorState, Alert, EmptyState } from '@/components/ui/misc';
import { formatMoney, formatDate, formatDateTime, formatRelative, cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { useCanEdit } from '@/auth/AuthProvider';
import { PaymentsTab, SubscriptionActions } from './payments';
import { NotesTab } from './notes';
import { SupportTab } from './support';
import { ProductsTab, PurchasesTab, ShiftsTab } from './more-tabs';
import { DataControls } from './data-controls';

type Tab =
  | 'overview'
  | 'payments'
  | 'customers'
  | 'sales'
  | 'products'
  | 'purchases'
  | 'shifts'
  | 'activity'
  | 'notes'
  | 'support';

export default function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const canEdit = useCanEdit();
  const [tab, setTab] = useState<Tab>('overview');
  const [confirmSuspend, setConfirmSuspend] = useState<'suspend' | 'reactivate' | null>(null);
  const [reason, setReason] = useState('');
  const [editing, setEditing] = useState(false);
  const [viewingAs, setViewingAs] = useState(false);

  const impersonate = useMutation({
    mutationFn: async (tab: Window | null) => ({ tab, res: await AdminApi.impersonate(id) }),
    onSuccess: ({ tab, res }) => {
      setViewingAs(false);
      if (tab) tab.location.replace(res.url);
      else window.open(res.url, '_blank', 'noopener');
      toast(`Opened as ${res.owner.name}. Read-only until ${formatDateTime(res.expiresAt)}.`, 'success');
    },
    onError: (_e, tab) => tab?.close(),
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-business', id],
    queryFn: () => AdminApi.business(id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-business', id] });
    qc.invalidateQueries({ queryKey: ['admin-businesses'] });
    qc.invalidateQueries({ queryKey: ['admin-stats'] });
  };

  const suspend = useMutation({
    mutationFn: (v: { isSuspended: boolean; reason?: string }) =>
      AdminApi.setSuspended(id, v.isSuspended, v.reason),
    onSuccess: (_, vars) => {
      invalidate();
      setConfirmSuspend(null);
      setReason('');
      toast(vars.isSuspended ? 'Business has been suspended' : 'Business reactivated successfully', 'success');
    },
  });

  const subscription = useMutation({
    mutationFn: (v: { isSubscribed: boolean; subscribedTo: string | null }) =>
      AdminApi.setSubscription(id, v.isSubscribed, v.subscribedTo),
    onSuccess: () => {
      invalidate();
      toast('Subscription status updated', 'success');
    },
  });

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <Spinner className="py-20" />;

  const money = (v: number | string) => formatMoney(v, data.currency);

  return (
    <div className="max-w-6xl space-y-6">
      {/* Back button */}
      <div>
        <button
          onClick={() => router.push('/businesses')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to businesses
        </button>
      </div>

      {/* Header bar */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{data.name}</h1>
            {data.isSuspended ? (
              <Badge tone="destructive">Suspended</Badge>
            ) : (
              <Badge tone="success">Active</Badge>
            )}
            <SubscriptionBadge status={data.subscriptionStatus} />
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            <span className="capitalize">{data.type}</span> · <span className="capitalize">{data.salesModel}</span> · {data.currency}
            {data.taxId ? ` · PAN ${data.taxId}` : ''} · Joined {formatDate(data.createdAt)} · Last active{' '}
            {data.lastActiveAt ? formatRelative(data.lastActiveAt).toLowerCase() : 'never'}
          </p>
        </div>

        {/* Wraps on a phone: three buttons don't fit beside each other at 360px. */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewingAs(true)} className="gap-1.5">
            <Eye className="h-3.5 w-3.5" /> View as owner
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" /> Edit details
              </Button>
              {data.isSuspended ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setConfirmSuspend('reactivate')}
                  className="gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Reactivate
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmSuspend('suspend')}
                  className="gap-1.5"
                >
                  <Ban className="h-3.5 w-3.5" /> Suspend
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Suspended alert banner */}
      {data.isSuspended && (
        <Alert className="border border-destructive/20">
          <p className="font-semibold">Business is currently suspended</p>
          <p className="mt-0.5 text-xs text-destructive/90">
            Suspended{data.suspendedAt ? ` on ${formatDate(data.suspendedAt)}` : ''}
            {data.suspendedReason ? `: "${data.suspendedReason}"` : '. No reason recorded.'}
          </p>
        </Alert>
      )}

      {/* Metric counters */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniCard label="Total Sales Value" value={money(data.totalSalesValue)} icon={ShoppingCart} />
        <MiniCard label="Completed Orders" value={String(data.totalTransactions)} icon={ShoppingCart} />
        <MiniCard label="Catalog Products" value={String(data._count.products)} icon={Store} />
        <MiniCard label="Registered Customers" value={String(data._count.customers)} icon={Users} />
      </div>

      {/* Tabs navigation */}
      <div className="flex gap-2 overflow-x-auto border-b border-border">
        {(['overview', 'payments', 'customers', 'sales', 'products', 'purchases', 'shifts', 'activity', 'notes', 'support'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'pb-3 px-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
              tab === t
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab contents */}
      <div>
        {tab === 'overview' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Subscription control card */}
            <Card className="lg:col-span-2">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-base font-semibold">License & Subscription Control</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Manage expiration dates and active license states</p>
              </CardHeader>
              {canEdit && (
                <SubscriptionControl
                  // Remounted when the end date changes (a payment extends it),
                  // so the date field shows the new figure rather than the old.
                  key={data.subscribedTo ?? 'none'}
                  isSubscribed={data.isSubscribed}
                  subscribedTo={data.subscribedTo ?? null}
                  pending={subscription.isPending}
                  error={subscription.error}
                  onSave={(isSubscribed, subscribedTo) =>
                    subscription.mutate({ isSubscribed, subscribedTo })
                  }
                />
              )}
              {canEdit ? (
                <SubscriptionActions business={data} onChanged={invalidate} />
              ) : (
                <p className="px-5 py-4 text-sm text-muted-foreground">
                  {data.subscribedTo ? `Paid until ${formatDate(data.subscribedTo)}.` : 'No end date.'} Only a full admin can change it.
                </p>
              )}
            </Card>

            {/* Staff list */}
            <Card>
              <CardHeader className="border-b border-border pb-3.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Staff Members</CardTitle>
                  <span className="text-xs text-muted-foreground">{data.users.length} users</span>
                </div>
              </CardHeader>
              <div className="divide-y divide-border max-h-80 overflow-y-auto">
                {data.users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <div className="font-medium text-foreground">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge tone="primary">{u.role}</Badge>
                      {!u.emailVerified && <Badge tone="warning">Unverified</Badge>}
                      {!u.isActive && <Badge tone="muted">Inactive</Badge>}
                    </div>
                  </div>
                ))}
                {data.users.length === 0 && (
                  <p className="p-5 text-center text-sm text-muted-foreground">No staff members assigned.</p>
                )}
              </div>
            </Card>

            {/* Stores list */}
            <Card>
              <CardHeader className="border-b border-border pb-3.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Branches & Outlets</CardTitle>
                  <span className="text-xs text-muted-foreground">{data.stores.length} branches</span>
                </div>
              </CardHeader>
              <div className="divide-y divide-border max-h-80 overflow-y-auto">
                {data.stores.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="font-medium text-foreground">{s.name}</span>
                    {s.isActive ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge tone="muted">Inactive</Badge>
                    )}
                  </div>
                ))}
                {data.stores.length === 0 && (
                  <p className="p-5 text-center text-sm text-muted-foreground">No branches created yet.</p>
                )}
              </div>
            </Card>

            <DataControls business={data} />
          </div>
        )}

        {tab === 'payments' && <PaymentsTab id={id} />}
        {tab === 'customers' && <CustomersTab id={id} money={money} />}
        {tab === 'sales' && <SalesTab id={id} money={money} />}
        {tab === 'products' && <ProductsTab id={id} money={money} />}
        {tab === 'purchases' && <PurchasesTab id={id} money={money} />}
        {tab === 'shifts' && <ShiftsTab id={id} money={money} />}
        {tab === 'activity' && <ActivityTab id={id} />}
        {tab === 'notes' && <NotesTab id={id} />}
        {tab === 'support' && <SupportTab id={id} />}
      </div>

      {/* Edit Business Modal */}
      {editing && (
        <EditBusinessModal
          business={data}
          onClose={() => setEditing(false)}
          onSaved={() => {
            invalidate();
            setEditing(false);
            toast('Business details updated', 'success');
          }}
        />
      )}

      {viewingAs && (
        <ConfirmDialog
          open
          title={`View ${data.name} as its owner?`}
          description="Opens the shop app in a new tab, signed in as the owner for 30 minutes. It is read-only: nothing can be changed. The session is recorded in the admin log."
          confirmLabel="Open read-only view"
          destructive={false}
          loading={impersonate.isPending}
          error={impersonate.error ? <Alert>{apiError(impersonate.error)}</Alert> : null}
          onConfirm={() => {
            // Opened now, on the click, or the browser treats it as a popup.
            // Cut off from this page: the shop app has no business reaching
            // back into the admin panel.
            const tab = window.open('about:blank', '_blank');
            if (tab) tab.opener = null;
            impersonate.mutate(tab);
          }}
          onCancel={() => {
            setViewingAs(false);
            impersonate.reset();
          }}
        />
      )}

      {/* Suspend Confirmation Dialog */}
      {confirmSuspend === 'suspend' && (
        <ConfirmDialog
          open={true}
          title={`Suspend ${data.name}`}
          description="Users of this business will be locked out until you reactivate it. They will see this reason when attempting to log in."
          confirmLabel="Suspend Business"
          destructive={true}
          loading={suspend.isPending}
          disabled={reason.trim().length === 0}
          error={suspend.error ? <Alert>{apiError(suspend.error)}</Alert> : null}
          onConfirm={() => suspend.mutate({ isSuspended: true, reason: reason.trim() })}
          onCancel={() => {
            setConfirmSuspend(null);
            setReason('');
            suspend.reset();
          }}
        >
          <Field label="Reason for suspension">
            <Textarea
              rows={3}
              maxLength={300}
              autoFocus
              placeholder="e.g. Unpaid subscription balance or terms violation."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </ConfirmDialog>
      )}

      {/* Reactivate Confirmation Dialog */}
      {confirmSuspend === 'reactivate' && (
        <ConfirmDialog
          open={true}
          title={`Reactivate ${data.name}`}
          description="Store users will immediately regain access to POS, dashboard, and inventory management."
          confirmLabel="Reactivate Business"
          destructive={false}
          loading={suspend.isPending}
          error={suspend.error ? <Alert>{apiError(suspend.error)}</Alert> : null}
          onConfirm={() => suspend.mutate({ isSuspended: false })}
          onCancel={() => {
            setConfirmSuspend(null);
            suspend.reset();
          }}
        />
      )}
    </div>
  );
}

function MiniCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground/60" />
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight text-foreground">{value}</p>
    </Card>
  );
}

function SubscriptionControl({
  isSubscribed,
  subscribedTo,
  pending,
  error,
  onSave,
}: {
  isSubscribed: boolean;
  subscribedTo: string | null;
  pending: boolean;
  error: unknown;
  onSave: (isSubscribed: boolean, subscribedTo: string | null) => void;
}) {
  const [date, setDate] = useState(subscribedTo ? subscribedTo.slice(0, 10) : '');

  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full max-w-xs">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            License Expiration Date (Optional)
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">Leave empty for lifetime / continuous access.</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="primary"
            loading={pending}
            onClick={() => onSave(true, date || null)}
          >
            {isSubscribed ? 'Update License Expiry' : 'Activate Subscription'}
          </Button>
          {isSubscribed && (
            <Button
              variant="destructive"
              loading={pending}
              onClick={() => onSave(false, null)}
            >
              Deactivate
            </Button>
          )}
        </div>
      </div>
      {error != null && <Alert>{apiError(error)}</Alert>}
    </div>
  );
}

function EditBusinessModal({
  business,
  onClose,
  onSaved,
}: {
  business: BusinessDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<UpdateBusinessInput>({
    name: business.name,
    type: business.type,
    salesModel: business.salesModel,
    currency: business.currency,
    taxId: business.taxId ?? '',
  });

  const save = useMutation({
    mutationFn: (dto: UpdateBusinessInput) => AdminApi.updateBusiness(business.id, dto),
    onSuccess: onSaved,
  });

  const set = <K extends keyof UpdateBusinessInput>(key: K, value: UpdateBusinessInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog open={true} onClose={onClose} title="Edit Business Profile">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({
            ...form,
            currency: form.currency?.toUpperCase(),
            taxId: form.taxId?.trim() ?? '',
          });
        }}
      >
        <Field label="Business Name">
          <Input
            required
            minLength={2}
            value={form.name ?? ''}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Business Type">
            <Select value={form.type} onChange={(e) => set('type', e.target.value as BusinessType)}>
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Sales Model">
            <Select
              value={form.salesModel}
              onChange={(e) => set('salesModel', e.target.value as SalesModel)}
            >
              {SALES_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Currency Code">
            <Input
              required
              minLength={3}
              maxLength={3}
              className="uppercase"
              value={form.currency ?? ''}
              onChange={(e) => set('currency', e.target.value)}
            />
          </Field>

          <Field label="PAN / Tax ID">
            <Input
              value={form.taxId ?? ''}
              placeholder="e.g. 123456789"
              onChange={(e) => set('taxId', e.target.value)}
            />
          </Field>
        </div>

        {save.error != null && <Alert>{apiError(save.error)}</Alert>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            Save Changes
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function CustomersTab({ id, money }: { id: string; money: (v: number | string) => string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-business-customers', id, page],
    queryFn: () => AdminApi.customers(id, { page, limit: 20 }),
  });

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <Spinner className="py-12" />;
  if (data.data.length === 0) return <EmptyState icon={Users} title="No customers registered for this business" />;

  return (
    <div className="space-y-4">
      <Table>
        <THead>
          <tr>
            <TH>Name</TH>
            <TH>Contact</TH>
            <TH className="text-right">Orders</TH>
            <TH className="text-right">Credit Balance</TH>
            <TH>Joined Date</TH>
          </tr>
        </THead>
        <TBody>
          {data.data.map((c) => (
            <TR key={c.id}>
              <TD className="font-semibold text-foreground">{c.name}</TD>
              <TD className="text-muted-foreground">{c.phone || c.email || '—'}</TD>
              <TD className="text-right font-medium">{c._count.sales}</TD>
              <TD className="text-right">
                {Number(c.creditBalance) > 0 ? (
                  <span className="font-semibold text-warning">{money(c.creditBalance)}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TD>
              <TD className="whitespace-nowrap text-muted-foreground">{formatDate(c.createdAt)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Pagination page={data.meta.page} pages={data.meta.pages} onPage={setPage} />
    </div>
  );
}

function SalesTab({ id, money }: { id: string; money: (v: number | string) => string }) {
  const [page, setPage] = useState(1);
  const [openSale, setOpenSale] = useState<AdminSaleRow | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-business-sales', id, page],
    queryFn: () => AdminApi.sales(id, { page, limit: 20 }),
  });

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <Spinner className="py-12" />;
  if (data.data.length === 0) return <EmptyState icon={ShoppingCart} title="No sales recorded for this business" />;

  return (
    <>
      <div className="space-y-4">
        <Table>
          <THead>
            <tr>
              <TH>Receipt #</TH>
              <TH>Date</TH>
              <TH>Customer</TH>
              <TH>Cashier</TH>
              <TH className="text-right">Items</TH>
              <TH>Payment</TH>
              <TH className="text-right">Total</TH>
            </tr>
          </THead>
          <TBody>
            {data.data.map((s) => (
              <TR
                key={s.id}
                className="cursor-pointer"
                onClick={() => setOpenSale(s)}
              >
                <TD className="font-semibold text-primary hover:underline">{s.receiptNo}</TD>
                <TD className="whitespace-nowrap text-muted-foreground">{formatDate(s.createdAt)}</TD>
                <TD>{s.customer?.name ?? 'Walk-in Customer'}</TD>
                <TD className="text-muted-foreground">{s.user?.name ?? '—'}</TD>
                <TD className="text-right font-medium">{s._count.items}</TD>
                <TD>
                  <Badge tone="muted" className="capitalize">{s.paymentMethod.toLowerCase()}</Badge>
                </TD>
                <TD className="text-right font-bold text-foreground">{money(s.total)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <Pagination page={data.meta.page} pages={data.meta.pages} onPage={setPage} />
      </div>

      {openSale && (
        <SaleModal
          id={id}
          saleId={openSale.id}
          money={money}
          onClose={() => setOpenSale(null)}
        />
      )}
    </>
  );
}

function SaleModal({
  id,
  saleId,
  money,
  onClose,
}: {
  id: string;
  saleId: string;
  money: (v: number | string) => string;
  onClose: () => void;
}) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-sale', id, saleId],
    queryFn: () => AdminApi.sale(id, saleId),
  });

  return (
    <Dialog open={true} onClose={onClose} title={data?.receiptNo ? `Receipt ${data.receiptNo}` : 'Sale Receipt'}>
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Spinner className="py-12" />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <p>
              <strong className="text-foreground">Date:</strong> {formatDateTime(data.createdAt)}
            </p>
            <p>
              <strong className="text-foreground">Customer:</strong> {data.customer?.name ?? 'Walk-in Customer'}
            </p>
            <p>
              <strong className="text-foreground">Cashier:</strong> {data.user?.name ?? '—'}
              {data.store?.name ? ` · Branch: ${data.store.name}` : ''}
            </p>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-3 py-2">
                      <span className="font-medium text-foreground">{it.name}</span>
                      {Number(it.returnedQty) > 0 && (
                        <span className="ml-1.5 text-destructive">
                          (−{Number(it.returnedQty)} returned)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{Number(it.quantity)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{money(it.unitPrice)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{money(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5 border-t border-border pt-3 text-sm">
            <div className="flex justify-between text-muted-foreground text-xs">
              <span>Subtotal</span>
              <span>{money(data.subtotal)}</span>
            </div>
            {Number(data.discount) > 0 && (
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Discount</span>
                <span>-{money(data.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground text-xs">
              <span>Tax</span>
              <span>{money(data.tax)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border text-base font-bold text-foreground">
              <span>Total</span>
              <span className="text-primary">{money(data.total)}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </div>
      )}
    </Dialog>
  );
}

function ActivityTab({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-business-activity', id, page],
    queryFn: () => AdminApi.activity(id, { page, limit: 25 }),
  });

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <Spinner className="py-12" />;
  if (data.data.length === 0) return <EmptyState title="No activity recorded for this business" />;

  return (
    <div className="space-y-4">
      <Table>
        <THead>
          <tr>
            <TH>Timestamp</TH>
            <TH>Staff User</TH>
            <TH>Action</TH>
            <TH>Details</TH>
          </tr>
        </THead>
        <TBody>
          {data.data.map((e) => (
            <TR key={e.id}>
              <TD className="whitespace-nowrap text-muted-foreground text-xs">
                {formatDateTime(e.createdAt)}
              </TD>
              <TD>
                <span className="font-medium text-foreground">{e.user?.name ?? e.userName ?? 'Unknown'}</span>
                {e.user?.role && <span className="text-xs text-muted-foreground ml-1.5">({e.user.role})</span>}
              </TD>
              <TD>
                <Badge tone="primary">{e.action}</Badge>
              </TD>
              <TD className="text-muted-foreground text-xs">
                {e.summary || `${e.entity ?? ''} ${e.entityId ? '#' + e.entityId.slice(0, 8) : ''}`.trim() || '—'}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Pagination page={data.meta.page} pages={data.meta.pages} onPage={setPage} />
    </div>
  );
}
