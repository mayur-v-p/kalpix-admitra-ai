import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-line bg-card px-3 py-1 text-sm text-muted',
        className,
      )}
      {...props}
    />
  );
}
