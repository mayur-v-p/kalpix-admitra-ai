import { useEffect, useRef, useState } from 'react';

/** True when the person has asked their device for less motion. */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The value shown after `elapsed` ms of a count to `to` (ease-out), for the count-up animation. */
export function countValue(to: number, elapsed: number, duration: number) {
  const p = Math.min(1, Math.max(0, elapsed / duration));
  return Math.round(to * (1 - Math.pow(1 - p, 3)));
}

/** Becomes true once, when the element first scrolls into view (at once without IntersectionObserver). */
export function useInView<T extends Element>(rootMargin = '0px 0px -10% 0px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, rootMargin]);
  return { ref, inView };
}
