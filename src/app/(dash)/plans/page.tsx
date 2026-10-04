'use client';
import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, Eye, Layers, LayoutList, Pencil, ReceiptText, Wallet } from 'lucide-react';
import { AdminApi, apiError, type PlatformSettings } from '@/lib/api';
import { useCanEdit } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner, ErrorState, PageHeader, Alert } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { OwnerPreview, PlansEditor, cleanPlans, toDrafts, type PlanDraft } from './plans-editor';
import { OnlinePaymentsStatus, PayByHandSettings, ReceiptSettings } from '@/components/settings/sections';
import { Tabs as TabBar } from '@/components/ui/tabs';

/**
 * Plans & billing: what shops pay for, how they can pay, and what their
 * receipts say -- with a checklist of what's set up and what isn't, and how a
 * payment goes, so it reads without knowing the code behind it.
 */
export default function PlansPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => AdminApi.settings(),
  });

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Plans & billing"
        description="What shop owners pay you for, how they can pay, and what their receipts say."
      />
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Spinner className="py-20" />
      ) : (
        <Tabs s={data} />
      )}
    </div>
  );
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutList },
  { id: 'plans', label: 'Plans', icon: Layers },
  { id: 'payments', label: 'Payment methods', icon: Wallet },
  { id: 'receipts', label: 'Receipts', icon: ReceiptText },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** The open tab lives in the URL's #hash: links (the checklist's Fix) can open one, and a reload keeps it. */
const onHash = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const hashTab = (): TabId => {
  const h = window.location.hash.slice(1);
  return TABS.some((t) => t.id === h) ? (h as TabId) : 'overview';
};

/**
 * One part of billing at a time. Every tab stays mounted and is only hidden,
 * so unsaved plan edits survive a look at another tab.
 */
function Tabs({ s }: { s: PlatformSettings }) {
  const tab = useSyncExternalStore(onHash, hashTab, () => 'overview' as TabId);
  // A dot on a tab that has something to sort out, matching the checklist.
  const needs: Record<TabId, boolean> = {
    overview: false,
    plans: !(s.plans?.length ?? 0),
    payments: !s.onlineGateways.some((g) => !g.test) || !(s.paymentMethods?.length ?? 0),
    receipts: !s.billingName,
  };
  const panel = (id: TabId) => cn('space-y-6', tab !== id && 'hidden');
  return (
    <div>
      <TabBar
        className="mb-6"
        label="Plans and billing"
        items={TABS.map((t) => ({
          id: t.id,
          label: t.label,
          icon: t.icon,
          extra: needs[t.id] ? <span className="h-2 w-2 rounded-full bg-warning" aria-label="needs attention" /> : null,
        }))}
        value={tab}
        // The tab lives in the #hash (see above), so set that and let it follow.
        onChange={(id) => {
          window.location.hash = id;
        }}
      />

      <div role="tabpanel" className={panel('overview')}>
        <SetupChecklist s={s} />
        <HowPaymentWorks />
      </div>

      {/* Each part keyed on its own saved fields: saving one resets it and
          leaves unsaved edits in the others alone. */}
      <div role="tabpanel" className={panel('plans')}>
        <PlansSection key={JSON.stringify(s.plans)} settings={s} />
      </div>

      <div role="tabpanel" className={panel('payments')}>
        <TabIntro text="Online wallets confirm payments by themselves. For everyone else (and shops paying in dollars), list where to send money: they then tap “I’ve paid” and it waits in Payments to confirm." />
        <OnlinePaymentsStatus settings={s} />
        <PayByHandSettings key={JSON.stringify([s.paymentMethods, s.paymentInstructions])} settings={s} />
      </div>

      <div role="tabpanel" className={panel('receipts')}>
        <TabIntro text="Every payment gets a numbered receipt, emailed to the owner and printable from their Subscription page. This is who it says was paid." />
        <ReceiptSettings
          key={JSON.stringify([s.billingName, s.billingTaxId, s.billingAddress, s.billingPhone, s.billingEmail])}
          settings={s}
        />
      </div>
    </div>
  );
}

