'use client';
import { Badge, type BadgeTone } from './ui/badge';
import type { SubscriptionStatus } from '@/lib/api';

export * from './ui/button';
export * from './ui/card';
export * from './ui/input';
export * from './ui/password-input';
export * from './ui/label';
export * from './ui/select';
export * from './ui/badge';
export * from './ui/dialog';
export * from './ui/toast';
export * from './ui/table';
export * from './ui/pagination';
export * from './ui/confirm-dialog';
export * from './ui/misc';

// Backwards-compatibility alias for Modal
export { Dialog as Modal } from './ui/dialog';

const SUBSCRIPTION_LABELS: Record<SubscriptionStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Active', tone: 'success' },
  trial: { label: 'Trial', tone: 'primary' },
  expiring: { label: 'Expiring', tone: 'warning' },
  expired: { label: 'Expired', tone: 'destructive' },
  inactive: { label: 'Inactive', tone: 'muted' },
};

export function SubscriptionBadge({ status }: { status: SubscriptionStatus }) {
  const { label, tone } = SUBSCRIPTION_LABELS[status] ?? SUBSCRIPTION_LABELS.inactive;
  return <Badge tone={tone}>{label}</Badge>;
}
