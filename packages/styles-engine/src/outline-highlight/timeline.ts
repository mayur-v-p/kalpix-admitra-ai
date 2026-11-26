import { FPS } from '../formats';

/**
 * Outline Highlight timeline, in seconds. 15 s at 30 fps = 450 frames.
 * Everything appears THROUGH its outline: names are drawn stroke by stroke and then fill in;
 * the product is drawn by its outline, then sketched, then coloured in.
 *   0.2–2     brand name drawn letter by letter, then filled
 *   1.8–4.2   product outline drawn on the product's own edge
 *   3.6–5.4   sketch lines of the product's details appear, top to bottom
 *   4.8–6.6   colour fills the product from the bottom up
 *   6.2–8.2   product name drawn letter by letter, then filled
 *   8.5–12    offer pops in, with price and dates (confirmed facts only)
 *   13–15     closing card
 */
export const OUTLINE_HIGHLIGHT_SECONDS = {
  brandDraw: [0.2, 2],
  productOutline: [1.8, 4.2],
  sketch: [3.6, 5.4],
  fill: [4.8, 6.6],
  nameDraw: [6.2, 8.2],
  offer: [8.5, 12],
  endCard: [13, 15],
} as const;

export const OUTLINE_HIGHLIGHT_DURATION_SECONDS = 15;
export const OUTLINE_HIGHLIGHT_DURATION_FRAMES = OUTLINE_HIGHLIGHT_DURATION_SECONDS * FPS;

export const sec = (s: number) => Math.round(s * FPS);

/** Frame range [start, end] for a phase. */
export function phase(name: keyof typeof OUTLINE_HIGHLIGHT_SECONDS): [number, number] {
  const [a, b] = OUTLINE_HIGHLIGHT_SECONDS[name];
  return [sec(a), sec(b)];
}
