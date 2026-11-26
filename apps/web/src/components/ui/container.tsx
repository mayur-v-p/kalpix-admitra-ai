import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Centred page width with side padding that shrinks on phones. */
export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8', className)} {...props} />
  );
}

/** A page section with at least 40px vertical padding on mobile (responsivness.md 2J). */
export function Section({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('py-12 md:py-20', className)} {...props} />;
}
