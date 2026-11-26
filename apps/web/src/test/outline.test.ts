import { containRect, smoothClosedPath, traceOutline } from '@admitra/styles-engine';
import { describe, expect, it } from 'vitest';

/** Builds RGBA pixels: background colour everywhere, `inside(x, y)` painted with `fg`. */
function image(
  w: number,
  h: number,
  inside: (x: number, y: number) => boolean,
  fg: [number, number, number, number],
  bg: [number, number, number, number],
) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = inside(x, y) ? fg : bg;
      data.set(c, (y * w + x) * 4);
    }
  }
  return data;
}

// A tapered "cutting chai" glass: wide at the top (y=40), narrow at the bottom (y=170).
const glass = (x: number, y: number) => {
  if (y < 40 || y > 170) return false;
  const t = (y - 40) / 130;
  const half = 60 - t * 25;
  return Math.abs(x - 100) <= half;
};

function bounds(points: Array<[number, number]>) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

describe('traceOutline: the highlight follows the real product shape', () => {
  it('traces a product on a plain white background', () => {
    const o = traceOutline(
      image(200, 200, glass, [180, 120, 60, 255], [255, 255, 255, 255]),
      200,
      200,
    );
    expect(o).not.toBeNull();
    const b = bounds(o!.points);
    // the outline hugs the glass (40..160 wide at the top, 170 at the bottom), not the photo edges
    expect(b.minX).toBeGreaterThan(0.18);
    expect(b.maxX).toBeLessThan(0.82);
    expect(b.minY).toBeGreaterThan(0.17);
    expect(b.maxY).toBeLessThan(0.88);
    // tapered: narrower near the bottom than near the top
    const near = (y: number) => o!.points.filter((p) => Math.abs(p[1] - y) < 0.04);
    const width = (y: number) => {
      const xs = near(y).map((p) => p[0]);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(width(0.8)).toBeLessThan(width(0.25));
    expect(o!.coverage).toBeGreaterThan(0.2);
    expect(o!.coverage).toBeLessThan(0.4);
  });

  it('traces a transparent cutout from its alpha channel', () => {
    const o = traceOutline(image(160, 200, glass, [50, 50, 50, 255], [0, 0, 0, 0]), 160, 200);
    expect(o).not.toBeNull();
    expect(o!.aspect).toBeCloseTo(0.8);
  });

  it('starts the main outline at its leftmost point', () => {
    const o = traceOutline(
      image(200, 200, glass, [180, 120, 60, 255], [255, 255, 255, 255]),
      200,
      200,
    )!;
    const minX = Math.min(...o.points.map((p) => p[0]));
    expect(o.points[0]![0]).toBeCloseTo(minX, 2);
  });

  it('keeps a product that touches the photo colour of the background in places (holes filled)', () => {
    // A ring: hole in the middle must not create an inner outline
    const ring = (x: number, y: number) => {
      const d = Math.hypot(x - 100, y - 100);
      return d < 70 && d > 30;
    };
    const o = traceOutline(
      image(200, 200, ring, [20, 90, 160, 255], [250, 250, 250, 255]),
      200,
      200,
    )!;
    const b = bounds(o.points);
    expect(b.maxX - b.minX).toBeGreaterThan(0.6); // the OUTER edge, not the hole
  });

  it('gives up (null) when there is no clear product: empty photo or a photo filled edge to edge', () => {
    expect(
      traceOutline(
        image(100, 100, () => false, [0, 0, 0, 255], [255, 255, 255, 255]),
        100,
        100,
      ),
    ).toBeNull();
    // a busy photo: noise everywhere, no plain background
    const noisy = new Uint8ClampedArray(100 * 100 * 4);
    for (let i = 0; i < noisy.length; i += 4) {
      noisy[i] = (i * 37) % 255;
      noisy[i + 1] = (i * 91) % 255;
      noisy[i + 2] = (i * 53) % 255;
      noisy[i + 3] = 255;
    }
    expect(traceOutline(noisy, 100, 100)).toBeNull();
  });

  it('keeps separate parts like steam above a cup, with the cup as the main part', () => {
    const steam = (x: number, y: number) =>
      y >= 8 && y <= 32 && Math.abs(x - 100 - Math.sin(y / 4) * 10) <= 5;
    const cupWithSteam = (x: number, y: number) => glass(x, y) || steam(x, y);
    const o = traceOutline(
      image(200, 200, cupWithSteam, [60, 40, 20, 255], [255, 255, 255, 255]),
      200,
      200,
    )!;
    expect(o.parts.length).toBe(2);
    expect(o.parts[0]).toBe(o.points); // main part first
    expect(bounds(o.points).minY).toBeGreaterThan(0.17); // the main part is the cup, not the steam
    expect(bounds(o.parts[1]!).maxY).toBeLessThan(0.2); // the steam part sits above it
  });

  it('fits the outline into the layout and builds a smooth closed path', () => {
    const r = containRect({ x: 0, y: 0, width: 400, height: 400 }, 0.5);
    expect(r).toEqual({ x: 100, y: 0, width: 200, height: 400 });
    const d = smoothClosedPath([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]);
    expect(d.startsWith('M 0.0 0.0 C')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });
});
