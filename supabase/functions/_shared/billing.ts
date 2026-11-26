// Shared steps of the billing Edge Functions: who is calling, and the service client.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { json } from './cors.ts';

const env = (...names: string[]) => {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (v) return v;
  }
  throw new Error(`Missing environment variable ${names[0]}`);
};

/** The signed-in user, from the verified token, or a 401 response. */
export async function caller(req: Request): Promise<{ userId: string } | Response> {
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json(req, { error: 'unauthorized' }, 401);
  const asUser = createClient(
    env('SUPABASE_URL'),
    env('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY'),
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user || data.user.is_anonymous)
    return json(req, { error: 'unauthorized' }, 401);
  return { userId: data.user.id };
}

export function serviceClient(): SupabaseClient {
  return createClient(
    env('SUPABASE_URL'),
    env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/** Stable error codes from the billing database functions, with their HTTP status. */
const billingErrors: Record<string, number> = {
  no_workspace: 404,
  not_owner: 403,
  invalid_plan: 422,
  invalid_pack: 422,
  plan_not_ready: 409,
  already_subscribed: 409,
  no_subscription: 404,
  rate_limited: 429,
};

export function billingError(
  req: Request,
  error: { message: string; code?: string },
  where: string,
) {
  const status = billingErrors[error.message];
  if (status) return json(req, { error: error.message }, status);
  console.error(`${where}: database error`, error.code);
  return json(req, { error: 'server_error' }, 500);
}

export const notConfigured = (req: Request) => json(req, { error: 'payments_not_configured' }, 503);
