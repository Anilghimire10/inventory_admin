'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Eye, Megaphone, Search, X } from 'lucide-react';
import { AdminApi, apiError, type AnnouncementAudience, type AnnouncementEntry, type BusinessRow } from '@/lib/api';
import { useCanEdit } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/label';
import { Input, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner, ErrorState, PageHeader, EmptyState, Alert } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { formatDateTime, cn } from '@/lib/utils';
import { MaintenanceBannerSettings } from '@/components/settings/sections';

/** Audiences by subscription status. "selected" is picking shops by hand. */
const AUDIENCES: { value: AnnouncementAudience; label: string; hint: string }[] = [
  { value: 'all', label: 'All active shops', hint: 'Every business that isn\u2019t suspended.' },
  { value: 'trial', label: 'On trial', hint: 'Still on their free trial, never paid.' },
  { value: 'active', label: 'Paying', hint: 'Paid, with more than 7 days left.' },
  { value: 'expiring', label: 'Expiring soon', hint: 'Paid, ending within 7 days.' },
  { value: 'expired', label: 'Expired', hint: 'Past their end date (grace period or locked out).' },
  { value: 'selected', label: 'Choose shops', hint: 'Pick businesses by name.' },
];

const AUDIENCE_LABEL: Record<AnnouncementAudience, string> = {
  all: 'All',
  selected: 'Chosen',
  trial: 'Trial',
  active: 'Paying',
  expiring: 'Expiring',
  expired: 'Expired',
};

/** `<input type="datetime-local">` value for a Date, in the browser's time zone. */
const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Tell shops something -- maintenance, a new feature, a price change. It
 * lands in each shop's notification bell, and optionally in the owners'
 * inboxes. Suspended shops are always skipped.
 */
