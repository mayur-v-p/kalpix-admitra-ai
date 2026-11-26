// The AI scene layer (PRD 4.3, composite mode): it sits BEHIND everything else, and the real
// product cutout and all text are drawn on top by code, so a scene can never change the
// product or the facts.
//
// * videoUrl set: the owner-approved AI clip, looped, under a soft scrim that keeps text readable.
// * no videoUrl: a code-drawn stand-in for the scene type (test mode, and the still preview
//   while a real clip is being generated). Light-toned on purpose: text stays legible.
import {
  AbsoluteFill,
  Loop,
  OffthreadVideo,
  interpolate,
  random,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { AdScene, BrandStyle } from './types';

const CLIP_SECONDS = 5;

function Steam({ brand }: { brand: BrandStyle }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const u = Math.min(width, height);
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 55% at 50% 72%, ${brand.accent}55, transparent 70%)`,
        }}
      />
      {Array.from({ length: 7 }, (_, i) => {
        const period = 150 + random(`sp${i}`) * 90;
        const t = ((frame + random(`so${i}`) * period) % period) / period; // 0..1 rising
        const x = width * (0.3 + random(`sx${i}`) * 0.4) + Math.sin(t * Math.PI * 2 + i) * u * 0.05;
        const y = height * (0.72 - t * 0.6);
        const s = u * (0.12 + t * 0.22);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - s / 2,
              top: y - s,
              width: s,
              height: s * 1.8,
              borderRadius: '50%',
              background: '#ffffff',
              opacity: Math.sin(t * Math.PI) * 0.45,
              filter: `blur(${u * 0.035}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

function Festive({ brand }: { brand: BrandStyle }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const u = Math.min(width, height);
  const colours = ['#F2C94C', '#F2994A', '#EB5757', brand.accent, '#F7E08A'];
  return (
    <AbsoluteFill>
      {Array.from({ length: 30 }, (_, i) => {
        const size = u * (0.04 + random(`fs${i}`) * 0.1);
        const twinkle = 0.35 + 0.35 * Math.sin(frame / (10 + random(`ft${i}`) * 14) + i);
        const drift = Math.sin(frame / 90 + i) * u * 0.015;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: random(`fx${i}`) * width - size / 2 + drift,
              top: random(`fy${i}`) * height - size / 2,
              width: size,
              height: size,
              borderRadius: '50%',
              background: colours[i % colours.length],
              opacity: twinkle * 0.6,
              filter: `blur(${size * 0.18}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

function Sunrise({ brand }: { brand: BrandStyle }) {
  const frame = useCurrentFrame();
  const { width, durationInFrames } = useVideoConfig();
  const sweep = interpolate(frame, [0, durationInFrames], [-0.6, 1.2]);
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{ background: `linear-gradient(180deg, #FFE9C7aa 0%, ${brand.secondary}00 60%)` }}
      />
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          bottom: '-20%',
          left: sweep * width,
          width: width * 0.45,
          background: 'linear-gradient(90deg, transparent, #FFF6DDcc, transparent)',
          transform: 'rotate(18deg)',
          filter: `blur(${width * 0.03}px)`,
        }}
      />
    </AbsoluteFill>
  );
}

function Spa() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const u = Math.min(width, height);
  const colours = ['#CFE3D4', '#E6DDF2', '#F6E3D8', '#D8E9EE'];
  return (
    <AbsoluteFill>
      {Array.from({ length: 6 }, (_, i) => {
        const s = u * (0.45 + random(`ss${i}`) * 0.35);
        const x = random(`sx${i}`) * width + Math.sin(frame / 80 + i) * u * 0.06;
        const y = random(`sy${i}`) * height + Math.cos(frame / 95 + i) * u * 0.06;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - s / 2,
              top: y - s / 2,
              width: s,
              height: s,
              borderRadius: '50%',
              background: colours[i % colours.length],
              opacity: 0.75,
              filter: `blur(${u * 0.08}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

function Studio({ brand }: { brand: BrandStyle }) {
  const frame = useCurrentFrame();
  const x = 50 + Math.sin(frame / 70) * 22;
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 45% 40% at ${x}% 45%, #ffffffcc, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, transparent 62%, ${brand.primary}14 100%)`,
        }}
      />
    </AbsoluteFill>
  );
}

export function SceneLayer({ scene, brand }: { scene: AdScene; brand: BrandStyle }) {
  const { fps } = useVideoConfig();
  if (scene.videoUrl) {
    return (
      <AbsoluteFill>
        <Loop durationInFrames={Math.round(CLIP_SECONDS * fps)}>
          <OffthreadVideo
            src={scene.videoUrl}
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Loop>
        {/* scrim: keeps code-drawn text readable over any clip */}
        <AbsoluteFill style={{ backgroundColor: brand.secondary, opacity: 0.55 }} />
      </AbsoluteFill>
    );
  }
  switch (scene.style) {
    case 'steam':
      return <Steam brand={brand} />;
    case 'festive':
      return <Festive brand={brand} />;
    case 'sunrise':
      return <Sunrise brand={brand} />;
    case 'spa':
      return <Spa />;
    case 'studio':
      return <Studio brand={brand} />;
    default:
      return null;
  }
}
