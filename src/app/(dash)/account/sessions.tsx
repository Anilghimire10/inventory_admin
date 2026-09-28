'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Laptop } from 'lucide-react';
import { AdminApi, apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ErrorState, Spinner } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { formatDateTime, formatRelative } from '@/lib/utils';

/**
 * Where this account is signed in. Ending a session takes effect on its very
 * next request, not when its token would have expired. Sessions opened before
 * this list existed don't appear, and end on their own within the day.
 */
export function SessionsCard() {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-sessions'],
    queryFn: () => AdminApi.sessions(),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-sessions'] });

  const end = useMutation({
    mutationFn: (id: string) => AdminApi.revokeSession(id),
    onSuccess: () => {
      refresh();
      toast('Signed out of that session', 'success');
    },
    onError: (e) => toast(apiError(e), 'error'),
  });
  const endOthers = useMutation({
    mutationFn: () => AdminApi.revokeOtherSessions(),
    onSuccess: (r) => {
      refresh();
      toast(r.ended ? `Signed out of ${r.ended} other session${r.ended === 1 ? '' : 's'}` : 'No other sessions to end', 'success');
    },
    onError: (e) => toast(apiError(e), 'error'),
  });

  const others = (data ?? []).filter((s) => !s.current).length;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Where you&apos;re signed in</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            You get an email when this account signs in from a new browser.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          loading={endOthers.isPending}
          disabled={others === 0}
          onClick={() => endOthers.mutate()}
        >
          Sign out everywhere else
        </Button>
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Spinner className="py-6" />
      ) : data.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          This session started before sessions were listed here. Sign out and back in to see it.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {data.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
              <Laptop className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {s.device}
                  {s.current && <Badge tone="success">This browser</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.ip ? `${s.ip} · ` : ''}signed in {formatDateTime(s.createdAt)} · active {formatRelative(s.lastSeenAt)}
                </p>
              </div>
              {!s.current && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={end.isPending && end.variables === s.id}
                  onClick={() => end.mutate(s.id)}
                >
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
