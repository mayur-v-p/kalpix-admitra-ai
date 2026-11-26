import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthContext, type AuthState } from './auth-context';

/** Keeps the signed-in session in React state and clears cached data on sign-out. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') {
        setRecovering(false);
        queryClient.clear(); // never show one user's data to the next
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      recovering,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading, recovering],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
