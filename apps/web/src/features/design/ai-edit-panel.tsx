import type { AdRecipe, RecipeContext } from '@admitra/styles-engine';
import { Check, Lock, Mic, Undo2, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';
import { cn } from '@/lib/utils';
import { canListen, listenOnce, type SpeechLang } from '@/features/voice/speech';
import { editDesign, QUICK_EDITS, type DesignChange, type QuickEdit } from './ai-edit';

const FACTS_NOTE =
  'Prices, offers, dates, phone and address are your facts, so AI never changes them. Change them in “Offer and dates”, or on the Products and Business pages.';

/**
 * "Change something": say or type a change, or tap a suggestion. The preview above updates and
 * the change is saved; "Undo last change" goes back one step.
 */
export function AiEditPanel({
  campaignId,
  recipe,
  ctx,
  brandColors,
  onApply,
}: {
  campaignId: string;
  recipe: AdRecipe;
  ctx: RecipeContext;
  brandColors: string[];
  onApply: (r: AdRecipe) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState<{ tone: 'info' | 'error' | 'success'; text: string } | null>(
    null,
  );
  // Newest first; `step` groups the changes of one edit so undo removes them together.
  const [log, setLog] = useState<(DesignChange & { step: number })[]>([]);
  const [history, setHistory] = useState<AdRecipe[]>([]);
  const lang: SpeechLang = ctx.language === 'mr' ? 'mr' : ctx.language === 'en' ? 'en' : 'hi';

  const run = async (request: string, quick?: QuickEdit) => {
    if (!request.trim() || busy) return;
    setBusy(quick ?? 'text');
    setNote(null);
    try {
      const out = await editDesign({ campaignId, recipe, request, ctx, brandColors, quick });
      if (out.kind === 'facts') setNote({ tone: 'info', text: FACTS_NOTE });
      else if (out.kind === 'none') setNote({ tone: 'info', text: out.message });
      else {
        await onApply(out.recipe);
        setHistory((h) => [...h, recipe].slice(-10));
        setLog((l) => [...out.changes.map((c) => ({ ...c, step: Date.now() })), ...l]);
        setText('');
      }
    } catch {
      setNote({ tone: 'error', text: 'Could not change the design. Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  const undo = async () => {
    const prev = history[history.length - 1];
    if (!prev || busy) return;
    setBusy('undo');
    try {
      await onApply(prev);
      setHistory((h) => h.slice(0, -1));
      setLog((l) => l.filter((c) => c.step !== l[0]?.step));
      setNote({ tone: 'success', text: 'Last change undone.' });
    } catch {
      setNote({ tone: 'error', text: 'Could not undo. Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  const speakChange = async () => {
    setListening(true);
    setNote(null);
    try {
      const heard = await listenOnce(lang);
      if (heard) {
        setText(heard);
        await run(heard);
      } else setNote({ tone: 'info', text: 'Didn’t hear anything. Please try again, or type.' });
    } catch {
      setNote({ tone: 'info', text: 'This browser cannot listen. Please type the change.' });
    } finally {
      setListening(false);
    }
  };

  return (
    <section
      aria-labelledby="ai-edit-title"
      className="mt-6 rounded-3xl border border-line bg-card p-5 shadow-soft"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="ai-edit-title"
            className="flex items-center gap-2 font-sans text-xl font-medium tracking-normal normal-case"
          >
            <Wand2 className="h-5 w-5 text-lamp" aria-hidden="true" /> Change something
          </h2>
          <p className="text-muted">Say or type what you want different. The preview updates.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void undo()}
          disabled={!history.length || busy !== null}
          className="w-auto"
        >
          <Undo2 className="h-4 w-4" aria-hidden="true" /> Undo last change
        </Button>
      </div>

      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(text);
        }}
      >
        <label htmlFor="ai-edit-input" className="sr-only">
          What should change?
        </label>
        <input
          id="ai-edit-input"
          type="text"
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          placeholder="For example: thoda festive banao"
          className="min-h-12 min-w-0 flex-[1_1_240px] rounded-full border border-line bg-card px-5 text-base focus:border-lamp focus:outline-none"
        />
        {canListen() && (
          <Button
            type="button"
            variant="dark"
            aria-label="Say the change"
            onClick={() => void speakChange()}
            disabled={busy !== null || listening}
            className={cn('w-12 px-0', listening && 'animate-pulse')}
          >
            <Mic className="h-5 w-5" aria-hidden="true" />
          </Button>
        )}
        <Button type="submit" disabled={!text.trim() || busy !== null} className="w-auto">
          {busy === 'text' ? 'Changing…' : 'Change it'}
        </Button>
      </form>

      <div className="mt-4">
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">Try one</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_EDITS.map((q) => (
            <button
              key={q.id}
              type="button"
              disabled={busy !== null}
              onClick={() => void run(q.request, q.id)}
              className="min-h-11 rounded-full border border-line bg-card px-4 hover:border-ink/50 disabled:opacity-60"
            >
              {busy === q.id ? 'Changing…' : q.label}
            </button>
          ))}
        </div>
      </div>

      <div aria-live="polite">
        {note && (
          <div className="mt-4">
            <FormMessage tone={note.tone}>{note.text}</FormMessage>
          </div>
        )}
      </div>

      {log.length > 0 && (
        <div className="mt-5">
          <h3 className="font-sans text-base font-semibold tracking-normal normal-case">
            What changed
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {log.map((c, i) => (
              <li key={`${c.title}-${i}`} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint">
                  <Check className="h-3.5 w-3.5 text-[#1f7a5a]" aria-hidden="true" />
                </span>
                <span>
                  <span className="font-semibold">{c.title}</span>
                  {c.detail ? ` — ${c.detail}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-5 flex items-start gap-3 rounded-2xl bg-navy px-4 py-3 text-sm text-white">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#8fb0ff]" aria-hidden="true" />
        <span>
          <span className="font-semibold">AI never changes your facts.</span>{' '}
          <span className="text-[#c9cde6]">
            Price, offer, dates, shop name, address and phone stay exactly as you confirmed them.
          </span>
        </span>
      </p>
    </section>
  );
}
