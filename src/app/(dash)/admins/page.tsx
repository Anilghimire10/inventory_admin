'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, Plus, Pencil, ShieldCheck } from 'lucide-react';
import { AdminApi, apiError, type AdminRole, type PlatformAdmin } from '@/lib/api';
import { useAuth, useCanEdit } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PasswordInput } from '@/components/ui/password-input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/label';
import { Table, THead, TH, TBody, TR, TD } from '@/components/ui/table';
import { Spinner, ErrorState, PageHeader, EmptyState, Alert } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';
import { AdminSettings } from '@/components/settings/sections';

const ROLE_HELP: Record<AdminRole, string> = {
  ADMIN: 'Full admin: can change anything, including other admins.',
  SUPPORT: 'Support: sees everything and answers support tickets, but can’t change shops, users or settings.',
};

function RolePicker({ value, onChange }: { value: AdminRole; onChange: (r: AdminRole) => void }) {
  return (
    <Field label="Role">
      <Select value={value} onChange={(e) => onChange(e.target.value as AdminRole)}>
        <option value="ADMIN">Full admin</option>
        <option value="SUPPORT">Support (read-only)</option>
      </Select>
    </Field>
  );
}

/** Platform admin accounts. Full admins manage the others. */
export default function AdminsPage() {
  const qc = useQueryClient();
  const { admin: me } = useAuth();
  const canEdit = useCanEdit();
  const { show: toast } = useToast();
  const [dialog, setDialog] = useState<{ mode: 'create' } | { mode: 'edit'; admin: PlatformAdmin } | null>(
    null,
  );
  const [signingOut, setSigningOut] = useState<PlatformAdmin | null>(null);
  const signOut = useMutation({
    mutationFn: (id: string) => AdminApi.signOutAdmin(id),
    onSuccess: (r) => {
      toast(
        r.ended
          ? `${signingOut?.name ?? 'They'} signed out of ${r.ended} session${r.ended === 1 ? '' : 's'}`
          : `${signingOut?.name ?? 'They'} had no open sessions`,
        'success',
      );
      setSigningOut(null);
    },
    onError: (e) => toast(apiError(e), 'error'),
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-admins'],
    queryFn: () => AdminApi.admins(),
  });

  const done = (message: string) => {
    setDialog(null);
    qc.invalidateQueries({ queryKey: ['admin-admins'] });
    toast(message, 'success');
  };

  return (
    <div>
      <PageHeader
        title="Admins"
        description="Who can sign in to this panel. Deactivating an admin signs them out everywhere."
        action={
          canEdit && (
            <Button className="gap-1.5" onClick={() => setDialog({ mode: 'create' })}>
              <Plus className="h-4 w-4" /> New admin
            </Button>
          )
        }
      />

      <AdminSettings />

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Spinner className="py-20" />
      ) : data.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No admins" />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Admin</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH>Two-factor</TH>
              <TH>Added</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <TBody>
            {data.map((a) => (
              <TR key={a.id}>
                <TD>
                  <div className="font-medium text-foreground">
                    {a.name}
                    {a.id === me?.id && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{a.email}</div>
                </TD>
                <TD>
                  {a.role === 'SUPPORT' ? <Badge tone="muted">Support</Badge> : <Badge tone="primary">Full admin</Badge>}
                </TD>
                <TD>
                  {a.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="muted">Inactive</Badge>}
                </TD>
                <TD>
                  {a.totpEnabledAt ? <Badge tone="success">On</Badge> : <Badge tone="muted">Off</Badge>}
                </TD>
                <TD className="whitespace-nowrap text-muted-foreground">{formatDate(a.createdAt)}</TD>
                <TD className="text-right">
                  {canEdit && a.isActive && a.id !== me?.id && (
                    <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setSigningOut(a)}>
                      <LogOut className="h-3.5 w-3.5" /> Sign out
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setDialog({ mode: 'edit', admin: a })}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {signingOut && (
        <ConfirmDialog
          open
          title={`Sign ${signingOut.name} out everywhere?`}
          description="Every browser they're signed in on is signed out now. They can sign straight back in with their password — to stop that, deactivate the account instead."
          confirmLabel="Sign out"
          loading={signOut.isPending}
          onConfirm={() => signOut.mutate(signingOut.id)}
          onCancel={() => setSigningOut(null)}
        />
      )}

      {dialog?.mode === 'create' && (
        <CreateAdminDialog onClose={() => setDialog(null)} onSaved={() => done('Admin created')} />
      )}
      {dialog?.mode === 'edit' && (
        <EditAdminDialog
          admin={dialog.admin}
          isSelf={dialog.admin.id === me?.id}
          onClose={() => setDialog(null)}
          onSaved={() => done('Admin updated')}
        />
      )}
    </div>
  );
}

function CreateAdminDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<{ name: string; email: string; password: string; role: AdminRole }>({
    name: '',
    email: '',
    password: '',
    role: 'ADMIN',
  });
  const save = useMutation({
    mutationFn: () =>
      AdminApi.createAdmin({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      }),
    onSuccess: onSaved,
  });

  return (
    <Dialog open onClose={onClose} title="New admin">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Name">
          <Input
            required
            minLength={2}
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </Field>
        <Field label="Password">
          <PasswordInput
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
        </Field>
        <RolePicker value={form.role} onChange={(role) => setForm((f) => ({ ...f, role }))} />
        <p className="-mt-2 text-xs text-muted-foreground">{ROLE_HELP[form.role]}</p>
        <p className="text-xs text-muted-foreground">
          Share the password with them directly; they can change it after signing in.
        </p>

        {save.error != null && <Alert>{apiError(save.error)}</Alert>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            Create admin
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function EditAdminDialog({
  admin,
  isSelf,
  onClose,
  onSaved,
}: {
  admin: PlatformAdmin;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(admin.name);
  const [isActive, setIsActive] = useState(admin.isActive);
  const [role, setRole] = useState<AdminRole>(admin.role);
  const [password, setPassword] = useState('');
  const [resetTwoFactor, setResetTwoFactor] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      AdminApi.updateAdmin(admin.id, {
        ...(name.trim() !== admin.name ? { name: name.trim() } : {}),
        ...(isActive !== admin.isActive ? { isActive } : {}),
        ...(role !== admin.role ? { role } : {}),
        ...(password ? { password } : {}),
        ...(resetTwoFactor ? { resetTwoFactor } : {}),
      }),
    onSuccess: onSaved,
  });

  return (
    <Dialog open onClose={onClose} title="Edit admin" description={admin.email}>
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

        {isSelf ? (
          // The API refuses this too; saying so here saves a round trip.
          <p className="text-xs text-muted-foreground">
            You can&apos;t deactivate yourself or change your own role. Change your own password from the
            account menu.
          </p>
        ) : (
          <>
            <RolePicker value={role} onChange={setRole} />
            <p className="-mt-2 text-xs text-muted-foreground">{ROLE_HELP[role]}</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active (can sign in)
            </label>
            <Field label="Set a new password (optional)">
              <PasswordInput
                minLength={8}
                autoComplete="new-password"
                placeholder="Leave empty to keep the current one"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {admin.totpEnabledAt && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary"
                  checked={resetTwoFactor}
                  onChange={(e) => setResetTwoFactor(e.target.checked)}
                />
                <span>
                  Turn off their two-factor
                  <span className="block text-xs text-muted-foreground">
                    For a lost or replaced phone. They sign in with just a password until they set it up again.
                  </span>
                </span>
              </label>
            )}
          </>
        )}

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
