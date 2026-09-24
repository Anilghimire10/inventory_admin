'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
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
  Users,
  History,
  UserCog,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { Spinner } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import { useTheme } from '@/theme/ThemeProvider';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/businesses', label: 'Businesses', icon: Building2 },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/activity', label: 'Activity Log', icon: ScrollText },
  { href: '/admins', label: 'Admins', icon: ShieldCheck },
  { href: '/admin-log', label: 'Admin Log', icon: History },
];

export default function DashLayout({ children }: { children: React.ReactNode }) {
  const { admin, loading, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !admin) router.replace('/login');
  }, [loading, admin, router]);

  if (loading || !admin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 transform border-r border-border bg-card transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">Super Admin</span>
            <span className="text-[11px] text-muted-foreground">Platform Console</span>
          </div>
          <button
            className="ml-auto lg:hidden rounded-md p-1 hover:bg-accent"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            Management
          </p>
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
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
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent lg:hidden"
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
                  <div className="text-xs text-muted-foreground">Platform Admin</div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-1 w-52 rounded-md border border-border bg-popover p-1 shadow-lg animate-fade-in">
                  <div className="px-3 py-2 text-xs border-b border-border mb-1">
                    <p className="font-medium text-foreground truncate">{admin.email}</p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">Super Administrator</p>
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
