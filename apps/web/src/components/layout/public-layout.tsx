import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

/** Header + page + footer. Scrolls to the top on every page change. */
export function PublicLayout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <a
        href="#main"
        className="sr-only rounded-full bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {/* Animation 8: each page slides softly into place. */}
        <div key={pathname} className="animate-page-in">
          <Outlet />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
