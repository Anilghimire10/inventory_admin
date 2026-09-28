'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { apiError } from '@/lib/api';
import { EXPORT_CAP } from '@/lib/csv';

/**
 * "Export CSV" for a list page. `run` fetches with the page's current filters
 * and downloads the file; it returns how many rows went in and whether the
 * cap cut it short, which the toast then says.
 */
export function ExportButton({
  run,
  label = 'Export CSV',
}: {
  run: () => Promise<{ count: number; truncated: boolean }>;
  label?: string;
}) {
  const { show: toast } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      className="gap-1.5"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await run();
          toast(
            r.truncated
              ? `Exported the first ${EXPORT_CAP.toLocaleString()} rows. Narrow the filters for the rest.`
              : `Exported ${r.count.toLocaleString()} row${r.count === 1 ? '' : 's'}`,
            r.truncated ? 'error' : 'success',
          );
        } catch (e) {
          toast(apiError(e), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      <Download className="h-4 w-4" /> {label}
    </Button>
  );
}
