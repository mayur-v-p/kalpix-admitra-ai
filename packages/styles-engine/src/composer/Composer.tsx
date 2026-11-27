// The Ad Composer: draws any checked design recipe (composer/recipe.ts) with the shop's
// confirmed facts. Same component in the Studio preview (Remotion Player) and the render worker.
//
// Layout is done with flexbox inside safe margins, so text never overlaps whatever the
// recipe says; the recipe decides the look, the order, the motion and the words.
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Aspect } from '../formats';
import { QrCode } from '../qr';
import type { OutlineHighlightProps } from '../types';
import { enterStyle, progress, TIMING, wave } from './effects';
import { FONTS, isDevanagari } from './fonts';
import { rng, type AdRecipe, type Icon } from './recipe';

export type ComposerExtras = {
  /** Confirmed opening hours, e.g. "Mon–Sat · 10 AM – 9 PM". */
  hours?: string | null;
  /** Confirmed registration line, e.g. "MahaRERA No. P521…" (required for real estate). */
  registration?: string | null;
};

export type ComposerProps = {
  aspect: Aspect;
  recipe: AdRecipe;
  /** The fact-gated ad (buildAdProps): only confirmed facts are set. */
  ad: OutlineHighlightProps;
  extras?: ComposerExtras;
};

export const composerDurationFrames = (recipe: Pick<AdRecipe, 'duration'>, fps: number) =>
  recipe.duration * fps;

type Ctx = {
  frame: number;
  fps: number;
  W: number;
  H: number;
  u: number;
  landscape: boolean;
  r: AdRecipe;
  next: () => { start: number; dur: number };
};

// ------------------------------------------------------------------------------- small pieces
function Enter({
  c,
  kind,
  children,
  style,
}: {
  c: Ctx;
  kind: AdRecipe['headline']['enter'];
  children: ReactNode;
  style?: CSSProperties;
}) {
  const { start, dur } = c.next();
  const p = progress(c.frame, c.fps, start, dur);
  return <div style={{ ...style, ...enterStyle(kind, p) }}>{children}</div>;
}

const fit = (
  text: string,
  base: number,
  maxW: number,
  lines: number,
  dev: boolean,
  upper: boolean,
) => {
  const k = (dev ? 0.62 : 0.5) * (upper ? 1.12 : 1);
  return Math.max(base * 0.45, Math.min(base, (maxW * lines) / Math.max(1, text.length * k)));
};

function IconPath({ icon }: { icon: Icon }) {
  // 24x24 line icons, drawn with stroke.
  const d: Record<Icon, string> = {
    cup: 'M4 10h13v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z M17 11h1.5a2.5 2.5 0 0 1 0 5H17 M8 3c0 1.5 1 1.5 1 3 M12 3c0 1.5 1 1.5 1 3',
    plate:
      'M12 20a8 8 0 1 0 0-16a8 8 0 0 0 0 16z M12 16a4 4 0 1 0 0-8a4 4 0 0 0 0 8z M2 4v6 M22 4v16',
    hanger: 'M12 6a2 2 0 1 1 2 2c-1 .5-2 1-2 2 M12 10l9 6.5a1 1 0 0 1-.6 1.8H3.6a1 1 0 0 1-.6-1.8z',
    sweets:
      'M12 21a5 5 0 1 0 0-10a5 5 0 0 0 0 10z M6 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8z M18 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8z',
    heart_cross:
      'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z M12 9v5 M9.5 11.5h5',
    pill: 'M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7z M8.5 8.5l7 7',
    test_tube: 'M9 2v14a3 3 0 0 0 6 0V2 M7 2h10 M9 11h6',
    dumbbell: 'M6 7v10 M18 7v10 M3 9v6 M21 9v6 M6 12h12',
    scissors:
      'M6 9a3 3 0 1 0 0-6a3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6a3 3 0 0 0 0 6z M20 4L8.1 15.9 M14.5 14.5L20 20 M8.1 8.1L12 12',
    book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
    building: 'M4 21V7l8-4 8 4v14 M9 21v-4h6v4 M8 10h2 M14 10h2 M8 14h2 M14 14h2 M2 21h20',
    phone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M11 18h2',
    tools: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
    star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  };
  return <path d={d[icon]} />;
}

function LineIcon({ c, size, color }: { c: Ctx; size: number; color: string }) {
  if (!c.r.icon) return null;
  // Draws itself once at the start, then stays.
  const p = progress(c.frame, c.fps, 0.2, 1.6);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g style={{ strokeDasharray: 120, strokeDashoffset: 120 * (1 - p) }}>
        <IconPath icon={c.r.icon} />
      </g>
    </svg>
  );
}

