import { Loader2, Inbox, AlertTriangle, RotateCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { apiError } from '@/lib/api';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-muted-foreground', className)} />;
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center", className)}>
      <Icon className="h-10 w-10 text-muted-foreground/60" />
      <h3 className="text-base font-medium">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Couldn't load this",
  description,
  error,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const errMsg = description ?? (error ? apiError(error) : 'Check your connection and try again.');
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 py-16 text-center", className)}>
      <AlertTriangle className="h-10 w-10 text-destructive/70" />
      <h3 className="text-base font-medium text-destructive">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{errMsg}</p>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" className="mt-2 gap-1.5" onClick={onRetry}>
          <RotateCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}

export function Alert({ children, className }: { children: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <div className={cn('flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive', className)}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
