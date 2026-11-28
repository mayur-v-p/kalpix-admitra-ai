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
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';
import { cn } from '@/lib/utils';
import {
  pictureFor,
  pictureTag,
  REPRESENTATION_NOTE,
  type ProductPicture,
} from '@/features/products/pictures';
import { designLooks, DESIGNS_MADE, type Looks } from './api';
import { PhotoCard, ScoreBars } from './look-scores';
import { PURPOSE_LABELS } from './labels';

/** Same look? (Saved recipes come back from the database with their keys reordered.) */
const lookKey = (r: AdRecipe) =>
  [r.name, r.layout, r.background, r.fonts, r.palette.bg, r.palette.accent, r.headline.text].join(
    '|',
  );
const same = (a: AdRecipe | null, b: AdRecipe) => Boolean(a) && lookKey(a!) === lookKey(b);
const RANKS = ['Best match', '2nd', '3rd'];

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
  autoStart = false,
  pictures = [],
  mainUrl = null,
}: {
  /** The product's AI pictures (each design may use a different one). */
  pictures?: ProductPicture[];
  /** The main photo the ad uses (product or business photo), if any. */
  mainUrl?: string | null;
  /** Design three looks as soon as the Studio opens (ads started with one tap). */
  autoStart?: boolean;
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
  const [showHidden, setShowHidden] = useState(false);
  const { width, height } = FORMATS['9:16'];

  // The picture each design shows, and the note an AI picture made from words needs.
  const forLook = (r: AdRecipe) => {
    const shown = pictureFor(r.picture, pictures, mainUrl);
    return {
      ad: { ...ad, productImageUrl: shown.url },
      extras: {
        ...extras,
        imageNote: shown.picture?.kind === 'generated' ? REPRESENTATION_NOTE : null,
      },
      tag: pictureTag(shown.picture, Boolean(mainUrl)),
    };
  };

  const use = async (r: AdRecipe, i: number) => {
    setSaving(i);
    try {
      await onUse(r);
    } catch {
      setError('Could not save this look. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const design = async (forPurpose: Purpose = purpose) => {
    setBusy(true);
    setError(null);
    try {
      const next = await designLooks(campaignId, { ...ctx, purpose: forPurpose }, seen);
      setLooks(next);
      setShowHidden(false);
      setSeen((s) =>
        [...s, ...[...next.shown, ...next.hidden].map((l) => l.recipe.name)].slice(-12),
      );
    } catch {
      setError('Could not make new looks. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    // Deferred so the effect itself does not set state.
    queueMicrotask(() => void design());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on open
  }, [autoStart]);

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
          <Sparkles className="h-4 w-4 animate-pulse" aria-hidden="true" />
          {ctx.hasPhoto
            ? `Looking at your photo and making ${DESIGNS_MADE} designs…`
            : `Making ${DESIGNS_MADE} designs for you…`}
        </p>
      )}

      {looks && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-indigo-soft px-3 py-1 text-sm text-indigo-deep">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {looks.source === 'ai'
                ? 'Designed by AI'
                : 'Surprise designs (AI is not switched on)'}
            </p>
            <p className="text-sm text-muted">
              {looks.shown.length + looks.hidden.length} designs made, best {looks.shown.length}{' '}
              shown. Each is checked for easy reading on a phone, text contrast
              {looks.photo ? ' and how well it suits your photo' : ''}.
            </p>
          </div>

          {looks.photo && <PhotoCard photo={looks.photo} imageUrl={ad.productImageUrl ?? null} />}

          <ul
            className={cn('mt-5 grid gap-5 sm:grid-cols-3', busy && 'opacity-50')}
            aria-busy={busy}
          >
            {looks.shown.map((l, i) => {
              const r = l.recipe;
              const using = same(current, r);
              const look = forLook(r);
              return (
                <li key={`${r.name}-${i}`} className="flex flex-col gap-3">
                  <div
                    className={cn(
                      'relative mx-auto w-full max-w-[240px] overflow-hidden rounded-2xl shadow-billboard',
                      using && 'ring-4 ring-indigo ring-offset-4',
                    )}
                  >
                    <Player
                      component={Composer}
                      inputProps={{ aspect: '9:16', recipe: r, ad: look.ad, extras: look.extras }}
                      durationInFrames={r.duration * FPS}
                      fps={FPS}
                      compositionWidth={width}
                      compositionHeight={height}
                      style={{ width: '100%', aspectRatio: `${width} / ${height}` }}
                      loop
                      autoPlay
                      acknowledgeRemotionLicense
                    />
                    <span className="absolute top-2 left-2 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-ink shadow-soft">
                      {RANKS[i]}
                    </span>
                  </div>
                  <p className="flex flex-wrap items-center justify-between gap-2 font-medium">
                    {r.name}
                    {look.tag && (
                      <span className="rounded-full bg-lilac px-2.5 py-0.5 text-xs font-semibold">
                        {look.tag}
                      </span>
                    )}
                  </p>
                  <ScoreBars score={l.score} />
                  {l.why && (
                    <p className="rounded-xl bg-paper-deep px-3 py-2 text-sm">
                      <span className="font-semibold">Why: </span>
                      {l.why}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant={using ? 'dark' : 'outline'}
                    aria-pressed={using}
                    disabled={saving !== null}
                    onClick={() => void use(r, i)}
                    className="mt-auto"
                  >
                    {using ? <Check className="h-5 w-5" aria-hidden="true" /> : null}
                    {using ? 'Using this look' : saving === i ? 'Saving…' : 'Use this look'}
                  </Button>
                </li>
              );
            })}
          </ul>

          {looks.hidden.length > 0 && (
            <div className="mt-5 rounded-2xl border border-line p-4">
              <button
                type="button"
                aria-expanded={showHidden}
                onClick={() => setShowHidden((v) => !v)}
                className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
              >
                <span>
                  <span className="font-semibold">
                    {looks.hidden.length} designs we didn&apos;t show you
                  </span>{' '}
                  <span className="text-muted">and why</span>
                </span>
                <span className="font-semibold text-indigo-deep">
                  {showHidden ? 'Hide' : 'Show'}
                </span>
              </button>
              {showHidden && (
                <ul className="mt-3 grid gap-3 sm:grid-cols-3">
                  {looks.hidden.map((l, i) => {
                    const r = l.recipe;
                    const k = 100 + i;
                    return (
                      <li
                        key={`${r.name}-h${i}`}
                        className="flex gap-3 rounded-xl bg-paper-deep p-3"
                      >
                        <div
                          aria-hidden="true"
                          className="flex h-24 w-14 shrink-0 items-end overflow-hidden rounded-lg p-1.5 text-[9px] leading-tight font-bold"
                          style={{
                            background: `linear-gradient(160deg, ${r.palette.bg}, ${r.palette.bg2})`,
                            color: r.palette.ink,
                          }}
                        >
                          {r.headline.text}
                        </div>
                        <div className="flex min-w-0 flex-col gap-1">
                          <p className="text-sm font-semibold">{r.name}</p>
                          <p className="text-sm text-muted">{l.hiddenReason}</p>
                          <button
                            type="button"
                            disabled={saving !== null}
                            onClick={() => void use(r, k)}
                            className="mt-auto inline-flex min-h-11 items-center self-start text-sm font-semibold text-indigo-deep underline"
                          >
                            {same(current, r)
                              ? 'Using this look'
                              : saving === k
                                ? 'Saving…'
                                : 'Use it anyway'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
