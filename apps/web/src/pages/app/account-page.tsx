import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/form-field';
import { getMfaState } from '@/features/account/mfa';
import { MfaChallenge, MfaSetup } from '@/features/account/mfa-forms';
import { useAuth } from '@/features/auth/auth-context';
import { friendlyAuthError } from '@/features/auth/auth-errors';
import { supabase } from '@/lib/supabase';
import { PageHeader } from './page-state';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Free try -> real account: link an email to the anonymous user; the work stays. */
function SaveTrial() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: `${window.location.origin}/app/account?saved=1` },
    );
    setBusy(false);
    if (err) return setError(friendlyAuthError(err));
    setSentTo(email.trim());
  };

  if (sentTo)
    return (
      <FormMessage tone="success">
        We sent a link to <strong className="break-all">{sentTo}</strong>. Open it to finish: your
        free try becomes your account, with everything you made and 10 free credits.
      </FormMessage>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <TextField
        id="save-email"
        label="Your email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Button
        type="submit"
        variant="dark"
        disabled={!EMAIL.test(email.trim()) || busy}
        className="w-fit"
      >
        {busy ? 'Sending…' : 'Save my work'}
      </Button>
    </form>
  );
}

/** After saving a trial (or any time): choose a password for email log-in. */
function SetPassword() {
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(friendlyAuthError(err));
    setDone(true);
    setPassword('');
  };
  if (done) return <FormMessage tone="success">Password saved.</FormMessage>;
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <TextField
        id="new-password"
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters with letters and numbers."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Button
        type="submit"
        variant="outline"
        disabled={password.length < 8 || busy}
        className="w-fit"
      >
        {busy ? 'Saving…' : 'Save password'}
      </Button>
    </form>
  );
}

export function AccountPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mfa = useQuery({ queryKey: ['mfa', user?.id], queryFn: getMfaState, enabled: !!user });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['mfa', user?.id] });
  const justSaved = new URLSearchParams(window.location.search).has('saved');

  if (user?.is_anonymous)
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          eyebrow="Free try"
          title="Save your work"
          intro="Add your email to turn this free try into a free account. Everything you made stays, and you get 10 credits."
        />
        <section className="rounded-2xl border border-line bg-card p-6 shadow-soft">
          <SaveTrial />
        </section>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Account" title="Account and security" intro={user?.email ?? undefined} />
      {justSaved && (
        <div className="mb-6">
          <FormMessage tone="success">
            Your work is saved to your account. Choose a password below so you can log in with your
            email.
          </FormMessage>
        </div>
      )}

      <section
        className="rounded-2xl border border-line bg-card p-6 shadow-soft"
        aria-labelledby="pw"
      >
        <h2 id="pw" className="text-xl uppercase">
          Password
        </h2>
        <div className="mt-4">
          <SetPassword />
        </div>
      </section>

      <section
        className="mt-6 rounded-2xl border border-line bg-card p-6 shadow-soft"
        aria-labelledby="mfa"
      >
        <h2 id="mfa" className="flex items-center gap-2 text-xl uppercase">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" /> Two-step login
        </h2>
        <p className="mt-2 text-muted">
          After your password, Kalpix also asks for a code from your phone, so a stolen password is
          not enough to get in.
        </p>
        <div className="mt-4">
          {mfa.isLoading ? null : mfa.data?.factorId ? (
            mfa.data.verified ? (
              <FormMessage tone="success">Two-step login is on for this account.</FormMessage>
            ) : (
              <>
                <p className="mb-3">Two-step login is on. Enter a code to unlock admin tools.</p>
                <MfaChallenge factorId={mfa.data.factorId} onDone={refresh} />
              </>
            )
          ) : (
            <MfaSetup onDone={refresh} />
          )}
        </div>
      </section>
    </div>
  );
}
