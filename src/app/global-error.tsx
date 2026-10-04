'use client';
import { useEffect } from 'react';
import './globals.css';

/**
 * Last resort: the root layout itself threw. This replaces <html>, so it
 * can't lean on the providers -- just a plain reload prompt.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            The admin panel hit an unexpected error. Trying again usually fixes it; reload if it doesn&apos;t.
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
