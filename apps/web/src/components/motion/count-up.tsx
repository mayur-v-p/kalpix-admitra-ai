import { useEffect, useState } from 'react';
import { countValue, prefersReducedMotion, useInView } from '@/lib/motion';

/**
 * Animation 4: a number rolls up from 0 when it scrolls into view. Screen readers get the
 * final number straight away; "reduce motion" shows it without counting.
 */
export function CountUp({
  to,
  duration = 1400,
  format = (n: number) => String(n),
  className,
}: {
  to: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const [reduced] = useState(prefersReducedMotion);
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView || reduced) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const v = countValue(to, now - start, duration);
      setValue(v);
      if (v < to) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduced, to, duration]);

  const shown = reduced ? to : value;
  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(to)}</span>
    </span>
  );
}
