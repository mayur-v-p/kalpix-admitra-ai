import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { mainNav } from '@/config/site';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { cn } from '@/lib/utils';
import { Logo } from './logo';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex min-h-11 items-center px-1 text-base transition-colors hover:text-ink',
    isActive ? 'text-ink underline decoration-lamp decoration-2 underline-offset-8' : 'text-muted',
  );

/**
 * Site header. Desktop (768px and up): inline links. Mobile: a hamburger that opens a
 * full-width dropdown, which closes on link click, outside click or Escape (responsivness.md 2B).
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  // Close the menu whenever the page changes (e.g. after a link was followed).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  // While open: close on a click outside the header or on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-line/70 bg-paper/90 backdrop-blur"
    >
      <Container className="flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {mainNav.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ButtonLink to="/login" variant="ghost">
            Log in
          </ButtonLink>
          <ButtonLink to="/signup" variant="dark">
            Start free
          </ButtonLink>
        </div>

        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-ink hover:bg-ink/5 md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
      </Container>

      {open && (
        <div
          id="mobile-menu"
          className="animate-fade-up border-t border-line/70 bg-paper md:hidden"
        >
          <Container className="flex flex-col gap-1 py-4">
            <nav aria-label="Mobile" className="flex flex-col">
              {mainNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-12 items-center rounded-lg px-3 text-lg',
                      isActive ? 'bg-ink/5 text-ink' : 'text-muted',
                    )
                  }
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 flex flex-col gap-2 border-t border-line pt-4">
              <ButtonLink
                to="/login"
                variant="outline"
                className="w-full"
                onClick={() => setOpen(false)}
              >
                Log in
              </ButtonLink>
              <ButtonLink
                to="/signup"
                variant="dark"
                className="w-full"
                onClick={() => setOpen(false)}
              >
                Start free
              </ButtonLink>
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
