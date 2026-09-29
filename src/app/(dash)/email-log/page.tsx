'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Mail, Search } from 'lucide-react';
import { AdminApi, EMAIL_TYPES, type EmailLogEntry } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TH, TBody, TR, TD } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { Spinner, ErrorState, PageHeader, EmptyState } from '@/components/ui/misc';
import { formatDateTime } from '@/lib/utils';

const TYPE_LABEL: Record<EmailLogEntry['type'], string> = {
  verification: 'Verification code',
  'password-reset': 'Password reset',
  receipt: 'Receipt',
  'low-stock': 'Low-stock digest',
  invite: 'Account invite',
  'subscription-reminder': 'Subscription reminder',
  'subscription-receipt': 'Subscription receipt',
  'admin-new-sign-in': 'Admin new sign-in',
  announcement: 'Announcement',
  'support-reply': 'Support reply',
  'support-new': 'New support ticket',
  'support-followup': 'Support follow-up',
};

const STATUS: Record<EmailLogEntry['status'], { tone: 'success' | 'destructive' | 'muted'; label: string }> = {
  SENT: { tone: 'success', label: 'Sent' },
  FAILED: { tone: 'destructive', label: 'Failed' },
  LOGGED: { tone: 'muted', label: 'Logged only' },
};

/**
 * Every email the app tried to send, searchable by address: the answer to
 * "I never got my code". The body isn't kept -- it holds one-time codes.
 */
export default function EmailLogPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-email-log', search, status, type, page],
    queryFn: () =>
      AdminApi.emailLog({
        search: search.trim() || undefined,
        status: status || undefined,
        type: type || undefined,
        page,
        limit: 30,
      }),
  });
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Email Log"
        description="Every email the app tried to send, and what happened to it. Search by address."
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by email address…"
            value={search}
            onChange={(e) => reset(setSearch)(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-44">
          <Select value={status} onChange={(e) => reset(setStatus)(e.target.value)} aria-label="Status">
            <option value="">Any status</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
            <option value="LOGGED">Logged only</option>
          </Select>
        </div>
        <div className="w-full sm:w-56">
          <Select value={type} onChange={(e) => reset(setType)(e.target.value)} aria-label="Type">
            <option value="">Any type</option>
            {EMAIL_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
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
        <EmptyState
          icon={Mail}
          title="No emails logged"
          description={search || status || type ? 'Nothing matches the filter.' : 'Emails appear here once the app sends any.'}
        />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <TH>When</TH>
                <TH>To</TH>
                <TH>Type</TH>
                <TH>Status</TH>
                <TH>Business</TH>
              </tr>
            </THead>
            <TBody>
              {data.data.map((e) => (
                <TR key={e.id}>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</TD>
                  <TD>
                    <div className="font-medium text-foreground">{e.to}</div>
                    <div className="text-xs text-muted-foreground">{e.subject}</div>
                  </TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{TYPE_LABEL[e.type] ?? e.type}</TD>
                  <TD>
                    <Badge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</Badge>
                    {e.error && <div className="mt-1 max-w-xs break-words text-xs text-destructive">{e.error}</div>}
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
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {data.data.length} of {data.meta.total} emails
            </span>
            <Pagination page={data.meta.page} pages={data.meta.pages} onPage={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
