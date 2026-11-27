import { cn } from '@/lib/utils';

export type MiniAdData = {
  photo: string | null;
  line1: string;
  line2?: string | null;
  price?: string | null;
  cta: string;
  business: string;
  bg: string;
  ink: string;
  accent: string;
};

/**
 * A small, light ad card (CSS animation only) for lists and the dashboard. The real ad (with
 * the full Composer) plays in the Studio; this is its quick look.
 */
export function MiniAd({
  ad,
  width = 180,
  className,
}: {
  ad: MiniAdData;
  width?: number;
  className?: string;
}) {
  const scale = width / 180;
  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{ width, height: 320 * scale }}
      aria-hidden="true"
    >
      <div
        className="absolute top-0 left-0 overflow-hidden font-sans"
        style={{
          width: 180,
          height: 320,
          background: ad.bg,
          color: ad.ink,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <div className="absolute inset-x-0 top-0 h-[190px] overflow-hidden">
          {ad.photo ? (
            <img src={ad.photo} alt="" className="kb h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background: `radial-gradient(90% 80% at 30% 20%, ${ad.accent}66, ${ad.bg})`,
              }}
            />
          )}
        </div>
        <div
          className="absolute inset-x-0 top-0 h-[200px]"
          style={{ background: `linear-gradient(180deg, transparent 45%, ${ad.bg} 96%)` }}
        />
        <p
          className="absolute top-2.5 left-2.5 m-0 max-w-[150px] truncate rounded-full px-2 py-0.5 text-[8px] font-bold tracking-[0.14em] uppercase"
          style={{ background: ad.bg, color: ad.ink }}
        >
          {ad.business}
        </p>
        <div className="absolute inset-x-3 top-[172px] font-display text-[22px] leading-[1.05] font-semibold">
          <span className="kx-loopin block truncate">{ad.line1}</span>
          {ad.line2 && (
            <span
              className="kx-loopin block truncate"
              style={{ color: ad.accent, animationDelay: '0.25s' }}
            >
              {ad.line2}
            </span>
          )}
        </div>
        {ad.price && (
          <p
            className="kx-loopin absolute top-[236px] left-3 m-0 font-display text-xl font-semibold"
            style={{ color: ad.accent, animationDelay: '0.5s' }}
          >
            {ad.price}
          </p>
        )}
        <div className="kx-loopin absolute inset-x-3 bottom-3" style={{ animationDelay: '0.75s' }}>
          <div
            className="kx-sweep relative overflow-hidden rounded-[10px] py-2 text-center text-[11px] font-bold"
            style={{ background: ad.accent, color: ad.bg }}
          >
            {ad.cta}
          </div>
        </div>
      </div>
    </div>
  );
}
