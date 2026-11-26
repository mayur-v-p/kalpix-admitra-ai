// CORS for browser calls. Only the origins listed in ALLOWED_ORIGINS may call the functions
// from a browser (security.md: explicit origins, no wildcard). CORS is not authentication:
// every function still verifies the caller's JWT.
const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

/** Answers the browser's preflight request. */
export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders(req) }) : null;
}

/** JSON response with a stable error code and no internal details. */
export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}
