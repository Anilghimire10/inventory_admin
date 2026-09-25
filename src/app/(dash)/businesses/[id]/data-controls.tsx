'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Download, Trash2 } from 'lucide-react';
import { AdminApi, apiError, type BusinessDetail } from '@/lib/api';
import { useCanEdit } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';

/**
 * Export and permanent deletion. Kept apart from the everyday controls, at
 * the bottom of the overview, so neither is one stray click away.
 */
export function DataControls({ business }: { business: BusinessDetail }) {
  const canEdit = useCanEdit();
  const router = useRouter();
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState('');

  const exportData = useMutation({
    mutationFn: () => AdminApi.exportBusiness(business.id),
    onError: (e) => toast(apiError(e), 'error'),
  });

  const remove = useMutation({
    mutationFn: () => AdminApi.deleteBusiness(business.id, typed),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-businesses'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      toast(`${res.name} was deleted`, 'success');
      router.replace('/businesses');
    },
  });

  const matches = typed.trim() === business.name.trim();

  // Export and delete are both full-admin only (the API refuses SUPPORT).
  if (!canEdit) return null;

  return (
    <Card className="lg:col-span-2 border-destructive/30">
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="text-base font-semibold">Data & deletion</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">Both actions are recorded in the admin log.</p>
      </CardHeader>
      <div className="divide-y divide-border">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Export data</p>
            <p className="text-xs text-muted-foreground">
              Everything this business holds, as one NDJSON file: for a deletion request or a shop that&apos;s leaving.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            loading={exportData.isPending}
            onClick={() => exportData.mutate()}
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-destructive">Delete business</p>
            <p className="text-xs text-muted-foreground">
              Permanently removes the business, its users, stores, products, sales and everything else. This can&apos;t
              be undone. Export first if the data may be needed.
            </p>
          </div>
          <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setDeleting(true)}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>

      {deleting && (
        <ConfirmDialog
          open
          title={`Delete ${business.name}?`}
          description={`This permanently deletes ${business._count.users} user(s), ${business._count.products} product(s), ${business._count.sales} sale(s) and everything else in this business. It can't be undone.`}
          confirmLabel="Delete permanently"
          loading={remove.isPending}
          disabled={!matches}
          error={remove.error ? <Alert>{apiError(remove.error)}</Alert> : null}
          onConfirm={() => remove.mutate()}
          onCancel={() => {
            setDeleting(false);
            setTyped('');
            remove.reset();
          }}
        >
          <Field label={`Type ${business.name} to confirm`}>
            <Input
              autoFocus
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={business.name}
            />
          </Field>
        </ConfirmDialog>
      )}
    </Card>
  );
}
