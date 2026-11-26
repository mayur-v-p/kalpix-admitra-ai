// HMAC-SHA256 signatures for webhooks (Razorpay and the AI video provider).

export async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison, so the signature can't be guessed byte by byte. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signBody(secret: string, body: string) {
  return hmacHex(secret, body);
}

/** True only if `signature` is the hex HMAC of the exact raw body with this secret. */
export async function verifySignature(secret: string, body: string, signature: string | null) {
  if (!secret || !signature) return false;
  return safeEqual(await hmacHex(secret, body), signature.trim().toLowerCase());
}
