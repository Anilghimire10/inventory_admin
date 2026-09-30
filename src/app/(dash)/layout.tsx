'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Building2,
  ScrollText,
  ShieldCheck,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Users,
  History,
  UserCog,
  TrendingUp,
  Mail,
  Activity,
  Megaphone,
  LifeBuoy,
  Settings,
  CalendarClock,
  ClipboardCheck,
  BadgeCheck,
  Layers,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { Spinner } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import { useTheme } from '@/theme/ThemeProvider';
import { cn } from '@/lib/utils';
import { AdminApi } from '@/lib/api';

// The sidebar, in sections, as in the shop app: Overview is always open, and
// of the rest one is open at a time -- the current page's, until another is
// picked.
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/', label: 'Overview', icon: LayoutDashboard },
      { href: '/growth', label: 'Growth', icon: TrendingUp },
      { href: '/onboarding', label: 'Onboarding', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Shops',
    items: [
      { href: '/businesses', label: 'Businesses', icon: Building2 },
      { href: '/plans', label: 'Plans & billing', icon: Layers },
      { href: '/payment-claims', label: 'Payments to confirm', icon: BadgeCheck },
      { href: '/renewals', label: 'Renewals', icon: CalendarClock },
      { href: '/users', label: 'Users', icon: Users },
    ],
  },
  {
    label: 'Support',
    items: [
      { href: '/support', label: 'Support', icon: LifeBuoy },
      { href: '/announcements', label: 'Announcements', icon: Megaphone },
    ],
  },
  {
    label: 'Logs',
    items: [
      { href: '/activity', label: 'Activity Log', icon: ScrollText },
      { href: '/admin-log', label: 'Admin Log', icon: History },
      { href: '/email-log', label: 'Email Log', icon: Mail },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/admins', label: 'Admins', icon: ShieldCheck },
      { href: '/system', label: 'System', icon: Activity },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default function DashLayout({ children }: { children: React.ReactNode }) {
  const { admin, loading, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // The section opened by hand, and on which page. On another page the
  // current page's section is open again.
  const [picked, setPicked] = useState<{ label: string | null; at: string } | null>(null);
  // Tickets waiting on us, for the badge on Support: open, and the shop wrote
  // last. Answered ones drop off. Polled, since shops write in.
  const awaitingTickets = useQuery({
    queryKey: ['admin-support', 'awaiting-count'],
    queryFn: () => AdminApi.tickets({ status: 'OPEN', limit: 1 }),
    enabled: !!admin,
    refetchInterval: 60_000,
    select: (d) => d.awaitingCount,
  });
  // Shops that say they've paid, waiting for an admin to check.
  const pendingClaims = useQuery({
    queryKey: ['admin-payment-claims', 'pending-count'],
    queryFn: () => AdminApi.paymentClaims({ status: 'PENDING', limit: 1 }),
    enabled: !!admin,
    refetchInterval: 60_000,
    select: (d) => d.pendingCount,
  });

  useEffect(() => {
    if (!loading && !admin) router.replace('/login');
  }, [loading, admin, router]);
  // Two-factor is required and not set up: the Account page is the only one
  // the API will serve, so don't strand the admin on a page of errors.
  useEffect(() => {
    if (admin?.twoFactorRequired && !pathname.startsWith('/account')) router.replace('/account');
  }, [admin, pathname, router]);

  if (loading || !admin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);
  const activeLabel = NAV_GROUPS.find((g) => g.items.some((i) => isActive(i.href)))?.label ?? null;
  const openLabel = picked && picked.at === pathname ? picked.label : activeLabel;

  // What's waiting on us, per page: a number on the nav item, and on a
  // folded section the total for its pages, so nothing hides behind a fold.
  const waiting: Record<string, { count?: number; what: string }> = {
    '/support': { count: awaitingTickets.data, what: 'waiting for a reply' },
    '/payment-claims': { count: pendingClaims.data, what: 'payments to confirm' },
  };
  const groupWaiting = (items: { href: string }[]) => items.reduce((n, i) => n + (waiting[i.href]?.count ?? 0), 0);
  const countBadge = (count: number | undefined, what = 'waiting') =>
    !!count && (
      <span
        className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-primary-foreground"
        aria-label={`${count} ${what}`}
      >
        {count}
      </span>
    );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          // Fixed on a phone (a drawer); on desktop it sticks at full screen
          // height, so it stays put down a long page and its menu scrolls on its own.
          'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 transform flex-col border-r border-border bg-card transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">Super Admin</span>
            <span className="text-[11px] text-muted-foreground">Platform Console</span>
          </div>
          <button
            className="ml-auto lg:hidden rounded-md p-2.5 hover:bg-accent"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
          {NAV_GROUPS.map((group) => {
            const isOverview = group.label === 'Overview';
            const isCollapsed = !isOverview && group.label !== openLabel;
            return (
              <div key={group.label} className="flex flex-col gap-1">
                {isOverview ? (
                  <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.label}
                  </p>
                ) : (
                  <button
                    // Opening one closes the others; clicking the open one closes it.
                    onClick={() => setPicked({ label: isCollapsed ? group.label : null, at: pathname })}
                    aria-expanded={!isCollapsed}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {group.label}
                    {/* Folded away, the Support count moves up here so it isn't hidden. */}
                    {isCollapsed && countBadge(groupWaiting(group.items))}
                    {isCollapsed ? (
                      <ChevronRight className={cn('h-4 w-4', !groupWaiting(group.items) && 'ml-auto')} />
                    ) : (
                      <ChevronDown className="ml-auto h-4 w-4" />
                    )}
                  </button>
                )}
                {!isCollapsed && (
                  <div className="flex flex-col gap-1">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          isActive(item.href)
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                        {countBadge(waiting[item.href]?.count, waiting[item.href]?.what)}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky Header matching inventory_frontend */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur lg:px-6">
          <button
            className="rounded-md p-2.5 text-muted-foreground hover:bg-accent lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="ml-auto flex items-center gap-2">
            {/* Theme Toggle */}
            <Tooltip content={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <button
                onClick={toggle}
                className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            </Tooltip>

            {/* Admin Avatar Dropdown */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={`Account menu for ${admin.email}`}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {(admin.email ?? 'A').charAt(0).toUpperCase()}
                </div>
                <div className="hidden text-left sm:block">
                  <div className="text-sm font-medium leading-tight">{admin.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {admin.role === 'SUPPORT' ? 'Support (read-only)' : 'Platform Admin'}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-1 w-52 rounded-md border border-border bg-popover p-1 shadow-lg animate-fade-in">
                  <div className="px-3 py-2 text-xs border-b border-border mb-1">
                    <p className="font-medium text-foreground truncate">{admin.email}</p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      {admin.role === 'SUPPORT' ? 'Support (read-only)' : 'Super Administrator'}
                    </p>
                  </div>
                  <Link
                    href="/account"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
                  >
                    <UserCog className="h-4 w-4" /> Change password
                  </Link>
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent transition-colors"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
