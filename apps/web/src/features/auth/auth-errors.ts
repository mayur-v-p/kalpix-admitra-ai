import type { AuthError } from '@supabase/supabase-js';

/**
 * Turns Supabase auth errors into plain messages. Login failures never say whether the
 * email exists (security.md: no account enumeration).
 */
export function friendlyAuthError(error: AuthError | Error | null | undefined): string {
  if (!error) return '';
  const code = 'code' in error ? (error.code as string | undefined) : undefined;
  switch (code) {
    case 'invalid_credentials':
      return 'That email and password do not match. Please try again.';
    case 'email_not_confirmed':
      return 'Please confirm your email first. Check your inbox for the link we sent.';
    case 'weak_password':
      return 'Please choose a stronger password: at least 8 characters with letters and numbers.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'same_password':
      return 'Your new password must be different from the old one.';
    case 'validation_failed':
    case 'provider_disabled':
      return 'Google sign-in is not switched on yet. Please use email and password for now.';
    case 'session_expired':
    case 'otp_expired':
      return 'This link has expired. Please request a new one.';
    default:
      return 'Something went wrong. Please try again in a moment.';
  }
}
