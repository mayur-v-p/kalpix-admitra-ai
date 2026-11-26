import { supabase } from '@/lib/supabase';

/**
 * Two-step login (TOTP, an authenticator app such as Google Authenticator).
 * Required for the admin console (the database checks the session's aal2), offered to owners.
 */
export type MfaState = {
  /** The session has passed a second factor. */
  verified: boolean;
  /** A verified authenticator exists (so a code can be asked for). */
  factorId: string | null;
};

export async function getMfaState(): Promise<MfaState> {
  const [{ data: aal, error: e1 }, { data: factors, error: e2 }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const totp = factors.totp.find((f) => f.status === 'verified');
  return { verified: aal.currentLevel === 'aal2', factorId: totp?.id ?? null };
}

export type Enrollment = { factorId: string; qrCode: string; secret: string };

export async function startEnrollment(): Promise<Enrollment> {
  // Leftover unverified factors from an abandoned attempt would block a new one.
  const { data: list } = await supabase.auth.mfa.listFactors();
  for (const f of list?.all ?? []) {
    if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Kalpix ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error) throw error;
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Checks a 6-digit code; on success the session is upgraded to aal2. */
export async function verifyCode(factorId: string, code: string): Promise<boolean> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  return !error;
}

export const CODE = /^\d{6}$/;
