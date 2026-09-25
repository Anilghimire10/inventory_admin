'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NotebookPen, Trash2 } from 'lucide-react';
import { AdminApi, apiError } from '@/lib/api';
import { useCanEdit } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { Spinner, ErrorState, EmptyState, Alert } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatDateTime } from '@/lib/utils';

/**
 * Internal notes on a business: calls, payment promises, setup details.
 * Visible to every platform admin and never to the shop.
 */
export function NotesTab({ id }: { id: string }) {
  const canEdit = useCanEdit();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const key = ['admin-business-notes', id];

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: key,
    queryFn: () => AdminApi.notes(id),
  });

  const add = useMutation({
    mutationFn: () => AdminApi.addNote(id, body.trim()),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const remove = useMutation({
    mutationFn: (noteId: string) => AdminApi.deleteNote(id, noteId),
    onSuccess: () => {
      setRemoving(null);
      qc.invalidateQueries({ queryKey: key });
    },
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) add.mutate();
          }}
          className="space-y-3"
        >
          <Textarea
            rows={3}
            maxLength={2000}
            placeholder="Add a note: a call, a payment promise, a setup detail. Only platform admins see this."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          {add.error && <Alert>{apiError(add.error)}</Alert>}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{body.length}/2000</span>
            <Button type="submit" size="sm" loading={add.isPending} disabled={!body.trim()}>
              Add note
            </Button>
          </div>
        </form>
      </Card>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Spinner className="py-12" />
      ) : data.length === 0 ? (
        <EmptyState icon={NotebookPen} title="No notes yet" />
      ) : (
        <ul className="space-y-3">
          {data.map((n) => (
            <li key={n.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-foreground">
                    {n.body}
                  </p>
                  {canEdit && (
                    <Tooltip content="Delete note">
                      <button
                        type="button"
                        onClick={() => setRemoving(n.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                        aria-label="Delete note"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {n.admin?.name ?? n.adminEmail} · {formatDateTime(n.createdAt)}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {removing && (
        <ConfirmDialog
          open
          title="Delete this note?"
          description="It is removed for every admin. The deletion is recorded in the admin log."
          confirmLabel="Delete note"
          loading={remove.isPending}
          error={remove.error ? <Alert>{apiError(remove.error)}</Alert> : null}
          onConfirm={() => remove.mutate(removing)}
          onCancel={() => {
            setRemoving(null);
            remove.reset();
          }}
        />
      )}
    </div>
  );
}
