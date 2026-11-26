import { useId, useMemo, type CSSProperties } from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { containRect, smoothClosedPath } from '../outline/trace';
import { QrCode } from '../qr';
import { SceneLayer } from '../scene';
import type { OutlineHighlightProps, OutlineStyle } from '../types';
import { highlightLayout, roundedRectPath, type Box } from './layout';
import { phase, sec } from './timeline';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

type Stroke = { color: string; filter: string; gradient: boolean };

/** How the drawing lines look: brand colour, neon glow or gold. */
function outlineStroke(style: OutlineStyle, accent: string, unit: number): Stroke {
  switch (style) {
    case 'neon':
      return {
        color: accent,
        filter: `drop-shadow(0 0 ${unit * 0.18}px ${accent}) drop-shadow(0 0 ${unit * 0.05}px #ffffff)`,
        gradient: false,
      };
    case 'gold':
      return { color: '#C9962B', filter: 'none', gradient: true };
    default:
      return { color: accent, filter: 'none', gradient: false };
  }
}

function GoldGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#F7E08A" />
      <stop offset="0.5" stopColor="#C9962B" />
      <stop offset="1" stopColor="#F2D16B" />
    </linearGradient>
  );
}

/**
 * Text that is DRAWN: each letter's outline traces itself (stroke dash animation on the glyph
 * outlines), then the letters fill in. `draw` and `fill` run 0..1.
 */
function DrawnText({
  text,
  size,
  draw,
  fill,
  stroke,
  fillColor,
  fontFamily,
  fontWeight,
  letterSpacing,
  align,
}: {
  text: string;
  size: number;
  draw: number;
  fill: number;
  stroke: Stroke;
  fillColor: string;
  fontFamily: string;
  fontWeight: number;
  letterSpacing: string;
  align: 'center' | 'left';
}) {
  const gid = `t${useId().replace(/:/g, '')}`;
  // Longer than any single glyph contour, so each contour draws once from start to end.
  const dash = size * 4;
  return (
    <svg
      aria-label={text}
      role="img"
      width="100%"
      height={size * 1.3}
      style={{ display: 'block', overflow: 'visible', filter: stroke.filter }}
    >
      {stroke.gradient && (
        <defs>
          <GoldGradient id={gid} />
        </defs>
      )}
      <text
        x={align === 'center' ? '50%' : 0}
        y={size}
        textAnchor={align === 'center' ? 'middle' : 'start'}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
        fontSize={size}
        letterSpacing={letterSpacing}
        fill={fillColor}
        fillOpacity={fill}
        stroke={stroke.gradient ? `url(#${gid})` : stroke.color}
        strokeWidth={Math.max(2, size * 0.045)}
        strokeLinejoin="round"
        strokeDasharray={`${dash} ${dash}`}
        strokeDashoffset={dash * (1 - draw)}
        strokeOpacity={1 - fill * 0.6}
      >
        {text}
      </text>
    </svg>
  );
}

/** Font size that keeps a line of text inside `width` (rough average glyph width). */
const fitSize = (text: string, preferred: number, width: number, spacingEm = 0) =>
  Math.min(preferred, width / Math.max(1, text.length * (0.62 + spacingEm)));

/**
 * Where the product sits. With a traced outline, the photo is zoomed so the PRODUCT (not the
 * photo's empty margins) fills the space and it is shown only inside its own shape (no photo
 * background). Without one, it sits in a rounded frame.
 */
