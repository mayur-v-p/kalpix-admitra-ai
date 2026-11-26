// Signature-style templates shared by apps/web (Remotion Player preview) and
// apps/media-worker (render, M5), so the preview and the exported video always match.
export const STYLES_ENGINE_VERSION = '0.3.0';

export { ASPECTS, FORMATS, FPS, type Aspect } from './formats';
export type { AdFacts, BrandStyle, OutlineHighlightProps, OutlineStyle } from './types';
export {
  buildAdProps,
  CTA_LABELS,
  formatPrice,
  formatValidity,
  qrAllowed,
  type AdCta,
  type AdInputs,
  type AdLanguage,
  type FactSnapshot,
  type MissingFact,
} from './facts';
export { QrCode, qrPath } from './qr';
export { OutlineHighlight } from './outline-highlight/OutlineHighlight';
export {
  OUTLINE_HIGHLIGHT_DURATION_FRAMES,
  OUTLINE_HIGHLIGHT_DURATION_SECONDS,
  OUTLINE_HIGHLIGHT_SECONDS,
  phase,
} from './outline-highlight/timeline';
export {
  highlightLayout,
  roundedRectPath,
  type Box,
  type HighlightLayout,
} from './outline-highlight/layout';
export {
  chaikin,
  containRect,
  simplify,
  smoothClosedPath,
  traceOutline,
  type Outline,
} from './outline/trace';
export { TRACE_SIZE, traceImageUrl } from './outline/trace-url';

export const STYLES = [
  { id: 'outline_highlight', name: 'Outline Highlight', available: true },
  { id: 'mascot', name: 'Mascot Presenter', available: false },
  { id: 'ai_scene', name: 'AI Scene', available: false },
] as const;
export type StyleId = (typeof STYLES)[number]['id'];
