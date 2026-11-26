/**
 * Error monitoring with Sentry (architecture.md 3). Off unless VITE_SENTRY_DSN is set; the
 * DSN is a public key, safe in the browser. Sentry's code is loaded only when it is on.
 *
 * Privacy: no personal data is sent (Sentry 11 sends none by default; we set no user), and query
 * strings are removed from every URL, because signed Storage links carry access tokens.
 */
type SentryApi = typeof import('@sentry/react');

const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined) ?? '';
let sentry: SentryApi | null = null;

export const stripQuery = (url: string) => url.split(/[?#]/)[0];

export async function initMonitoring() {
  if (!dsn) return;
  const Sentry = await import('@sentry/react');
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: (import.meta.env.VITE_RELEASE as string | undefined) || undefined,
    tracesSampleRate: 0,
    beforeBreadcrumb(crumb) {
      if (crumb.data && typeof crumb.data.url === 'string')
        crumb.data.url = stripQuery(crumb.data.url);
      if (crumb.category === 'navigation' && crumb.data) {
        if (typeof crumb.data.from === 'string') crumb.data.from = stripQuery(crumb.data.from);
        if (typeof crumb.data.to === 'string') crumb.data.to = stripQuery(crumb.data.to);
      }
      return crumb;
    },
    beforeSend(event) {
      if (event.request?.url) event.request.url = stripQuery(event.request.url);
      delete event.request?.query_string;
      delete event.user;
      return event;
    },
  });
  sentry = Sentry;
}

/** Report an error that React caught (render errors), if monitoring is on. */
export function reportError(error: unknown) {
  sentry?.captureException(error);
}