function productShape(props: OutlineHighlightProps, product: Box, unit: number) {
  const outline = props.productOutline;
  if (outline && outline.points.length >= 4) {
    const parts = outline.parts?.length ? outline.parts : [outline.points];
    const all = parts.flat();
    const minX = Math.min(...all.map((p) => p[0]));
    const maxX = Math.max(...all.map((p) => p[0]));
    const minY = Math.min(...all.map((p) => p[1]));
    const maxY = Math.max(...all.map((p) => p[1]));
    const bboxAspect = ((maxX - minX) * outline.aspect) / Math.max(0.0001, maxY - minY);
    const inset = unit * 0.6;
    const rect = containRect(
      {
        x: product.x + inset,
        y: product.y + inset,
        width: product.width - inset * 2,
        height: product.height - inset * 2,
      },
      bboxAspect,
    );
    const imgW = rect.width / (maxX - minX);
    const imgH = rect.height / (maxY - minY);
    const image = { x: rect.x - minX * imgW, y: rect.y - minY * imgH, width: imgW, height: imgH };
    const toCanvas = ([x, y]: [number, number]) =>
      [image.x + x * imgW, image.y + y * imgH] as [number, number];
    const toImage = ([x, y]: [number, number]) => [x * imgW, y * imgH] as [number, number];
    return {
      traced: true,
      rect,
      image,
      // The product is drawn by the outline of every part (a cup AND its steam), on the edge.
      outlines: parts.map((part) => smoothClosedPath(part.map(toCanvas))),
      clip: parts.map((part) => smoothClosedPath(part.map(toImage))).join(' '),
    };
  }
  const inset = unit * 0.4;
  const rect = {
    x: product.x + inset,
    y: product.y + inset,
    width: product.width - inset * 2,
    height: product.height - inset * 2,
  };
  return {
    traced: false,
    rect,
    image: rect,
    outlines: [roundedRectPath(rect, unit * 0.8)],
    clip: null,
  };
}

/**
 * Outline Highlight (signature style 1). Things appear THROUGH their outlines: the brand
 * name and product name are drawn letter by letter and then fill in; the product is drawn by
 * its outline, sketched, then coloured in from the bottom up. The offer pops in and a closing
 * card follows. A pure function of the frame, so the browser preview and the M5 renderer
 * produce the same video. Facts are drawn only from props; callers pass only confirmed facts.
 */
