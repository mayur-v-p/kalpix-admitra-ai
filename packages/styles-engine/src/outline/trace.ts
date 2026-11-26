/**
 * Product outline tracing for Outline Highlight: finds the product in a photo and returns its
 * edge as a smooth closed polygon, so the highlight follows the real product shape.
 *
 * Pure function over RGBA pixels: the browser (canvas) and the media worker (M5) call the same
 * code, so the preview and the exported video trace identical outlines.
 *
 * Steps:
 *   1. Foreground mask: the alpha channel if the image is a cutout, otherwise everything that
 *      is not connected to the border by "background-coloured" pixels (plain backgrounds).
 *   2. Split it into connected parts, fill their holes, keep the significant ones.
 *   3. Follow each part's boundary (Moore-neighbour tracing). The largest part comes first; all
 *      parts together shape the cutout (so a cup's separate steam is kept).
 *   4. Simplify (Ramer–Douglas–Peucker) and smooth (Chaikin), normalised to 0..1.
 * Returns null when no clear product is found, so callers fall back to a rounded frame.
 */

export type Outline = {
  /** The main (largest) part: closed polygon, x and y in 0..1 of the image box. Starts at the leftmost point. */
  points: Array<[number, number]>;
  /** Every significant part, main part first. The photo is shown through all of them. */
  parts: Array<Array<[number, number]>>;
  /** Image width / height. */
  aspect: number;
  /** Share of the image covered by the product (0..1). */
  coverage: number;
};

// Clockwise neighbour order in image coordinates (y grows downwards): W, NW, N, NE, E, SE, S, SW.
const DIRS: Array<[number, number]> = [
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
];
const dirIndex = (dx: number, dy: number) => DIRS.findIndex(([x, y]) => x === dx && y === dy);

function foregroundMask(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const n = w * h;
  const fg = new Uint8Array(n);

  let transparentBorder = 0;
  let borderCount = 0;
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1);
  for (const i of border) {
    borderCount++;
    if (rgba[i * 4 + 3]! < 128) transparentBorder++;
  }

  // A cutout: trust the alpha channel.
  if (transparentBorder / borderCount > 0.5) {
    for (let i = 0; i < n; i++) fg[i] = rgba[i * 4 + 3]! > 128 ? 1 : 0;
    return fg;
  }

  // A photo on a plain background: the most common border colour is the background.
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (const i of border) {
    const r = rgba[i * 4]!;
    const g = rgba[i * 4 + 1]!;
    const b = rgba[i * 4 + 2]!;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const s = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    s.count++;
    s.r += r;
    s.g += g;
    s.b += b;
    buckets.set(key, s);
  }
  let best = { count: 0, r: 0, g: 0, b: 0 };
  for (const s of buckets.values()) if (s.count > best.count) best = s;
  const br = best.r / best.count;
  const bg = best.g / best.count;
  const bb = best.b / best.count;
  const threshold = 42 * 42;
  const isBackground = (i: number) => {
    if (rgba[i * 4 + 3]! < 128) return true;
    const dr = rgba[i * 4]! - br;
    const dg = rgba[i * 4 + 1]! - bg;
    const db = rgba[i * 4 + 2]! - bb;
    return dr * dr + dg * dg + db * db < threshold;
  };

  // Flood fill the background from the border.
  const outside = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (const i of border) {
    if (!outside[i] && isBackground(i)) {
      outside[i] = 1;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++]!;
    const x = i % w;
    const y = (i - x) / w;
    const next = [
      x > 0 ? i - 1 : -1,
      x < w - 1 ? i + 1 : -1,
      y > 0 ? i - w : -1,
      y < h - 1 ? i + w : -1,
    ];
    for (const j of next) {
      if (j >= 0 && !outside[j] && isBackground(j)) {
        outside[j] = 1;
        queue[tail++] = j;
      }
    }
  }
  for (let i = 0; i < n; i++) fg[i] = outside[i] ? 0 : 1;
  return fg;
}