// ------------------------------------------------------------------------------- background
function Background({ c, photo }: { c: Ctx; photo: string | null }) {
  const { r, frame, fps, W, H, u } = c;
  const { bg, bg2, accent, ink } = r.palette;
  const t = frame / fps;
  const base: CSSProperties = { background: `linear-gradient(170deg, ${bg} 0%, ${bg2} 100%)` };
  const seeded = useMemo(() => {
    const g = rng(r.name.length * 977 + r.layout.length * 31 + 7);
    return Array.from({ length: 18 }, () => ({
      x: g.next(),
      y: g.next(),
      s: g.next(),
      d: g.next(),
    }));
  }, [r.name, r.layout]);

  let layer: ReactNode = null;
  switch (r.background) {
    case 'orbs':
      layer = (
        <>
          <div
            style={{
              position: 'absolute',
              width: W * 0.75,
              height: W * 0.75,
              borderRadius: '50%',
              background: accent,
              opacity: 0.45,
              filter: `blur(${u * 9}px)`,
              left: -W * 0.2 + Math.sin(t * 0.5) * u * 4,
              top: -W * 0.15 + Math.cos(t * 0.4) * u * 3,
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: W * 0.7,
              height: W * 0.7,
              borderRadius: '50%',
              background: bg2,
              opacity: 0.8,
              filter: `blur(${u * 10}px)`,
              right: -W * 0.25 + Math.cos(t * 0.45) * u * 4,
              bottom: H * 0.12 + Math.sin(t * 0.35) * u * 3,
            }}
          />
        </>
      );
      break;
    case 'photo_zoom':
      if (photo)
        layer = (
          <>
            <Img
              src={photo}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${1 + 0.12 * (frame / (r.duration * fps))})`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(180deg, ${bg}55 0%, ${bg}22 30%, ${bg}dd 62%, ${bg} 85%)`,
              }}
            />
          </>
        );
      break;
    case 'grid':
      layer = (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(${ink}14 1px, transparent 1px), linear-gradient(90deg, ${ink}14 1px, transparent 1px)`,
            backgroundSize: `${u * 5}px ${u * 5}px`,
          }}
        />
      );
      break;
    case 'paper':
      layer = (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(${accent}22 1px, transparent 1px)`,
            backgroundSize: `100% ${u * 4.2}px`,
          }}
        />
      );
      break;
    case 'neon_grid':
      layer = (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(${accent}22 1px, transparent 1px), linear-gradient(90deg, ${accent}22 1px, transparent 1px)`,
            backgroundSize: `${u * 6}px ${u * 6}px`,
            backgroundPosition: `0 ${(t * u * 3) % (u * 6)}px`,
          }}
        />
      );
      break;
    case 'rays':
      layer = (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '38%',
            width: Math.max(W, H) * 1.6,
            height: Math.max(W, H) * 1.6,
            marginLeft: -Math.max(W, H) * 0.8,
            marginTop: -Math.max(W, H) * 0.8,
            background: `repeating-conic-gradient(${accent}1f 0deg 8deg, transparent 8deg 20deg)`,
            transform: `rotate(${t * 6}deg)`,
          }}
        />
      );
      break;
    case 'particles':
      layer = seeded.map((p, i) => {
        const y = ((p.y + t * (0.05 + p.s * 0.06)) % 1.1) - 0.05;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.x * W,
              bottom: y * H,
              width: u * (0.6 + p.s),
              height: u * (0.6 + p.s),
              borderRadius: '50%',
              background: accent,
              boxShadow: `0 0 ${u * 2}px ${u * 0.6}px ${accent}aa`,
              opacity: 0.4 + 0.6 * wave(frame, fps, 2 + p.d * 2, i),
            }}
          />
        );
      });
      break;
    case 'confetti':
      layer = seeded.map((p, i) => {
        const y = ((p.y + t * (0.1 + p.s * 0.08)) % 1.15) - 0.1;
        const colors = [accent, ink, bg2, '#ffffff'];
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.x * W,
              top: y * H,
              width: u * 1.2,
              height: u * (p.s > 0.5 ? 2 : 1.2),
              borderRadius: p.s > 0.7 ? '50%' : 2,
              background: colors[i % colors.length],
              transform: `rotate(${t * 180 * (p.d - 0.5)}deg)`,
              opacity: 0.85,
            }}
          />
        );
      });
      break;
    case 'rangoli':
      layer = (
        <svg
          width={W * 1.3}
          height={W * 1.3}
          viewBox="-100 -100 200 200"
          style={{
            position: 'absolute',
            left: -W * 0.25,
            top: -W * 0.3,
            opacity: 0.35,
            transform: `rotate(${t * 8}deg)`,
          }}
          aria-hidden="true"
        >
          <circle r={92} fill="none" stroke={accent} strokeWidth={1.5} strokeDasharray="4 6" />
          <circle r={70} fill="none" stroke={ink} strokeOpacity={0.4} strokeWidth={2} />
          {Array.from({ length: 8 }, (_, i) => (
            <ellipse
              key={i}
              rx={12}
              ry={30}
              cy={-52}
              fill={accent}
              fillOpacity={0.5}
              transform={`rotate(${i * 45})`}
            />
          ))}
          <circle r={16} fill={accent} fillOpacity={0.6} />
        </svg>
      );
      break;
    case 'gradient':
    default:
      layer = (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(120% 70% at 50% 25%, ${accent}22 0%, transparent 60%)`,
          }}
        />
      );
  }
  return <AbsoluteFill style={base}>{layer}</AbsoluteFill>;
}

