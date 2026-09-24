'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, History } from 'lucide-react';
import { AdminApi, type AdminAuditEntry } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TH, TBody, TR, TD } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { Spinner, ErrorState, PageHeader, EmptyState } from '@/components/ui/misc';
import { formatDateTime } from '@/lib/utils';

/**
 * What platform admins did: suspensions, payments, user fixes, viewing a
 * shop's customers. Separate from the Activity Log, which is what shop users
 * did inside their own business.
 */
export default function AdminLogPage() {
  const [search, setSearch] = useState('');
  const [adminId, setAdminId] = useState('');
  const [page, setPage] = useState(1);

  const admins = useQuery({ queryKey: ['admin-admins'], queryFn: () => AdminApi.admins() });
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-audit-log', search, adminId, page],
    queryFn: () =>
      AdminApi.auditLog({
        search: search.trim() || undefined,
        adminId: adminId || undefined,
        page,
        limit: 30,
      }),
  });

  return (
    <div>
      <PageHeader
        title="Admin Log"
        description="Every change made from this panel, and every time a shop's private data was viewed."
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Filter by action (e.g. suspend, payment)…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            value={adminId}
            onChange={(e) => {
              setAdminId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All admins</option>
            {admins.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Spinner className="py-20" />
      ) : data.data.length === 0 ? (
        <EmptyState icon={History} title="Nothing logged" description={search || adminId ? 'No entries match the filter.' : undefined} />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <TH>When</TH>
                <TH>Admin</TH>
                <TH>Action</TH>
                <TH>Business</TH>
                <TH>Details</TH>
              </tr>
            </THead>
            <TBody>
              {data.data.map((e) => (
                <TR key={e.id}>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</TD>
                  <TD>
                    <div className="font-medium text-foreground">{e.admin?.name ?? e.adminEmail}</div>
                    {e.admin && <div className="text-xs text-muted-foreground">{e.adminEmail}</div>}
                  </TD>
                  <TD>
                    <Badge tone="primary">{e.action}</Badge>
                  </TD>
                  <TD>
                    {e.business ? (
                      <Link href={`/businesses/${e.business.id}`} className="text-primary hover:underline">
                        {e.business.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TD>
                  <TD className="max-w-md text-xs text-muted-foreground">{describe(e)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {data.data.length} of {data.meta.total} entries
            </span>
            <Pagination page={data.meta.page} pages={data.meta.pages} onPage={setPage} />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * `details` is free-form per action, so it is shown as short `key: value`
 * pairs rather than a raw JSON blob. Nested values fall back to JSON.
 */
function describe(e: AdminAuditEntry): string {
  if (!e.details || Object.keys(e.details).length === 0) return '—';
  return Object.entries(e.details)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
}