export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const canEdit = useCanEdit();
  const { show: toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<AnnouncementAudience>('all');
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [at, setAt] = useState(() => toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
  // Fixed when the form opens: the picker's earliest time, not a render-time clock.
  const [minAt] = useState(() => toLocalInput(new Date()));
  const [atError, setAtError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState('');
  const [email, setEmail] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const history = useQuery({ queryKey: ['admin-announcements'], queryFn: () => AdminApi.announcements() });
  // How many shops the chosen status means today -- the same filter the
  // Businesses page uses, so the number matches what that page would list.
  const reach = useQuery({
    queryKey: ['admin-businesses', 'announce-reach', audience],
    queryFn: () =>
      AdminApi.businesses({
        status: 'active',
        limit: 1,
        ...(audience === 'all' || audience === 'selected' ? {} : { subscription: audience }),
      }),
    enabled: audience !== 'selected',
  });
  const matches = useQuery({
    queryKey: ['admin-businesses', 'announce-pick', search],
    queryFn: () => AdminApi.businesses({ status: 'active', search: search.trim() || undefined, limit: 8 }),
    enabled: audience === 'selected',
  });

  const send = useMutation({
    mutationFn: () =>
      AdminApi.sendAnnouncement({
        title: title.trim(),
        body: body.trim(),
        ...(audience === 'selected' ? { businessIds: Array.from(picked.keys()) } : { audience }),
        email,
        ...(when === 'later' ? { scheduledFor: new Date(at).toISOString() } : {}),
      }),
    onSuccess: (res) => {
      if (res.scheduled) {
        toast(`Scheduled for ${formatDateTime(res.scheduledFor!)} — ${res.businesses} business${res.businesses === 1 ? '' : 'es'} today`, 'success');
      } else {
        toast(
          `Sent to ${res.businesses} business${res.businesses === 1 ? '' : 'es'}${
            email ? ` · ${res.emailed} email${res.emailed === 1 ? '' : 's'}${res.failed ? `, ${res.failed} failed` : ''}` : ''
          }`,
          res.failed ? 'error' : 'success',
        );
      }
      setTitle('');
      setBody('');
      setPicked(new Map());
      setConfirming(false);
      qc.invalidateQueries({ queryKey: ['admin-announcements'] });
    },
  });

  const recipients = audience === 'selected' ? picked.size : reach.data?.meta.total ?? 0;
  const atDate = new Date(at);
  const ready =
    title.trim().length >= 3 &&
    body.trim().length > 0 &&
    (when === 'now' || !Number.isNaN(atDate.getTime())) &&
    (audience === 'selected' ? recipients > 0 : true);

  const cancel = useMutation({
    mutationFn: (id: string) => AdminApi.cancelAnnouncement(id),
    onSuccess: () => {
      toast('Scheduled announcement cancelled', 'success');
      qc.invalidateQueries({ queryKey: ['admin-announcements'] });
    },
    onError: (e) => toast(apiError(e), 'error'),
  });
  const toggle = (b: BusinessRow) =>
    setPicked((m) => {
      const next = new Map(m);
      if (next.has(b.id)) next.delete(b.id);
      else next.set(b.id, b.name);
      return next;
    });

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Send a message to every shop's notification bell, or to the shops you choose."
      />

      <MaintenanceBannerSettings />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base font-semibold">New announcement</CardTitle>
          </CardHeader>
          <form
            className="space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!ready) return;
              // Checked here rather than while rendering: "a minute from now"
              // needs the clock, and render must not read it.
              if (when === 'later') {
                const ahead = atDate.getTime() - Date.now();
                if (ahead < 60_000 || ahead > 90 * 24 * 60 * 60 * 1000) {
                  setAtError('Pick a time at least a minute from now and within 90 days.');
                  return;
                }
              }
              setAtError(null);
              setConfirming(true);
            }}
          >
            <Field label="Title">
              <Input
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Scheduled maintenance on Saturday"
              />
            </Field>
            <Field label="Message">
              <Textarea
                rows={5}
                maxLength={1000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What shops need to know, and whether they need to do anything."
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">{body.length}/1000</p>
            </Field>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Send to</legend>
              <div className="flex flex-wrap gap-2">
                {AUDIENCES.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    title={a.hint}
                    aria-pressed={audience === a.value}
                    onClick={() => setAudience(a.value)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm transition-colors',
                      audience === a.value
                        ? 'border-primary bg-primary/10 font-medium text-primary'
                        : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {AUDIENCES.find((a) => a.value === audience)!.hint}
                {audience !== 'selected' &&
                  ` ${reach.isLoading ? '…' : recipients} business${recipients === 1 ? '' : 'es'} today${
                    when === 'later' ? ' — counted again when it goes out' : ''
                  }.`}
              </p>
              {audience === 'selected' && (
                <div className="mt-3 space-y-2">
                  {picked.size > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from(picked).map(([id, name]) => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary"
                        >
                          {name}
                          <button
                            type="button"
                            aria-label={`Remove ${name}`}
                            onClick={() => toggle({ id, name } as BusinessRow)}
                            className="rounded-full p-0.5 hover:bg-primary/20"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Find a business…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
                    {matches.isLoading ? (
                      <Spinner className="py-6" />
                    ) : (matches.data?.data.length ?? 0) === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">No active business matches.</p>
                    ) : (
                      matches.data!.data.map((b) => (
                        <label key={b.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-accent/50">
                          <input
                            type="checkbox"
                            checked={picked.has(b.id)}
                            onChange={() => toggle(b)}
                            className="h-4 w-4 accent-[hsl(var(--primary))]"
                          />
                          <span className="flex-1">{b.name}</span>
                          <span className="text-xs capitalize text-muted-foreground">{b.type.toLowerCase()}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">When</legend>
              <div className="flex flex-wrap items-center gap-2">
                {(['now', 'later'] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    aria-pressed={when === w}
                    onClick={() => setWhen(w)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm transition-colors',
                      when === w
                        ? 'border-primary bg-primary/10 font-medium text-primary'
                        : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {w === 'now' ? 'Send now' : 'Schedule'}
                  </button>
                ))}
                {when === 'later' && (
                  <Input
                    type="datetime-local"
                    aria-label="Send at"
                    className="w-auto"
                    value={at}
                    min={minAt}
                    onChange={(e) => {
                      setAt(e.target.value);
                      setAtError(null);
                    }}
                  />
                )}
              </div>
              {when === 'later' && atError && <p className="mt-1 text-xs text-destructive">{atError}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                For an outage happening now, the maintenance banner (at the top of this page) shows across the top of
                the shop app instead of in the bell.
              </p>
            </fieldset>

            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={email}
                onChange={(e) => setEmail(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
              />
              <span>
                Also email the owners
                <span className="block text-xs text-muted-foreground">
                  Verified, active owners only. Every email shows in the Email Log.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-end gap-3">
              {!canEdit && (
                <span className="text-sm text-muted-foreground">Only a full admin can send announcements.</span>
              )}
              <Button type="submit" disabled={!ready || !canEdit} className="gap-1.5">
                <Megaphone className="h-4 w-4" /> {when === 'later' ? 'Review & schedule' : 'Review & send'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base font-semibold">History</CardTitle>
          </CardHeader>
          {history.isError ? (
            <ErrorState error={history.error} onRetry={() => history.refetch()} />
          ) : history.isLoading || !history.data ? (
            <Spinner className="py-12" />
          ) : history.data.length === 0 ? (
            <EmptyState icon={Megaphone} title="Nothing sent yet" />
          ) : (
            <ul className="divide-y divide-border">
              {history.data.map((a) => (
                <HistoryItem
                  key={a.id}
                  a={a}
                  canEdit={canEdit}
                  cancelling={cancel.isPending && cancel.variables === a.id}
                  onCancel={() => cancel.mutate(a.id)}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {confirming && (
        <ConfirmDialog
          open
          title={
            when === 'later'
              ? `Schedule for ${formatDateTime(atDate)}?`
              : `Send to ${recipients} business${recipients === 1 ? '' : 'es'}?`
          }
          description={
            when === 'later'
              ? `"${title.trim()}" goes to ${AUDIENCES.find((x) => x.value === audience)!.label.toLowerCase()} (${recipients} today) at that time${
                  email ? ', and their owners will be emailed' : ''
                }. You can cancel it until then.`
              : `"${title.trim()}" will appear in their notification bell${
                  email ? ', and their owners will be emailed' : ''
                }. It can't be recalled.`
          }
          confirmLabel={when === 'later' ? 'Schedule' : 'Send'}
          destructive={false}
          loading={send.isPending}
          error={send.error ? <Alert>{apiError(send.error)}</Alert> : null}
          onConfirm={() => send.mutate()}
          onCancel={() => {
            setConfirming(false);
            send.reset();
          }}
        />
      )}
    </div>
  );
}

/**
 * One announcement: scheduled (with Cancel), cancelled, or sent -- and for a
 * sent one, how many of the shops it reached have opened it.
 */
function HistoryItem({
  a,
  canEdit,
  cancelling,
  onCancel,
}: {
  a: AnnouncementEntry;
  canEdit: boolean;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const reached = a.businesses ?? 0;
  const seenPct = reached ? Math.round((a.seenByShops / reached) * 100) : 0;
  return (
    <li className={cn('px-5 py-4', a.status === 'cancelled' && 'opacity-60')}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 break-words text-sm font-medium text-foreground">{a.title}</p>
        {a.status === 'scheduled' && <Badge tone="warning">Scheduled</Badge>}
        {a.status === 'cancelled' && <Badge tone="muted">Cancelled</Badge>}
      </div>
      <p className="mt-1 line-clamp-3 whitespace-pre-line break-words text-sm text-muted-foreground">{a.body}</p>

      {a.status === 'sent' && reached > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" /> Seen by {a.seenByShops} of {reached} shop{reached === 1 ? '' : 's'}
            </span>
            <span>{seenPct}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${seenPct}%` }} />
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Badge tone="primary">
          {AUDIENCE_LABEL[a.audience] ?? a.audience}
          {a.status === 'sent' ? ` · ${reached}` : a.audience === 'selected' ? ` · ${a.businessIds.length}` : ''}
        </Badge>
        {a.email && a.status === 'sent' && (
          <Badge tone={a.failed ? 'warning' : 'default'}>
            {a.emailed ?? 0} emailed{a.failed ? `, ${a.failed} failed` : ''}
          </Badge>
        )}
        {a.email && a.status !== 'sent' && <Badge tone="default">+ email</Badge>}
        <span>
          {a.createdByEmail} ·{' '}
          {a.status === 'scheduled' ? (
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <CalendarClock className="h-3 w-3" /> {formatDateTime(a.scheduledFor)}
            </span>
          ) : (
            formatDateTime(a.sentAt ?? a.createdAt)
          )}
        </span>
        {a.status === 'scheduled' && canEdit && (
          <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs" loading={cancelling} onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </li>
  );
}
