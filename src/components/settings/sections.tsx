'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ImageUp, Plus, Settings2, Trash2 } from 'lucide-react';
import {
  AdminApi,
  BILLING_FIELDS,
  apiError,
  PAYMENT_METHOD_LABELS,
  type PaymentMethodSetting,
  type PlatformSettings,
  type UpdateSettingsInput,
} from '@/lib/api';
import { useAuth, useCanEdit } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/label';
import { Input, Textarea } from '@/components/ui/input';
import { Alert, Spinner } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatDateTime } from '@/lib/utils';

/*
 * The platform settings, each shown on the page for the feature it controls
 * (sign-ups on Onboarding, the maintenance banner on Announcements, ...),
 * rather than all together on one Settings page. They share one settings
 * record and one cache entry; each section saves only its own fields.
 */

export function useSettings() {
  return useQuery({ queryKey: ['admin-settings'], queryFn: () => AdminApi.settings() });
}

function useSaveSettings() {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  return useMutation({
    mutationFn: (changes: UpdateSettingsInput) => AdminApi.updateSettings(changes),
    onSuccess: (next) => {
      qc.setQueryData(['admin-settings'], next);
      toast('Saved');
    },
    onError: (e) => toast(apiError(e), 'error'),
  });
}

/**
 * A page's settings, folded to one line that says how things stand; open
 * to change them. Loads the settings itself, so a page just drops it in.
 */
function SettingsPanel({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary: (s: PlatformSettings) => string;
  children: (s: PlatformSettings) => React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { data } = useSettings();
  return (
    <Card className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
      >
        <Settings2 className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{data ? summary(data) : 'Loading…'}</span>
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border px-5 py-4">
          {/* Keyed on the saved version, so the form resets to what was stored. */}
          {data ? <div key={data.updatedAt}>{children(data)}</div> : <Spinner className="py-6" />}
        </div>
      )}
    </Card>
  );
}

/** Save button, disabled until something changed; who changed the settings last. */
function SaveRow({
  dirty,
  error,
  pending,
  onSave,
  settings,
}: {
  dirty: boolean;
  error?: string;
  pending: boolean;
  onSave: () => void;
  settings: PlatformSettings;
}) {
  const canEdit = useCanEdit();
  if (!canEdit) return <p className="mt-4 text-xs text-muted-foreground">Support accounts can see this but not change it.</p>;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button size="sm" loading={pending} disabled={!dirty || !!error} onClick={onSave}>
        Save
      </Button>
      {settings.updatedBy && (
        <span className="text-xs text-muted-foreground">
          Settings last changed by {settings.updatedBy}, {formatDateTime(settings.updatedAt)}
        </span>
      )}
    </div>
  );
}

/** Digits only, or null for an empty box. */
const toDays = (v: string) => (v.trim() === '' ? null : Number(v));

// ---- Onboarding: sign-ups and the trial ----

export function SignupSettings() {
  return (
    <SettingsPanel
      title="Sign-ups and free trial"
      summary={(s) =>
        `${s.signupOpen ? 'Anyone can sign up' : 'Invite only'} · ${s.trialDays ?? s.envTrialDays}-day free trial${s.trialDays == null ? ' (server default)' : ''}`
      }
    >
      {(s) => <SignupForm settings={s} />}
    </SettingsPanel>
  );
}

function SignupForm({ settings }: { settings: PlatformSettings }) {
  const canEdit = useCanEdit();
  const save = useSaveSettings();
  const [signupOpen, setSignupOpen] = useState(settings.signupOpen);
  const [trialDays, setTrialDays] = useState(settings.trialDays?.toString() ?? '');
  const trial = toDays(trialDays);
  const error =
    trial !== null && (!Number.isInteger(trial) || trial < 0 || trial > 365) ? 'A whole number from 0 to 365' : undefined;
  const changes: UpdateSettingsInput = {
    ...(signupOpen !== settings.signupOpen ? { signupOpen } : {}),
    ...(trial !== settings.trialDays ? { trialDays: trial } : {}),
  };
  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 accent-primary"
          checked={signupOpen}
          disabled={!canEdit}
          onChange={(e) => setSignupOpen(e.target.checked)}
        />
        <span>
          <span className="block font-medium">Anyone can sign up</span>
          <span className="text-sm text-muted-foreground">
            Off makes it invite-only: the app&apos;s register form is closed, and you create shops from Businesses → New
            business.
          </span>
        </span>
      </label>
      <Field label="Free trial (days)" error={error}>
        <Input
          inputMode="numeric"
          className="max-w-[10rem]"
          placeholder={`${settings.envTrialDays} (default)`}
          value={trialDays}
          disabled={!canEdit}
          onChange={(e) => setTrialDays(e.target.value.replace(/[^\d]/g, ''))}
        />
      </Field>
      <p className="-mt-2 text-xs text-muted-foreground">
        For new signups only. Empty uses the server default ({settings.envTrialDays} days).
      </p>
      <SaveRow
        dirty={Object.keys(changes).length > 0}
        error={error}
        pending={save.isPending}
        onSave={() => save.mutate(changes)}
        settings={settings}
      />
    </div>
  );
}

