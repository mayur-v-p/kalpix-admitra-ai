import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Shield,
  Store,
  UserRound,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { amIPlatformAdmin } from '@/features/admin/api';
import { useAuth } from '@/features/auth/auth-context';
import { useCredits } from '@/features/exports/hooks';
import { useWorkspace } from '@/features/workspace/hooks';
import { Logo } from './logo';

type NavItem = { label: string; to: string; Icon: LucideIcon; soon?: string };

const nav: NavItem[] = [
  { label: 'Dashboard', to: '/app', Icon: LayoutDashboard },
  { label: 'Business', to: '/app/business', Icon: Store },
  { label: 'Products', to: '/app/products', Icon: Package },
  { label: 'My Ads', to: '/app/ads', Icon: Video },
  { label: 'Billing', to: '/app/billing', Icon: CreditCard },
  { label: 'Account', to: '/app/account', Icon: UserRound },
];
const adminItem: NavItem = { label: 'Admin', to: '/admin', Icon: Shield };

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  // Only shows the link; the admin console itself checks admin + MFA in the database.
  const isAdmin = useQuery({
    queryKey: ['am-i-admin'],
    queryFn: amIPlatformAdmin,
    staleTime: 300_000,
  });
  const items = isAdmin.data ? [...nav, adminItem] : nav;
  return (
    <ul className="flex flex-col gap-1">
      {items.map(({ label, to, Icon, soon }) => (
        <li key={to}>
          {soon ? (
            <span
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-muted/70"
              aria-disabled="true"
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
              <span className="ml-auto rounded-full bg-paper-deep px-2 py-0.5 text-xs">Soon</span>
            </span>
          ) : (
            <NavLink
              to={to}
              end={to === '/app'}
              onClick={onNavigate}
              className="kx-nav flex min-h-12 items-center gap-3 rounded-2xl px-3 font-medium text-ink"
            >
              <span className="kx-nav-ic flex h-9 w-9 items-center justify-center rounded-xl">
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              {label}
            </NavLink>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Signed-in app shell: sidebar from 1024px, top bar + slide-in drawer below that. */
export function AppLayout() {
  const { user, signOut } = useAuth();
  const { data } = useWorkspace();
  const credits = useCredits(data?.workspace.id);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  // Close the drawer on navigation; close on Escape.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const onSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const name = data?.business?.name ?? data?.workspace.name ?? 'My business';
  const account = (
    <div className="flex flex-col gap-3">
      <Link
        to="/app/billing"
        className="kx-credit relative block overflow-hidden rounded-2xl p-4 text-white"
      >
        <span className="relative block text-sm text-[#d8d6f5]">Credits</span>
        <span className="relative mt-0.5 block font-display text-3xl leading-none">
          {credits.data?.available ?? '–'} <span className="text-sm text-[#d8d6f5]">left</span>
        </span>
        <span className="relative mt-3 block h-1.5 overflow-hidden rounded-full bg-white/20">
          <span
            className="kx-bar block h-full rounded-full bg-gradient-to-r from-[#f6c96f] to-[#e8b04b]"
            style={{ width: `${Math.min(100, ((credits.data?.available ?? 0) / 10) * 100)}%` }}
          />
        </span>
      </Link>
      <div className="flex items-center gap-3 px-1">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#e8b04b] to-[#c2410c] font-display text-lg text-white"
          aria-hidden="true"
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{name}</span>
          <span className="block truncate text-sm text-muted">
            {user?.is_anonymous ? 'Free try' : user?.email}
          </span>
        </span>
      </div>
      <button
        type="button"
        onClick={onSignOut}
        className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-ink hover:bg-ink/5"
      >
        <LogOut className="h-5 w-5" aria-hidden="true" /> Sign out
      </button>
    </div>
  );

  return (
    <div className="kx-app min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <a
        href="#app-main"
        className="sr-only rounded-full bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>

      {/* Desktop sidebar (the column keeps its white background on long pages) */}
      <div className="kx-side hidden lg:block">
        <aside className="sticky top-0 flex h-dvh flex-col gap-6 overflow-y-auto p-5">
          <Logo />
          <nav aria-label="App" className="flex-1">
            <NavList />
          </nav>
          {account}
        </aside>
      </div>

      {/* Mobile / tablet top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-paper/90 px-4 backdrop-blur lg:hidden">
        <Logo />
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-ink/5"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="app-drawer"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setOpen(false)}
          />
          <div
            id="app-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="App menu"
            className="animate-fade-up absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col gap-6 overflow-y-auto bg-card p-5 shadow-billboard"
          >
            <div className="flex items-center justify-between">
              <Logo />
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-ink/5"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="App mobile" className="flex-1">
              <NavList onNavigate={() => setOpen(false)} />
            </nav>
            {account}
          </div>
        </div>
      )}

      <main id="app-main" className="min-w-0 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        {user?.is_anonymous && pathname !== '/app/account' && (
          <div
            role="status"
            className="mx-auto mb-6 flex max-w-5xl flex-col gap-3 rounded-2xl bg-lamp-soft p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p>
              <strong>Free try:</strong> 1 product and 1 low-resolution video. Save your work to get
              10 credits; unsaved tries are deleted after 7 days.
            </p>
            <Link
              to="/app/account"
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-ink px-5 text-paper"
            >
              Save my work
            </Link>
          </div>
        )}
        <div key={pathname} className="animate-page-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
