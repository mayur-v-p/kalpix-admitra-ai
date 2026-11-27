import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ThinBold } from './thin-bold';

type Props = {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: 'left' | 'center';
  as?: 'h1' | 'h2';
  className?: string;
};

/** Blue-line eyebrow + a thin/bold Inter Tight heading (v3 design). */
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
    <div className={cn('max-w-3xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow && (
        <p className={cn('kx-eyebrow mb-4 text-indigo', align === 'center' && 'justify-center')}>
          {eyebrow}
        </p>
      )}
      <Heading
        className={cn(
          'tracking-[-0.035em]',
          as === 'h1'
            ? 'text-[clamp(42px,5.4vw,72px)] leading-[1.04]'
            : 'text-[clamp(30px,3.6vw,44px)]',
        )}
      >
        <ThinBold text={title} accentLast />
      </Heading>
      {intro && <p className="mt-4 text-base text-muted md:text-lg">{intro}</p>}
    </div>
  );
}
