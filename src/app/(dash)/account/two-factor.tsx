'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { AdminApi, apiError, setToken } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Alert, Spinner } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/auth/AuthProvider';

const digitsOnly = (v: string) => v.replace(/[^\d\s]/g, '');

/**
 * Two-factor sign-in with an authenticator app. An admin account opens every
 * shop's data, so a leaked password alone shouldn't be enough.
 *
 * Setting up is two steps on purpose: scan, then prove it worked with a code.
 * Nothing changes at sign-in until that second step succeeds.
 */
export function TwoFactorCard() {
  const qc = useQueryClient();
  const { refresh } = useAuth();
  const { show: toast } = useToast();
  const me = useQuery({ queryKey: ['admin-me'], queryFn: () => AdminApi.me() });
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [turningOff, setTurningOff] = useState(false);

  // Drawn in the browser: the secret never goes to a QR-image service.
  useEffect(() => {
    if (!setup) return;
    let live = true;
    QRCode.toDataURL(setup.otpauthUrl, { margin: 1, width: 200 })
      .then((url) => live && setQr(url))
      .catch(() => live && setQr(null));
    return () => {
      live = false;
    };
  }, [setup]);

  const start = useMutation({
    mutationFn: () => AdminApi.setupTwoFactor(),
    onSuccess: (res) => {
      setQr(null);
      setSetup(res);
      setCode('');
    },
  });
  const enable = useMutation({
    mutationFn: () => AdminApi.enableTwoFactor(code),
    onSuccess: (res) => {
      setToken(res.accessToken);
      setSetup(null);
      setCode('');
      qc.invalidateQueries({ queryKey: ['admin-me'] });
      qc.invalidateQueries({ queryKey: ['admin-admins'] });
      // If the platform required it, the rest of the panel opens up now.
      void refresh();
      toast('Two-factor is on. Other sessions are signed out, and you will be asked for a code when you sign in.', 'success');
    },
  });
  const disable = useMutation({
    mutationFn: () => AdminApi.disableTwoFactor(password, code),
    onSuccess: () => {
      setTurningOff(false);
      setPassword('');
      setCode('');
      qc.invalidateQueries({ queryKey: ['admin-me'] });
      qc.invalidateQueries({ queryKey: ['admin-admins'] });
      void refresh();
      toast('Two-factor is off.', 'success');
    },
  });

  const on = me.data?.twoFactorEnabled;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Two-factor sign-in</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A 6-digit code from an authenticator app (Google Authenticator, Authy, 1Password…) as well as your
            password.
          </p>
        </div>
        {me.data && (on ? <Badge tone="success">On</Badge> : <Badge tone="muted">Off</Badge>)}
      </div>

      {me.isLoading ? (
        <Spinner className="py-6" />
      ) : on ? (
        turningOff ? (
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              disable.mutate();
            }}
          >
            <Field label="Password">
              <PasswordInput
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field label="Current code">
              <Input
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                placeholder="123 456"
                value={code}
                onChange={(e) => setCode(digitsOnly(e.target.value))}
              />
            </Field>
            {disable.error != null && <Alert>{apiError(disable.error)}</Alert>}
            <div className="flex gap-2">
              <Button type="submit" variant="destructive" loading={disable.isPending}>
                Turn off
              </Button>
              <Button type="button" variant="outline" onClick={() => setTurningOff(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-4">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTurningOff(true)}>
              <ShieldOff className="h-3.5 w-3.5" /> Turn off
            </Button>
          </div>
        )
      ) : setup ? (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            enable.mutate();
          }}
        >
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>
              Scan this with your authenticator app.
              <div className="mt-2 flex h-[200px] w-[200px] items-center justify-center rounded-md border border-border bg-white p-1">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt="QR code to add this account to an authenticator app" width={200} height={200} />
                ) : (
                  <Spinner />
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Can&apos;t scan? Type this key into the app instead:</p>
              <code className="mt-1 block break-all rounded bg-muted px-2 py-1.5 font-mono text-xs tracking-wider">
                {setup.secret.match(/.{1,4}/g)?.join(' ')}
              </code>
            </li>
            <li>
              Enter the code it shows.
              <Input
                className="mt-2 max-w-40"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                placeholder="123 456"
                aria-label="Code from the app"
                value={code}
                onChange={(e) => setCode(digitsOnly(e.target.value))}
              />
            </li>
          </ol>
          {enable.error != null && <Alert>{apiError(enable.error)}</Alert>}
          <div className="flex gap-2">
            <Button type="submit" loading={enable.isPending} disabled={code.replace(/\s/g, '').length !== 6}>
              Turn on
            </Button>
            <Button type="button" variant="outline" onClick={() => setSetup(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-4 space-y-3">
          {start.error != null && <Alert>{apiError(start.error)}</Alert>}
          <Button size="sm" className="gap-1.5" loading={start.isPending} onClick={() => start.mutate()}>
            <ShieldCheck className="h-3.5 w-3.5" /> Set up two-factor
          </Button>
        </div>
      )}
    </Card>
  );
}
