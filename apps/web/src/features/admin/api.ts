import { supabase } from '@/lib/supabase';

/**
 * Admin console data. Every function here is a database function that checks, itself, that
 * the caller is a platform admin with two-step login (aal2); the browser decides nothing.
 */
export type AdminOverview = {
  users: number;
  users_7d: number;
  active_trials: number;
  paying_workspaces: number;
  revenue_month_inr: number;
  exports_today: number;
  exports_failed_7d: number;
  exports_waiting: number;
  avg_render_seconds_7d: number | null;
  ai_scenes_7d: number;
  ai_scenes_failed_7d: number;
  webhooks_24h: number;
  webhooks_unprocessed: number;
};

const must = <T>(r: { data: T | null; error: unknown }): T => {
  if (r.error) throw r.error;
  return r.data as T;
};

export async function amIPlatformAdmin(): Promise<boolean> {
  return must(await supabase.rpc('am_i_platform_admin'));
}

export async function getOverview(): Promise<AdminOverview> {
  return must(await supabase.rpc('admin_overview')) as unknown as AdminOverview;
}

export async function findUsers(query: string) {
  return must(await supabase.rpc('admin_find_users', { p_query: query }));
}
export type AdminUser = Awaited<ReturnType<typeof findUsers>>[number];

export async function adjustCredits(workspaceId: string, amount: number, reason: string) {
  return must(
    await supabase.rpc('admin_adjust_credits', {
      p_workspace: workspaceId,
      p_amount: amount,
      p_reason: reason,
    }),
  );
}

export async function recentFailures() {
  return must(await supabase.rpc('admin_recent_failures'));
}

export async function auditLog(limit = 100) {
  return must(await supabase.rpc('admin_audit_log', { p_limit: limit }));
}

export async function updatePlan(
  plan: string,
  razorpayPlanId: string,
  monthlyCredits: number,
  active: boolean,
) {
  must(
    await supabase.rpc('admin_update_plan', {
      p_plan: plan,
      p_razorpay_plan_id: razorpayPlanId,
      p_monthly_credits: monthlyCredits,
      p_active: active,
    }),
  );
}

export async function listAllSceneTypes() {
  return must(await supabase.from('ai_scene_types').select('*').order('id'));
}

export async function updateSceneType(id: string, active: boolean, creditCost: number) {
  must(
    await supabase.rpc('admin_update_scene_type', {
      p_id: id,
      p_active: active,
      p_credit_cost: creditCost,
    }),
  );
}

/** Admin error codes into plain words. */
export function adminErrorText(e: unknown): string {
  const m = (e as { message?: string } | null)?.message ?? '';
  if (m === 'not_enough_credits') return 'That would take the balance below zero.';
  if (m === 'reason_required') return 'Please write a short reason (it goes in the audit log).';
  if (m === 'invalid_amount') return 'That number is not allowed.';
  if (m === 'mfa_required') return 'Please verify your two-step login code again.';
  if (m.includes('razorpay_plan_id'))
    return 'A Razorpay plan id looks like plan_ followed by letters and numbers.';
  return 'That did not work. Please try again.';
}
