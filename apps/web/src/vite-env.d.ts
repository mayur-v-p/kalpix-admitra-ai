/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Safe for the browser. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable (anon) key. Safe for the browser: RLS protects the data. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
