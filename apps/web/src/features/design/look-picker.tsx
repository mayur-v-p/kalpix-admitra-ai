import {
  Composer,
  FORMATS,
  FPS,
  PURPOSES,
  type AdRecipe,
  type ComposerExtras,
  type OutlineHighlightProps,
  type Purpose,
  type RecipeContext,
} from '@admitra/styles-engine';
import '@admitra/styles-engine/src/composer/font-files';
import { Player } from '@remotion/player';
import { Check, Shuffle, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';
import { cn } from '@/lib/utils';
import { designLooks, type Looks } from './api';
import { PURPOSE_LABELS } from './labels';

/** Same look? (Saved recipes come back from the database with their keys reordered.) */
const lookKey = (r: AdRecipe) =>
  [r.name, r.layout, r.background, r.fonts, r.palette.bg, r.palette.accent, r.headline.text].join(
    '|',
  );
const same = (a: AdRecipe | null, b: AdRecipe) => Boolean(a) && lookKey(a!) === lookKey(b);

/**
 * "What is this ad for?" + "Pick a look": three live designs from the AI art director (or the
 * no-key surprise designer). "Use this look" saves the recipe on the campaign.
 */
export function LookPicker({
  campaignId,
  purpose,
  ctx,
  ad,
  extras,
  current,
  onPurpose,
  onUse,
}: {
  campaignId: string;
  purpose: Purpose;
  ctx: RecipeContext;
  ad: OutlineHighlightProps;
  extras: ComposerExtras;
  current: AdRecipe | null;
  onPurpose: (p: Purpose) => Promise<void>;
  onUse: (r: AdRecipe) => Promise<void>;
}) {
  const [looks, setLooks] = useState<Looks | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { width, height } = FORMATS['9:16'];

  const design = async (forPurpose: Purpose = purpose) => {
    setBusy(true);
    setError(null);
    try {
      const next = await designLooks(campaignId, { ...ctx, purpose: forPurpose }, seen);
      setLooks(next);
      setSeen((s) => [...s, ...next.recipes.map((r) => r.name)].slice(-12));
    } catch {
      setError('Could not make new looks. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const choosePurpose = async (p: Purpose) => {
    if (p === purpose) return;
    await onPurpose(p);
    setLooks(null);
    void design(p);
  };

  return (
    <section
      aria-labelledby="looks-title"
      className="mt-6 rounded-3xl border border-line bg-card p-5 shadow-soft"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2
            id="looks-title"
            className="font-sans text-xl font-medium tracking-normal normal-case"
          >
            Pick a look
          </h2>
          <p className="text-muted">
            Different designs from the same details. Your prices and dates are always your confirmed
            ones.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => design()}
          disabled={busy}
          className="shrink-0 whitespace-nowrap md:w-auto"
        >
          {looks ? (
            <Shuffle className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          )}
          {busy ? 'Designing…' : looks ? 'Try another look' : 'Design my ad'}
        </Button>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 font-medium">What is this ad for?</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Ad purpose">
          {PURPOSES.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={purpose === p}
              onClick={() => void choosePurpose(p)}
              className={cn(
                'min-h-11 rounded-full border px-4',
                purpose === p
                  ? 'border-indigo bg-indigo text-white'
                  : 'border-line bg-card hover:border-ink/50',
              )}
            >
              {PURPOSE_LABELS[p]}
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <div className="mt-4">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      )}

      {busy && !looks && (
        <p className="mt-6 flex items-center gap-2 text-muted" role="status">
          <Sparkles className="h-4 w-4 animate-pulse" aria-hidden="true" /> Designing three looks
          for you…
        </p>
      )}

      {looks && (
        <>
          <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-indigo-soft px-3 py-1 text-sm text-indigo-deep">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {looks.source === 'ai' ? 'Designed by AI' : 'Surprise designs (AI is not switched on)'}
          </p>
          <ul
            className={cn('mt-4 grid gap-5 sm:grid-cols-3', busy && 'opacity-50')}
            aria-busy={busy}
          >
            {looks.recipes.map((r, i) => {
              const using = same(current, r);
              return (
                <li key={`${r.name}-${i}`} className="flex flex-col items-center gap-3">
                  <div
                    className={cn(
                      'w-full max-w-[240px] overflow-hidden rounded-2xl shadow-billboard',
                      using && 'ring-4 ring-indigo ring-offset-4',
                    )}
                  >
                    <Player
                      component={Composer}
                      inputProps={{ aspect: '9:16', recipe: r, ad, extras }}
                      durationInFrames={r.duration * FPS}
                      fps={FPS}
                      compositionWidth={width}
                      compositionHeight={height}
                      style={{ width: '100%', aspectRatio: `${width} / ${height}` }}
                      loop
                      autoPlay
                      acknowledgeRemotionLicense
                    />
                  </div>
                  <p className="text-sm font-medium">{r.name}</p>
                  <Button
                    type="button"
                    variant={using ? 'dark' : 'outline'}
                    aria-pressed={using}
                    disabled={saving !== null}
                    onClick={async () => {
                      setSaving(i);
                      try {
                        await onUse(r);
                      } catch {
                        setError('Could not save this look. Please try again.');
                      } finally {
                        setSaving(null);
                      }
                    }}
                  >
                    {using ? <Check className="h-5 w-5" aria-hidden="true" /> : null}
                    {using ? 'Using this look' : saving === i ? 'Saving…' : 'Use this look'}
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
