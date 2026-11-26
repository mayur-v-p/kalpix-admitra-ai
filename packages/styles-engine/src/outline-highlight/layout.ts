import { FORMATS, type Aspect } from '../formats';

export type Box = { x: number; y: number; width: number; height: number };

export type HighlightLayout = {
  width: number;
  height: number;
  /** Safe margin kept clear of edges (platform UI overlays). */
  margin: number;
  /** Brand name + headline. */
  header: Box;
  /** The product. */
  product: Box;
  /** Product name, offer, price and dates. */
  details: Box;
  /** Base font size; everything else scales from it. */
  unit: number;
};

/**
 * Places the parts of an Outline Highlight ad for each format. Portrait and square formats
 * stack header, product and details; 16:9 puts the product left and the text right.
 * Pure, so it is unit-tested.
 */
export function highlightLayout(aspect: Aspect): HighlightLayout {
  const { width, height } = FORMATS[aspect];
  const unit = Math.min(width, height) / 20; // 54px at 1080
  const margin = Math.round(Math.min(width, height) * 0.07);

  if (aspect === '16:9') {
    const productW = width * 0.4;
    const productH = height - margin * 2 - unit * 1.5;
    const textX = width * 0.52;
    const textW = width * 0.48 - margin * 1.5;
    return {
      width,
      height,
      margin,
      unit,
      product: { x: margin * 1.5, y: (height - productH) / 2, width: productW, height: productH },
      header: { x: textX, y: margin * 1.2, width: textW, height: height * 0.34 },
      details: { x: textX, y: height * 0.46, width: textW, height: height * 0.42 },
    };
  }

  const headerH = height * (aspect === '9:16' ? 0.19 : 0.2);
  const detailsH = height * (aspect === '9:16' ? 0.24 : 0.27);
  const productTop = margin + headerH;
  const productH = height - productTop - detailsH - margin;
  const productW = Math.min(width - margin * 2, productH * (aspect === '9:16' ? 0.9 : 1.1));

  return {
    width,
    height,
    margin,
    unit,
    header: { x: margin, y: margin, width: width - margin * 2, height: headerH },
    product: { x: (width - productW) / 2, y: productTop, width: productW, height: productH },
    details: {
      x: margin,
      y: height - margin - detailsH,
      width: width - margin * 2,
      height: detailsH,
    },
  };
}

/** Rounded rectangle path, used when the product's own shape cannot be traced. */
export function roundedRectPath(box: Box, radius: number): string {
  const r = Math.min(radius, box.width / 2, box.height / 2);
  const { x, y, width: w, height: h } = box;
  return [
    `M ${x + r} ${y}`,
    `L ${x + w - r} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `L ${x + w} ${y + h - r}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `L ${x + r} ${y + h}`,
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    'Z',
  ].join(' ');
}
