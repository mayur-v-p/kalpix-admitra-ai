// Entrance effects as pure functions of the frame (Remotion renders frame by frame, so CSS
// animations would not match between the preview and the exported video).
import type { CSSProperties } from 'react';
import type { Enter, Rhythm } from './recipe';

export const TIMING: Record<Rhythm, { stagger: number; dur: number; start: number }> = {
  calm: { stagger: 0.3, dur: 0.9, start: 0.3 },
  lively: { stagger: 0.22, dur: 0.62, start: 0.2 },
  punchy: { stagger: 0.15, dur: 0.42, start: 0.12 },
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
/** Overshoots a little then settles (pop, stamp, swing). */
export const backOut = (t: number) => {
  const c = 1.7;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Progress 0..1 of an entrance that starts at `startSec` and lasts `durSec`, at `frame`.
 */
export function progress(frame: number, fps: number, startSec: number, durSec: number): number {
  return clamp01((frame / fps - startSec) / durSec);
}

/** The style for an element entering with `kind` at progress `p` (0 = hidden, 1 = in place). */
export function enterStyle(kind: Enter, p: number): CSSProperties {
  const e = easeOut(p);
  const b = backOut(p);
  const hidden = p <= 0;
  switch (kind) {
    case 'rise':
      return { opacity: e, transform: `translateY(${lerp(8, 0, e)}%)` };
    case 'pop':
      return { opacity: clamp01(p * 3), transform: `scale(${hidden ? 0.3 : lerp(0.3, 1, b)})` };
    case 'unmask':
      return {
        clipPath: `inset(${lerp(100, 0, e)}% 0 0 0)`,
        transform: `translateY(${lerp(20, 0, e)}%)`,
      };
    case 'wipe':
      return { clipPath: `inset(0 ${lerp(100, 0, e)}% 0 0)` };
    case 'iris':
      return { clipPath: `circle(${lerp(0, 75, e)}% at 50% 50%)` };
    case 'tilt':
      return {
        opacity: e,
        transform: `perspective(1400px) rotateY(${lerp(55, 0, e)}deg) translateX(${lerp(6, 0, e)}%)`,
      };
    case 'stamp':
      return {
        opacity: clamp01(p * 4),
        transform: `scale(${lerp(2.2, 1, b)}) rotate(${lerp(-30, 0, b)}deg)`,
      };
    case 'swing':
      return {
        opacity: clamp01(p * 3),
        transform: `rotate(${lerp(-40, 0, b)}deg)`,
        transformOrigin: 'top center',
      };
    case 'flicker': {
      const steps = [0, 1, 0.15, 1, 0.35, 1];
      const o = p >= 1 ? 1 : steps[Math.min(steps.length - 1, Math.floor(p * steps.length))]!;
      return { opacity: o };
    }
    case 'slide_left':
      return { opacity: e, transform: `translateX(${lerp(-60, 0, e)}%)` };
    case 'slide_right':
      return { opacity: e, transform: `translateX(${lerp(60, 0, e)}%)` };
    case 'blur':
      return { opacity: e, filter: `blur(${lerp(16, 0, e)}px)` };
    case 'drop':
      return {
        opacity: clamp01(p * 3),
        transform: `translateY(${lerp(-40, 0, b)}%) rotate(${lerp(-6, 0, e)}deg)`,
      };
    case 'zoom':
      return {
        opacity: e,
        transform: `scale(${lerp(1.5, 1, e)})`,
        filter: `blur(${lerp(10, 0, e)}px)`,
      };
  }
}

/** A value that breathes between 0 and 1 with period `sec` seconds. */
export const wave = (frame: number, fps: number, sec: number, phase = 0) =>
  0.5 + 0.5 * Math.sin((frame / fps / sec) * Math.PI * 2 + phase);
