import { useQueryClient } from '@tanstack/react-query';
import { Camera, Star, Trash2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { FormMessage } from '@/components/ui/form-field';
import { cn } from '@/lib/utils';
import {
  addBusinessPhoto,
  businessPhotosKey,
  deleteBusinessPhoto,
  setMainBusinessPhoto,
  useBusinessPhotos,
} from './business-photos';

/** Photos of the shop for "Promote my business" ads: add, choose the main one, remove. */
export function BusinessPhotosCard({
  business,
}: {
  business: { id: string; workspace_id: string };
}) {
  const queryClient = useQueryClient();
  const photos = useBusinessPhotos(business.id);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = photos.data ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: businessPhotosKey(business.id) });

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="photos-title"
      className="kx-card kx-rise rounded-[26px] p-6 [animation-delay:80ms]"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kx-eyebrow text-indigo">Your place</p>
          <h2 id="photos-title" className="mt-1.5 text-2xl font-medium tracking-normal normal-case">
            Business photos
          </h2>
        </div>
        <p className="max-w-sm text-sm text-muted">
          Used in "Promote my business" ads. Tap the star to choose the main photo.
        </p>
      </div>
      {error && (
        <div className="mt-4">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      )}
      <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((p) => (
          <li
            key={p.id}
            className="kx-lift relative h-40 overflow-hidden rounded-[22px] bg-paper-deep shadow-[0_14px_28px_rgb(35_34_89/0.14)]"
          >
            {p.url && (
              <img
                src={p.url}
                alt={p.label ?? 'Business photo'}
                className="h-full w-full object-cover"
              />
            )}
            <span
              className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgb(20_19_46/0.7))]"
              aria-hidden="true"
            />
            {p.is_main && (
              <span className="absolute top-2.5 left-2.5 rounded-full bg-gradient-to-r from-[#f6c96f] to-[#e8b04b] px-2.5 py-1 text-xs font-bold text-ink">
                Main photo
              </span>
            )}
            <div className="absolute right-2 bottom-2 flex gap-1.5">
              {!p.is_main && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => setMainBusinessPhoto(p.id))}
                  aria-label="Make this the main photo"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink disabled:opacity-50"
                >
                  <Star className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                aria-label="Remove this photo"
                onClick={() =>
                  run(async () => {
                    await deleteBusinessPhoto(p);
                    const next = list.find((x) => x.id !== p.id);
                    if (p.is_main && next) await setMainBusinessPhoto(next.id);
                  })
                }
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-red-800 disabled:opacity-50"
              >
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
        {list.length < 12 && (
          <li>
            <label
              htmlFor={inputId}
              className={cn(
                'kx-lift flex h-40 cursor-pointer flex-col items-center justify-center gap-2.5 rounded-[22px] border-2 border-dashed border-[#c9c4ea] bg-[linear-gradient(140deg,rgb(236_235_251/0.7),rgb(251_231_191/0.4))] font-bold text-indigo',
                busy && 'pointer-events-none opacity-60',
              )}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-md">
                <Camera className="h-6 w-6" aria-hidden="true" />
              </span>
              {busy ? 'Uploading…' : 'Add a photo'}
            </label>
            <input
              ref={input}
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void run(() => addBusinessPhoto(business, file, null));
              }}
            />
          </li>
        )}
      </ul>
    </section>
  );
}