export function OutlineHighlight(props: OutlineHighlightProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const id = useId().replace(/:/g, '');
  const layout = useMemo(() => highlightLayout(props.aspect), [props.aspect]);
  const { unit, product, header, details, width, height } = layout;
  const { brand, facts } = props;
  const shape = useMemo(() => productShape(props, product, unit), [props, product, unit]);
  const stroke = outlineStroke(props.outlineStyle, brand.accent, unit);
  const wide = props.aspect === '16:9';
  const align = wide ? 'left' : 'center';

  // ---------- timing ----------
  const ramp = (range: [number, number], easing = Easing.inOut(Easing.cubic)) =>
    interpolate(frame, range, [0, 1], { ...clamp, easing });
  const [bdStart, bdEnd] = phase('brandDraw');
  const brandDraw = ramp([bdStart, bdEnd - sec(0.4)]);
  const brandFill = ramp([bdEnd - sec(0.5), bdEnd + sec(0.3)]);
  const productDraw = ramp(phase('productOutline'));
  const sketch = ramp(phase('sketch'), Easing.out(Easing.quad));
  const [fillStart, fillEnd] = phase('fill');
  const fill = ramp([fillStart, fillEnd], Easing.inOut(Easing.quad));
  const [ndStart, ndEnd] = phase('nameDraw');
  const nameDraw = ramp([ndStart, ndEnd - sec(0.5)]);
  const nameFill = ramp([ndEnd - sec(0.6), ndEnd + sec(0.2)]);
  const [offerStart] = phase('offer');
  const [endStart] = phase('endCard');
  const endIn = spring({ frame: frame - endStart, fps, config: { damping: 16 } });
  const push = interpolate(frame, [0, endStart], [1, 1.04], clamp);
  // the drawn outline relaxes into a thin line once the colour is in
  const outlineFade = interpolate(frame, [fillEnd, fillEnd + sec(0.8)], [1, 0.35], clamp);
  const sparkle = interpolate(frame, [fillEnd - sec(0.2), fillEnd + sec(0.7)], [0, 1], clamp);

  const center = {
    x: shape.rect.x + shape.rect.width / 2,
    y: shape.rect.y + shape.rect.height / 2,
  };

  const text = (size: number, extra: CSSProperties = {}): CSSProperties => ({
    fontFamily: brand.fontBody,
    fontSize: size,
    color: brand.primary,
    lineHeight: 1.15,
    margin: 0,
    ...extra,
  });
  const words = props.headline.split(/\s+/).filter(Boolean);
  const offerChars = facts.offer ? Array.from(facts.offer) : [];
  const fadeIn = (start: number, length = sec(0.5)) =>
    interpolate(frame, [start, start + length], [0, 1], clamp);
  const lineColor = stroke.gradient ? `url(#gold-${id})` : stroke.color;
  const brandSize = fitSize(props.businessName, unit * 0.8, header.width, 0.25);
  const nameSize = fitSize(props.productName, unit * 1.15, details.width, 0.05);

  return (
    <AbsoluteFill style={{ backgroundColor: brand.secondary, overflow: 'hidden' }}>
      {props.scene && <SceneLayer scene={props.scene} brand={brand} />}
      <AbsoluteFill
        style={{ transform: `scale(${push})`, transformOrigin: `${center.x}px ${center.y}px` }}
      >
        {/* Gently floating specks */}
        {Array.from({ length: 16 }, (_, i) => {
          const x = random(`x${i}`) * width;
          const y0 = random(`y${i}`) * height;
          const y =
            (((y0 - frame * (0.3 + random(`s${i}`) * 0.6) * (unit / 30)) % height) + height) %
            height;
          const size = unit * (0.06 + random(`r${i}`) * 0.1);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: size,
                height: size,
                borderRadius: '50%',
                backgroundColor: brand.accent,
                opacity: 0.15 + random(`o${i}`) * 0.2,
              }}
            />
          );
        })}

        {/* Soft glow behind the product, growing as it fills */}
        <div
          style={{
            position: 'absolute',
            left: center.x - shape.rect.width * 0.9,
            top: center.y - shape.rect.height * 0.8,
            width: shape.rect.width * 1.8,
            height: shape.rect.height * 1.6,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${brand.accent}50, transparent)`,
            opacity: 0.25 + fill * 0.6,
          }}
        />

        {/* Header: brand name drawn letter by letter, then the headline */}
        <div
          style={{
            position: 'absolute',
            left: header.x,
            top: header.y,
            width: header.width,
            height: header.height,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: wide ? 'flex-start' : 'center',
            gap: unit * 0.35,
            textAlign: align,
          }}
        >
          <DrawnText
            text={props.businessName.toUpperCase()}
            size={brandSize}
            draw={brandDraw}
            fill={brandFill}
            stroke={stroke}
            fillColor={brand.primary}
            fontFamily={brand.fontHeading}
            fontWeight={500}
            letterSpacing="0.22em"
            align={align}
          />
          <p
            style={text(unit * (wide ? 1.05 : 0.9), {
              fontFamily: brand.fontHeading,
              fontWeight: 400,
              letterSpacing: '0.04em',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: wide ? 'flex-start' : 'center',
              columnGap: '0.3em',
            })}
          >
            {words.map((w, i) => {
              const s = spring({ frame: frame - sec(1.2) - i * 4, fps, config: { damping: 14 } });
              return (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    opacity: s,
                    transform: `translateY(${(1 - s) * unit * 0.7}px)`,
                  }}
                >
                  {w}
                </span>
              );
            })}
          </p>
        </div>

        {/* Shadow under the product */}
        <div
          style={{
            position: 'absolute',
            left: center.x - shape.rect.width * 0.38,
            top: shape.rect.y + shape.rect.height - unit * 0.2,
            width: shape.rect.width * 0.76,
            height: unit * 0.45,
            borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(0,0,0,.22), transparent)',
            opacity: fill,
          }}
        />

        {/* The product: sketch lines, then colour filling from the bottom up */}
        <div
          style={{
            position: 'absolute',
            left: shape.image.x,
            top: shape.image.y,
            width: shape.image.width,
            height: shape.image.height,
            clipPath: shape.clip ? `path('${shape.clip}')` : `inset(0 round ${unit * 0.8}px)`,
          }}
        >
          {props.productImageUrl && (
            <>
              <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
                {/* Edge detection: turns the photo into dark sketch lines on transparent */}
                <filter id={`sketch-${id}`} colorInterpolationFilters="sRGB">
                  <feColorMatrix type="saturate" values="0" />
                  <feConvolveMatrix
                    order="3"
                    kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1"
                    preserveAlpha="true"
                  />
                  <feColorMatrix
                    type="matrix"
                    values={`0 0 0 0 0.12  0 0 0 0 0.12  0 0 0 0 0.11  2.2 2.2 2.2 0 0`}
                  />
                </filter>
              </svg>
              {/* Sketch, revealed top to bottom */}
              <Img
                src={props.productImageUrl}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  padding: shape.traced ? 0 : unit * 0.5,
                  filter: `url(#sketch-${id})`,
                  clipPath: `inset(0 0 ${(1 - sketch) * 100}% 0)`,
                  opacity: 1 - fill * 0.9,
                }}
              />
              {/* Colour, filling from the bottom up */}
              <Img
                src={props.productImageUrl}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  padding: shape.traced ? 0 : unit * 0.5,
                  clipPath: `inset(${(1 - fill) * 100}% 0 0 0)`,
                }}
              />
            </>
          )}
          {!props.productImageUrl && (
            <div
              style={{
                display: 'flex',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: brand.fontHeading,
                fontSize: unit * 1.1,
                color: brand.primary,
                textAlign: 'center',
                padding: unit,
                opacity: fill,
              }}
            >
              {props.productName}
            </div>
          )}
        </div>

        {/* The product's outline, drawn on its own edge */}
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ position: 'absolute', inset: 0, overflow: 'visible', filter: stroke.filter }}
          aria-hidden
        >
          {stroke.gradient && (
            <defs>
              <GoldGradient id={`gold-${id}`} />
            </defs>
          )}
          {shape.outlines.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={lineColor}
              strokeWidth={unit * 0.09}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - productDraw}
              strokeOpacity={outlineFade}
            />
          ))}
        </svg>

        {/* A small sparkle when the product is complete */}
        {Array.from({ length: 12 }, (_, i) => {
          if (sparkle <= 0 || sparkle >= 1) return null;
          const angle = (i / 12) * Math.PI * 2 + random(`a${i}`) * 0.4;
          const dist =
            (Math.max(shape.rect.width, shape.rect.height) * 0.5 + unit * 0.8) *
            Easing.out(Easing.cubic)(sparkle);
          const size = unit * (0.1 + random(`z${i}`) * 0.12) * (1 - sparkle * 0.6);
          return (
            <div
              key={`sp${i}`}
              style={{
                position: 'absolute',
                left: center.x + Math.cos(angle) * dist - size / 2,
                top: center.y + Math.sin(angle) * dist - size / 2,
                width: size,
                height: size,
                borderRadius: '50%',
                backgroundColor: i % 3 === 0 ? '#ffffff' : brand.accent,
                opacity: 1 - sparkle,
                boxShadow: `0 0 ${unit * 0.25}px ${brand.accent}`,
              }}
            />
          );
        })}

        {/* Product name drawn letter by letter, then offer, price and dates */}
        <div
          style={{
            position: 'absolute',
            left: details.x,
            top: details.y,
            width: details.width,
            height: details.height,
            display: 'flex',
            flexDirection: 'column',
            alignItems: wide ? 'flex-start' : 'center',
            justifyContent: 'center',
            gap: unit * 0.25,
          }}
        >
          <DrawnText
            text={props.productName}
            size={nameSize}
            draw={nameDraw}
            fill={nameFill}
            stroke={stroke}
            fillColor={brand.primary}
            fontFamily={brand.fontHeading}
            fontWeight={500}
            letterSpacing="0.03em"
            align={align}
          />
          {offerChars.length > 0 && (
            <p
              style={text(unit * (props.aspect === '1:1' ? 1.6 : 1.9), {
                fontFamily: brand.fontHeading,
                fontWeight: 600,
                letterSpacing: '0.02em',
                whiteSpace: 'pre',
              })}
            >
              {offerChars.map((ch, i) => {
                const s = spring({
                  frame: frame - offerStart - i * 2,
                  fps,
                  config: { damping: 9, mass: 0.6 },
                });
                return (
                  <span
                    key={i}
                    style={{
                      display: 'inline-block',
                      opacity: Math.min(1, s * 1.5),
                      transform: `translateY(${(1 - s) * unit}px) scale(${0.4 + s * 0.6})`,
                    }}
                  >
                    {ch}
                  </span>
                );
              })}
            </p>
          )}
          {(facts.price || facts.validity) && (
            <p style={text(unit * 0.55, { opacity: fadeIn(offerStart + sec(0.6)) * 0.85 })}>
              {[facts.price, facts.validity].filter(Boolean).join('  ·  ')}
            </p>
          )}
        </div>
      </AbsoluteFill>

      {/* Closing card, full frame */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: brand.primary,
          color: brand.secondary,
          transform: `translateY(${(1 - endIn) * 100}%)`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: unit * 0.55,
          padding: `0 ${layout.margin}px`,
          textAlign: 'center',
        }}
      >
        {props.logoUrl && (
          <Img
            src={props.logoUrl}
            style={{
              width: unit * 2.6,
              height: unit * 2.6,
              objectFit: 'contain',
              borderRadius: unit * 0.4,
              transform: `scale(${spring({ frame: frame - endStart - 6, fps, config: { damping: 10 } })})`,
            }}
          />
        )}
        <p
          style={text(unit * 1.2, {
            color: brand.secondary,
            fontFamily: brand.fontHeading,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          })}
        >
          {props.businessName}
        </p>
        {facts.offer && (
          <p
            style={text(unit * 1.4, {
              color: brand.accent,
              fontFamily: brand.fontHeading,
              fontWeight: 600,
            })}
          >
            {facts.offer}
          </p>
        )}
        {facts.validity && (
          <p style={text(unit * 0.5, { color: brand.secondary, opacity: 0.75 })}>
            {facts.validity}
          </p>
        )}
        <p
          style={text(unit * 0.75, {
            color: brand.primary,
            backgroundColor: brand.accent,
            borderRadius: 999,
            padding: `${unit * 0.25}px ${unit * 0.8}px`,
            fontWeight: 600,
            transform: `scale(${1 + Math.max(0, Math.sin((frame - endStart) / 6)) * 0.05})`,
            boxShadow: `0 0 ${unit * 0.5}px ${brand.accent}66`,
          })}
        >
          {props.cta}
        </p>
        {(facts.phone || facts.address) && (
          <p style={text(unit * 0.55, { color: brand.secondary, opacity: 0.9 })}>
            {[facts.phone, facts.address].filter(Boolean).join('  ·  ')}
          </p>
        )}
        {props.qrUrl && (
          <div
            style={{
              position: 'absolute',
              right: layout.margin * 0.6,
              bottom: layout.margin * 0.6,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: unit * 0.15,
              opacity: fadeIn(endStart + sec(0.6)),
            }}
          >
            <p style={text(unit * 0.36, { color: brand.secondary, letterSpacing: '0.1em' })}>
              SCAN ME
            </p>
            <div style={{ borderRadius: unit * 0.15, overflow: 'hidden', lineHeight: 0 }}>
              <QrCode value={props.qrUrl} size={unit * 2.6} />
            </div>
          </div>
        )}
      </div>

      {props.watermark && (
        <p
          style={text(unit * 0.38, {
            position: 'absolute',
            left: layout.margin,
            bottom: layout.margin * 0.4,
            color: brand.secondary,
            opacity: endIn > 0.5 ? 0.7 : 0,
          })}
        >
          Made with AdMitra
        </p>
      )}
    </AbsoluteFill>
  );
}
