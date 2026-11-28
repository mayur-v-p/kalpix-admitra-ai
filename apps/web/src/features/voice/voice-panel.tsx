import { Mic, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  canListen,
  listenErrorText,
  SPEECH_LANG_LABEL,
  useListening,
  type SpeechLang,
} from './speech';

export const VOICE_BRIEF_PATH = '/app/voice';
export type VoiceBriefState = { transcript: string; lang: SpeechLang };

const LANG_KEY = 'kalpix.voiceLang';
const savedLang = (): SpeechLang => {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(LANG_KEY) : null;
  return v === 'mr' || v === 'en' ? v : 'hi';
};

export function MicDot({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-11 w-11' : size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const icon = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-lamp text-ink',
        box,
      )}
    >
      <Mic className={icon} aria-hidden="true" />
    </span>
  );
}

/**
 * "Speak your ad": a small button that opens a small listening panel. What was said goes to
 * the "Check your ad" page, where every value is shown, editable and confirmed before use.
 */
export function SpeakYourAd({
  className,
  tone = 'light',
}: {
  className?: string;
  tone?: 'light' | 'onPhoto';
}) {
  const navigate = useNavigate();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<SpeechLang>(savedLang);
  const [typed, setTyped] = useState('');
  const { listening, interim, final, error, start, stop } = useListening();
  const supported = canListen();
  const panel = useRef<HTMLDivElement | null>(null);
  const anchor = useRef<HTMLDivElement | null>(null);
  const [place, setPlace] = useState<{ top: number; left: number; width: number } | null>(null);

  // The panel is drawn at page level (a portal), so a card that clips its content (the
  // dashboard banner) can never hide it. It sits just under the button, inside the screen.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(380, window.innerWidth - 32);
      const left = Math.min(Math.max(16, r.left), window.innerWidth - width - 16);
      setPlace({ top: r.bottom + window.scrollY + 8, left: left + window.scrollX, width });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);

  // On short screens, scroll just enough to show the whole panel.
  useEffect(() => {
    if (open && place) panel.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [open, place]);

  const heard = `${final} ${interim}`.trim();
  const text = supported && !error ? heard : typed.trim();

  const begin = (l = lang) => {
    setOpen(true);
    if (supported) start(l);
  };
  const close = () => {
    stop();
    setOpen(false);
  };
  const go = () => {
    const transcript = (supported && !error ? final || heard : typed).trim();
    if (!transcript) return;
    stop();
    setOpen(false);
    navigate(VOICE_BRIEF_PATH, { state: { transcript, lang } satisfies VoiceBriefState });
  };
  const pickLang = (l: SpeechLang) => {
    setLang(l);
    localStorage.setItem(LANG_KEY, l);
    if (listening) {
      stop();
      setTimeout(() => start(l), 250);
    }
  };

  // Escape closes; clicking outside closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panel.current && !panel.current.contains(t) && !anchor.current?.contains(t)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close only reads stable refs
  }, [open]);

  return (
    <div ref={anchor} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => (open ? close() : begin())}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          'inline-flex min-h-11 items-center gap-2 rounded-xl py-1 pr-4 pl-1.5 font-semibold transition-shadow',
          tone === 'onPhoto'
            ? 'bg-card text-ink shadow-float'
            : 'border border-line bg-card text-ink hover:shadow-soft',
        )}
      >
        <MicDot />
        Speak your ad
      </button>

      {open &&
        createPortal(
          <div
            ref={panel}
            id={panelId}
            role="dialog"
            aria-label="Speak your ad"
            style={place ? { top: place.top, left: place.left, width: place.width } : undefined}
            className={cn(
              'animate-page-in absolute z-50 flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 text-ink shadow-float',
              !place && 'invisible',
            )}
          >
            <div className="flex items-center gap-3">
              <span className="relative inline-flex">
                {listening && (
                  <span
                    className="absolute inset-0 animate-ping rounded-full bg-lamp/60"
                    aria-hidden="true"
                  />
                )}
                <MicDot size="lg" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {listening
                    ? `सुन रहे हैं… Listening (${SPEECH_LANG_LABEL[lang]})`
                    : heard
                      ? 'Got it.'
                      : 'Speak your ad'}
                </p>
                <p className="text-xs text-muted">
                  Say the ad you want, with or without price, discount and dates.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-ink/5"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div role="group" aria-label="Speaking language" className="flex gap-1.5">
              {(['hi', 'mr', 'en'] as SpeechLang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={l === lang}
                  onClick={() => pickLang(l)}
                  className={cn(
                    'min-h-9 rounded-lg border px-3 text-sm font-medium',
                    l === lang ? 'border-ink bg-ink text-white' : 'border-line bg-card',
                  )}
                >
                  {SPEECH_LANG_LABEL[l]}
                </button>
              ))}
            </div>

            {supported && !error ? (
              <p
                aria-live="polite"
                className="min-h-16 rounded-xl bg-paper px-3 py-2.5 leading-relaxed"
              >
                {heard || (
                  <span className="text-muted">
                    बोलिए… for example “Diwali sale ka ad banao, saree 1500 ki, 20 percent off”
                  </span>
                )}
              </p>
            ) : (
              <>
                {error && <p className="text-sm text-[#9A3B00]">{listenErrorText(error)}</p>}
                <label htmlFor={`${panelId}-typed`} className="text-sm font-medium">
                  Type what you want instead
                </label>
                <textarea
                  id={`${panelId}-typed`}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Diwali sale ka ad, saree 1500, 20% off, 15 se 20 November"
                  className="rounded-xl border border-line bg-paper px-3 py-2 text-base"
                />
              </>
            )}

            <div className="flex gap-2">
              {listening ? (
                <button
                  type="button"
                  onClick={stop}
                  className="min-h-11 flex-1 rounded-xl bg-ink font-semibold text-white"
                >
                  रोकें · Done
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={go}
                    disabled={!text}
                    className="min-h-11 flex-1 rounded-xl bg-lamp font-bold text-ink disabled:opacity-50"
                  >
                    Check ad details →
                  </button>
                  {supported && (
                    <button
                      type="button"
                      onClick={() => begin()}
                      className="min-h-11 rounded-xl border border-ink/20 bg-card px-3 font-semibold"
                    >
                      {heard ? 'Again' : 'Speak'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
