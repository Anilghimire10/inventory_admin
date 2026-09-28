'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ScrollText } from 'lucide-react';
import { AdminApi } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TH, TBody, TR, TD } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { Spinner, ErrorState, PageHeader, EmptyState } from '@/components/ui/misc';
import { formatDateTime } from '@/lib/utils';
import { DateRange, dayEnd, dayStart } from '@/components/ui/date-range';
import { ExportButton } from '@/components/export-button';
import { downloadCsv, fetchAll, today } from '@/lib/csv';

export default function ActivityPage() {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const filters = { search: search || undefined, from: dayStart(from), to: dayEnd(to) };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-activity-feed', search, from, to, page],
    queryFn: () => AdminApi.activityFeed({ ...filters, page, limit: 30 }),
  });

  return (
    <div>
      <PageHeader
        title="Global Activity Feed"
        description="Sales, staff sign-ins and changes across every business, newest first. Each page you view here is written to the Admin Log."
      />

      <div className="my-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Filter by action (e.g. sale, login, product)…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <DateRange
          from={from}
          to={to}
          onChange={(f, t) => {
            setFrom(f);
            setTo(t);
            setPage(1);
          }}
        />
        <div className="sm:ml-auto">
          <ExportButton
            run={async () => {
              const { rows, truncated } = await fetchAll((p, limit) => AdminApi.activityFeed({ ...filters, page: p, limit }));
              downloadCsv(
                `activity-${today()}.csv`,
                ['When', 'Business', 'User', 'Role', 'Action', 'Summary', 'IP'],
                rows.map((e) => [
                  e.createdAt,
                  e.business?.name ?? '',
                  e.user?.name ?? e.userName ?? '',
                  e.user?.role ?? '',
                  e.action,
                  e.summary ?? '',
                  e.ip ?? '',
                ]),
              );
              return { count: rows.length, truncated };
            }}
          />
        </div>
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Spinner className="py-20" />
      ) : data.data.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No activity recorded"
          description={search || from || to ? 'Nothing matches the filter.' : 'No system activity logged yet.'}
        />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <TH>When</TH>
                <TH>Business</TH>
                <TH>User</TH>
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
                  <TD className="font-semibold text-foreground">
                    {e.business?.name ?? '—'}
                  </TD>
                  <TD>
                    <span className="font-medium text-foreground">{e.user?.name ?? e.userName ?? 'Unknown'}</span>
                    {e.user?.role && (
                      <span className="text-xs text-muted-foreground ml-1.5">({e.user.role})</span>
                    )}
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

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {data.data.length} of {data.meta.total} events
            </span>
            <Pagination
              page={data.meta.page}
              pages={data.meta.pages}
              onPage={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
