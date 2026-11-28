import type { LookScore } from '@admitra/styles-engine';
import { Check, Eye, Lightbulb, TriangleAlert } from 'lucide-react';
import type { PhotoReading } from './api';

/** "Kalpix sees your photo": what is in it, its colours and mood, and a quick photo check. */
export function PhotoCard({ photo, imageUrl }: { photo: PhotoReading; imageUrl: string | null }) {
  return (
    <section
      aria-labelledby="photo-read-title"
      className="mt-5 flex flex-col gap-4 rounded-2xl border border-line bg-card p-4 sm:flex-row"
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt="The photo your ad uses"
          className="h-40 w-full shrink-0 rounded-xl object-cover sm:h-auto sm:w-40"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <h3
          id="photo-read-title"
          className="flex items-center gap-2 font-sans text-lg font-semibold tracking-normal normal-case"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lilac">
            <Eye className="h-4 w-4" aria-hidden="true" />
          </span>
          Kalpix sees your photo
        </h3>
        {photo.subject && <p>{photo.subject}</p>}
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {photo.colours.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted uppercase">
                Main colours
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-3">
                {photo.colours.map((c) => (
                  <li key={c.hex} className="flex items-center gap-1.5 text-sm">
                    <span
                      aria-hidden="true"
                      className="h-5 w-5 rounded-full border border-black/10"
                      style={{ backgroundColor: c.hex }}
                    />
                    {c.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {photo.mood.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted uppercase">Mood</p>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {photo.mood.map((m) => (
                  <li key={m} className="rounded-full bg-peach px-3 py-0.5 text-sm">
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <CheckLine ok={photo.sharp} yes="Sharp and in focus" no="A little blurry" />
          <CheckLine ok={photo.goodLight} yes="Good light" no="A bit dark" />
        </ul>
        {photo.tip && (
          <p className="flex items-start gap-2 rounded-xl bg-lemon px-3 py-2 text-sm">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {photo.tip}
          </p>
        )}
        <p className="text-xs text-muted">
          Used to pick colours and layouts that suit your photo. Prices and offers still come only
          from you.
        </p>
      </div>
    </section>
  );
}

function CheckLine({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <li className="flex items-center gap-1.5">
      {ok ? (
        <Check className="h-4 w-4 text-[#1f7a5a]" aria-hidden="true" />
      ) : (
        <TriangleAlert className="h-4 w-4 text-[#8a5a00]" aria-hidden="true" />
      )}
      {ok ? yes : no}
    </li>
  );
}

/** Small bars under each look: easy to read, contrast, suits photo. */
export function ScoreBars({ score }: { score: LookScore }) {
  const rows: { label: string; pct: number; text: string }[] = [
    { label: 'Easy to read', pct: score.readable, text: String(score.readable) },
    { label: 'Contrast', pct: score.contrast, text: score.contrastText },
  ];
  if (score.fit !== null)
    rows.push({ label: 'Suits photo', pct: score.fit, text: String(score.fit) });
  return (
    <dl className="flex flex-col gap-1.5 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <dt className="w-24 shrink-0 text-muted">{r.label}</dt>
          <dd className="flex flex-1 items-center gap-2">
            <span
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-deep"
              aria-hidden="true"
            >
              <span className="block h-full rounded-full bg-lamp" style={{ width: `${r.pct}%` }} />
            </span>
            <span className="w-11 text-right font-semibold">{r.text}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
