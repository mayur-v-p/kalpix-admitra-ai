import { Check } from 'lucide-react';

/**
 * Animation 1 (home page): an example ad builds itself inside a phone: the product appears,
 * its outline draws, the offer badge pops and the price slides up, on a 5-second loop.
 * Pure CSS (index.css, ".ad-*"); "reduce motion" shows the finished ad.
 * The shop and its prices are a fictional example.
 */
export function HeroAd() {
  return (
    <div className="relative mx-auto h-[520px] w-full max-w-[460px] sm:h-[560px]">
      <div
        aria-hidden="true"
        className="absolute inset-[30px_0_0_40px] rounded-[32px] bg-indigo-deep"
      />

      <figure
        className="absolute top-10 left-1/2 h-[460px] w-[240px] -translate-x-[45%] overflow-hidden rounded-[36px] border-[9px] border-ink bg-indigo-deep sm:h-[480px] sm:w-[250px]"
        aria-label="Example ad: Rang Boutique festive kurta sale, 20% off, ₹1,199 instead of ₹1,499"
      >
        <div className="flex h-full flex-col items-center justify-center gap-3 px-[18px] py-6 text-center text-paper">
          <p className="ad-title text-[11px] tracking-[0.3em]">RANG BOUTIQUE</p>
          <p className="ad-title font-display text-2xl leading-tight uppercase">
            Festive kurta sale
          </p>
          <div className="ad-product relative h-[170px] w-[150px]">
            <div className="absolute inset-[10px] flex items-center justify-center rounded-[14px] bg-lamp-soft text-xs text-muted">
              Product photo
            </div>
            <svg
              width="150"
              height="170"
              viewBox="0 0 150 170"
              aria-hidden="true"
              className="absolute inset-0"
            >
              <rect
                className="ad-outline"
                x="3"
                y="3"
                width="144"
                height="164"
                rx="18"
                fill="none"
                stroke="var(--color-lamp)"
                strokeWidth="3"
              />
            </svg>
            <div className="ad-badge absolute -top-3.5 -right-6 flex h-[62px] w-[62px] items-center justify-center rounded-full bg-lamp text-sm leading-none font-bold text-ink">
              20%
              <br />
              OFF
            </div>
          </div>
          <p className="ad-price flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-gold">₹1,199</span>
            <span className="text-sm text-paper/70 line-through">₹1,499</span>
          </p>
          <span className="ad-price rounded-full bg-paper px-4 py-2 text-[13px] font-semibold text-ink">
            Order on WhatsApp
          </span>
        </div>
      </figure>

      <div className="animate-float absolute top-[290px] left-0 hidden w-[200px] rounded-[18px] bg-card px-4 py-3.5 shadow-float sm:block">
        <p className="text-xs text-muted">Price you confirmed</p>
        <p className="mt-1 flex items-center gap-2 text-[22px] font-semibold">
          ₹1,199
          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[#2E7D4F]">
            <Check className="h-4 w-4" aria-hidden="true" /> confirmed
          </span>
        </p>
      </div>

      <div className="animate-float absolute right-0 bottom-10 hidden w-[220px] rounded-[18px] bg-card px-4 py-3.5 shadow-float [animation-delay:1s] sm:block">
        <p className="text-xs text-muted">Ready to post</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[13px] font-medium">
          <span className="rounded-full bg-lamp-soft px-2.5 py-1">Status 9:16</span>
          <span className="rounded-full bg-indigo-soft px-2.5 py-1">Post 1:1</span>
          <span className="rounded-full bg-indigo-soft px-2.5 py-1">Feed 4:5</span>
          <span className="rounded-full bg-lamp-soft px-2.5 py-1">YouTube 16:9</span>
        </div>
      </div>
    </div>
  );
}