/**
 * Splits the mask into 8-connected parts and returns the significant ones (largest first),
 * each as its own mask with holes filled. Specks smaller than 1.5% of the largest part, or
 * 0.15% of the image, are dropped; thin details such as steam swirls are kept.
 */
function solidParts(
  fg: Uint8Array,
  w: number,
  h: number,
): Array<{ mask: Uint8Array; area: number }> {
  const n = w * h;
  const label = new Int32Array(n);
  const queue = new Int32Array(n);
  const areas: number[] = [0];
  let current = 0;
  for (let s = 0; s < n; s++) {
    if (!fg[s] || label[s]) continue;
    current++;
    let head = 0;
    let tail = 0;
    queue[tail++] = s;
    label[s] = current;
    while (head < tail) {
      const i = queue[head++]!;
      const x = i % w;
      const y = (i - x) / w;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (fg[j] && !label[j]) {
          label[j] = current;
          queue[tail++] = j;
        }
      }
    }
    areas.push(tail);
  }
  const largest = Math.max(0, ...areas);
  const keep = areas
    .map((area, id) => ({ id, area }))
    .filter((p) => p.id > 0 && p.area >= Math.max(largest * 0.015, n * 0.0015))
    .sort((p, q) => q.area - p.area);

  return keep.map(({ id }) => {
    // Fill holes: everything not reachable from the border outside this part belongs to it.
    const outside = new Uint8Array(n);
    let head = 0;
    let tail = 0;
    const push = (i: number) => {
      if (!outside[i] && label[i] !== id) {
        outside[i] = 1;
        queue[tail++] = i;
      }
    };
    for (let x = 0; x < w; x++) {
      push(x);
      push((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      push(y * w);
      push(y * w + w - 1);
    }
    while (head < tail) {
      const i = queue[head++]!;
      const x = i % w;
      const y = (i - x) / w;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (y > 0) push(i - w);
      if (y < h - 1) push(i + w);
    }
    const mask = new Uint8Array(n);
    let area = 0;
    for (let i = 0; i < n; i++) {
      if (!outside[i]) {
        mask[i] = 1;
        area++;
      }
    }
    return { mask, area };
  });
}

/** Moore-neighbour boundary tracing. Returns pixel coordinates in clockwise order. */
function traceBoundary(mask: Uint8Array, w: number, h: number): Array<[number, number]> {
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  let start = -1;
  for (let i = 0; i < w * h; i++) {
    if (mask[i]) {
      start = i;
      break;
    }
  }
  if (start < 0) return [];
  const sx = start % w;
  const sy = (start - sx) / w;
  const contour: Array<[number, number]> = [[sx, sy]];
  let cx = sx;
  let cy = sy;
  let back = 0; // we "entered" the start pixel from the west (scan order guarantees it is empty)
  const limit = w * h * 4;
  for (let step = 0; step < limit; step++) {
    let moved = false;
    for (let k = 0; k < 8; k++) {
      const d = (back + 1 + k) % 8;
      const nx = cx + DIRS[d]![0];
      const ny = cy + DIRS[d]![1];
      if (at(nx, ny)) {
        const prev = DIRS[(d + 7) % 8]!;
        const bx = cx + prev[0];
        const by = cy + prev[1];
        cx = nx;
        cy = ny;
        back = dirIndex(bx - cx, by - cy);
        if (back < 0) back = (d + 4) % 8;
        moved = true;
        break;
      }
    }
    if (!moved) break; // single isolated pixel
    if (cx === sx && cy === sy) break;
    contour.push([cx, cy]);
  }
  return contour;
}

function perpendicularDistance(p: [number, number], a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
}

/** Ramer–Douglas–Peucker simplification of an open polyline. */
export function simplify(
  points: Array<[number, number]>,
  epsilon: number,
): Array<[number, number]> {
  if (points.length < 3) return points;
  let maxDist = 0;
  let index = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i++) {
    const d = perpendicularDistance(points[i]!, points[0]!, points[last]!);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist <= epsilon) return [points[0]!, points[last]!];
  const left = simplify(points.slice(0, index + 1), epsilon);
  const right = simplify(points.slice(index), epsilon);
  return [...left.slice(0, -1), ...right];
}

