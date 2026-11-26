// qr-redirect: the link inside every ad's QR code. GET ?c=<code>
//
// Public by design (verify_jwt = false): customers scan it with a phone camera, no login.
// Safety instead comes from:
//  * the code is a random 12-character id; nothing else is accepted,
//  * the target is worked out NOW from CONFIRMED facts only (same rule as qrAllowed in
//    @admitra/styles-engine): WhatsApp / call on the confirmed phone, or the map at the
//    confirmed address. Never a URL taken from the request, so it cannot be an open redirect,
//  * per-IP rate limit (the IP is hashed, never stored),
//  * the scan is logged as a count only (no IP, no device data) for the owner's stats.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { qrTarget } from '../_shared/qr-target.ts';

const CODE = /^[0-9a-f]{12}$/;
const MAX_PER_MINUTE = 30;

const env = (...names: string[]) => {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (v) return v;
  }
  throw new Error(`Missing environment variable ${names[0]}`);
};

const text = (body: string, status: number) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });

async function sha256(value: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join(
    '',
  );
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') return text('Method not allowed', 405);
  const code = new URL(req.url).searchParams.get('c') ?? '';
  if (!CODE.test(code)) return text('This QR code is not valid.', 404);

  const admin = createClient(
    env('SUPABASE_URL'),
    env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  // cf-connecting-ip is set by Cloudflare in front of Supabase and cannot be faked by the
  // visitor; x-forwarded-for's first entry can, so it is only the local-development fallback.
  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    ((req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown');
  const { data: allowed } = await admin.rpc('consume_rate_limit', {
    p_key: `qr:${await sha256(ip)}`,
    p_max: MAX_PER_MINUTE,
    p_window_seconds: 60,
  });
  if (allowed === false) return text('Too many scans. Please try again in a minute.', 429);

  const { data: link } = await admin
    .from('qr_links')
    .select('id, workspace_id, campaign:campaigns(name, cta, business_id)')
    .eq('code', code)
    .maybeSingle();
  const campaign = Array.isArray(link?.campaign) ? link?.campaign[0] : link?.campaign;
  if (!link || !campaign) return text('This QR code is no longer active.', 404);

  const [{ data: business }, { data: location }] = await Promise.all([
    admin
      .from('business_profiles')
      .select('phone, phone_confirmed_at')
      .eq('id', campaign.business_id)
      .maybeSingle(),
    admin
      .from('business_locations')
      .select('address, city, map_url, confirmed_at')
      .eq('business_id', campaign.business_id)
      .order('created_at')
      .limit(1)
      .maybeSingle(),
  ]);

  const target = qrTarget({
    campaignName: campaign.name,
    cta: campaign.cta,
    phone: business?.phone ?? null,
    phoneConfirmed: Boolean(business?.phone_confirmed_at),
    address: location?.confirmed_at ? location : null,
  });
  if (!target) return text('This business has not confirmed its contact details yet.', 404);

  const { error } = await admin
    .from('qr_scans')
    .insert({ workspace_id: link.workspace_id, qr_link_id: link.id });
  if (error) console.error('qr-redirect: scan not logged', error.code);

  return new Response(null, {
    status: 302,
    headers: { Location: target, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
});
