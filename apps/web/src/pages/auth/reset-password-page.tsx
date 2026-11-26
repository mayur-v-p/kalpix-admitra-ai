import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import type { z } from 'zod';
import { Button, ButtonLink } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/form-field';
import { useAuth } from '@/features/auth/auth-context';
import { friendlyAuthError } from '@/features/auth/auth-errors';
import { resetSchema } from '@/features/auth/auth-schemas';
import { supabase } from '@/lib/supabase';
import { AuthShell } from './auth-page';

/** Opened from the reset email. The link signs the user in for this one purpose. */
export function ResetPasswordPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) return setError(friendlyAuthError(updateError));
    navigate('/app', { replace: true });
  });

  if (!loading && !user) {
    return (
      <AuthShell
        title="Link expired"
        subtitle="This reset link is invalid or has already been used."
      >
        <ButtonLink to="/forgot-password" variant="dark" className="w-full">
          Request a new link
        </ButtonLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Use something you do not use anywhere else.">
      <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
        <TextField
          id="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, with letters and numbers."
          error={errors.password?.message}
          {...register('password')}
        />
        <TextField
          id="confirm"
          label="Repeat new password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register('confirm')}
        />
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <Button
          type="submit"
          variant="dark"
          size="lg"
          className="w-full"
          disabled={isSubmitting || loading}
        >
          {isSubmitting ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    </AuthShell>
  );
}
