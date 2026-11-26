import { cn } from '@/lib/utils';

// A fixed decorative pattern that looks like a QR code. It is not scannable.
const cells = ['1110101', '1010110', '1110011', '0001100', '1101011', '0110101', '1011101'];

export function QrMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 9 9"
      className={cn('shrink-0', className)}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <rect width="9" height="9" fill="#ffffff" />
      {cells.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === '1' ? (
            <rect key={`${x}-${y}`} x={x + 1} y={y + 1} width="1" height="1" fill="#1E1E1C" />
          ) : null,
        ),
      )}
    </svg>
  );
}