// ------------------------------------------------------------------------------- photo
function Photo({
  c,
  src,
  w,
  h,
  forceShape,
}: {
  c: Ctx;
  src: string;
  w: number;
  h: number;
  forceShape?: AdRecipe['photo']['shape'];
}) {
  const { r, frame, fps, u } = c;
  const shape = forceShape ?? r.photo.shape;
  const zoom = 1 + 0.1 * (frame / (r.duration * fps));
  const radius: Record<string, string | number> = {
    arch: `${w / 2}px ${w / 2}px ${u * 2}px ${u * 2}px`,
    circle: '50%',
    rounded: u * 4,
    polaroid: u * 0.6,
    full: 0,
    blob: '42% 58% 55% 45% / 48% 42% 58% 52%',
  };
  const ring = r.accents.includes('ring');
  const img = (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: radius[shape] ?? u * 4,
        overflow: 'hidden',
        boxShadow: shape === 'full' ? undefined : `0 ${u * 2}px ${u * 5}px rgba(0,0,0,.28)`,
      }}
    >
      <Img
        src={src}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})` }}
      />
    </div>
  );
  return (
    <div
      style={{
        position: 'relative',
        transform: `rotate(${r.photo.rotate}deg) scale(${r.photo.scale})`,
      }}
    >
      {ring && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: -u * 2,
            borderRadius: shape === 'circle' ? '50%' : u * 6,
            border: `${u * 0.4}px dashed ${r.palette.accent}`,
            transform: `rotate(${(frame / fps) * 20}deg)`,
          }}
        />
      )}
      {shape === 'polaroid' ? (
        <div
          style={{
            background: '#ffffff',
            padding: `${u * 1.6}px ${u * 1.6}px ${u * 6}px`,
            boxShadow: `0 ${u * 2}px ${u * 5}px rgba(0,0,0,.25)`,
          }}
        >
          {img}
        </div>
      ) : (
        img
      )}
      {r.accents.includes('steam') && <Steam c={c} x={w * 0.5} />}
    </div>
  );
}

function Steam({ c, x }: { c: Ctx; x: number }) {
  const { frame, fps, u } = c;
  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', left: x - u * 6, top: -u * 12, width: u * 12, height: u * 12 }}
    >
      {[0, 1, 2].map((i) => {
        const p = ((frame / fps + i * 1.1) % 3.2) / 3.2;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: u * (2 + i * 3.4),
              bottom: 0,
              width: u * 2,
              height: u * 5,
              borderRadius: '50%',
              background: 'rgba(255,255,255,.7)',
              filter: `blur(${u * 0.7}px)`,
              opacity: p < 0.25 ? p * 3 : 0.75 * (1 - p),
              transform: `translateY(${-p * u * 9}px) scaleX(${1 + p})`,
            }}
          />
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------------------- badge
function OfferBadge({ c, text }: { c: Ctx; text: string }) {
  const { r, u } = c;
  const { accent, onAccent } = r.palette;
  const size = Math.min(u * 4.4, (u * 26 * 2) / Math.max(1, text.length * 0.55));
  const label = (
    <span
      style={{
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.1,
        textAlign: 'center',
        display: 'block',
      }}
    >
      {text}
    </span>
  );
  const common: CSSProperties = {
    color: onAccent,
    background: accent,
    fontFamily: FONTS[r.fonts].body,
  };
  switch (r.badge) {
    case 'ribbon':
      return (
        <div
          style={{
            ...common,
            padding: `${u * 1.6}px ${u * 3}px ${u * 2.6}px`,
            clipPath: 'polygon(0 0,100% 0,100% 100%,50% 82%,0 100%)',
            maxWidth: u * 34,
          }}
        >
          {label}
        </div>
      );
    case 'stamp':
      return (
        <div
          style={{
            ...common,
            width: u * 26,
            height: u * 26,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: u * 3,
            boxSizing: 'border-box',
            border: `${u * 0.6}px dashed ${onAccent}88`,
            transform: 'rotate(-10deg)',
          }}
        >
          {label}
        </div>
      );
    case 'starburst':
      return (
        <div
          style={{
            ...common,
            width: u * 28,
            height: u * 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: u * 5,
            boxSizing: 'border-box',
            clipPath:
              'polygon(50% 0,61% 13%,77% 6%,79% 22%,95% 25%,88% 40%,100% 50%,88% 60%,95% 75%,79% 78%,77% 94%,61% 87%,50% 100%,39% 87%,23% 94%,21% 78%,5% 75%,12% 60%,0 50%,12% 40%,5% 25%,21% 22%,23% 6%,39% 13%)',
            transform: `rotate(${(c.frame / c.fps) * 12}deg)`,
          }}
        >
          <div style={{ transform: `rotate(${-(c.frame / c.fps) * 12}deg)` }}>{label}</div>
        </div>
      );
    case 'tag':
      return (
        <div
          style={{
            ...common,
            padding: `${u * 1.8}px ${u * 3}px ${u * 1.8}px ${u * 4.5}px`,
            clipPath: 'polygon(14% 0,100% 0,100% 100%,14% 100%,0 50%)',
            maxWidth: u * 36,
            transform: `rotate(${Math.sin((c.frame / c.fps) * 2) * 3}deg)`,
            transformOrigin: 'left center',
          }}
        >
          {label}
        </div>
      );
    case 'pill':
    default:
      return (
        <div
          style={{
            ...common,
            padding: `${u * 1.4}px ${u * 3.2}px`,
            borderRadius: 999,
            maxWidth: u * 60,
          }}
        >
          {label}
        </div>
      );
  }
}

// ------------------------------------------------------------------------------- text blocks
function Headline({ c, maxW }: { c: Ctx; ad?: OutlineHighlightProps; maxW: number }) {
  const { r, u, landscape } = c;
  const f = FONTS[r.fonts];
  const lines = [r.headline.text, r.headline.accent].filter(Boolean) as string[];
  const base = (landscape ? 8 : 11) * r.headline.size * u;
  return (
    <div style={{ textAlign: r.headline.align }}>
      {lines.map((line, i) => {
        const dev = isDevanagari(line);
        const upper = Boolean(r.headline.upper || f.capsOnly) && !dev;
        const size = fit(line, base, maxW, 2, dev, upper);
        return (
          <Enter key={i} c={c} kind={r.headline.enter}>
            <div
              style={{
                fontFamily: dev ? f.devHeading : f.heading,
                fontWeight: dev ? f.devHeadingWeight : f.headingWeight,
                fontSize: size,
                lineHeight: dev ? 1.25 : f.capsOnly ? 0.92 : 1.05,
                letterSpacing: f.capsOnly ? '0.02em' : '-0.01em',
                textTransform: upper ? 'uppercase' : 'none',
                color: i === 1 ? r.palette.accent : r.palette.ink,
                fontStyle: i === 1 && f.italicAccent && !dev ? 'italic' : 'normal',
              }}
            >
              {line}
            </div>
          </Enter>
        );
      })}
    </div>
  );
}

function BrandRow({
  c,
  ad,
  align,
}: {
  c: Ctx;
  ad: OutlineHighlightProps;
  align: 'left' | 'center';
}) {
  const { r, u } = c;
  return (
    <Enter
      c={c}
      kind="blur"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: u * 1.6,
        justifyContent: align === 'center' ? 'center' : 'flex-start',
      }}
    >
      {ad.logoUrl ? (
        <Img
          src={ad.logoUrl}
          style={{
            width: u * 7,
            height: u * 7,
            borderRadius: '50%',
            objectFit: 'cover',
            background: '#fff',
          }}
        />
      ) : r.icon ? (
        <LineIcon c={c} size={u * 6} color={r.palette.accent} />
      ) : null}
      <span
        style={{
          fontFamily: FONTS[r.fonts].body,
          fontWeight: 700,
          fontSize: u * 3.3,
          letterSpacing: isDevanagari(ad.businessName) ? 0 : '0.16em',
          textTransform: 'uppercase',
          color: r.palette.ink,
        }}
      >
        {ad.businessName}
      </span>
    </Enter>
  );
}

function Facts({
  c,
  ad,
  extras,
  align,
}: {
  c: Ctx;
  ad: OutlineHighlightProps;
  extras?: ComposerExtras;
  align: 'left' | 'center';
}) {
  const { r, u } = c;
  const body = FONTS[r.fonts].body;
  const lines = [ad.facts.validity, extras?.hours, ad.facts.address, ad.facts.phone].filter(
    Boolean,
  ) as string[];
  return (
    <>
      {ad.facts.price && (
        <Enter c={c} kind="pop" style={{ textAlign: align }}>
          <div
            style={{ fontFamily: body, color: r.palette.ink, fontSize: u * 3.4, fontWeight: 600 }}
          >
            {ad.productName}
          </div>
          <div
            style={{
              fontFamily: FONTS[r.fonts].heading,
              fontWeight: FONTS[r.fonts].headingWeight,
              color: r.palette.accent,
              fontSize: u * 9,
              lineHeight: 1,
            }}
          >
            {ad.facts.price}
          </div>
        </Enter>
      )}
      {lines.length > 0 && (
        <Enter
          c={c}
          kind="rise"
          style={{ textAlign: align, display: 'flex', flexDirection: 'column', gap: u * 0.6 }}
        >
          {lines.map((l, i) => (
            <span
              key={i}
              style={{
                fontFamily: body,
                color: r.palette.ink,
                opacity: 0.92,
                fontSize: u * 3.5,
                fontWeight: 500,
              }}
            >
              {l}
            </span>
          ))}
        </Enter>
      )}
    </>
  );
}

function Chips({ c, align }: { c: Ctx; align: 'left' | 'center' }) {
  const { r, u } = c;
  if (!r.chips.length) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: u * 1.2,
        justifyContent: align === 'center' ? 'center' : 'flex-start',
      }}
    >
      {r.chips.map((chip, i) => (
        <Enter key={i} c={c} kind="pop">
          <span
            style={{
              display: 'inline-block',
              padding: `${u * 1}px ${u * 2.4}px`,
              borderRadius: 999,
              border: `${u * 0.25}px solid ${r.palette.ink}55`,
              color: r.palette.ink,
              fontFamily: FONTS[r.fonts].body,
              fontWeight: 600,
              fontSize: u * 3.2,
            }}
          >
            {chip}
          </span>
        </Enter>
      ))}
    </div>
  );
}

function Cta({ c, ad }: { c: Ctx; ad: OutlineHighlightProps }) {
  const { r, u, frame, fps } = c;
  const label = r.cta ?? ad.cta;
  const sweepX = (((frame / fps) % 3.5) / 3.5) * 260 - 120;
  const pulse = 1 + 0.03 * Math.sin((frame / fps) * Math.PI * 1.2);
  return (
    <Enter c={c} kind="pop" style={{ display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          textAlign: 'center',
          padding: `${u * 2.6}px ${u * 4}px`,
          borderRadius: u * 3,
          background: r.palette.accent,
          color: r.palette.onAccent,
          fontFamily: FONTS[r.fonts].body,
          fontWeight: 800,
          fontSize: fit(label, u * 4.6, u * 70, 1, isDevanagari(label), false),
          transform: `scale(${pulse})`,
          boxShadow: `0 ${u}px ${u * 3}px ${r.palette.accent}55`,
        }}
      >
        {label}
        {r.accents.includes('sweep') && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${sweepX}%`,
              width: '40%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent)',
              transform: 'skewX(-20deg)',
            }}
          />
        )}
      </div>
    </Enter>
  );
}

