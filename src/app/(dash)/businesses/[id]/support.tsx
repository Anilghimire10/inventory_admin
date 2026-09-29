'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LifeBuoy } from 'lucide-react';
import { AdminApi } from '@/lib/api';
import { Pagination } from '@/components/ui/pagination';
import { Spinner, ErrorState, EmptyState } from '@/components/ui/misc';
import { TicketDialog, TicketRow } from '@/components/support-ticket';

/**
 * This shop's support tickets, open and closed, newest activity first --
 * the same rows and dialog as the Support inbox, so a ticket can be answered
 * from here while looking at the shop's data.
 */
export function SupportTab({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-support', 'business', id, page],
    queryFn: () => AdminApi.tickets({ businessId: id, page, limit: 20 }),
  });

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <Spinner className="py-10" />;

  return (
    <>
      {data.data.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No tickets" description="This shop hasn't asked support anything yet." />
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {data.data.map((t) => (
              <TicketRow key={t.id} ticket={t} showBusiness={false} onOpen={() => setOpenId(t.id)} />
            ))}
          </ul>
          <Pagination page={data.meta.page} pages={data.meta.pages} onPage={setPage} />
        </>
      )}
      {openId && <TicketDialog id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
