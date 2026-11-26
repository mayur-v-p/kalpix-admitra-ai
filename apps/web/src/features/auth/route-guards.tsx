import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';

function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-ink" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** App pages: signed-in users only. Others go to /login and come back afterwards. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/** Login / sign-up pages: signed-in users are sent straight to the app. */
export function RedirectIfSignedIn() {
  const { user, loading, recovering } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (user && !recovering) return <Navigate to="/app" replace />;
  return <Outlet />;
}
