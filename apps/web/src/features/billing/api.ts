import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type PlanRow = Tables<'plans'>;
export type PackRow = Tables<'credit_packs'>;
export type SubscriptionRow = Tables<'subscriptions'>;
export type PaymentRow = Tables<'payments'>;
export type LedgerRow = Tables<'credit_ledger'>;

export type BillingStatus = {
  planId: string;
  planName: string;
  subscriptionStatus: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  watermark: boolean;
};

/** Stable error codes from the billing Edge Functions. */
export type BillingErrorCode =
  | 'payments_not_configured'
  | 'not_owner'
  | 'plan_not_ready'
  | 'already_subscribed'
  | 'no_subscription'
  | 'rate_limited'
  | 'invalid_plan'
  | 'invalid_pack'
  | 'payment_provider_error'
  | 'checkout_unavailable'
  | 'unknown';

const KNOWN: BillingErrorCode[] = [
  'payments_not_configured',
  'not_owner',
  'plan_not_ready',
  'already_subscribed',
  'no_subscription',
  'rate_limited',
  'invalid_plan',
  'invalid_pack',
  'payment_provider_error',
];

export class BillingError extends Error {
  constructor(public code: BillingErrorCode) {
    super(code);
  }
}

export const billingErrorText: Record<BillingErrorCode, string> = {
  payments_not_configured: 'Payments are not switched on yet. Please try again later.',
  not_owner: 'Only the owner of this business account can change the plan.',
  plan_not_ready: 'This plan cannot be bought yet. Please try again later.',
  already_subscribed: 'You already have a plan. It must end before you start another one.',
  no_subscription: 'There is no plan to cancel.',
  rate_limited: 'Too many attempts. Please wait a few minutes and try again.',
  invalid_plan: 'That plan is not available.',
  invalid_pack: 'That pack is not available.',
  payment_provider_error: 'Razorpay could not start the payment. Please try again.',
  checkout_unavailable: 'The payment window could not load. Check your connection and try again.',
  unknown: 'Something went wrong. Please try again.',
};

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let code: BillingErrorCode = 'unknown';
    if (error instanceof FunctionsHttpError) {
      const b = await error.context.json().catch(() => null);
      code = KNOWN.find((k) => k === b?.error) ?? 'unknown';
    }
    throw new BillingError(code);
  }
  return data as T;
}

/** Prices come only from the database (the browser never decides one). */
export async function listPlans(): Promise<PlanRow[]> {
  const { data, error } = await supabase.from('plans').select('*').order('sort');
  if (error) throw error;
  return data;
}

export async function listPacks(): Promise<PackRow[]> {
  const { data, error } = await supabase.from('credit_packs').select('*').order('price_inr');
  if (error) throw error;
  return data;
}

export async function getBillingStatus(workspaceId: string): Promise<BillingStatus> {
  const { data, error } = await supabase.rpc('billing_status', { p_workspace: workspaceId });
  if (error) throw error;
  const row = data[0];
  return {
    planId: row?.plan_id ?? 'free',
    planName: row?.plan_name ?? 'Free',
    subscriptionStatus: row?.subscription_status ?? null,
    periodEnd: row?.current_period_end ?? null,
    cancelAtPeriodEnd: row?.cancel_at_period_end ?? false,
    watermark: row?.watermark ?? true,
  };
}

export async function listPayments(workspaceId: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('workspace_id', workspaceId)
    .neq('status', 'created')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

export async function listLedger(workspaceId: string): Promise<LedgerRow[]> {
  const { data, error } = await supabase
    .from('credit_ledger')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

export type StartedSubscription = { ref: string; subscriptionId: string; keyId: string };
export type StartedOrder = {
  ref: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
};

export const startSubscription = (planId: string) =>
  invoke<StartedSubscription>('razorpay-create-subscription', { planId });

export const startPackOrder = (packId: string) =>
  invoke<StartedOrder>('razorpay-create-order', { packId });

export const cancelSubscription = () =>
  invoke<{ cancelled: boolean; atPeriodEnd: boolean }>('razorpay-cancel-subscription', {});

/**
 * Has the webhook confirmed this payment yet? `ref` is our own subscription or payment row id
 * (readable only by members of its workspace).
 */
export type RefState = 'waiting' | 'confirmed' | 'failed';

export async function getRefState(ref: string): Promise<RefState> {
  const [{ data: sub, error: e1 }, { data: pay, error: e2 }] = await Promise.all([
    supabase.from('subscriptions').select('status').eq('id', ref).maybeSingle(),
    supabase.from('payments').select('status').eq('id', ref).maybeSingle(),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (sub) {
    if (sub.status === 'active') return 'confirmed';
    if (sub.status === 'expired' || sub.status === 'halted') return 'failed';
    return 'waiting';
  }
  if (pay) {
    if (pay.status === 'paid') return 'confirmed';
    if (pay.status === 'failed') return 'failed';
    return 'waiting';
  }
  return 'failed';
}

/** ₹ from paise. */
export const paiseToInr = (paise: number) => paise / 100;
