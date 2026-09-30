'use client';
import Link from 'next/link';
import { Activity, ArrowRight, ClipboardCheck, Layers, Megaphone, ScrollText, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/misc';
import { useSettings } from '@/components/settings/sections';

/**
 * Where each setting lives now: with the feature it controls, not all on one
 * page. This page just points there, with how each stands.
 */
export default function SettingsPage() {
  const { data: s } = useSettings();
  const items = [
    {
      href: '/onboarding',
      icon: ClipboardCheck,
      title: 'Sign-ups and free trial',
      where: 'Onboarding',
      now: s && `${s.signupOpen ? 'Anyone can sign up' : 'Invite only'} · ${s.trialDays ?? s.envTrialDays}-day trial`,
    },
    {
      href: '/plans',
      icon: Layers,
      title: 'Plans, payment methods, online payments, receipt details',
      where: 'Plans & billing',
      now: s && `${s.plans?.length ?? 0} plan${s.plans?.length === 1 ? '' : 's'} · ${s.onlineGateways.length} online gateway${s.onlineGateways.length === 1 ? '' : 's'} set up`,
    },
    {
      href: '/announcements',
      icon: Megaphone,
      title: 'Maintenance banner',
      where: 'Announcements',
      now: s && (s.maintenanceMessage ? 'Showing' : 'Off'),
    },
    {
      href: '/activity',
      icon: ScrollText,
      title: 'How long the activity log is kept',
      where: 'Activity Log',
      now: s && (s.auditRetentionDays == null ? 'Forever' : `${s.auditRetentionDays} days`),
    },
    {
      href: '/admins',
      icon: ShieldCheck,
      title: 'Two-factor for all admins, daily summary email',
      where: 'Admins',
      now: s && `Two-factor ${s.requireAdminTwoFactor ? 'required' : 'optional'} · summary ${s.adminDigestEnabled ? 'on' : 'off'}`,
    },
    {
      href: '/system',
      icon: Activity,
      title: 'Background jobs, server health',
      where: 'System',
      now: undefined,
    },
  ];
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Each setting now sits on the page for the feature it controls." />
      <div className="space-y-3">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="block">
            <Card className="flex items-center gap-4 p-4 transition-all duration-150 hover:-translate-y-1 hover:border-primary hover:bg-primary/5 hover:shadow-lg">
              <it.icon className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{it.title}</p>
                <p className="text-xs text-muted-foreground">
                  On <span className="font-medium text-foreground">{it.where}</span>
                  {it.now ? ` · ${it.now}` : ''}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
