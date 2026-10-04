'use client';
import { useEffect } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { getToken } from './api';

/** What the API says a shop just did (inventory_backend/src/realtime). */
type AdminTopic = 'support' | 'claims' | 'businesses';

const STALE: Record<AdminTopic, QueryKey[]> = {
  support: [['admin-support'], ['admin-support-ticket']],
  claims: [['admin-payment-claims']],
  businesses: [['admin-businesses'], ['admin-business'], ['admin-business-payments'], ['admin-renewals'], ['admin-stats']],
};

/**
 * Keeps the panel live: a new ticket or reply, or a shop reporting a
 * payment, updates the sidebar badges and any list showing it at once,
 * rather than at the next minute's poll (which stays, as the fallback).
 *
 * `GET /api/admin/events`, read with fetch so the token goes in the
 * Authorization header and never in a URL. Reconnects with a growing wait;
 * stops on 401, where the panel's own sign-out takes over.
 */
export function useAdminLive(enabled: boolean) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let controller: AbortController | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let delay = 2_000;

    const reload = (topics: AdminTopic[]) => {
      for (const t of topics) for (const queryKey of STALE[t] ?? []) void qc.invalidateQueries({ queryKey });
    };

    const connect = async () => {
      const token = getToken();
      if (stopped || !token) return;
      controller = new AbortController();
      try {
        const res = await fetch('/api/admin/events', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: controller.signal,
          cache: 'no-store',
        });
        if (res.status === 401 || res.status === 403) return;
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        delay = 2_000;
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() ?? '';
          for (const raw of events) {
            const fields: Record<string, string> = {};
            for (const line of raw.split(/\r?\n/)) {
              const i = line.indexOf(':');
              if (i > 0) fields[line.slice(0, i)] = line.slice(i + 1).trimStart();
            }
            if (fields.event !== 'change' || !fields.data) continue;
            try {
              reload((JSON.parse(fields.data) as { topics: AdminTopic[] }).topics);
            } catch {
              // Skip a malformed event.
            }
          }
        }
      } catch {
        // Aborted or dropped: retry below unless stopped.
      }
      if (stopped) return;
      retry = setTimeout(connect, delay);
      delay = Math.min(delay * 2, 60_000);
    };

    void connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      controller?.abort();
    };
  }, [enabled, qc]);
}
