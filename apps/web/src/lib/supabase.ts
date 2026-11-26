import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * The browser's Supabase client. It only ever holds the project URL and the PUBLISHABLE key;
 * every read and write is checked by row-level security in the database.
 * Never create a client with the secret key in browser code.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && publishableKey);

if (!isSupabaseConfigured && import.meta.env.MODE !== 'test') {
  console.error(
    'Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example).',
  );
}

export const supabase = createClient<Database>(
  url || 'http://127.0.0.1:54321',
  publishableKey || 'missing-publishable-key',
  {
    auth: {
      flowType: 'pkce', // email links and Google sign-in return a one-time code, not tokens in the URL
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
