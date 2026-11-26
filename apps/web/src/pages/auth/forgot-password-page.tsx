import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/form-field';
import { friendlyAuthError } from '@/features/auth/auth-errors';
import { useCaptcha } from '@/features/auth/captcha';
import { forgotSchema } from '@/features/auth/auth-schemas';
import { supabase } from '@/lib/supabase';
import { AuthShell, SwitchAuthLink } from './auth-page';

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captcha = useCaptcha();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
      captchaToken: captcha.token,
    });
    captcha.reset();
    // Rate limits are worth reporting; anything else gets the same neutral message,
    // so the page never reveals whether an account exists.
    if (resetError && resetError.code?.startsWith('over_'))
      return setError(friendlyAuthError(resetError));
    setSent(true);
  });

  return (
    <AuthShell title="Reset password" subtitle="We will email you a link to choose a new password.">
      {sent ? (
        <FormMessage tone="success">
          If an account exists for that email, a reset link is on its way. The link works once and
          expires after an hour.
        </FormMessage>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
          <TextField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          {captcha.widget}
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <Button
            type="submit"
            variant="dark"
            size="lg"
            className="w-full"
            disabled={isSubmitting || !captcha.ready}
          >
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
      <SwitchAuthLink question="Remembered it?" to="/login" label="Back to log in" />
    </AuthShell>
  );
}
