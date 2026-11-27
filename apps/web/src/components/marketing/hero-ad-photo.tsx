import { Check } from 'lucide-react';

/**
 * Version 2 hero ad: a real photo (masala chai, Pexels) in a phone, with steam rising, the
 * offer badge popping in and the text sliding up, plus two floating cards. CSS only
 * (index.css); "reduce motion" shows it still. The café and its price are an example.
 */
export function HeroAdPhoto() {
  return (
    <div className="relative mx-auto h-[500px] w-full max-w-[440px] sm:h-[520px]">
      <figure
        aria-label="Example ad: Amrut Café special masala chai, only ₹20"
        className="absolute top-2.5 left-1/2 h-[480px] w-[250px] -translate-x-1/2 overflow-hidden rounded-[36px] border-[9px] border-[#11102A] bg-indigo-deep shadow-[0_30px_60px_rgb(0_0_0/0.35)]"
      >
        <div className="relative h-[56%] overflow-hidden">
          <img
            src="/images/chai.jpg"
            alt="Masala chai in a white cup"
            className="kb-fast h-full w-full object-cover"
          />
          <span
            aria-hidden="true"
            className="steam absolute top-[30%] left-[44%] h-[26px] w-2.5 rounded-full bg-white/75 blur-[3px]"
          />
          <span
            aria-hidden="true"
            className="steam absolute top-[32%] left-[52%] h-[22px] w-2 rounded-full bg-white/70 blur-[3px] [animation-delay:0.8s]"
          />
          <span
            aria-hidden="true"
            className="steam absolute top-[28%] left-[48%] h-6 w-[9px] rounded-full bg-white/70 blur-[3px] [animation-delay:1.6s]"
          />
          <div className="pop absolute top-2.5 right-2.5 flex h-16 w-16 items-center justify-center rounded-full bg-lamp text-sm font-bold text-ink">
            नवीन
          </div>
        </div>
        <div className="flex flex-col gap-1.5 px-4 py-3.5 text-paper">
          <p className="text-[11px] tracking-[0.2em] opacity-80">AMRUT CAFÉ</p>
          <p className="slide-up text-[22px] leading-tight font-semibold">स्पेशल मसाला चहा</p>
          <p className="slide-up text-[26px] font-semibold text-gold [animation-delay:0.2s]">
            फक्त ₹20
          </p>
          <span className="slide-up w-fit rounded-full bg-paper px-3.5 py-2 text-[13px] font-semibold text-ink [animation-delay:0.4s]">
            आजच भेट द्या
          </span>
        </div>
      </figure>

      <div className="animate-float absolute top-16 left-0 hidden w-[190px] rounded-[18px] bg-card px-4 py-3.5 text-ink shadow-float sm:block">
        <p className="text-xs text-muted">Price you confirmed</p>
        <p className="mt-1 flex items-center gap-2 text-[22px] font-semibold">
          ₹20
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#E3F2E8] text-[#2E7D4F]">
            <Check className="h-4 w-4" aria-hidden="true" />
          </span>
        </p>
      </div>
      <div className="animate-float absolute right-0 bottom-8 hidden w-[200px] rounded-[18px] bg-card px-4 py-3.5 text-ink shadow-float [animation-delay:1s] sm:block">
        <p className="text-xs text-muted">Ready to post</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[13px] font-medium">
          <span className="rounded-full bg-lamp-soft px-2.5 py-1">Status</span>
          <span className="rounded-full bg-indigo-soft px-2.5 py-1">Reel</span>
          <span className="rounded-full bg-indigo-soft px-2.5 py-1">Post</span>
          <span className="rounded-full bg-lamp-soft px-2.5 py-1">Poster</span>
        </div>
      </div>
    </div>
  );
}
