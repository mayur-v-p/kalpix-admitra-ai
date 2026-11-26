import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { creditsKey } from '@/features/exports/hooks';
import {
  cancelSubscription,
  getBillingStatus,
  getRefState,
  listLedger,
  listPacks,
  listPayments,
  listPlans,
} from './api';

export const billingKey = (workspaceId: string | undefined) => ['billing', workspaceId] as const;

export function usePlans() {
  return useQuery({ queryKey: ['plans'], queryFn: listPlans, staleTime: 10 * 60_000 });
}

export function usePacks() {
  return useQuery({ queryKey: ['credit-packs'], queryFn: listPacks, staleTime: 10 * 60_000 });
}

export function useBillingStatus(workspaceId: string | undefined) {
  return useQuery({
    queryKey: billingKey(workspaceId),
    queryFn: () => getBillingStatus(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function usePayments(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['payments', workspaceId],
    queryFn: () => listPayments(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useLedger(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['credit-ledger', workspaceId],
    queryFn: () => listLedger(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useCancelSubscription(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: billingKey(workspaceId) }),
  });
}

/** Refreshes everything billing shows. */
export function useRefreshBilling(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    for (const key of [
      billingKey(workspaceId),
      creditsKey(workspaceId),
      ['payments', workspaceId],
      ['credit-ledger', workspaceId],
    ])
      void queryClient.invalidateQueries({ queryKey: key });
  };
}

/**
 * Waits for the webhook to confirm a payment: Realtime on the two payment tables (RLS-checked)
 * plus a poll every 3 s, for up to 2 minutes.
 */
export function useRefState(ref: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['payment-ref', ref],
    queryFn: () => getRefState(ref!),
    enabled: Boolean(ref),
    refetchInterval: (q) =>
      q.state.data === 'waiting' && q.state.dataUpdateCount < 40 ? 3000 : false,
  });
  const waiting = query.data === 'waiting';

  useEffect(() => {
    if (!ref || !waiting) return;
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ['payment-ref', ref] });
    const channel = supabase
      .channel(`payment-${ref}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'subscriptions', filter: `id=eq.${ref}` },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'payments', filter: `id=eq.${ref}` },
        refresh,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ref, waiting, queryClient]);

  const fetches = queryClient.getQueryState(['payment-ref', ref])?.dataUpdateCount ?? 0;
  return { ...query, timedOut: waiting && fetches >= 40 };
}
