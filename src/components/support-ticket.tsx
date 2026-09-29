'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Mail, Store, UserRound } from 'lucide-react';
import {
  AdminApi,
  apiError,
  TICKET_CATEGORIES,
  ticketCategoryLabel,
  type SupportReplyTemplate,
  type SupportTicketRow,
  type TicketCategory,
  type TicketStatus,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Spinner, ErrorState } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { cn, formatDateTime } from '@/lib/utils';

/**
 * One support ticket: its row in a list, and the dialog to answer it. Used by
 * the Support inbox and by the Support tab on a business page.
 */

export function TicketRow({
  ticket: t,
  onOpen,
  showBusiness = true,
}: {
  ticket: SupportTicketRow;
  onOpen: () => void;
  /** Off on a business page, where every row is the same shop. */
  showBusiness?: boolean;
}) {
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
          <Badge tone="muted">{ticketCategoryLabel(t.category)}</Badge>
          <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTime(t.lastMessageAt)}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {showBusiness && `${t.business.name} · `}
          {t.userName} · {t.messageCount} message{t.messageCount === 1 ? '' : 's'} ·{' '}
          {t.assignedAdmin ? (
            <span className="text-foreground">{t.assignedAdmin.name}</span>
          ) : (
            <span className="italic">unassigned</span>
          )}
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

export function TicketDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const [reply, setReply] = useState('');
  const { data: ticket, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-support-ticket', id],
    queryFn: () => AdminApi.ticket(id),
  });
  const admins = useQuery({ queryKey: ['admin-admins'], queryFn: () => AdminApi.admins() });
  const templates = useQuery({ queryKey: ['support-templates'], queryFn: () => AdminApi.replyTemplates() });

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
  const assign = useMutation({
    mutationFn: (adminId: string | null) => AdminApi.assignTicket(id, adminId),
    onSuccess: (next) => {
      done(next);
      toast(next.assignedAdmin ? `Assigned to ${next.assignedAdmin.name}` : 'Unassigned');
    },
    onError: (e) => toast(apiError(e), 'error'),
  });
  // A saved reply, with {name} and {business} filled in from this ticket,
  // added after whatever is already typed.
  const insert = (t: SupportReplyTemplate) => {
    if (!ticket) return;
    const text = t.body.replaceAll('{name}', ticket.userName).replaceAll('{business}', ticket.business.name);
    setReply((r) => (r.trim() ? `${r.trimEnd()}\n\n${text}` : text));
  };
  const setStatus = useMutation({
    mutationFn: (status: TicketStatus) => AdminApi.updateTicket(id, { status }),
    onSuccess: (next) => {
      done(next);
      toast(next.status === 'CLOSED' ? 'Ticket closed' : 'Ticket reopened');
    },
    onError: (e) => toast(apiError(e), 'error'),
  });
  // The shop picks a category when asking; put it right if they guessed wrong.
  const setCategory = useMutation({
    mutationFn: (category: TicketCategory) => AdminApi.updateTicket(id, { category }),
    onSuccess: (next) => {
      done(next);
      toast(`Filed under ${ticketCategoryLabel(next.category)}`);
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
          {/* Who asked. No negative margin: the dialog body scrolls, and
              anything pulled above its top edge is clipped. */}
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <Link
              href={`/businesses/${ticket.business.id}`}
              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              <Store className="h-4 w-4 shrink-0" />
              {ticket.business.name}
            </Link>
            <span className="inline-flex items-center gap-1.5 text-foreground">
              <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
              {ticket.userName}
            </span>
            <a
              href={`mailto:${ticket.userEmail}`}
              className="inline-flex min-w-0 items-center gap-1.5 break-all hover:text-foreground hover:underline"
            >
              <Mail className="h-4 w-4 shrink-0" />
              {ticket.userEmail}
            </a>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 shrink-0" />
              Opened {formatDateTime(ticket.createdAt)}
            </span>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border py-3 text-sm">
            <div className="flex items-center gap-2">
              <label htmlFor="assign" className="text-muted-foreground">
                Assigned to
              </label>
              <div className="w-48">
                <Select
                  id="assign"
                  value={ticket.assignedAdmin?.id ?? ''}
                  disabled={assign.isPending}
                  onChange={(e) => assign.mutate(e.target.value || null)}
                >
                  <option value="">Nobody yet</option>
                  {(admins.data ?? [])
                    .filter((a) => a.isActive || a.id === ticket.assignedAdmin?.id)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="category" className="text-muted-foreground">
                Category
              </label>
              <div className="w-44">
                <Select
                  id="category"
                  value={ticket.category}
                  disabled={setCategory.isPending}
                  onChange={(e) => setCategory.mutate(e.target.value as TicketCategory)}
                >
                  {TICKET_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
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
            {(templates.data?.length ?? 0) > 0 && (
              <div className="mb-2 w-full sm:w-72">
                <Select
                  aria-label="Insert a saved reply"
                  value=""
                  onChange={(e) => {
                    const t = templates.data!.find((x) => x.id === e.target.value);
                    if (t) insert(t);
                  }}
                >
                  <option value="">Insert a saved reply…</option>
                  {templates.data!.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </Select>
              </div>
            )}
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
