'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, Search } from 'lucide-react';
import { AdminApi, apiError, type SupportTicketRow, type TicketStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Spinner, ErrorState, PageHeader, EmptyState } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { cn, formatDateTime } from '@/lib/utils';

/**
 * Questions and feedback shops send from the app's Help & support page.
 * A reply rings the shop's bell and emails whoever asked. Support accounts
 * can answer and close tickets.
 */
export default function SupportPage() {
  const [status, setStatus] = useState<TicketStatus | ''>('OPEN');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-support', status, search, page],
    queryFn: () =>
      AdminApi.tickets({ status: status || undefined, search: search.trim() || undefined, page, limit: 20 }),
  });

  return (
    <div>
      <PageHeader
        title="Support"
        description="Questions and feedback from shops. Newest activity first."
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search subject, email or business…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            aria-label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as TicketStatus | '');
              setPage(1);
            }}
          >
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="">All</option>
          </Select>
        </div>
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Spinner className="py-20" />
      ) : data.data.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title={status === 'OPEN' && !search ? 'Nothing waiting' : 'No tickets'}
          description={search ? 'Nothing matches the search.' : 'Tickets appear here when a shop sends one from the app.'}
        />
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {data.data.map((t) => (
              <TicketRow key={t.id} ticket={t} onOpen={() => setOpenId(t.id)} />
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {data.meta.total} ticket{data.meta.total === 1 ? '' : 's'} · {data.openCount} open in total
            </span>
            <Pagination page={data.meta.page} pages={data.meta.pages} onPage={setPage} />
          </div>
        </>
      )}

      {openId && <TicketDialog id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function TicketRow({ ticket: t, onOpen }: { ticket: SupportTicketRow; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="block w-full px-4 py-3 text-left hover:bg-accent/50">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{t.subject}</span>
          {t.status === 'CLOSED' ? (
            <Badge tone="muted">Closed</Badge>
          ) : t.awaitingReply ? (
            <Badge tone="warning">Needs a reply</Badge>
          ) : (
            <Badge tone="primary">Answered</Badge>
          )}
          <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTime(t.lastMessageAt)}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {t.business.name} · {t.userName} · {t.messageCount} message{t.messageCount === 1 ? '' : 's'}
        </div>
        {t.lastMessage && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {t.lastMessage.fromAdmin ? 'You: ' : ''}
            {t.lastMessage.body}
          </p>
        )}
      </button>
    </li>
  );
}

function TicketDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const [reply, setReply] = useState('');
  const { data: ticket, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-support-ticket', id],
    queryFn: () => AdminApi.ticket(id),
  });

  const done = (next: Awaited<ReturnType<typeof AdminApi.ticket>>) => {
    qc.setQueryData(['admin-support-ticket', id], next);
    qc.invalidateQueries({ queryKey: ['admin-support'] });
  };
  const send = useMutation({
    mutationFn: () => AdminApi.replyToTicket(id, reply.trim()),
    onSuccess: (next) => {
      done(next);
      setReply('');
      toast('Reply sent');
    },
    onError: (e) => toast(apiError(e), 'error'),
  });
  const setStatus = useMutation({
    mutationFn: (status: TicketStatus) => AdminApi.setTicketStatus(id, status),
    onSuccess: (next) => {
      done(next);
      toast(next.status === 'CLOSED' ? 'Ticket closed' : 'Ticket reopened');
    },
    onError: (e) => toast(apiError(e), 'error'),
  });

  return (
    <Dialog open onClose={onClose} title={ticket?.subject ?? 'Ticket'} className="max-w-2xl">
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !ticket ? (
        <Spinner className="py-10" />
      ) : (
        <>
          <p className="-mt-2 mb-4 text-sm text-muted-foreground">
            <Link href={`/businesses/${ticket.business.id}`} className="text-primary hover:underline">
              {ticket.business.name}
            </Link>{' '}
            · {ticket.userName} ({ticket.userEmail})
          </p>
          <ol className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
            {ticket.messages.map((m) => (
              <li
                key={m.id}
                className={cn(
                  'rounded-lg border px-3 py-2',
                  m.fromAdmin ? 'ml-6 border-primary/20 bg-primary/5' : 'mr-6 border-border bg-muted/40',
                )}
              >
                <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {m.authorName}
                    {m.fromAdmin ? ' (support)' : ''}
                  </span>
                  <span>{formatDateTime(m.createdAt)}</span>
                </div>
                <p className="whitespace-pre-line break-words text-sm">{m.body}</p>
              </li>
            ))}
          </ol>

          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (reply.trim()) send.mutate();
            }}
          >
            <Textarea
              rows={4}
              maxLength={5000}
              aria-label="Reply"
              placeholder={ticket.status === 'CLOSED' ? 'Replying keeps it closed; reopen it if they still need help.' : 'Write a reply…'}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
            <DialogFooter>
              {ticket.status === 'OPEN' ? (
                <Button type="button" variant="outline" loading={setStatus.isPending} onClick={() => setStatus.mutate('CLOSED')}>
                  Close ticket
                </Button>
              ) : (
                <Button type="button" variant="outline" loading={setStatus.isPending} onClick={() => setStatus.mutate('OPEN')}>
                  Reopen
                </Button>
              )}
              <Button type="submit" loading={send.isPending} disabled={!reply.trim()}>
                Send reply
              </Button>
            </DialogFooter>
          </form>
        </>
      )}
    </Dialog>
  );
}
