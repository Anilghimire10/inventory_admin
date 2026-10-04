'use client';
import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/misc';

/**
 * Pages outside the dashboard (sign-in) and the dashboard layout itself:
 * a retry instead of a blank screen.
 */
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <ErrorState
        title="Something went wrong"
        description="The admin panel hit an unexpected error. Retry, or reload if it keeps happening."
        onRetry={retry}
        className="w-full max-w-md"
      />
    </div>
  );
}
