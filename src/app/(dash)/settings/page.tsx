'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminApi, apiError, type PlatformSettings, type UpdateSettingsInput } from '@/lib/api';
import { useCanEdit } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/label';
import { Input, Textarea } from '@/components/ui/input';
import { Spinner, ErrorState, PageHeader, Alert } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { formatDateTime } from '@/lib/utils';

/**
 * Platform-wide settings: trial length, open or invite-only signup, the shop
 * app's maintenance banner, and how long shop activity logs are kept.
 */
export default function SettingsPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => AdminApi.settings(),
  });

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Apply to every shop on the platform." />
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Spinner className="py-20" />
      ) : (
        // Keyed on the saved version, so the form resets to what was stored.
        <SettingsForm key={data.updatedAt} settings={data} />
      )}
    </div>
  );
}

/** Digits only, or null for an empty box. */
const toDays = (v: string) => (v.trim() === '' ? null : Number(v));

function SettingsForm({ settings }: { settings: PlatformSettings }) {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const canEdit = useCanEdit();
  const [trialDays, setTrialDays] = useState(settings.trialDays?.toString() ?? '');
  const [signupOpen, setSignupOpen] = useState(settings.signupOpen);
  const [banner, setBanner] = useState(settings.maintenanceMessage ?? '');
  const [retention, setRetention] = useState(settings.auditRetentionDays?.toString() ?? '');

  const trial = toDays(trialDays);
  const keep = toDays(retention);
  const trialError =
    trial !== null && (!Number.isInteger(trial) || trial < 0 || trial > 365) ? 'A whole number from 0 to 365' : undefined;
  const keepError =
    keep !== null && (!Number.isInteger(keep) || keep < 30 || keep > 3650) ? 'A whole number from 30 to 3650' : undefined;

  const changes: UpdateSettingsInput = {
    ...(trial !== settings.trialDays ? { trialDays: trial } : {}),
    ...(signupOpen !== settings.signupOpen ? { signupOpen } : {}),
    ...((banner.trim() || null) !== settings.maintenanceMessage ? { maintenanceMessage: banner.trim() || null } : {}),
    ...(keep !== settings.auditRetentionDays ? { auditRetentionDays: keep } : {}),
  };
  const dirty = Object.keys(changes).length > 0;

  const save = useMutation({
    mutationFn: () => AdminApi.updateSettings(changes),
    onSuccess: (next) => {
      qc.setQueryData(['admin-settings'], next);
      toast('Settings saved');
    },
    onError: (e) => toast(apiError(e), 'error'),
  });

  const { activityLog } = settings;
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      {!canEdit && <Alert>Support accounts can see these settings but not change them.</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Signup and trial</CardTitle>
          <CardDescription>How new shops join.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
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
                Off makes it invite-only: the app&apos;s register form is closed, and you create shops from
                Businesses → New business.
              </span>
            </span>
          </label>
          <Field label="Free trial (days)" error={trialError}>
            <Input
              inputMode="numeric"
              className="max-w-[10rem]"
              placeholder={`${settings.envTrialDays} (default)`}
              value={trialDays}
              disabled={!canEdit}
              onChange={(e) => setTrialDays(e.target.value.replace(/[^\d]/g, ''))}
            />
          </Field>
          <p className="-mt-3 text-xs text-muted-foreground">
            For new signups only. Empty uses the server default ({settings.envTrialDays} days).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance banner</CardTitle>
          <CardDescription>
            Shown across the top of the shop app, including its sign-in page, until you clear it.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
          <p className="mt-1 text-xs text-muted-foreground">
            Empty means no banner. Shops see a change within a minute.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity log retention</CardTitle>
          <CardDescription>
            Each shop&apos;s activity log grows forever unless you set a limit. The admin log is always kept.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Keep entries for (days)" error={keepError}>
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
          {keep !== null && !keepError && keep !== settings.auditRetentionDays && (
            <Alert>Entries older than {keep} days are deleted for good at the next nightly run (03:30).</Alert>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={save.isPending} disabled={!dirty || !!trialError || !!keepError}>
            Save settings
          </Button>
          {settings.updatedBy && (
            <span className="text-xs text-muted-foreground">
              Last changed by {settings.updatedBy}, {formatDateTime(settings.updatedAt)}
            </span>
          )}
        </div>
      )}
    </form>
  );
}
