'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, Pencil, Search, Trash2 } from 'lucide-react';
import {
  AdminApi,
  apiError,
  TICKET_CATEGORIES,
  type SupportReplyTemplate,
  type TicketCategory,
  type TicketStatus,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { Spinner, ErrorState, PageHeader, EmptyState } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { TicketDialog, TicketRow } from '@/components/support-ticket';

/**
 * Questions and feedback shops send from the app's Help & support page.
 * A reply rings the shop's bell and emails whoever asked. Support accounts
 * can answer, close and assign tickets, and keep saved replies.
 */
export default function SupportPage() {
  const [status, setStatus] = useState<TicketStatus | ''>('OPEN');
  const [search, setSearch] = useState('');
  const [assigned, setAssigned] = useState<'' | 'me' | 'none'>('');
  const [category, setCategory] = useState<TicketCategory | ''>('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-support', status, search, assigned, category, page],
    queryFn: () =>
      AdminApi.tickets({
        status: status || undefined,
        search: search.trim() || undefined,
        assigned: assigned || undefined,
        category: category || undefined,
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
        <div className="w-full sm:w-44">
          <Select
            aria-label="Category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as TicketCategory | '');
              setPage(1);
            }}
          >
            <option value="">Any category</option>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
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
              {data.meta.total} ticket{data.meta.total === 1 ? '' : 's'} · {data.openCount} open in total ·{' '}
              {data.awaitingCount} waiting for a reply
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
