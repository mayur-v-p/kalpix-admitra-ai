import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/form-field';
import { plans } from '@/data/plans';
import { friendlyAuthError } from '@/features/auth/auth-errors';
import { useCaptcha } from '@/features/auth/captcha';
import { safeShopName, SHOP_PARAM, signupSchema } from '@/features/auth/auth-schemas';
import { signInWithGoogle } from '@/features/auth/google';
import { supabase } from '@/lib/supabase';
import { AuthShell, Divider, GoogleButton, SwitchAuthLink } from './auth-page';

type SignupValues = z.input<typeof signupSchema>;

export function SignupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Only a known plan id is shown; anything else in the URL is ignored.
  const chosenPlan = plans.find((p) => p.id === params.get('plan') && p.price > 0);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // The shop name typed on the home page (only a starting value for onboarding).
  const shopName = safeShopName(params.get(SHOP_PARAM));
  const captcha = useCaptcha();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) });

  const onSubmit = handleSubmit(async ({ fullName, email, password }) => {
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Display values only; never used for access decisions.
        data: { full_name: fullName, ...(shopName ? { shop_name: shopName } : {}) },
        emailRedirectTo: `${window.location.origin}/app`,
        captchaToken: captcha.token,
      },
    });
    if (signUpError) {
      captcha.reset();
      return setError(friendlyAuthError(signUpError));
    }
    // If the project does not require email confirmation, the user is already signed in.
    if (data.session) return navigate('/app', { replace: true });
    // Same message whether or not the email was already registered (no account enumeration).
    setSentTo(email);
  });

  const onGoogle = async () => {
    setError(null);
    const { error: googleError } = await signInWithGoogle();
    if (googleError) setError(friendlyAuthError(googleError));
  };

  if (sentTo) {
    return (
      <AuthShell title="Check your email" subtitle="One more step to activate your account.">
        <FormMessage tone="success">
          We sent a confirmation link to <strong className="break-all">{sentTo}</strong>. Open it on
          this device to finish creating your account.
        </FormMessage>
        <p className="mt-6 text-muted">
          No email after a few minutes? Check your spam folder, or{' '}
          <button
            type="button"
            className="min-h-11 underline underline-offset-4"
            onClick={() => setSentTo(null)}
          >
            try again
          </button>
          .
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle={
        chosenPlan
          ? `Start free, then switch to ${chosenPlan.name} from billing whenever you are ready.`
          : 'Free to start. No card needed.'
      }
    >
      <GoogleButton onClick={onGoogle} disabled={isSubmitting} />
      <Divider />
      <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
        <TextField
          id="fullName"
          label="Your name"
          autoComplete="name"
          error={errors.fullName?.message}
          {...register('fullName')}
        />
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
          autoComplete="new-password"
          hint="At least 8 characters, with letters and numbers."
          error={errors.password?.message}
          {...register('password')}
        />
        <div>
          <label className="flex items-start gap-3 text-base">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 shrink-0 accent-ink"
              aria-invalid={errors.accept ? true : undefined}
              {...register('accept')}
            />
            <span>
              I agree to the{' '}
              <Link to="/terms" className="underline underline-offset-4">
                Terms
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="underline underline-offset-4">
                Privacy policy
              </Link>
              .
            </span>
          </label>
          {errors.accept && (
            <p className="mt-1.5 text-sm text-red-700" role="alert">
              {errors.accept.message}
            </p>
          )}
        </div>
        {captcha.widget}
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <Button
          type="submit"
          variant="dark"
          size="lg"
          className="w-full"
          disabled={isSubmitting || !captcha.ready}
        >
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <SwitchAuthLink question="Already have an account?" to="/login" label="Log in" />
    </AuthShell>
  );
}
