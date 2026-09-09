'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { AdminApi } from '@/lib/api';
import { Card, Input, Badge, Spinner, Button } from '@/components/ui';
import { formatDate } from '@/lib/utils';

export default function BusinessesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-businesses', search, page],
    queryFn: () => AdminApi.businesses({ search: search || undefined, page, limit: 20 }),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Businesses</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every tenant on the platform.</p>

      <div className="relative my-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search businesses…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {isLoading || !data ? <Spinner /> : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Business</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 text-right font-medium">Users</th>
                    <th className="px-4 py-3 text-right font-medium">Products</th>
                    <th className="px-4 py-3 text-right font-medium">Sales</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.data.map((b) => (
                    <tr key={b.id} className="cursor-pointer hover:bg-muted/40"
                      onClick={() => router.push(`/businesses/${b.id}`)}>
                      <td className="px-4 py-3 font-medium">{b.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.type}</td>
                      <td className="px-4 py-3 text-right">{b._count.users}</td>
                      <td className="px-4 py-3 text-right">{b._count.products}</td>
                      <td className="px-4 py-3 text-right">{b._count.sales}</td>
                      <td className="px-4 py-3">
                        {b.isSuspended ? <Badge tone="destructive">Suspended</Badge> : <Badge tone="success">Active</Badge>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(b.createdAt)}</td>
                    </tr>
                  ))}
                  {data.data.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No businesses found.</td></tr>
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