/** Chaikin corner cutting on a closed polygon: rounds the corners. */
export function chaikin(
  points: Array<[number, number]>,
  iterations: number,
): Array<[number, number]> {
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    pts = out;
  }
  return pts;
}

/** Boundary of one part → simplified, smoothed polygon in pixel coordinates. */
function partPolygon(mask: Uint8Array, w: number, h: number): Array<[number, number]> | null {
  const boundary = traceBoundary(mask, w, h);
  if (boundary.length < 12) return null;
  // Simplify the closed loop as two open halves so the start point is kept.
  const half = Math.floor(boundary.length / 2);
  const epsilon = Math.max(w, h) / 160;
  const simplified = [
    ...simplify(boundary.slice(0, half + 1), epsilon).slice(0, -1),
    ...simplify([...boundary.slice(half), boundary[0]!], epsilon).slice(0, -1),
  ];
  if (simplified.length < 4) return null;
  return chaikin(simplified, 2);
}

export function traceOutline(rgba: Uint8ClampedArray, w: number, h: number): Outline | null {
  if (w < 8 || h < 8 || rgba.length < w * h * 4) return null;
  const parts = solidParts(foregroundMask(rgba, w, h), w, h);
  const coverage = parts.reduce((sum, p) => sum + p.area, 0) / (w * h);
  // Nothing found, or the "product" is the whole photo: no usable outline.
  if (!parts.length || coverage < 0.03 || coverage > 0.92) return null;

  const polygons = parts
    .map((p) => partPolygon(p.mask, w, h))
    .filter((p): p is Array<[number, number]> => p !== null);
  if (!polygons.length) return null;

  // The main (largest) part starts at its leftmost, then lowest, point.
  const main = polygons[0]!;
  let startIdx = 0;
  for (let i = 1; i < main.length; i++) {
    const [x, y] = main[i]!;
    const [bx, by] = main[startIdx]!;
    if (x < bx - 0.5 || (Math.abs(x - bx) <= 0.5 && y > by)) startIdx = i;
  }
  const ordered = [...main.slice(startIdx), ...main.slice(0, startIdx)];
  const norm = (poly: Array<[number, number]>) =>
    poly.map(([x, y]) => [(x + 0.5) / w, (y + 0.5) / h] as [number, number]);
  const points = norm(ordered);
  return { points, parts: [points, ...polygons.slice(1).map(norm)], aspect: w / h, coverage };
}

/** Fits an image of `aspect` inside a box (CSS object-fit: contain). */
export function containRect(
  box: { x: number; y: number; width: number; height: number },
  aspect: number,
) {
  const boxAspect = box.width / box.height;
  const width = aspect > boxAspect ? box.width : box.height * aspect;
  const height = aspect > boxAspect ? box.width / aspect : box.height;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}

/** Smooth closed SVG path through the points (Catmull–Rom converted to cubic Béziers). */
export function smoothClosedPath(points: Array<[number, number]>, move = true): string {
  const n = points.length;
  if (n < 3) return '';
  const p = (i: number) => points[((i % n) + n) % n]!;
  let d = move ? `M ${p(0)[0].toFixed(1)} ${p(0)[1].toFixed(1)}` : '';
  for (let i = 0; i < n; i++) {
    const p0 = p(i - 1);
    const p1 = p(i);
    const p2 = p(i + 1);
    const p3 = p(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0]!.toFixed(1)} ${c1[1]!.toFixed(1)} ${c2[0]!.toFixed(1)} ${c2[1]!.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d} Z`;
}
