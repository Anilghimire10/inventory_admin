'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, Pencil, Search, Trash2 } from 'lucide-react';
import { AdminApi, apiError, type SupportReplyTemplate, type SupportTicketRow, type TicketStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Spinner, ErrorState, PageHeader, EmptyState } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { cn, formatDateTime } from '@/lib/utils';

/**
 * Questions and feedback shops send from the app's Help & support page.
 * A reply rings the shop's bell and emails whoever asked. Support accounts
 * can answer, close and assign tickets, and keep saved replies.
 */
export default function SupportPage() {
  const [status, setStatus] = useState<TicketStatus | ''>('OPEN');
  const [search, setSearch] = useState('');
  const [assigned, setAssigned] = useState<'' | 'me' | 'none'>('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-support', status, search, assigned, page],
    queryFn: () =>
      AdminApi.tickets({
        status: status || undefined,
        search: search.trim() || undefined,
        assigned: assigned || undefined,
        page,
        limit: 20,
      }),
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
        <div className="w-full sm:w-44">
          <Select
            aria-label="Assigned"
            value={assigned}
            onChange={(e) => {
              setAssigned(e.target.value as '' | 'me' | 'none');
              setPage(1);
            }}
          >
            <option value="">Anyone&apos;s</option>
            <option value="me">Mine</option>
            <option value="none">Unassigned</option>
          </Select>
        </div>
        <Button variant="outline" className="sm:ml-auto" onClick={() => setManaging(true)}>
          Saved replies
        </Button>
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
      {managing && <SavedRepliesDialog onClose={() => setManaging(false)} />}
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
          {t.business.name} · {t.userName} · {t.messageCount} message{t.messageCount === 1 ? '' : 's'} ·{' '}
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

function TicketDialog({ id, onClose }: { id: string; onClose: () => void }) {
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
          <div className="-mt-2 mb-4 flex items-center gap-2 text-sm">
            <label htmlFor="assign" className="text-muted-foreground">
              Assigned to
            </label>
            <div className="w-56">
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

/**
 * Canned answers for the questions that keep coming back. {name} and
 * {business} are filled in when one is inserted into a reply.
 */
function SavedRepliesDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['support-templates'],
    queryFn: () => AdminApi.replyTemplates(),
  });
  const [editing, setEditing] = useState<SupportReplyTemplate | 'new' | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [deleting, setDeleting] = useState<SupportReplyTemplate | null>(null);

  const open = (t: SupportReplyTemplate | 'new') => {
    setEditing(t);
    setTitle(t === 'new' ? '' : t.title);
    setBody(t === 'new' ? '' : t.body);
  };
  const refresh = () => qc.invalidateQueries({ queryKey: ['support-templates'] });
  const save = useMutation({
    mutationFn: () =>
      editing === 'new'
        ? AdminApi.createReplyTemplate({ title: title.trim(), body: body.trim() })
        : AdminApi.updateReplyTemplate((editing as SupportReplyTemplate).id, { title: title.trim(), body: body.trim() }),
    onSuccess: () => {
      refresh();
      setEditing(null);
      toast('Saved reply saved');
    },
    onError: (e) => toast(apiError(e), 'error'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => AdminApi.deleteReplyTemplate(id),
    onSuccess: () => {
      refresh();
      setDeleting(null);
      toast('Saved reply deleted');
    },
    onError: (e) => toast(apiError(e), 'error'),
  });

  return (
    <Dialog open onClose={onClose} title="Saved replies" className="max-w-2xl">
      {editing ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Name">
            <Input
              autoFocus
              maxLength={80}
              placeholder="e.g. Forgot password"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Reply">
            <Textarea rows={6} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <p className="-mt-2 text-xs text-muted-foreground">
            {'{name}'} becomes the person who asked, {'{business}'} their shop.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Back
            </Button>
            <Button type="submit" loading={save.isPending} disabled={title.trim().length < 2 || !body.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Spinner className="py-10" />
      ) : (
        <>
          {data.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No saved replies yet. Add answers to the questions shops ask most.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {data.map((t) => (
                <li key={t.id} className="flex items-start gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className="line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">{t.body}</p>
                  </div>
                  <Button size="sm" variant="ghost" aria-label={`Edit ${t.title}`} onClick={() => open(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`Delete ${t.title}`} onClick={() => setDeleting(t)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button onClick={() => open('new')}>Add saved reply</Button>
          </DialogFooter>
        </>
      )}
      {deleting && (
        <ConfirmDialog
          open
          title={`Delete "${deleting.title}"?`}
          description="Replies already sent with it aren't affected."
          confirmLabel="Delete"
          loading={remove.isPending}
          onConfirm={() => remove.mutate(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Dialog>
  );
}