// ------------------------------------------------------------------------------- accents layer
function Accents({
  c,
  ad,
  extras,
}: {
  c: Ctx;
  ad: OutlineHighlightProps;
  extras?: ComposerExtras;
}) {
  const { r, u, frame, fps, W, H } = c;
  const t = frame / fps;
  const seeded = useMemo(() => {
    const g = rng(r.name.length * 131 + 3);
    return Array.from({ length: 9 }, () => ({ x: g.next(), y: g.next(), d: g.next() }));
  }, [r.name]);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {r.accents.includes('sparkles') &&
        seeded.map((p, i) => (
          <span
            key={i}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: p.x * W,
              top: p.y * H * 0.8,
              width: u * 2.4,
              height: u * 2.4,
              background: r.palette.accent,
              clipPath: 'polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%)',
              opacity: wave(frame, fps, 2 + p.d * 1.5, i),
              transform: `scale(${0.5 + 0.5 * wave(frame, fps, 2 + p.d, i)})`,
            }}
          />
        ))}
      {r.accents.includes('diyas') && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: H * 0.2,
            display: 'flex',
            justifyContent: 'space-between',
            padding: `0 ${u * 3}px`,
            opacity: 0.9,
          }}
        >
          {[0, 1].map((i) => (
            <svg key={i} width={u * 10} height={u * 8} viewBox="0 0 56 44">
              <path
                d="M28 2 C34 12 34 18 28 22 C22 18 22 12 28 2z"
                fill="#fde047"
                opacity={0.6 + 0.4 * wave(frame, fps, 0.8, i * 2)}
              />
              <path d="M4 24 H52 C50 38 40 42 28 42 C16 42 6 38 4 24z" fill="#b45309" />
            </svg>
          ))}
        </div>
      )}
      {r.accents.includes('pulse_line') && (
        <svg
          aria-hidden="true"
          width={W}
          height={u * 10}
          viewBox="0 0 360 40"
          preserveAspectRatio="none"
          style={{ position: 'absolute', left: 0, top: H * 0.06 }}
        >
          <path
            d="M0 22 H120 L132 22 L140 6 L150 36 L160 14 L166 22 H360"
            fill="none"
            stroke={r.palette.accent}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ strokeDasharray: 600, strokeDashoffset: 600 - ((t % 3) / 3) * 1200 }}
            opacity={0.7}
          />
        </svg>
      )}
      {r.accents.includes('marquee') && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: -u * 5,
            right: -u * 5,
            top: H * 0.035,
            transform: 'rotate(-4deg)',
            background: r.palette.accent,
            padding: `${u * 0.8}px 0`,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              whiteSpace: 'nowrap',
              color: r.palette.onAccent,
              fontFamily: FONTS[r.fonts].body,
              fontWeight: 800,
              fontSize: u * 3,
              letterSpacing: '0.12em',
              transform: `translateX(${-((t * u * 8) % (W * 1.2))}px)`,
            }}
          >
            {Array.from({ length: 6 }, () =>
              [ad.businessName, ...r.chips, extras?.hours].filter(Boolean).join('  ·  '),
            ).join('  ·  ')}
          </div>
        </div>
      )}
      {r.accents.includes('icon') && r.icon && (
        <div
          aria-hidden="true"
          style={{ position: 'absolute', right: -u * 6, bottom: H * 0.3, opacity: 0.12 }}
        >
          <LineIcon c={c} size={u * 50} color={r.palette.ink} />
        </div>
      )}
    </AbsoluteFill>
  );
}

