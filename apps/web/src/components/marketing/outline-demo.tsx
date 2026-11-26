import { useId } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  offer?: string;
  productName?: string;
  className?: string;
  /** Outline colour, e.g. the brand accent. */
  outlineColor?: string;
};

/**
 * A CSS/SVG stand-in for the Outline Highlight style, used on the marketing site.
 * The real style is the Remotion template in @admitra/styles-engine. Timing lives in
 * index.css (.hl-demo). Decorative only: the parent gives the accessible description.
 */
export function OutlineDemo({
  offer = '20% OFF',
  productName = 'Masala Chai',
  className,
  outlineColor = '#F2C94C',
}: Props) {
  const id = useId().replace(/:/g, '');
  const chai = `chai-${id}`;
  const glass = `glass-${id}`;
  const glow = `glow-${id}`;

  // Tapered "cutting chai" glass, and the same shape a little larger for the highlight.
  const outline = 'M62 70 L138 70 L126 176 Q100 184 74 176 Z';
  const highlight = 'M55 63 L145 63 L132 182 Q100 192 68 182 Z';

  return (
    <svg
      viewBox="0 0 200 260"
      className={cn('hl-demo block h-full w-full', className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={chai} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E9B872" />
          <stop offset="1" stopColor="#A8743F" />
        </linearGradient>
        <linearGradient id={glass} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.45" />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.45" r="0.55">
          <stop offset="0" stopColor="#FBF0C9" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FBF0C9" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="100" cy="118" r="92" fill={`url(#${glow})`} />

      <g
        className="hl-steam"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      >
        <path d="M86 56 q-6 -10 0 -20 q6 -10 0 -20" />
        <path d="M104 58 q-6 -10 0 -20 q6 -10 0 -20" />
        <path d="M120 56 q-6 -10 0 -20 q6 -10 0 -20" />
      </g>

      {/* The product */}
      <g className="hl-product">
        <path
          d={outline}
          fill={`url(#${glass})`}
          stroke="#ffffff"
          strokeOpacity="0.7"
          strokeWidth="1.5"
        />
        <path d="M66 96 L134 96 L126 176 Q100 184 74 176 Z" fill={`url(#${chai})`} />
        <path d="M66 96 L134 96" stroke="#F6E2BD" strokeWidth="4" strokeLinecap="round" />
        <g stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2">
          <path d="M80 74 L84 174" />
          <path d="M96 74 L97 178" />
          <path d="M112 74 L111 178" />
          <path d="M126 74 L120 174" />
        </g>
      </g>

      {/* Outline around the product */}
      <path
        className="hl-draw hl-product-outline"
        d={highlight}
        pathLength={1}
        fill="none"
        stroke={outlineColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Product name with its outline */}
      <text
        x="100"
        y="208"
        textAnchor="middle"
        fontFamily="Jost, sans-serif"
        fontWeight="500"
        fontSize="12"
        letterSpacing="1.5"
        fill="#1E1E1C"
      >
        {productName.toUpperCase()}
      </text>
      <rect
        className="hl-draw hl-name-outline"
        x="46"
        y="194"
        width="108"
        height="20"
        rx="10"
        pathLength={1}
        fill="none"
        stroke={outlineColor}
        strokeWidth="2.5"
      />

      {/* Offer */}
      <text
        className="hl-offer"
        x="100"
        y="246"
        textAnchor="middle"
        fontFamily="Jost, sans-serif"
        fontWeight="600"
        fontSize="28"
        letterSpacing="1.5"
        fill="#1E1E1C"
      >
        {offer}
      </text>
    </svg>
  );
}
