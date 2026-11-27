import { Mic } from 'lucide-react';
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
      <Container className="flex flex-wrap items-center gap-12">
        <div className="min-w-0 flex-[1_1_460px]">
          <SectionHeading
            as="h1"
            eyebrow="Free try"
            title="Try it free: one ad"
            intro="See what Kalpix makes with your own product before you create an account. No sign-up, no email."
          />
          <ol className="mt-9 flex flex-col gap-5">
            {included.map((t, i) => (
              <li key={t} className="flex items-start gap-5">
                <span
                  className="w-12 font-display text-[34px] leading-none font-light text-concrete-light"
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>
                  <span
                    className="mt-1 mb-2.5 block h-[3px] w-[26px] rounded bg-blue"
                    aria-hidden="true"
                  />
                  <span className="text-lg">{t}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="kx-night relative flex min-w-0 flex-[1_1_400px] flex-col items-center gap-5 overflow-hidden rounded-[34px] p-10 text-center text-white shadow-[0_30px_60px_rgb(11_16_51/0.3)]">
          <p className="text-[13px] font-semibold tracking-[0.26em] text-[#8fb0ff]">
            YOUR FIRST AD
          </p>
          <span
            className="kx-bluepulse flex h-28 w-28 items-center justify-center rounded-full bg-blue"
            aria-hidden="true"
          >
            <Mic className="h-11 w-11" />
          </span>
          <p className="font-display text-2xl leading-snug font-light">
            "Mere café ka promotion karo"
          </p>
          <div className="flex w-full flex-col gap-3">
            {user ? (
              <>
                <p className="text-[#c9cdf0]">You are already signed in.</p>
                <ButtonLink
                  to="/app"
                  size="lg"
                  className="w-full bg-white text-navy hover:bg-white/90"
                >
                  Go to my ads
                </ButtonLink>
              </>
            ) : (
              <>
                {captcha.widget}
                {error && <FormMessage tone="error">{error}</FormMessage>}
                <Button
                  size="lg"
                  className="w-full bg-white text-navy hover:bg-white/90"
                  disabled={busy || !captcha.ready}
                  onClick={() => void start()}
                >
                  {busy ? 'Starting…' : 'Start my free try'}
                </Button>
                <p className="text-sm text-[#c9cdf0]">
                  One free try per device per day. Unsaved trials are deleted after 7 days. By
                  continuing you agree to our Terms and Privacy Policy.
                </p>
              </>
            )}
          </div>
          <p className="border-t border-[#8fb0ff]/25 pt-4 text-sm text-[#c9cdf0]">
            Want 10 credits and your work saved?{' '}
            <a href="/signup" className="font-semibold text-white underline underline-offset-4">
              Create a free account
            </a>
          </p>
        </div>
      </Container>

      <Container className="mt-14 grid gap-5 sm:grid-cols-3">
        {[
          ['हिंदी', 'bg-pink', '"दिवाली सेल का ऐड बनाओ, साड़ी पंद्रह सौ की"'],
          ['मराठी', 'bg-lemon', '"आमच्या हॉटेलची जाहिरात करा"'],
          ['English', 'bg-lilac', '"Promote my café, masala chai for 20 rupees"'],
        ].map(([lang, bg, said]) => (
          <div key={lang} className={`kx-lift rounded-[28px] p-7 ${bg}`}>
            <span className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold">
              {lang}
            </span>
            <p className="mt-4 font-display text-2xl leading-snug font-light">{said}</p>
          </div>
        ))}
      </Container>
    </Section>
  );
}
