'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Search, X } from 'lucide-react';
import { AdminApi, apiError, type BusinessRow } from '@/lib/api';
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
  const [audience, setAudience] = useState<'all' | 'selected'>('all');
  const [picked, setPicked] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState('');
  const [email, setEmail] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const history = useQuery({ queryKey: ['admin-announcements'], queryFn: () => AdminApi.announcements() });
  const active = useQuery({
    queryKey: ['admin-businesses', 'active-count'],
    queryFn: () => AdminApi.businesses({ status: 'active', limit: 1 }),
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
        businessIds: audience === 'selected' ? Array.from(picked.keys()) : undefined,
        email,
      }),
    onSuccess: (res) => {
      toast(
        `Sent to ${res.businesses} business${res.businesses === 1 ? '' : 'es'}${
          email ? ` · ${res.emailed} email${res.emailed === 1 ? '' : 's'}${res.failed ? `, ${res.failed} failed` : ''}` : ''
        }`,
        res.failed ? 'error' : 'success',
      );
      setTitle('');
      setBody('');
      setPicked(new Map());
      setConfirming(false);
      qc.invalidateQueries({ queryKey: ['admin-announcements'] });
    },
  });

  const recipients = audience === 'all' ? active.data?.meta.total ?? 0 : picked.size;
  const ready = title.trim().length >= 3 && body.trim().length > 0 && recipients > 0;
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base font-semibold">New announcement</CardTitle>
          </CardHeader>
          <form
            className="space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready) setConfirming(true);
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
                {(['all', 'selected'] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={audience === a}
                    onClick={() => setAudience(a)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm transition-colors',
                      audience === a
                        ? 'border-primary bg-primary/10 font-medium text-primary'
                        : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {a === 'all' ? `All active businesses (${active.data?.meta.total ?? '…'})` : 'Chosen businesses'}
                  </button>
                ))}
              </div>
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
                <Megaphone className="h-4 w-4" /> Review & send
              </Button>
            </div>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base font-semibold">Sent</CardTitle>
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
                <li key={a.id} className="px-5 py-4">
                  <p className="text-sm font-medium text-foreground">{a.details.title}</p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">{a.details.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge tone="primary">
                      {a.details.audience === 'all' ? 'All' : 'Chosen'} · {a.details.businesses}
                    </Badge>
                    {a.details.email && (
                      <Badge tone={a.details.failed ? 'warning' : 'default'}>
                        {a.details.emailed} emailed{a.details.failed ? `, ${a.details.failed} failed` : ''}
                      </Badge>
                    )}
                    <span>
                      {a.adminEmail} · {formatDateTime(a.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {confirming && (
        <ConfirmDialog
          open
          title={`Send to ${recipients} business${recipients === 1 ? '' : 'es'}?`}
          description={`"${title.trim()}" will appear in their notification bell${
            email ? ', and their owners will be emailed' : ''
          }. It can't be recalled.`}
          confirmLabel="Send"
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