// ------------------------------------------------------------------------------- the composer
/**
 * Rough height of the text column at unit `u`, so the Composer can shrink everything to fit
 * the frame whatever the recipe asks for (long words, many chips, price, hours, ...).
 */
function estimateColumn(
  r: AdRecipe,
  ad: OutlineHighlightProps,
  extras: ComposerExtras | undefined,
  u: number,
  textW: number,
  landscape: boolean,
  parts: { brand: boolean; photoH: number; badge: boolean; listItems: number; price: boolean },
): number {
  const f = FONTS[r.fonts];
  const linesOf = (text: string, size: number, k: number) =>
    Math.max(1, Math.ceil((text.length * size * k) / textW));
  const blocks: number[] = [];
  if (parts.brand) blocks.push(u * 7);
  if (parts.photoH) blocks.push(parts.photoH + (r.photo.shape === 'polaroid' ? u * 7.6 : 0));
  if (parts.badge) blocks.push(u * 26);
  const base = (landscape ? 8 : 11) * r.headline.size * u;
  for (const line of [r.headline.text, r.headline.accent]) {
    if (!line) continue;
    const dev = isDevanagari(line);
    const upper = Boolean(r.headline.upper || f.capsOnly) && !dev;
    const size = fit(line, base, textW, 2, dev, upper);
    blocks.push(linesOf(line, size, dev ? 0.62 : 0.52) * size * (dev ? 1.3 : 1.1));
  }
  if (r.tagline) blocks.push(linesOf(r.tagline, u * 4, 0.52) * u * 5.6);
  if (ad.facts.offer && r.badge === 'none') blocks.push(u * 7);
  if (r.chips.length) blocks.push(Math.ceil(r.chips.length / 3) * u * 6.4);
  if (parts.listItems) blocks.push(parts.listItems * u * 8);
  if (parts.price && ad.facts.price) blocks.push(u * 13.5);
  const factLines = [ad.facts.validity, extras?.hours, ad.facts.address, ad.facts.phone].filter(
    Boolean,
  ).length;
  if (factLines) blocks.push(factLines * u * 5);
  blocks.push(u * 12.5); // button
  return blocks.reduce((a, b) => a + b, 0) + (blocks.length - 1) * u * 3;
}

