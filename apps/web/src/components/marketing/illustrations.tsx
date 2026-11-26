/**
 * Small hand-drawn style illustrations (warm fills, soft glow, uneven ink lines),
 * in the illustration direction of sample image 2. Original artwork; decorative only.
 */
const ink = '#1E1E1C';
const line = {
  stroke: ink,
  strokeWidth: 2.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function Glow({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return <circle cx={cx} cy={cy} r={r} fill="#FBF0C9" opacity="0.9" />;
}

/** Step 1: snap your product on a phone. */
export function UploadIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden="true">
      <Glow cx={80} cy={62} r={52} />
      {/* table */}
      <path d="M14 100 C50 97 110 98 148 100" {...line} fill="none" />
      <path d="M20 100 L22 112 M140 100 L138 112" {...line} />
      {/* phone */}
      <path
        d="M58 22 C58 18 61 16 65 16 L95 16.5 C99 16.5 101 19 101 23 L100.5 92 C100.5 96 98 98 94 98 L65 97.5 C61 97.5 58.5 95 58.5 91 Z"
        fill="#8F8FD8"
        {...line}
      />
      <rect x="63" y="25" width="33" height="52" rx="3" fill="#F6F4EF" />
      {/* product photo on screen: a jar */}
      <path
        d="M71 48 C71 44 73 43 76 43 L84 43 C87 43 89 44 89 48 L88.5 68 C88.5 70 87 71 85 71 L75 71 C73 71 71.5 70 71.5 68 Z"
        fill="#E9B872"
        {...line}
        strokeWidth={2}
      />
      <path d="M73 38 L87 38 L86.5 43 L73.5 43 Z" fill="#7C8C6E" {...line} strokeWidth={2} />
      <circle cx="79.5" cy="87.5" r="3" fill="#F6F4EF" />
      {/* upload arrow */}
      <path
        d="M122 70 C121 58 121 46 122 36 M114 44 L122 35 L130 44"
        {...line}
        fill="none"
        stroke="#4F5E44"
      />
      <path d="M30 58 c4 -3 8 -3 12 0" {...line} fill="none" stroke="#D9A925" />
      <path d="M28 46 c3 -2 6 -2 9 0" {...line} fill="none" stroke="#D9A925" />
    </svg>
  );
}

/** Step 2: choose a signature style (a product with an outline highlight drawn around it). */
export function StyleIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden="true">
      <Glow cx={80} cy={60} r={52} />
      <path d="M14 100 C50 97 110 98 148 100" {...line} fill="none" />
      {/* product: a jar */}
      <path
        d="M66 50 C66 45 69 43 74 43 L86 43 C91 43 94 45 94 50 L93 88 C93 92 90 94 86 94 L74 94 C70 94 67 92 67 88 Z"
        fill="#E9B872"
        {...line}
      />
      <path d="M68 34 L92 34 L91 43 L69 43 Z" fill="#7C8C6E" {...line} strokeWidth={2} />
      {/* the outline highlight around it */}
      <path
        d="M58 40 C58 31 62 27 70 27 L90 27 C98 27 102 31 102 40 L101 92 C101 99 97 102 90 102 L70 102 C63 102 59 99 59 92 Z"
        fill="none"
        stroke="#D9A925"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* name label with its outline */}
      <rect
        x="54"
        y="106"
        width="52"
        height="10"
        rx="5"
        fill="#F6F4EF"
        stroke="#D9A925"
        strokeWidth="2.5"
      />
      <path
        d="M130 18 L132.5 25 L140 25.5 L134 30 L136 37 L130 33 L124 37 L126 30 L120 25.5 L127.5 25 Z"
        fill="#F2C94C"
        {...line}
        strokeWidth={2}
      />
      <path d="M30 40 l4 4 m0 -4 l-4 4" {...line} stroke="#7C8C6E" />
      <path d="M128 72 l4 4 m0 -4 l-4 4" {...line} stroke="#7C8C6E" />
    </svg>
  );
}

/** Step 3: share everywhere (a shop front with a message bubble). */
export function ShareIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden="true">
      <Glow cx={80} cy={60} r={52} />
      <path d="M14 100 C50 97 110 98 148 100" {...line} fill="none" />
      {/* shop */}
      <path d="M36 100 L37 56 L103 55 L104 100" fill="#F6F4EF" {...line} />
      <path d="M32 56 L40 40 L100 39.5 L108 55.5 Z" fill="#C76B5A" {...line} />
      <path d="M52 40 L48 56 M68 40 L66 56 M84 40 L84 56" {...line} />
      <path d="M46 100 L46.5 72 L64 72 L64 100" fill="#A8743F" {...line} />
      <rect
        x="74"
        y="68"
        width="22"
        height="16"
        rx="2"
        fill="#E3E8DC"
        stroke={ink}
        strokeWidth="2.5"
      />
      {/* message bubble with play button */}
      <path
        d="M112 20 C112 15 115 13 120 13 L146 13 C150 13 152 15.5 152 20 L152 40 C152 44 150 46 146 46 L128 46 L118 55 L120 46 C115 46 112 44 112 40 Z"
        fill="#7C8C6E"
        {...line}
      />
      <path d="M128 22 L140 29.5 L128 37 Z" fill="#F6F4EF" />
    </svg>
  );
}
