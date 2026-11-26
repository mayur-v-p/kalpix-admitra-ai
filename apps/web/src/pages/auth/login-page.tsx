import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/form-field';
import { friendlyAuthError } from '@/features/auth/auth-errors';
import { loginSchema, safeNextPath } from '@/features/auth/auth-schemas';
import { signInWithGoogle } from '@/features/auth/google';
import { supabase } from '@/lib/supabase';
import { AuthShell, Divider, GoogleButton, SwitchAuthLink } from './auth-page';

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const next = safeNextPath((location.state as { from?: string } | null)?.from);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) return setError(friendlyAuthError(signInError));
    navigate(next, { replace: true });
  });

  const onGoogle = async () => {
    setError(null);
    const { error: googleError } = await signInWithGoogle();
    if (googleError) setError(friendlyAuthError(googleError));
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to create and manage your ads.">
      <GoogleButton onClick={onGoogle} disabled={isSubmitting} />
      <Divider />
      <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="-mt-2 flex justify-end">
          <Link
            to="/forgot-password"
            className="inline-flex min-h-11 items-center px-2 underline underline-offset-4"
          >
            Forgot password?
          </Link>
        </div>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <Button type="submit" variant="dark" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
      <SwitchAuthLink question="New to AdMitra?" to="/signup" label="Create a free account" />
    </AuthShell>
  );
}
