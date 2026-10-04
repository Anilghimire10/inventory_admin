'use client';
import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/misc';

/**
 * A page under the sidebar threw while rendering (e.g. a response of an
 * unexpected shape). It sits inside the dashboard layout, so the sidebar
 * stays and the admin can retry or go to another page.
 */
export default function DashError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Something went wrong"
      description="This page hit an unexpected error. Retry, or open another page from the sidebar."
      onRetry={retry}
    />
  );
}
