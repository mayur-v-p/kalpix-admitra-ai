import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/** The dark modules of a QR code as one SVG path in module units, plus the module count. */
export function qrPath(value: string): { d: string; size: number } {
  const qr = qrcode(0, 'M'); // type 0 = smallest version that fits; M = ~15% damage tolerance
  qr.addData(value);
  qr.make();
  const size = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    }
  }
  return { d, size };
}

/** A crisp, scannable QR code (vector, with the 4-module quiet zone scanners need). */
export function QrCode({ value, size }: { value: string; size: number }) {
  const { d, size: n } = useMemo(() => qrPath(value), [value]);
  const quiet = 4;
  const total = n + quiet * 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-quiet} ${-quiet} ${total} ${total}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR code"
    >
      <rect x={-quiet} y={-quiet} width={total} height={total} fill="#ffffff" />
      <path d={d} fill="#000000" />
    </svg>
  );
}
