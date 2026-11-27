import { Badge } from '@/components/ui/badge';
import { industryLabels, styleKindLabels, type Format, type StyleExample } from '@/data/styles';
import { cn } from '@/lib/utils';

// Width caps keep every format's true proportions (a max-height would squash tall posters).
const aspectClass: Record<Format, string> = {
  '9:16': 'aspect-[9/16] max-w-[11rem]',
  '1:1': 'aspect-square max-w-[15rem]',
  '4:5': 'aspect-[4/5] max-w-[13rem]',
  '16:9': 'aspect-video',
};

const PASTELS = ['bg-pink', 'bg-lemon', 'bg-lilac', 'bg-mint', 'bg-peach'];
const pastelFor = (id: string) =>
  PASTELS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % PASTELS.length];

/** A gallery card with a stylised poster preview of one example ad (fictional businesses). */
export function StyleCard({ example }: { example: StyleExample }) {
  return (
    <article className="kx-card kx-lift flex h-full flex-col overflow-hidden rounded-[28px]">
      <div className={cn('flex min-h-72 items-center justify-center p-5', pastelFor(example.id))}>
        {/* The outer box is the size container; padding lives on the inner box, because
            container units (cqw) measure the container's content box. */}
        <div
          className={cn(
            '@container relative w-full overflow-hidden rounded-2xl text-ink shadow-[0_18px_36px_rgb(11_16_51/0.18)]',
            aspectClass[example.format],
          )}
          style={{ backgroundColor: example.accent }}
          aria-hidden="true"
        >
          <div className="absolute -top-[20%] -right-[20%] h-[70%] w-[70%] rounded-full bg-white/25" />
          <div className="absolute inset-0 flex flex-col justify-between p-[8cqw]">
            <p className="relative font-display text-[7cqw] tracking-[0.25em] uppercase">
              {example.business}
            </p>
            <div className="relative">
              <p className="font-display text-[13cqw] leading-none font-medium">{example.offer}</p>
              <svg viewBox="0 0 120 10" className="mt-[3cqw] w-[70%]">
                <path
                  d="M2 6 q10 -6 20 0 t20 0 t20 0 t20 0 t20 0 t16 0"
                  fill="none"
                  stroke="#1E1E1C"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap gap-2">
          <Badge className="border-ink/15 bg-ink text-paper">{styleKindLabels[example.kind]}</Badge>
          <Badge>{example.format}</Badge>
          {example.available === 'Soon' && <Badge className="bg-lamp-soft">Coming soon</Badge>}
        </div>
        <h3 className="font-display text-xl font-semibold tracking-normal normal-case">
          {example.title}
        </h3>
        <p className="mt-auto text-sm text-muted">
          {industryLabels[example.industry]} · {example.business}
        </p>
      </div>
    </article>
  );
}
