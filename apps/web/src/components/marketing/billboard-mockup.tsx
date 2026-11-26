import { OutlineDemo } from './outline-demo';
import { QrMark } from './qr-mark';

/**
 * Hero visual: a fictional café's Outline Highlight ad on a billboard on a concrete wall,
 * in the editorial "photo panel + text panel" layout of sample image 1.
 * Text inside scales with the billboard (container query units), so it stays in
 * proportion from 320px phones to wide desktops.
 */
export function BillboardMockup() {
  return (
    <figure
      className="concrete-wall relative overflow-hidden rounded-2xl p-[6%] pb-[10%] shadow-soft"
      aria-label="Example ad on a street billboard: Kesar Chai House, masala chai 20% off this week, built with the Outline Highlight style."
      role="img"
    >
      {/* Billboard frame */}
      <div className="@container relative mx-auto grid aspect-[16/9] w-full grid-cols-[1.35fr_1fr] overflow-hidden rounded-sm border-[6px] border-ink bg-card shadow-billboard">
        {/* Photo panel with the animated outline highlight */}
        <div className="relative bg-gradient-to-b from-lamp-soft via-[#f3e3c3] to-[#e7d2ad]">
          <p className="absolute top-[5%] left-[6%] font-display text-[2.2cqw] tracking-[0.3em] text-ink/70 uppercase">
            Kesar Chai House
          </p>
          <div className="absolute inset-x-[12%] top-[11%] bottom-[3%]">
            <OutlineDemo />
          </div>
        </div>

        {/* Text panel */}
        <div className="flex flex-col justify-between bg-card p-[4cqw]">
          <div>
            <p className="font-display text-[5.2cqw] leading-[1.05] font-light tracking-[0.08em] text-ink/80 uppercase">
              Masala
              <br />
              Chai Week
            </p>
            <p className="mt-[1.5cqw] text-[1.7cqw] tracking-[0.2em] text-muted uppercase">
              Chai · Bun maska · Kulhad coffee
            </p>
            <ul className="mt-[2.5cqw] space-y-[0.8cqw] text-[1.8cqw] text-ink/80">
              <li>Fresh ginger &amp; cardamom, brewed every hour</li>
              <li>Open 7 am – 11 pm</li>
              <li>Valid 1 – 7 December</li>
            </ul>
          </div>
          <div className="flex items-end justify-between gap-[2cqw] border-t border-line pt-[2cqw]">
            <div className="text-[1.6cqw] leading-snug text-muted">
              <p className="font-medium tracking-[0.15em] text-ink uppercase">Order on WhatsApp</p>
              <p>FC Road, Pune</p>
            </div>
            <QrMark className="h-[9cqw] w-[9cqw]" />
          </div>
        </div>
      </div>

      {/* Billboard posts and a strip of pavement */}
      <div className="absolute inset-x-0 bottom-0 h-[6%] bg-gradient-to-b from-[#8f8c85] to-[#77746e]" />
    </figure>
  );
}