export function Composer({ recipe: r, ad, extras }: ComposerProps) {
  const frame = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const u0 = Math.min(W, H) / 100;
  const landscape = W > H * 1.15;
  const photo = ad.productImageUrl ?? null;
  const pad = u0 * 7;
  // Safe zone: Reels/Status put their own buttons at the top and bottom of 9:16 videos.
  const padTop = W < H ? H * 0.07 : pad;
  const padBottom = W < H ? H * 0.1 : pad;
  const textW = landscape ? W * 0.5 - pad * 2 : W - pad * 2;
  const offerBadge = ad.facts.offer && r.badge !== 'none' ? ad.facts.offer : null;
  const offerPlain = ad.facts.offer && r.badge === 'none' ? ad.facts.offer : null;
  const hasPhotoBlock = Boolean(photo && r.photo.shape !== 'none');

  // Fit: shrink every size together when the content would not fit the frame.
  const band = !landscape && (r.layout === 'photo_band' || r.layout === 'editorial');
  const photoH0 = landscape
    ? 0
    : band
      ? 0
      : r.layout === 'list'
        ? W * 0.42
        : hasPhotoBlock
          ? H * (r.layout === 'arch' ? 0.33 : 0.3)
          : 0;
  const avail = landscape
    ? H - pad * 2
    : r.layout === 'photo_band'
      ? H * 0.6 - padBottom
      : r.layout === 'editorial'
        ? H * 0.52 - padBottom - u0 * 3
        : H - padTop - padBottom;
  const need = estimateColumn(r, ad, extras, u0, textW, landscape, {
    brand: !band,
    photoH: hasPhotoBlock || r.layout === 'list' ? photoH0 : 0,
    badge: Boolean(offerBadge) && (band || !hasPhotoBlock),
    listItems: r.layout === 'list' ? Math.max(1, r.chips.length) : 0,
    price: r.layout !== 'list',
  });
  const k = Math.max(0.55, Math.min(1, avail / need));
  const u = u0 * k;

  const timing = TIMING[r.rhythm];
  let n = 0;
  const c: Ctx = {
    frame,
    fps,
    W,
    H,
    u,
    landscape,
    r,
    next: () => ({ start: timing.start + timing.stagger * n++, dur: timing.dur }),
  };
  const align = landscape ? 'left' : r.headline.align;

  const photoBox = (w: number, h: number) =>
    photo && r.photo.shape !== 'none' ? (
      <Enter
        c={c}
        kind={r.photo.enter}
        style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}
      >
        <Photo c={c} src={photo} w={w} h={h} />
        {offerBadge && (
          <div style={{ position: 'absolute', right: -u * 2, top: -u * 3 }}>
            <Enter
              c={c}
              kind={
                r.badge === 'stamp'
                  ? 'stamp'
                  : r.badge === 'ribbon' || r.badge === 'tag'
                    ? 'swing'
                    : 'pop'
              }
            >
              <OfferBadge c={c} text={offerBadge} />
            </Enter>
          </div>
        )}
      </Enter>
    ) : offerBadge ? (
      <Enter c={c} kind="stamp" style={{ display: 'flex', justifyContent: 'center' }}>
        <OfferBadge c={c} text={offerBadge} />
      </Enter>
    ) : null;

  const textStack = (
    <>
      <Headline c={c} ad={ad} maxW={textW} />
      {r.tagline && (
        <Enter c={c} kind="rise" style={{ textAlign: align }}>
          <span
            style={{
              fontFamily: FONTS[r.fonts].body,
              fontWeight: 500,
              fontSize: u * 4,
              color: r.palette.ink,
              opacity: 0.9,
            }}
          >
            {r.tagline}
          </span>
        </Enter>
      )}
      {offerPlain && (
        <Enter c={c} kind="rise" style={{ textAlign: align }}>
          <span
            style={{
              fontFamily: FONTS[r.fonts].body,
              fontWeight: 800,
              fontSize: u * 5,
              color: r.palette.accent,
            }}
          >
            {offerPlain}
          </span>
        </Enter>
      )}
      <Chips c={c} align={align} />
      <Facts c={c} ad={ad} extras={extras} align={align} />
    </>
  );

  const column: CSSProperties = {
    position: 'absolute',
    inset: 0,
    padding: `${padTop}px ${pad}px ${padBottom}px`,
    display: 'flex',
    flexDirection: 'column',
    gap: u * 3,
    boxSizing: 'border-box',
  };
  let content: ReactNode;

  if (r.layout === 'story' && photo) {
    content = (
      <Story
        c={c}
        ad={ad}
        extras={extras}
        photo={photo}
        pad={pad}
        padTop={padTop}
        padBottom={padBottom}
        offer={offerBadge ?? offerPlain}
      />
    );
  } else if (landscape) {
    content = (
      <div style={{ ...column, flexDirection: 'row', alignItems: 'center', gap: pad }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          {photoBox(H * 0.62, H * 0.7)}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: u * 2.4 }}>
          <BrandRow c={c} ad={ad} align="left" />
          {textStack}
          <Cta c={c} ad={ad} />
        </div>
      </div>
    );
  } else if (r.layout === 'photo_band' || r.layout === 'editorial') {
    const isBand = r.layout === 'photo_band';
    content = (
      <>
        {photo && isBand && (
          // Full-bleed photo with the colour fading in from the bottom, under the text.
          <AbsoluteFill>
            <Img
              src={photo}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${1 + 0.12 * (frame / (r.duration * fps))})`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(180deg, ${r.palette.bg}00 0%, ${r.palette.bg}00 28%, ${r.palette.bg}e6 46%, ${r.palette.bg} 60%)`,
              }}
            />
          </AbsoluteFill>
        )}
        {photo && !isBand && (
          <Enter
            c={c}
            kind={r.photo.enter}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, height: H * 0.46 }}
          >
            <Photo c={c} src={photo} w={W} h={H * 0.46} forceShape="full" />
          </Enter>
        )}
        <div
          style={{
            ...column,
            justifyContent: isBand ? 'flex-end' : 'flex-start',
            // Editorial: the text starts below the photo and never runs into it.
            paddingTop: isBand ? padTop : H * 0.46 + u0 * 4,
            gap: u * 2.6,
          }}
        >
          <div style={{ position: 'absolute', top: padTop, left: pad, right: pad }}>
            <div
              style={{
                display: 'inline-flex',
                padding: `${u * 1}px ${u * 2.4}px`,
                borderRadius: 999,
                background: `${r.palette.bg}e6`,
              }}
            >
              <BrandRow c={c} ad={ad} align={align} />
            </div>
          </div>
          {offerBadge && (
            <Enter
              c={c}
              kind="stamp"
              style={{
                display: 'flex',
                justifyContent: align === 'center' ? 'center' : 'flex-start',
              }}
            >
              <OfferBadge c={c} text={offerBadge} />
            </Enter>
          )}
          {textStack}
          <Cta c={c} ad={ad} />
        </div>
      </>
    );
  } else if (r.layout === 'list') {
    content = (
      <div style={column}>
        <BrandRow c={c} ad={ad} align={align} />
        <Headline c={c} ad={ad} maxW={textW} />
        {photoBox(W * 0.42 * k, W * 0.42 * k)}
        <div style={{ display: 'flex', flexDirection: 'column', gap: u * 2 }}>
          {(r.chips.length ? r.chips : [ad.productName]).map((item, i) => (
            <Enter key={i} c={c} kind="wipe">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: u * 1.5,
                  color: r.palette.ink,
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS[r.fonts].heading,
                    fontWeight: FONTS[r.fonts].headingWeight,
                    fontSize: u * 5.4,
                  }}
                >
                  {item}
                </span>
                <span style={{ flex: 1, borderBottom: `${u * 0.3}px dotted ${r.palette.ink}66` }} />
                {item === ad.productName && ad.facts.price && (
                  <span
                    style={{
                      fontFamily: FONTS[r.fonts].body,
                      fontWeight: 800,
                      fontSize: u * 4.4,
                      color: r.palette.accent,
                    }}
                  >
                    {ad.facts.price}
                  </span>
                )}
              </div>
            </Enter>
          ))}
        </div>
        {r.tagline && (
          <Enter c={c} kind="rise" style={{ textAlign: align }}>
            <span
              style={{ fontFamily: FONTS[r.fonts].body, fontSize: u * 3.8, color: r.palette.ink }}
            >
              {r.tagline}
            </span>
          </Enter>
        )}
        <Facts
          c={c}
          ad={{ ...ad, facts: { ...ad.facts, price: null } }}
          extras={extras}
          align={align}
        />
        <div style={{ flex: 1 }} />
        <Cta c={c} ad={ad} />
      </div>
    );
  } else {
    // spotlight and arch
    const arch = r.layout === 'arch';
    content = (
      <div style={{ ...column, alignItems: 'stretch' }}>
        <BrandRow c={c} ad={ad} align={align} />
        {arch && <Headline c={c} ad={ad} maxW={textW} />}
        {photoBox((arch ? W * 0.62 : W * 0.66) * k, photoH0 * k)}
        {arch ? (
          <>
            {r.tagline && (
              <Enter c={c} kind="rise" style={{ textAlign: align }}>
                <span
                  style={{
                    fontFamily: FONTS[r.fonts].body,
                    fontWeight: 500,
                    fontSize: u * 4,
                    color: r.palette.ink,
                  }}
                >
                  {r.tagline}
                </span>
              </Enter>
            )}
            <Chips c={c} align={align} />
            <Facts c={c} ad={ad} extras={extras} align={align} />
          </>
        ) : (
          textStack
        )}
        <div style={{ flex: 1 }} />
        <Cta c={c} ad={ad} />
      </div>
    );
  }

  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: r.palette.bg }}>
      <Background c={c} photo={photo} />
      {content}
      <Accents c={c} ad={ad} extras={extras} />
      {extras?.registration && (
        <div
          style={{
            position: 'absolute',
            left: pad,
            right: pad,
            bottom: W < H ? H * 0.055 : u * 2,
            textAlign: 'center',
            fontFamily: FONTS[r.fonts].body,
            fontSize: u * 2.4,
            color: r.palette.ink,
            opacity: 0.85,
          }}
        >
          {extras.registration}
        </div>
      )}
      {ad.qrUrl && (
        <div
          style={{
            position: 'absolute',
            right: u * 3,
            bottom: W < H ? H * 0.1 + u * 18 : u * 3,
            opacity: progress(frame, fps, r.duration - 3.5, 0.6),
          }}
        >
          <QrCode value={ad.qrUrl} size={u * 16} />
        </div>
      )}
      {ad.watermark && (
        <div
          style={{
            position: 'absolute',
            left: u * 3,
            bottom: u * 2,
            fontFamily: 'Inter, sans-serif',
            fontSize: u * 2.4,
            color: r.palette.ink,
            opacity: 0.6,
          }}
        >
          Made with Kalpix
        </div>
      )}
    </AbsoluteFill>
  );
}

