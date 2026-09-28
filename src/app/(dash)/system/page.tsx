'use client';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, RefreshCw } from 'lucide-react';
import { AdminApi, type CronRun } from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner, ErrorState, PageHeader } from '@/components/ui/misc';
import { formatDateTime, formatRelative, cn } from '@/lib/utils';

type State = 'ok' | 'warn' | 'error' | 'unknown';

const STATE_ICON: Record<State, { icon: React.ComponentType<{ className?: string }>; className: string; label: string }> = {
  ok: { icon: CheckCircle2, className: 'text-success', label: 'OK' },
  warn: { icon: AlertTriangle, className: 'text-warning', label: 'Check' },
  error: { icon: XCircle, className: 'text-destructive', label: 'Problem' },
  unknown: { icon: MinusCircle, className: 'text-muted-foreground', label: 'Not yet' },
};

/**
 * Is everything working? API and database up, email configured and
 * delivering, where product images go, and when each scheduled job last ran.
 * Settings are shown as set / not set, never their values.
 */
export default function SystemPage() {
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['admin-system'],
    queryFn: () => AdminApi.system(),
    refetchInterval: 60_000,
  });

  return (
    <div>
      <PageHeader
        title="System"
        description="Health of the API, database, email and scheduled jobs."
        action={
          <Button variant="outline" size="sm" className="gap-1.5" loading={isFetching} onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Spinner className="py-20" />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-semibold">API & database</CardTitle>
            </CardHeader>
            <div className="divide-y divide-border">
              <Row state="ok" label="API" value={`Up ${uptime(data.app.uptimeSeconds)} · ${data.app.environment}`} />
              <Row
                state={data.database.ok ? (data.database.latencyMs! > 500 ? 'warn' : 'ok') : 'error'}
                label="Database"
                value={data.database.ok ? `Responding in ${data.database.latencyMs} ms` : data.database.error ?? 'Not responding'}
              />
              <Row
                state={data.database.lastMigration ? 'ok' : 'warn'}
                label="Latest migration"
                value={data.database.lastMigration?.name ?? 'Unknown'}
                sub={data.database.lastMigration ? `Applied ${formatDateTime(data.database.lastMigration.finishedAt)}` : undefined}
              />
              <Row
                state="ok"
                label="Deployed version"
                value={`${data.app.version ?? '—'}${data.app.commit ? ` · ${data.app.commit.slice(0, 7)}` : ''}`}
                sub={`Node ${data.app.node} · started ${formatDateTime(data.app.startedAt)}`}
              />
            </div>
          </Card>

          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-semibold">Email & storage</CardTitle>
            </CardHeader>
            <div className="divide-y divide-border">
              <Row
                state={!data.email.configured ? 'error' : data.email.transport === 'log' ? 'warn' : 'ok'}
                label="Email"
                value={
                  !data.email.configured
                    ? 'Not configured: RESEND_API_KEY / RESEND_FROM missing'
                    : data.email.transport === 'log'
                      ? 'Log only: emails are written to the server log, not sent'
                      : 'Sending through Resend'
                }
              />
              <Row
                state={data.email.last24h.failed > 0 ? 'warn' : 'ok'}
                label="Last 24 hours"
                value={`${data.email.last24h.sent} sent · ${data.email.last24h.failed} failed${
                  data.email.last24h.logged ? ` · ${data.email.last24h.logged} logged only` : ''
                }`}
              />
              <Row
                state={data.storage.productImages === 'supabase' ? 'ok' : 'warn'}
                label="Product images"
                value={
                  data.storage.productImages === 'supabase'
                    ? 'Supabase Storage'
                    : 'Local disk: lost on every redeploy of a hosted server'
                }
              />
              <Row
                state={data.subscriptions.supportContactSet ? 'ok' : 'warn'}
                label="Subscriptions"
                value={`${data.subscriptions.trialDays}-day trial · ${data.subscriptions.graceDays}-day grace`}
                sub={
                  data.subscriptions.supportContactSet
                    ? 'Renewal contact is set'
                    : 'No SUPPORT_EMAIL / SUPPORT_PHONE: shops are told only to "contact us"'
                }
              />
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-semibold">Scheduled jobs</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Since this server started {formatRelative(data.app.startedAt).toLowerCase()}. Each server process
                tracks only its own runs.
              </p>
            </CardHeader>
            <div className="divide-y divide-border">
              {data.crons.map((c) => (
                <CronRow key={c.name} run={c} />
              ))}
            </div>
          </Card>
          <p className="text-xs text-muted-foreground lg:col-span-2">
            Checked {formatDateTime(new Date(dataUpdatedAt))} · refreshes every minute
          </p>
        </div>
      )}
    </div>
  );
}

function uptime(seconds: number) {
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

function Row({ state, label, value, sub }: { state: State; label: string; value: string; sub?: string }) {
  const { icon: Icon, className, label: stateLabel } = STATE_ICON[state];
  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', className)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {label} <span className="sr-only">({stateLabel})</span>
        </p>
        <p className="break-words text-sm text-muted-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

const JOB_LABEL: Record<string, string> = {
  'alert-sync': 'Stock alert sync',
  'low-stock-digest': 'Low-stock digest emails',
  'subscription-reminders': 'Subscription reminders',
  'scheduled-announcements': 'Scheduled announcements',
};

function CronRow({ run }: { run: CronRun }) {
  const state: State = run.ok === null ? (run.startedAt ? 'warn' : 'unknown') : run.ok ? 'ok' : 'error';
  const value = !run.startedAt
    ? 'Has not run since this server started'
    : run.ok === null
      ? `Running since ${formatDateTime(run.startedAt)}`
      : `${run.ok ? 'Last ran' : 'Failed'} ${formatDateTime(run.finishedAt)}${run.summary ? ` · ${run.summary}` : ''}`;
  return <Row state={state} label={`${JOB_LABEL[run.name] ?? run.name} · ${run.schedule}`} value={value} />;
}
