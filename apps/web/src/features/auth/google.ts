import { supabase } from '@/lib/supabase';

/** Starts Google sign-in. Google returns to /app, where the one-time code is exchanged for a session. */
export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/app` },
  });
}