// ---- Announcements: maintenance mode and the maintenance banner ----

export function MaintenanceBannerSettings() {
  return (
    <SettingsPanel
      title="Maintenance"
      summary={(s) =>
        [
          s.maintenanceMode ? 'Shop app CLOSED for maintenance' : 'Shop app open',
          s.maintenanceMessage ? `banner: “${s.maintenanceMessage}”` : 'no banner',
        ].join(' · ')
      }
    >
      {(s) => <MaintenanceForm settings={s} />}
    </SettingsPanel>
  );
}

function MaintenanceForm({ settings }: { settings: PlatformSettings }) {
  const canEdit = useCanEdit();
  const save = useSaveSettings();
  const [banner, setBanner] = useState(settings.maintenanceMessage ?? '');
  const [closing, setClosing] = useState(false);
  const next = banner.trim() || null;
  const on = settings.maintenanceMode;
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-foreground">Maintenance mode</h3>
        <div
          className={`mt-2 rounded-md border p-3 text-sm ${on ? 'border-destructive/40 bg-destructive/10' : 'border-border bg-muted/40'}`}
        >
          <p className="font-medium text-foreground">
            {on ? 'On: the shop app is closed.' : 'Off: the shop app is open.'}
          </p>
          <p className="mt-1 text-muted-foreground">
            {on
              ? 'Shops see a “Down for maintenance” screen and can’t sign in or save anything. This panel keeps working, and so does “view as owner”. Ending it opens the app again within a minute.'
              : 'Turning it on closes the shop app for everyone: no signing in, no sales, nothing saved, until you end it. Use it while you update the server or the database.'}
          </p>
          {canEdit && (
            <div className="mt-3">
              {on ? (
                <Button size="sm" loading={save.isPending} onClick={() => save.mutate({ maintenanceMode: false })}>
                  End maintenance
                </Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={() => setClosing(true)}>
                  Turn on maintenance mode
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-foreground">Banner</h3>
        <p className="mb-3 mt-1 text-sm text-muted-foreground">
          Shown across the top of the shop app, including its sign-in page, until you remove it. Unlike an announcement it
          can&apos;t be dismissed. While maintenance mode is on it&apos;s the message on the maintenance screen, so say when
          you&apos;ll be back.
        </p>
        <Field label="Message">
          <Textarea
            rows={3}
            maxLength={500}
            placeholder="e.g. The app will be down 22:00–22:15 tonight for an update."
            value={banner}
            disabled={!canEdit}
            onChange={(e) => setBanner(e.target.value)}
          />
        </Field>
        <p className="mt-1 text-xs text-muted-foreground">Empty means no banner. Shops see a change within a minute.</p>
        <SaveRow
          dirty={next !== settings.maintenanceMessage}
          pending={save.isPending}
          onSave={() => save.mutate({ maintenanceMessage: next })}
          settings={settings}
        />
        {canEdit && settings.maintenanceMessage && (
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            disabled={save.isPending}
            onClick={() => save.mutate({ maintenanceMessage: null })}
          >
            Remove banner
          </Button>
        )}
      </section>

      {closing && (
        <ConfirmDialog
          open
          title="Close the shop app for maintenance?"
          description="Every shop is stopped within a minute: open tabs switch to the maintenance screen, and no one can sign in or save anything until you end it here."
          confirmLabel="Turn on"
          loading={save.isPending}
          onConfirm={() => save.mutate({ maintenanceMode: true }, { onSettled: () => setClosing(false) })}
          onCancel={() => setClosing(false)}
        />
      )}
    </div>
  );
}

// ---- Activity Log: how long it is kept ----

export function RetentionSettings() {
  return (
    <SettingsPanel
      title="How long the activity log is kept"
      summary={(s) =>
        `${s.auditRetentionDays == null ? 'Kept forever' : `Kept ${s.auditRetentionDays} days`} · ${s.activityLog.total.toLocaleString()} entries`
      }
    >
      {(s) => <RetentionForm settings={s} />}
    </SettingsPanel>
  );
}

function RetentionForm({ settings }: { settings: PlatformSettings }) {
  const canEdit = useCanEdit();
  const save = useSaveSettings();
  const [retention, setRetention] = useState(settings.auditRetentionDays?.toString() ?? '');
  const keep = toDays(retention);
  const error =
    keep !== null && (!Number.isInteger(keep) || keep < 30 || keep > 3650) ? 'A whole number from 30 to 3650' : undefined;
  const { activityLog } = settings;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Each shop&apos;s activity log grows forever unless you set a limit. The admin log is always kept.
      </p>
      <Field label="Keep entries for (days)" error={error}>
        <Input
          inputMode="numeric"
          className="max-w-[10rem]"
          placeholder="Forever"
          value={retention}
          disabled={!canEdit}
          onChange={(e) => setRetention(e.target.value.replace(/[^\d]/g, ''))}
        />
      </Field>
      <p className="text-sm text-muted-foreground">
        {activityLog.total.toLocaleString()} entries
        {activityLog.oldestAt ? `, the oldest from ${formatDateTime(activityLog.oldestAt)}` : ''}.
        {settings.auditRetentionDays != null &&
          ` ${activityLog.dueForRemoval.toLocaleString()} are older than ${settings.auditRetentionDays} days and go at the next nightly run.`}
      </p>
      {keep !== null && !error && keep !== settings.auditRetentionDays && (
        <Alert>Entries older than {keep} days are deleted for good at the next nightly run (03:30).</Alert>
      )}
      <SaveRow
        dirty={keep !== settings.auditRetentionDays}
        error={error}
        pending={save.isPending}
        onSave={() => save.mutate({ auditRetentionDays: keep })}
        settings={settings}
      />
    </div>
  );
}

// ---- Admins: two-factor for everyone, and the daily summary ----

export function AdminSettings() {
  return (
    <SettingsPanel
      title="Admin security and daily summary"
      summary={(s) =>
        `Two-factor ${s.requireAdminTwoFactor ? 'required' : 'optional'} · Daily summary email ${s.adminDigestEnabled ? 'on' : 'off'}`
      }
    >
      {(s) => <AdminForm settings={s} />}
    </SettingsPanel>
  );
}

function AdminForm({ settings }: { settings: PlatformSettings }) {
  const canEdit = useCanEdit();
  const { show: toast } = useToast();
  const save = useSaveSettings();
  const { admin } = useAuth();
  const myTwoFactor = !!admin?.twoFactorEnabled;
  const [require2fa, setRequire2fa] = useState(settings.requireAdminTwoFactor);
  const [digestOn, setDigestOn] = useState(settings.adminDigestEnabled);
  const sendDigest = useMutation({
    mutationFn: () => AdminApi.sendDigestToMe(),
    onSuccess: (r) => toast(`Sent to ${r.sentTo}`),
    onError: (e) => toast(apiError(e), 'error'),
  });
  const changes: UpdateSettingsInput = {
    ...(require2fa !== settings.requireAdminTwoFactor ? { requireAdminTwoFactor: require2fa } : {}),
    ...(digestOn !== settings.adminDigestEnabled ? { adminDigestEnabled: digestOn } : {}),
  };
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-primary"
            checked={require2fa}
            // Turning it on from an account without two-factor would lock
            // this admin out; the API refuses it too.
            disabled={!canEdit || (!settings.requireAdminTwoFactor && !myTwoFactor)}
            onChange={(e) => setRequire2fa(e.target.checked)}
          />
          <span>
            <span className="block font-medium">Require two-factor sign-in for all admins</span>
            <span className="text-sm text-muted-foreground">
              Every admin can see every shop&apos;s data. Admins without two-factor can only open their Account page, to
              set it up, until they have.
            </span>
          </span>
        </label>
        {!settings.requireAdminTwoFactor && !myTwoFactor && (
          <p className="text-xs text-muted-foreground">
            Turn on two-factor for your own account first (<Link href="/account" className="text-primary hover:underline">Account</Link>).
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-primary"
            checked={digestOn}
            disabled={!canEdit}
            onChange={(e) => setDigestOn(e.target.checked)}
          />
          <span>
            <span className="block font-medium">Send the daily summary email</span>
            <span className="text-sm text-muted-foreground">
              Every morning at 08:00 Nepal time, each full admin gets one email: payments to confirm, subscriptions
              ending this week, shops locked since yesterday, and support tickets waiting. Nothing is sent on a day
              with none of those.
            </span>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-3 pl-8">
          {canEdit && (
            <Button type="button" variant="outline" size="sm" loading={sendDigest.isPending} onClick={() => sendDigest.mutate()}>
              Send me one now
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {settings.adminDigestSentOn ? `Last sent ${settings.adminDigestSentOn}.` : 'Not sent yet.'} &quot;Send me one
            now&quot; goes only to you, with today&apos;s figures.
          </span>
        </div>
      </div>
      <SaveRow
        dirty={Object.keys(changes).length > 0}
        pending={save.isPending}
        onSave={() => save.mutate(changes)}
        settings={settings}
      />
    </div>
  );
}

// ---- Plans & billing: online payments, paying by hand, receipts ----

/** Which gateways the server has keys for. Read only: keys live in its environment. */
export function OnlinePaymentsStatus({ settings }: { settings: PlatformSettings }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Online payments</CardTitle>
        <CardDescription>
          eSewa, Khalti and connectIPS (straight from a bank account), in rupees. The subscription is extended, and the
          shop moved onto its plan, as soon as a payment goes through, with the receipt emailed: nothing to confirm.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {(['ESEWA', 'KHALTI', 'CONNECTIPS'] as const).map((id) => {
            const g = settings.onlineGateways.find((x) => x.id === id);
            return (
              <span
                key={id}
                className={
                  g
                    ? g.test
                      ? 'rounded-full bg-warning/15 px-2.5 py-1 font-medium text-warning'
                      : 'rounded-full bg-success/15 px-2.5 py-1 font-medium text-success'
                    : 'rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground'
                }
              >
                {PAYMENT_METHOD_LABELS[id]}: {g ? (g.test ? 'test mode (no real money)' : 'live') : 'not set up'}
              </span>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          A gateway is switched on with its merchant keys in the API server&apos;s environment (ESEWA_*, KHALTI_SECRET_KEY
          or CONNECTIPS_*; see .env.example), not here.
        </p>
      </CardContent>
    </Card>
  );
}

/** How shops pay by hand: accounts and QR codes to send money to, and what to write. */
export function PayByHandSettings({ settings }: { settings: PlatformSettings }) {
  const canEdit = useCanEdit();
  const save = useSaveSettings();
  const [instructions, setInstructions] = useState(settings.paymentInstructions ?? '');
  const [methods, setMethods] = useState<PaymentMethodSetting[]>(settings.paymentMethods ?? []);
  const clean = methods.map((m) => ({ label: m.label.trim(), details: m.details.trim(), qrUrl: m.qrUrl || null }));
  const error = clean.some((m) => !m.label) ? 'Every payment method needs a name' : undefined;
  const changes: UpdateSettingsInput = {
    ...(JSON.stringify(clean) !== JSON.stringify(settings.paymentMethods ?? [])
      ? { paymentMethods: clean.length ? clean : null }
      : {}),
    ...((instructions.trim() || null) !== settings.paymentInstructions
      ? { paymentInstructions: instructions.trim() || null }
      : {}),
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Paying by hand</CardTitle>
        <CardDescription>
          Shown to owners under the plans, for paying by QR, bank or cash: where to send the money, and what to write.
          They then tap &quot;I&apos;ve paid&quot;, and it waits in Payments to confirm.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <p className="text-sm font-medium">Payment methods</p>
          {methods.length === 0 && (
            <p className="text-xs text-muted-foreground">
              None yet. Add eSewa, Khalti or your bank account, with a QR code if you have one.
            </p>
          )}
          {methods.map((m, i) => (
            <PaymentMethodRow
              key={i}
              value={m}
              disabled={!canEdit}
              onChange={(next) => setMethods((ms) => ms.map((x, j) => (j === i ? next : x)))}
              onRemove={() => setMethods((ms) => ms.filter((_, j) => j !== i))}
            />
          ))}
          {canEdit && methods.length < 6 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMethods((ms) => [...ms, { label: '', details: '', qrUrl: null }])}
            >
              <Plus className="h-4 w-4" /> Add payment method
            </Button>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <Field label="Instructions">
          <Textarea
            rows={3}
            maxLength={1000}
            placeholder="e.g. Write your shop name in the remarks. We extend your subscription within a working day of payment."
            value={instructions}
            disabled={!canEdit}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </Field>
        <SaveRow
          dirty={Object.keys(changes).length > 0}
          error={error}
          pending={save.isPending}
          onSave={() => save.mutate(changes)}
          settings={settings}
        />
      </CardContent>
    </Card>
  );
}

type BillingField = (typeof BILLING_FIELDS)[number];

const BILLING_FORM: { key: BillingField; label: string; placeholder: string; max: number }[] = [
  { key: 'billingName', label: 'Business name', placeholder: 'e.g. Inventory Cloud Pvt. Ltd.', max: 200 },
  { key: 'billingTaxId', label: 'PAN / VAT number', placeholder: 'e.g. 609876543', max: 50 },
  { key: 'billingAddress', label: 'Address', placeholder: 'e.g. Baneshwor, Kathmandu', max: 300 },
  { key: 'billingPhone', label: 'Phone', placeholder: 'e.g. 01-4XXXXXX', max: 50 },
  { key: 'billingEmail', label: 'Email', placeholder: 'e.g. billing@yourcompany.com', max: 254 },
];

/** Who was paid, printed at the top of every subscription receipt. */
export function ReceiptSettings({ settings }: { settings: PlatformSettings }) {
  const canEdit = useCanEdit();
  const save = useSaveSettings();
  const [billing, setBilling] = useState<Record<BillingField, string>>(
    () => Object.fromEntries(BILLING_FIELDS.map((k) => [k, settings[k] ?? ''])) as Record<BillingField, string>,
  );
  const changes: UpdateSettingsInput = Object.fromEntries(
    BILLING_FIELDS.filter((k) => (billing[k].trim() || null) !== settings[k]).map((k) => [k, billing[k].trim() || null]),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Receipt details</CardTitle>
        <CardDescription>
          Printed at the top of every subscription receipt, as who was paid. Leave a line empty to leave it off.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {BILLING_FORM.map((f) => (
            <Field key={f.key} label={f.label} className={f.key === 'billingAddress' ? 'sm:col-span-2' : undefined}>
              <Input
                maxLength={f.max}
                placeholder={f.placeholder}
                value={billing[f.key]}
                disabled={!canEdit}
                onChange={(e) => setBilling((b) => ({ ...b, [f.key]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
        {!settings.billingName && (
          <p className="mt-3 text-xs text-muted-foreground">
            Without a business name, receipts show only the shop&apos;s details and the payment.
          </p>
        )}
        <SaveRow
          dirty={Object.keys(changes).length > 0}
          pending={save.isPending}
          onSave={() => save.mutate(changes)}
          settings={settings}
        />
      </CardContent>
    </Card>
  );
}

/** One payment method: its name, the details to pay to, and an optional QR code. */
function PaymentMethodRow({
  value,
  disabled,
  onChange,
  onRemove,
}: {
  value: PaymentMethodSetting;
  disabled: boolean;
  onChange: (next: PaymentMethodSetting) => void;
  onRemove: () => void;
}) {
  const { show: toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await AdminApi.uploadPaymentQr(file);
      onChange({ ...value, qrUrl: url });
    } catch (e) {
      toast(apiError(e), 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row">
      <div className="min-w-0 flex-1 space-y-2">
        <Input
          aria-label="Payment method name"
          maxLength={60}
          placeholder="Name, e.g. eSewa, Khalti, Nabil Bank"
          value={value.label}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
        />
        <Textarea
          aria-label="Payment details"
          rows={2}
          maxLength={500}
          placeholder="Details, e.g. eSewa ID 98XXXXXXXX (Inventory Pvt. Ltd.) or Account 0123456789, Nabil Bank, New Road"
          value={value.details}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, details: e.target.value })}
        />
      </div>
      <div className="flex shrink-0 items-start gap-2 sm:flex-col sm:items-end">
        {value.qrUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.qrUrl} alt={`${value.label || 'Payment'} QR code`} className="h-24 w-24 rounded-md border border-border object-contain" />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-border text-center text-[11px] text-muted-foreground">
            No QR code
          </div>
        )}
        {!disabled && (
          <div className="flex flex-wrap gap-1">
            <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-input px-2 text-xs hover:bg-accent">
              <ImageUp className="h-3.5 w-3.5" />
              {uploading ? 'Uploading…' : value.qrUrl ? 'Replace' : 'Add QR'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            {value.qrUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...value, qrUrl: null })}>
                Remove QR
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" aria-label="Remove payment method" onClick={onRemove}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
