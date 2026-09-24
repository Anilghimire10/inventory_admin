'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AdminApi, apiError, setToken } from '@/lib/api';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { PageHeader, Alert } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';

/** This admin's own account: change the password. */
export default function AccountPage() {
  const { admin } = useAuth();
  const { show: toast } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const change = useMutation({
    mutationFn: () => AdminApi.changePassword(current, next),
    onSuccess: (res) => {
      // Every token issued before the change stops working, this tab's
      // included, so the fresh one has to replace it or the next request
      // would sign us out.
      setToken(res.accessToken);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast('Password changed. Other sessions have been signed out.', 'success');
    },
  });

  const mismatch = confirm.length > 0 && next !== confirm;

  return (
    <div className="max-w-lg">
      <PageHeader title="Account" description={admin ? `${admin.name} · ${admin.email}` : undefined} />

      <Card className="p-5">
        <h2 className="text-base font-semibold">Change password</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Signs out every other session using your account.
        </p>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            change.mutate();
          }}
        >
          <Field label="Current password">
            <PasswordInput
              required
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field label="New password">
            <PasswordInput
              required
              minLength={8}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field label="Confirm new password">
            <PasswordInput
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          {mismatch && <p className="text-xs text-destructive">The new passwords don&apos;t match.</p>}

          {change.error != null && <Alert>{apiError(change.error)}</Alert>}

          <Button type="submit" loading={change.isPending} disabled={mismatch || next.length < 8}>
            Change password
          </Button>
        </form>
      </Card>
    </div>
  );
}
