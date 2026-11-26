import { OutlineDemo } from './outline-demo';

/** The same campaign as a 9:16 status/reel on a phone: one campaign, every format. */
export function PhoneMockup() {
  return (
    <div
      role="img"
      aria-label="The same ad as a vertical 9:16 video on a phone."
      className="@container w-full rounded-[2.2rem] border-[7px] border-ink bg-ink shadow-billboard"
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-[1.7rem] bg-gradient-to-b from-lamp-soft to-[#e7d2ad]">
        <div className="absolute top-[3%] left-1/2 h-[2.5%] w-[30%] -translate-x-1/2 rounded-full bg-ink" />
        <p className="absolute top-[9%] w-full text-center font-display text-[7cqw] tracking-[0.25em] text-ink/80 uppercase">
          Chai Week
        </p>
        <div className="absolute inset-x-[8%] top-[18%] bottom-[16%]">
          <OutlineDemo />
        </div>
        <div className="absolute inset-x-[8%] bottom-[4%] rounded-full bg-ink py-[3cqw] text-center text-[5.5cqw] font-medium text-paper">
          Order on WhatsApp
        </div>
      </div>
    </div>
  );
}
