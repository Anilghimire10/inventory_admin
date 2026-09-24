'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Users, Pencil, MailCheck, Send, KeyRound } from 'lucide-react';
import { AdminApi, apiError, type TenantUser } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/ui/label';
import { Table, THead, TH, TBody, TR, TD } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { Spinner, ErrorState, PageHeader, EmptyState, Alert } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { formatDate } from '@/lib/utils';

type Pending = { user: TenantUser; action: 'verify' | 'resend' | 'reset' };

const CONFIRM_COPY: Record<Pending['action'], { title: string; body: string; label: string }> = {
  verify: {
    title: 'Mark email as verified',
    body: 'Use this only when you have confirmed the address another way. They will be able to sign in without entering a code.',
    label: 'Mark verified',
  },
  resend: {
    title: 'Resend verification code',
    body: 'A new code is emailed to this address. Any earlier code stops working.',
    label: 'Send code',
  },
  reset: {
    title: 'Send password reset',
    body: 'A reset code is emailed to this address. Their current password keeps working until they use it.',
    label: 'Send reset',
  },
};

/**
 * Support tools for shop users across every business: find someone by email
 * or name, then fix whatever is stopping them signing in.
 */
export default function UsersPage() {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<TenantUser | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-users', search, page],
    queryFn: () => AdminApi.users({ search: search.trim() || undefined, page, limit: 20 }),
  });

  const act = useMutation({
    mutationFn: async ({ user, action }: Pending) => {
      if (action === 'verify') {
        await AdminApi.verifyUserEmail(user.id);
        return `${user.email} is now verified`;
      }
      const res =
        action === 'resend'
          ? await AdminApi.resendVerification(user.id)
          : await AdminApi.sendPasswordReset(user.id);
      return res.message;
    },
    onSuccess: (message) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setPending(null);
      toast(message, 'success');
    },
  });

  return (
    <div>
      <PageHeader
        title="Users"
        description="Shop users across every business. Search by email or name to help someone sign in."
      />

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by email or name…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Spinner className="py-20" />
      ) : data.data.length === 0 ? (
        <EmptyState icon={Users} title={search ? 'No users match that search' : 'No users yet'} />
      ) : (
        <div className="space-y-4">
          <Table>
            <THead>
              <tr>
                <TH>User</TH>
                <TH>Business</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH>Joined</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {data.data.map((u) => (
                <TR key={u.id}>
                  <TD>
                    <div className="font-medium text-foreground">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TD>
                  <TD>
                    <Link href={`/businesses/${u.business.id}`} className="text-primary hover:underline">
                      {u.business.name}
                    </Link>
                    {u.business.isSuspended && (
                      <Badge tone="destructive" className="ml-1.5">
                        Suspended
                      </Badge>
                    )}
                    {u.store && <div className="text-xs text-muted-foreground">{u.store.name}</div>}
                  </TD>
                  <TD>
                    <Badge tone="primary">{u.role}</Badge>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {u.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="muted">Inactive</Badge>}
                      {!u.emailVerified && <Badge tone="warning">Unverified</Badge>}
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{formatDate(u.createdAt)}</TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      <IconButton label="Edit" icon={Pencil} onClick={() => setEditing(u)} />
                      {!u.emailVerified && (
                        <>
                          <IconButton
                            label="Resend verification code"
                            icon={Send}
                            onClick={() => setPending({ user: u, action: 'resend' })}
                          />
                          <IconButton
                            label="Mark email verified"
                            icon={MailCheck}
                            onClick={() => setPending({ user: u, action: 'verify' })}
                          />
                        </>
                      )}
                      <IconButton
                        label="Send password reset"
                        icon={KeyRound}
                        // The API refuses a reset for a deactivated user.
                        disabled={!u.isActive}
                        onClick={() => setPending({ user: u, action: 'reset' })}
                      />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={data.meta.page} pages={data.meta.pages} onPage={setPage} />
        </div>
      )}

      {editing && (
        <EditUserDialog
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ['admin-users'] });
            toast('User updated', 'success');
          }}
        />
      )}

      {pending && (
        <ConfirmDialog
          open
          title={CONFIRM_COPY[pending.action].title}
          description={`${pending.user.name} · ${pending.user.email}. ${CONFIRM_COPY[pending.action].body}`}
          confirmLabel={CONFIRM_COPY[pending.action].label}
          destructive={false}
          loading={act.isPending}
          error={act.error ? <Alert>{apiError(act.error)}</Alert> : null}
          onConfirm={() => act.mutate(pending)}
          onCancel={() => {
            setPending(null);
            act.reset();
          }}
        />
      )}
    </div>
  );
}

function IconButton({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip content={label}>
      <Button
        variant="ghost"
        size="sm"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className="h-8 w-8 p-0"
      >
        <Icon className="h-4 w-4" />
      </Button>
    </Tooltip>
  );
}

function EditUserDialog({
  user,
  onClose,
  onSaved,
}: {
  user: TenantUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [isActive, setIsActive] = useState(user.isActive);

  const save = useMutation({
    // Only what changed. A changed email resets verification, so it is never
    // sent along with an unrelated edit.
    mutationFn: () =>
      AdminApi.updateUser(user.id, {
        ...(name.trim() !== user.name ? { name: name.trim() } : {}),
        ...(email.trim() !== user.email ? { email: email.trim() } : {}),
        ...(isActive !== user.isActive ? { isActive } : {}),
      }),
    onSuccess: onSaved,
  });

  const emailChanged = email.trim().toLowerCase() !== user.email.toLowerCase();

  return (
    <Dialog open onClose={onClose} title="Edit user" description={user.business.name}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Name">
          <Input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {emailChanged && (
          <p className="text-xs text-warning">
            The new address has to be verified again before they can sign in with it.
          </p>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active (can sign in)
        </label>

        {save.error != null && <Alert>{apiError(save.error)}</Alert>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            Save changes
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