function TabIntro({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

type Check = { state: 'done' | 'warn' | 'todo'; title: string; detail: string; href: string };

/** What's ready and what isn't, each with a link to the part of the page that fixes it. */
function SetupChecklist({ s }: { s: PlatformSettings }) {
  const plans = s.plans?.length ?? 0;
  const live = s.onlineGateways.filter((g) => !g.test);
  const test = s.onlineGateways.filter((g) => g.test);
  const methods = s.paymentMethods?.length ?? 0;
  const checks: Check[] = [
    plans
      ? { state: 'done', title: `${plans} plan${plans === 1 ? '' : 's'} for owners to choose from`, detail: 'Owners see them on their Subscription page.', href: '#plans' }
      : { state: 'todo', title: 'No plans yet', detail: 'Owners can’t subscribe or pay online until you add one.', href: '#plans' },
    live.length
      ? {
          state: 'done',
          title: `Online payments live: ${live.map((g) => g.label).join(', ')}`,
          detail: 'Payments confirm themselves and extend the subscription at once.',
          href: '#payments',
        }
      : test.length
        ? {
            state: 'warn',
            title: `Online payments in test mode: ${test.map((g) => g.label).join(', ')}`,
            detail: 'No real money moves. Put live merchant keys on the server before real shops pay.',
            href: '#payments',
          }
        : { state: 'todo', title: 'No online payments', detail: 'Owners can only pay by hand until a wallet is set up on the server.', href: '#payments' },
    methods
      ? { state: 'done', title: `${methods} way${methods === 1 ? '' : 's'} to pay by hand`, detail: 'Accounts and QR codes owners can send money to.', href: '#payments' }
      : {
          state: 'warn',
          title: 'No accounts or QR codes for paying by hand',
          detail: 'Owners who can’t pay online (or pay in dollars) won’t know where to send money.',
          href: '#payments',
        },
    s.billingName
      ? { state: 'done', title: `Receipts issued by ${s.billingName}`, detail: 'Your business details print on every receipt.', href: '#receipts' }
      : { state: 'warn', title: 'Receipts don’t name your business', detail: 'Add your business name and PAN so receipts are proper bills.', href: '#receipts' },
  ];
  const left = checks.filter((c) => c.state !== 'done').length;
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold">Setup checklist</h2>
        <span className={cn('text-xs font-medium', left ? 'text-warning' : 'text-success')}>
          {left ? `${left} thing${left === 1 ? '' : 's'} to look at` : 'All set'}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {checks.map((c) => (
          <li key={c.title}>
            <a href={c.href} className="group -mx-3 flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-primary/10">
              {c.state === 'done' ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              ) : c.state === 'warn' ? (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              ) : (
                <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{c.title}</span>
                <span className="block text-xs text-muted-foreground">{c.detail}</span>
              </span>
              <span className="shrink-0 text-xs font-medium text-primary opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100">
                {c.state === 'done' ? 'View' : 'Fix'} <ArrowRight className="inline h-3 w-3" />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** What happens between an owner choosing a plan and the money being counted. */
function HowPaymentWorks() {
  const steps = [
    {
      title: 'Owner picks a plan',
      text: 'On their Subscription page: a plan, and 1 month, 3 months or a year.',
    },
    {
      title: 'They pay',
      text: (
        <>
          <b>Online</b> (eSewa, Khalti, connectIPS): confirmed by itself.
          <br />
          <b>By hand</b> (QR, bank, cash): they tap “I’ve paid”, and you check it in{' '}
          <Link href="/payment-claims" className="text-primary hover:underline">
            Payments to confirm
          </Link>
          .
        </>
      ),
    },
    {
      title: 'Done',
      text: 'The paid-until date moves on, the shop moves onto the plan (its branch limit applies), and the receipt is emailed.',
    },
  ];
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">How a shop pays you</h2>
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((st, i) => (
          <li key={st.title} className="rounded-lg border border-border bg-card p-4 transition-all duration-150 hover:-translate-y-1 hover:border-primary hover:bg-primary/5 hover:shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Step {i + 1}</p>
            <p className="mt-1 font-medium">{st.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{st.text}</p>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        To move one shop to another plan yourself (a deal by phone, say): <Link href="/businesses" className="text-primary hover:underline">Businesses</Link> → the shop →
        Overview → Change plan. Shops in NPR see NPR prices; shops in any other currency see the dollar prices where you set them.
      </p>
    </section>
  );
}

function PlansSection({ settings }: { settings: PlatformSettings }) {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const canEdit = useCanEdit();
  const [drafts, setDrafts] = useState<PlanDraft[]>(() => toDrafts(settings.plans));
  const [preview, setPreview] = useState(false);
  const { plans, error } = cleanPlans(drafts);
  // Against the saved plans read the same way, so ones saved before a field existed don't count as edited.
  const changed = JSON.stringify(plans) !== JSON.stringify(cleanPlans(toDrafts(settings.plans)).plans);

  const save = useMutation({
    mutationFn: () => AdminApi.updateSettings({ plans: plans.length ? plans : null }),
    onSuccess: (next) => {
      qc.setQueryData(['admin-settings'], next);
      toast('Plans saved. Owners see them now.');
    },
    onError: (e) => toast(apiError(e), 'error'),
  });

  const unplanned = settings.planUsage?.none ?? 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TabIntro text="What owners choose from. Each has a branch limit and a price for each length you sell. Edit one to change it; save when you're done." />
        <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
          <button
            type="button"
            onClick={() => setPreview(false)}
            className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5', !preview && 'bg-primary text-primary-foreground')}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={() => setPreview(true)}
            className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5', preview && 'bg-primary text-primary-foreground')}
          >
            <Eye className="h-3.5 w-3.5" /> As owners see it
          </button>
        </div>
      </div>

      {!canEdit && <Alert>Support accounts can see the plans but not change them.</Alert>}
      {unplanned > 0 && (
        <p className="text-xs text-muted-foreground">
          {unplanned} shop{unplanned === 1 ? ' is' : 's are'} on no plan yet (on a trial, or paid before plans existed): no branch
          limit until they pay for one.
        </p>
      )}

      {preview ? (
        <Card className="p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            A shop in NPR sees this on its Subscription page, including changes you haven&apos;t saved yet.
          </p>
          <OwnerPreview drafts={drafts} />
        </Card>
      ) : (
        <PlansEditor drafts={drafts} setDrafts={setDrafts} canEdit={canEdit} usage={settings.planUsage ?? {}} />
      )}

      {canEdit && (changed || error) && (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 rounded-lg border border-border bg-background/95 p-3 shadow-sm backdrop-blur">
          <p className={cn('mr-auto text-sm', error ? 'text-destructive' : 'text-muted-foreground')}>
            {error ?? 'You have unsaved changes to the plans. Owners see them once you save.'}
          </p>
          <Button variant="outline" disabled={save.isPending} onClick={() => setDrafts(toDrafts(settings.plans))}>
            Discard changes
          </Button>
          <Button loading={save.isPending} disabled={!changed || !!error} onClick={() => save.mutate()}>
            Save plans
          </Button>
        </div>
      )}
    </section>
  );
}
