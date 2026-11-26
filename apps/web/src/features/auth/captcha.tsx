import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cloudflare Turnstile captcha for sign-up, log-in, password reset and the free try.
 * Supabase Auth checks the token on its side (auth.captcha), so the browser cannot skip it.
 *
 * The site key is public (VITE_TURNSTILE_SITE_KEY). Without it the captcha is off: the
 * widget is not shown and no token is sent, which matches a Supabase project whose captcha
 * protection is also off. Local development uses Cloudflare's test key, which always passes.
 */
export const TURNSTILE_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? '';
export const captchaEnabled = siteKey.length > 0;

type Turnstile = {
  render(
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
      theme?: 'light' | 'dark' | 'auto';
      size?: 'normal' | 'flexible';
    },
  ): string;
  reset(id: string): void;
  remove(id: string): void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TURNSTILE_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      s.remove();
      loading = null;
      reject(new Error('captcha failed to load'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * The captcha for one form: render `widget` in the form, send `token` with the auth call,
 * and call `reset()` after a failed attempt (a token works once).
 */
export function useCaptcha() {
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!captchaEnabled) return;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(box.current, {
          sitekey: siteKey,
          size: 'flexible',
          theme: 'light',
          callback: (t) => {
            setToken(t);
            setFailed(false);
          },
          'expired-callback': () => setToken(null),
          'error-callback': () => setFailed(true),
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  const reset = useCallback(() => {
    setToken(null);
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  }, []);

  const widget = captchaEnabled ? (
    <div>
      <div ref={box} className="min-h-[65px]" />
      {failed && (
        <p className="mt-2 text-sm text-red-800" role="alert">
          The security check could not load. Check your connection and refresh the page.
        </p>
      )}
    </div>
  ) : null;

  return {
    widget,
    /** Pass as options.captchaToken; undefined when the captcha is off. */
    token: captchaEnabled ? (token ?? undefined) : undefined,
    /** True when the form may be submitted. */
    ready: !captchaEnabled || Boolean(token),
    reset,
  };
}
