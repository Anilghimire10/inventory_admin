'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, CheckCircle2, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Field } from '@/components/ui/label';
import { Tooltip } from '@/components/ui/tooltip';
import { apiError, apiErrorCode } from '@/lib/api';
import { useTheme } from '@/theme/ThemeProvider';

export default function LoginPage() {
  const { admin, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  // Shown once the API says this account has two-factor on (after the
  // password has checked out), and kept for retries.
  const [needCode, setNeedCode] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (admin) router.replace('/');
  }, [admin, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, needCode ? code : undefined);
      router.replace('/');
    } catch (err) {
      const reason = apiErrorCode(err);
      if (reason === 'TOTP_REQUIRED') {
        setNeedCode(true);
        return;
      }
      if (reason === 'TOTP_INVALID' || reason === 'TOTP_LOCKED') setCode('');
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminAuthShell>
      <h1 className="text-xl font-semibold">Super Admin Sign In</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Access platform management, tenants, and system-wide telemetry.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Admin Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@platform.com"
            autoComplete="email"
            required
            autoFocus
          />
        </Field>
        <Field label="Password">
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </Field>
        {needCode && (
          <Field label="Authenticator code">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, ''))}
              placeholder="123 456"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              autoFocus
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              The 6-digit code from your authenticator app. Lost your phone? Ask another admin to reset it.
            </p>
          </Field>
        )}
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <Button type="submit" className="w-full" loading={loading}>
          Sign in to Admin Console
        </Button>
      </form>
    </AdminAuthShell>
  );
}

function AdminAuthShell({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  const features = [
    'Multi-tenant business control & live onboarding',
    'Subscription status, trial tracking & instant freeze/reactivation',
    'System-wide audit trail and real-time operational feeds',
  ];

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — matches frontend brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_45%)]" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground/15">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">Inventory Admin</span>
          </div>
          <Tooltip content={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <button
              onClick={toggle}
              className="rounded-lg bg-primary-foreground/10 p-2 text-primary-foreground hover:bg-primary-foreground/20"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </Tooltip>
        </div>
        <div className="relative">
          <h2 className="max-w-sm text-3xl font-semibold leading-tight tracking-tight">
            Centralized platform control.
          </h2>
          <p className="mt-3 max-w-sm text-sm text-primary-foreground/85">
            Monitor tenant metrics, manage licenses, inspect audits, and support all business instances across your network.
          </p>
          <ul className="mt-8 space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-foreground/90" />
                <span className="text-primary-foreground/90">{f}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-primary-foreground/70">
          © {new Date().getFullYear()} Inventory Manager · Super Admin
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-muted/30 p-4 sm:p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="text-lg font-semibold">Inventory Admin</span>
            </div>
            <Tooltip content={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <button
                onClick={toggle}
                className="rounded-md p-2 text-muted-foreground hover:bg-accent"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </Tooltip>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
