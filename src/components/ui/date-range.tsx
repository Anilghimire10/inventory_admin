'use client';
import { Input } from '@/components/ui/input';

/** A day in the browser's time zone, as the ISO instant it starts or ends. */
export const dayStart = (day: string) => (day ? new Date(`${day}T00:00:00`).toISOString() : undefined);
export const dayEnd = (day: string) => (day ? new Date(`${day}T23:59:59.999`).toISOString() : undefined);

/**
 * From / to day pickers for a log list. Either can be left empty. The days
 * are the admin's own local days; the API gets the exact instants.
 */
export function DateRange({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  return (
    // Wraps rather than overflowing in a narrow card; each picker keeps its
    // natural width.
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Input
        type="date"
        aria-label="From date"
        className="w-auto"
        value={from}
        max={to || undefined}
        onChange={(e) => onChange(e.target.value, to)}
      />
      <span className="text-sm text-muted-foreground">to</span>
      <Input
        type="date"
        aria-label="To date"
        className="w-auto"
        value={to}
        min={from || undefined}
        onChange={(e) => onChange(from, e.target.value)}
      />
      {(from || to) && (
        <button type="button" className="text-xs text-primary hover:underline" onClick={() => onChange('', '')}>
          Clear
        </button>
      )}
    </div>
  );
}
