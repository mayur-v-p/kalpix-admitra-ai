import { Check } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ButtonLink } from '@/components/ui/button';
import { Container, Section } from '@/components/ui/container';
import { FormMessage } from '@/components/ui/form-field';
import { SectionHeading } from '@/components/ui/section-heading';
import { useAuth } from '@/features/auth/auth-context';
import { friendlyAuthError } from '@/features/auth/auth-errors';
import { useCaptcha } from '@/features/auth/captcha';
import { supabase } from '@/lib/supabase';

const included = [
  'Tap the mic and say the ad you want, in Hindi, Marathi or English',
  'Add one product photo: we cut it out and trace its outline',
  'Write your offer and see your animated ad play live',
  'Export one short video (9:16, low resolution, with the Kalpix watermark)',
  'Keep everything when you create your free account',
];

/**
 * /try: the free try without an account (architecture.md 7.3). After the captcha the visitor
 * is signed in anonymously into a trial workspace; the trial limits are enforced by the
 * database, not by this page.
 */
export function TryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const captcha = useCaptcha();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setError(null);
    setBusy(true);
    const { error: e } = await supabase.auth.signInAnonymously({
      options: { captchaToken: captcha.token },
    });
    setBusy(false);
    if (e) {
      captcha.reset();
      return setError(friendlyAuthError(e));
    }
    // Straight to voice: speak the ad, check it, create it (the business is filled in there).
    navigate('/app/voice', { replace: true });
  };

  return (
    <Section className="pt-8 md:pt-14">
      <Container className="max-w-2xl">
        <SectionHeading
          as="h1"
          eyebrow="Free try"
          title="Try it free: one ad"
          intro="See what Kalpix makes with your own product before you create an account."
        />
        <ul className="mt-8 flex flex-col gap-3">
          {included.map((t) => (
            <li key={t} className="flex gap-3 text-lg">
              <Check className="mt-1.5 h-5 w-5 shrink-0 text-indigo-deep" aria-hidden="true" />
              <span>{t}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 shadow-soft">
          {user ? (
            <>
              <p>You are already signed in.</p>
              <ButtonLink to="/app" variant="dark" size="lg" className="w-full">
                Go to my ads
              </ButtonLink>
            </>
          ) : (
            <>
              {captcha.widget}
              {error && <FormMessage tone="error">{error}</FormMessage>}
              <Button
                variant="dark"
                size="lg"
                className="w-full"
                disabled={busy || !captcha.ready}
                onClick={() => void start()}
              >
                {busy ? 'Starting…' : 'Start my free try'}
              </Button>
              <p className="text-sm text-muted">
                One free try per device per day. Unsaved trials are deleted after 7 days. By
                continuing you agree to our Terms and Privacy Policy.
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-muted">
          Want 10 credits and your work saved?{' '}
          <a href="/signup" className="underline underline-offset-4">
            Create a free account
          </a>
        </p>
      </Container>
    </Section>
  );
}
