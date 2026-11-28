import { useQueryClient } from '@tanstack/react-query';
import { Check, Info, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';
import { cn } from '@/lib/utils';
import type { Product } from './api';
import {
  deletePicture,
  makePictures,
  PicturesError,
  picturesKey,
  REPRESENTATION_NOTE,
  setPictureForAds,
  useProductPictures,
} from './pictures';

const messages: Record<string, string> = {
  not_configured: 'AI pictures are not switched on yet (no AI key on the server).',
  rate_limited: 'You have made a lot of pictures this hour. Please try again a little later.',
  picture_limit: 'This product has 12 pictures. Delete some to make new ones.',
  pictures_failed: 'The pictures could not be made this time. Please try again.',
};

/**
 * "AI pictures": with a photo, the same product in new scenes; without one, pictures made from
 * the product's name. The owner ticks which ones ads may use.
 */
export function ProductPictures({
  product,
  autoStart = false,
}: {
  product: Product;
  /** Make the first pictures straight away (right after the product was saved). */
  autoStart?: boolean;
}) {
  const queryClient = useQueryClient();
  // Pictures for a new product are made in the background right after it is saved (here or
  // in Speak your ad): keep checking for a few minutes until the first ones arrive.
  const [openedAt] = useState(() => Date.now());
  const isNew = openedAt - new Date(product.created_at).getTime() < 5 * 60 * 1000;
  const pictures = useProductPictures(product.id, isNew);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);
  const hasPhoto = Boolean(product.image_path);
  const list = pictures.data ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: picturesKey(product.id) });

  const make = async () => {
    setBusy(true);
    setError(null);
    setMade(null);
    try {
      const out = await makePictures(product.id, note);
      setMade(
        out.failed
          ? `${out.made} new pictures made (${out.failed} could not be made).`
          : `${out.made} new pictures made.`,
      );
    } catch (e) {
      setError((e instanceof PicturesError && messages[e.code]) || messages.pictures_failed!);
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || started.current || !pictures.isSuccess || list.length) return;
    started.current = true;
    queueMicrotask(() => void make());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, when the list is known
  }, [autoStart, pictures.isSuccess]);

  const act = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch {
      setError('That did not work. Please try again.');
    } finally {
      await refresh();
    }
  };

  return (
    <section
      aria-labelledby="pictures-title"
      className="rounded-2xl border border-line bg-card p-5 shadow-soft md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="pictures-title"
          className="flex items-center gap-2 font-sans text-lg font-semibold tracking-normal normal-case"
        >
          <Sparkles className="h-5 w-5 text-lamp" aria-hidden="true" />
          {hasPhoto ? 'AI scenes with your product' : 'No photo? Kalpix makes pictures'}
        </h2>
        <p className="text-muted">
          {hasPhoto
            ? 'Your same product, placed in new settings. Tick the ones your ads may use: each new ad design can use a different one.'
            : `Pictures made from “${product.name}”. Tick the ones your ads may use. You can add your real photo any time.`}
        </p>
      </div>

      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void make();
        }}
      >
        <label htmlFor="picture-note" className="sr-only">
          Describe your product (optional)
        </label>
        <input
          id="picture-note"
          type="text"
          value={note}
          maxLength={160}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            hasPhoto
              ? 'Optional: a setting you like, e.g. “on a festive table”'
              : 'Optional: describe it, e.g. “4 pieces in a brass bowl”'
          }
          className="min-h-12 min-w-0 flex-[1_1_260px] rounded-full border border-line bg-card px-5 text-base focus:border-lamp focus:outline-none"
        />
        <Button type="submit" disabled={busy} className="w-auto">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {busy ? 'Making pictures…' : list.length ? 'Make 3 more' : 'Make 3 pictures'}
        </Button>
      </form>

      <div aria-live="polite">
        {busy && (
          <p className="mt-3 text-sm text-muted" role="status">
            Making three pictures. This takes about 30 seconds.
          </p>
        )}
        {made && !busy && (
          <div className="mt-3">
            <FormMessage tone="success">{made}</FormMessage>
          </div>
        )}
        {error && (
          <div className="mt-3">
            <FormMessage tone="error">{error}</FormMessage>
          </div>
        )}
      </div>

      {list.length > 0 && (
        <ul className="mt-5 grid gap-4 sm:grid-cols-3">
          {list.map((p) => (
            <li
              key={p.id}
              className={cn(
                'flex flex-col gap-2 rounded-2xl border p-2',
                p.use_in_ads ? 'border-lamp ring-2 ring-lamp/40' : 'border-line',
              )}
            >
              <div className="relative">
                {p.url ? (
                  <img
                    src={p.url}
                    alt={`${p.kind === 'generated' ? 'AI picture' : 'AI scene'}: ${p.label ?? product.name}`}
                    className={cn(
                      'aspect-[2/3] w-full rounded-xl object-cover',
                      !p.use_in_ads && 'opacity-55',
                    )}
                  />
                ) : (
                  <div className="aspect-[2/3] w-full rounded-xl bg-paper-deep" />
                )}
                <span className="absolute top-2 left-2 rounded-full bg-lilac px-2.5 py-0.5 text-xs font-semibold text-ink">
                  {p.kind === 'generated' ? 'AI picture' : 'AI scene'}
                </span>
                <button
                  type="button"
                  aria-label={`Delete ${p.label ?? 'picture'}`}
                  onClick={() => void act(() => deletePicture(p))}
                  className="absolute top-1 right-1 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink shadow-soft hover:bg-white"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {p.label && <p className="px-1 text-sm font-medium">{p.label}</p>}
              <button
                type="button"
                aria-pressed={p.use_in_ads}
                onClick={() => void act(() => setPictureForAds(p.id, !p.use_in_ads))}
                className={cn(
                  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold',
                  p.use_in_ads
                    ? 'bg-mint text-[#0f3b2e]'
                    : 'border border-line bg-card text-muted hover:border-ink/50',
                )}
              >
                {p.use_in_ads && <Check className="h-4 w-4" aria-hidden="true" />}
                {p.use_in_ads ? 'Ads can use this' : 'Use in ads'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {list.some((p) => p.kind === 'generated') && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-lemon px-3 py-2.5 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">
              These are AI pictures, not photos of your product.
            </span>{' '}
            Ads that use one show a small “{REPRESENTATION_NOTE}” line.
          </span>
        </p>
      )}
      {hasPhoto && list.length > 0 && (
        <p className="mt-3 text-sm text-muted">
          Check that your product looks right in each scene. Untick any where it changed.
        </p>
      )}
    </section>
  );
}
