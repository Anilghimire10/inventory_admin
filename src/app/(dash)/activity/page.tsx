'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { AdminApi } from '@/lib/api';
import { Card, Badge, Spinner, Button, Input } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

export default function ActivityPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-activity-feed', search, page],
    queryFn: () => AdminApi.activityFeed({ search: search || undefined, page, limit: 30 }),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
      <p className="mt-1 text-sm text-muted-foreground">Everything happening across every business.</p>

      <div className="relative my-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Filter by action (e.g. sale, login)…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {isLoading || !data ? <Spinner /> : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">Business</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.data.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(e.createdAt)}</td>
                      <td className="px-4 py-3">{e.business?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        {e.user?.name ?? e.userName ?? 'Unknown'}
                        {e.user?.role && <span className="text-muted-foreground"> · {e.user.role}</span>}
                      </td>
                      <td className="px-4 py-3"><Badge tone="primary">{e.action}</Badge></td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {e.summary || `${e.entity ?? ''} ${e.entityId ? '#' + e.entityId.slice(0, 8) : ''}`.trim() || '—'}
                      </td>
                    </tr>
                  ))}
                  {data.data.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No activity recorded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {data.meta.pages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="outline" className="h-8" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="text-sm text-muted-foreground">Page {data.meta.page} of {data.meta.pages}</span>
              <Button variant="outline" className="h-8" disabled={page >= data.meta.pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
