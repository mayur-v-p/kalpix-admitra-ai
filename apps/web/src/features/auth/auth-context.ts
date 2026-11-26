import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';

export type AuthState = {
  session: Session | null;
  user: User | null;
  /** True until the stored session has been read on page load. */
  loading: boolean;
  /** True after the user opened a password-reset link. */
  recovering: boolean;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
