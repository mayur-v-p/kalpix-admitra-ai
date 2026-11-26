import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { AuthProvider } from '@/features/auth/auth-provider';
import { createQueryClient } from '@/lib/query-client';

/** Data cache + signed-in session, shared by every page. */
export function AppProviders({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [queryClient] = useState(() => client ?? createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
