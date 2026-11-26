import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/** Kalpix wordmark: a single highlight stroke inside the mark. */
export function Logo({
  className,
  tone = 'dark',
}: {
  className?: string;
  tone?: 'dark' | 'light';
}) {
  return (
    <Link
      to="/"
      aria-label="Kalpix home"
      className={cn('inline-flex min-h-11 items-center gap-2.5', className)}
    >
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden="true">
        <rect
          width="32"
          height="32"
          rx="8"
          className={tone === 'dark' ? 'fill-indigo-deep' : 'fill-paper'}
        />
        <path
          d="M7 22c3-9 6-13 9-13s4 5 2 8-6 3-6 0 5-6 10-5"
          fill="none"
          stroke="var(--color-lamp)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
      <span
        className={cn(
          'font-display text-lg tracking-[0.2em] uppercase',
          tone === 'dark' ? 'text-ink' : 'text-paper',
        )}
      >
        Kalpix
      </span>
    </Link>
  );
}
