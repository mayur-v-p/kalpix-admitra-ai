import type { ElementType, ReactNode } from 'react';
import { useInView } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Animation 2: the content fades up once it scrolls into view. `delay` (ms) staggers
 * neighbours. Content is in the page from the start (only its opacity changes), so it stays
 * readable for screen readers; "reduce motion" shows it at once (index.css).
 */
export function Reveal({
  as: Tag = 'div',
  delay = 0,
  className,
  children,
}: {
  as?: ElementType;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref}
      data-visible={inView ? 'true' : 'false'}
      className={cn('reveal', className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
