import { z } from 'zod';

// Same password rule as Supabase Auth (config.toml: 8+ characters, letters and digits).
export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use at most 72 characters.')
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/[0-9]/, 'Include at least one number.');

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email.')
  .email('Enter a valid email address.');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});

export const signupSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your name.').max(120, 'Use at most 120 characters.'),
  email: emailSchema,
  password: passwordSchema,
  accept: z.literal(true, { error: 'Please accept the Terms and Privacy policy.' }),
});

export const forgotSchema = z.object({ email: emailSchema });

export const resetSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match.',
  });

/** Only allow redirects back into our own app after sign-in (no open redirects). */
export function safeNextPath(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/app') && !value.startsWith('//')
    ? value
    : '/app';
}

/** Query parameter carrying the shop name typed on the home page into sign-up. */
export const SHOP_PARAM = 'shop';

/**
 * A shop name from the URL or user metadata, cleaned for use as a form's starting value only
 * (never for access decisions): plain text, 1–120 characters, or null.
 */
export function safeShopName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = Array.from(value)
    .filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127) // no control characters
    .join('')
    .trim()
    .slice(0, 120);
  return name.length > 0 ? name : null;
}
