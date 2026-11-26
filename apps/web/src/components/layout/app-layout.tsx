import {
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Package,
  Palette,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { useWorkspace } from '@/features/workspace/hooks';
import { cn } from '@/lib/utils';
import { Logo } from './logo';

type NavItem = { label: string; to: string; Icon: LucideIcon; soon?: string };

const nav: NavItem[] = [
  { label: 'Dashboard', to: '/app', Icon: LayoutDashboard },
  { label: 'Business', to: '/app/business', Icon: Building2 },
  { label: 'Brand kit', to: '/app/brand', Icon: Palette },
  { label: 'Products', to: '/app/products', Icon: Package },
  { label: 'Campaigns', to: '/app/campaigns', Icon: Megaphone },
  { label: 'Billing', to: '/app/billing', Icon: CreditCard, soon: 'M7' },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {nav.map(({ label, to, Icon, soon }) => (
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
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center gap-3 rounded-xl px-3 transition-colors',
                  isActive ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/5',
                )
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
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

  const account = (
    <div className="border-t border-line pt-4">
      <p className="truncate font-medium">
        {data?.business?.name ?? data?.workspace.name ?? 'My business'}
      </p>
      <p className="truncate text-sm text-muted">{user?.email}</p>
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
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[16rem_1fr]">
      <a
        href="#app-main"
        className="sr-only rounded-full bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>

      {/* Desktop sidebar (the column keeps its white background on long pages) */}
      <div className="hidden border-r border-line bg-card lg:block">
        <aside className="sticky top-0 flex h-dvh flex-col gap-6 p-5">
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
            className="animate-fade-up absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col gap-6 bg-card p-5 shadow-billboard"
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
        <Outlet />
      </main>
    </div>
  );
}