// ------------------------------------------------------------------------------- story (3 scenes)
function Story({
  c,
  ad,
  extras,
  photo,
  pad,
  padTop,
  padBottom,
  offer,
}: {
  c: Ctx;
  ad: OutlineHighlightProps;
  extras?: ComposerExtras;
  photo: string;
  pad: number;
  padTop: number;
  padBottom: number;
  offer: string | null;
}) {
  const { r, frame, fps, u, W } = c;
  const total = r.duration * fps;
  const cut1 = Math.round(total * 0.3);
  const cut2 = Math.round(total * 0.62);
  const wipeIn = (at: number) =>
    `inset(0 0 0 ${Math.max(0, 100 - ((frame - at) / (fps * 0.4)) * 100)}%)`;
  // Each scene times its own entrances from its start.
  const scene = (at: number): Ctx => {
    let k = 0;
    const tm = TIMING[r.rhythm];
    return { ...c, next: () => ({ start: at / fps + tm.start + tm.stagger * k++, dur: tm.dur }) };
  };
  const s1 = scene(0);
  const s2 = scene(cut1);
  const s3 = scene(cut2);
  const col: CSSProperties = {
    position: 'absolute',
    inset: 0,
    padding: `${padTop}px ${pad}px ${padBottom}px`,
    display: 'flex',
    flexDirection: 'column',
    gap: u * 3,
    boxSizing: 'border-box',
  };
  const bars = [0, cut1, cut2, total];
  return (
    <>
      {frame < cut1 + fps * 0.4 && (
        <AbsoluteFill>
          <Img
            src={photo}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: `blur(${u * 1.2}px) brightness(.5)`,
              transform: 'scale(1.1)',
            }}
          />
          <div style={{ ...col, justifyContent: 'center' }}>
            <Headline
              c={{ ...s1, r: { ...r, palette: { ...r.palette, ink: '#ffffff' } } }}
              ad={ad}
              maxW={W - pad * 2}
            />
          </div>
        </AbsoluteFill>
      )}
      {frame >= cut1 && frame < cut2 + fps * 0.4 && (
        <AbsoluteFill style={{ clipPath: wipeIn(cut1) }}>
          <Img
            src={photo}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${1 + 0.1 * ((frame - cut1) / (cut2 - cut1))})`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '45%',
              background: 'linear-gradient(transparent, rgba(0,0,0,.8))',
            }}
          />
          <div style={{ ...col, justifyContent: 'flex-end' }}>
            <Enter c={s2} kind="rise">
              <span
                style={{
                  fontFamily: FONTS[r.fonts].heading,
                  fontWeight: FONTS[r.fonts].headingWeight,
                  fontSize: fit(
                    ad.productName,
                    u * 9,
                    W - pad * 2,
                    2,
                    isDevanagari(ad.productName),
                    false,
                  ),
                  color: '#ffffff',
                  lineHeight: 1.05,
                }}
              >
                {ad.productName}
              </span>
            </Enter>
            {r.tagline && (
              <Enter c={s2} kind="rise">
                <span
                  style={{
                    fontFamily: FONTS[r.fonts].body,
                    fontSize: u * 4,
                    color: '#ffffff',
                    opacity: 0.9,
                  }}
                >
                  {r.tagline}
                </span>
              </Enter>
            )}
          </div>
        </AbsoluteFill>
      )}
      {frame >= cut2 && (
        <AbsoluteFill
          style={{
            clipPath: wipeIn(cut2),
            background: `linear-gradient(170deg, ${r.palette.bg}, ${r.palette.bg2})`,
          }}
        >
          <div style={{ ...col, justifyContent: 'center', alignItems: 'stretch' }}>
            {r.icon && (
              <Enter c={s3} kind="iris" style={{ display: 'flex', justifyContent: 'center' }}>
                <div
                  style={{
                    width: u * 26,
                    height: u * 26,
                    borderRadius: '50%',
                    background: r.palette.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <LineIcon
                    c={{ ...s3, frame: frame - cut2 }}
                    size={u * 15}
                    color={r.palette.onAccent}
                  />
                </div>
              </Enter>
            )}
            <BrandRow c={s3} ad={ad} align="center" />
            {r.headline.accent && (
              <Enter c={s3} kind="rise" style={{ textAlign: 'center' }}>
                <span
                  style={{
                    fontFamily: isDevanagari(r.headline.accent)
                      ? FONTS[r.fonts].devHeading
                      : FONTS[r.fonts].heading,
                    fontWeight: FONTS[r.fonts].headingWeight,
                    fontSize: fit(
                      r.headline.accent,
                      u * 8,
                      W - pad * 2,
                      2,
                      isDevanagari(r.headline.accent),
                      false,
                    ),
                    color: r.palette.accent,
                    lineHeight: 1.1,
                  }}
                >
                  {r.headline.accent}
                </span>
              </Enter>
            )}
            {offer && (
              <Enter c={s3} kind="stamp" style={{ display: 'flex', justifyContent: 'center' }}>
                <OfferBadge c={s3} text={offer} />
              </Enter>
            )}
            <Facts c={s3} ad={ad} extras={extras} align="center" />
            <Chips c={s3} align="center" />
            <Cta c={s3} ad={ad} />
          </div>
        </AbsoluteFill>
      )}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: u * 2,
          left: u * 2,
          right: u * 2,
          display: 'flex',
          gap: u,
        }}
      >
        {[0, 1, 2].map((i) => {
          const p = Math.min(1, Math.max(0, (frame - bars[i]!) / (bars[i + 1]! - bars[i]!)));
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: u * 0.5,
                borderRadius: u,
                background: 'rgba(255,255,255,.35)',
                overflow: 'hidden',
              }}
            >
              <div style={{ width: `${p * 100}%`, height: '100%', background: '#ffffff' }} />
            </div>
          );
        })}
      </div>
    </>
  );
}
