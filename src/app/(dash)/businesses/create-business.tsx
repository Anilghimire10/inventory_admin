'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  AdminApi,
  apiError,
  BUSINESS_TYPES,
  SALES_MODELS,
  type BusinessType,
  type CreateBusinessInput,
  type SalesModel,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';

/**
 * Onboard a shop by hand: the API creates the business, a Main Store and a
 * verified owner. Without a password the owner is emailed an invite and sets
 * one through "Forgot password".
 */
export function CreateBusinessDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const [form, setForm] = useState({
    businessName: '',
    type: 'RETAIL' as BusinessType,
    salesModel: 'RETAIL' as SalesModel,
    currency: 'NPR',
    ownerName: '',
    ownerEmail: '',
    password: '',
    subscribedTo: '',
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: () => {
      const dto: CreateBusinessInput = {
        businessName: form.businessName.trim(),
        type: form.type,
        salesModel: form.salesModel,
        currency: form.currency.trim().toUpperCase(),
        ownerName: form.ownerName.trim(),
        ownerEmail: form.ownerEmail.trim(),
        ...(form.password ? { password: form.password } : {}),
        // End of the chosen day, so "paid until the 30th" includes the 30th.
        ...(form.subscribedTo
          ? { subscribedTo: new Date(`${form.subscribedTo}T23:59:59`).toISOString() }
          : {}),
      };
      return AdminApi.createBusiness(dto);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-businesses'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      // With no password, the invite email is how the owner gets in, so a
      // failed send has to be said plainly rather than folded into "created".
      if (form.password) {
        toast(`${res.business.name} created`, 'success');
      } else if (res.inviteSent) {
        toast(`${res.business.name} created. Invite sent to ${res.owner.email}`, 'success');
      } else {
        toast(
          `${res.business.name} created, but the invite email failed. Use Users → Send password reset.`,
          'error',
        );
      }
      router.push(`/businesses/${res.business.id}`);
    },
  });

  return (
    <Dialog open onClose={onClose} title="New business">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <Field label="Business name">
          <Input
            required
            minLength={2}
            autoFocus
            value={form.businessName}
            onChange={(e) => set('businessName', e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Type">
            <Select value={form.type} onChange={(e) => set('type', e.target.value as BusinessType)}>
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sales model">
            <Select value={form.salesModel} onChange={(e) => set('salesModel', e.target.value as SalesModel)}>
              {SALES_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Currency">
            <Input
              required
              minLength={3}
              maxLength={3}
              className="uppercase"
              value={form.currency}
              onChange={(e) => set('currency', e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Owner name">
            <Input required minLength={2} value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} />
          </Field>
          <Field label="Owner email">
            <Input
              type="email"
              required
              value={form.ownerEmail}
              onChange={(e) => set('ownerEmail', e.target.value)}
            />
          </Field>
        </div>

        <Field label="Initial password (optional)">
          <PasswordInput
            minLength={8}
            autoComplete="new-password"
            placeholder="Leave empty to email the owner an invite"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
          />
        </Field>

        <Field label="Paid until (optional)">
          <Input type="date" value={form.subscribedTo} onChange={(e) => set('subscribedTo', e.target.value)} />
        </Field>
        <p className="text-xs text-muted-foreground">
          Leave empty to start on the standard free trial.
        </p>

        {create.error != null && <Alert>{apiError(create.error)}</Alert>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create business
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
