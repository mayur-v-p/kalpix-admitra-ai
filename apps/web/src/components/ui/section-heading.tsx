import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: 'left' | 'center';
  as?: 'h1' | 'h2';
  className?: string;
};

/** Thin uppercase eyebrow + light display heading, in the billboard style. */
export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = 'left',
  as = 'h2',
  className,
}: Props) {
  const Heading = as;
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow && (
        <p className="mb-3 text-sm font-medium tracking-[0.25em] text-sage-deep uppercase">
          {eyebrow}
        </p>
      )}
      <Heading className="uppercase">{title}</Heading>
      {intro && <p className="mt-4 text-base text-muted md:text-lg">{intro}</p>}
    </div>
  );
}
