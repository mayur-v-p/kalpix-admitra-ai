import { traceOutline, type Outline } from './trace';

/** Trace on a small copy: fast, and plenty for a smooth outline. */
export const TRACE_SIZE = 200;

/**
 * Loads an image (CORS) in a browser and returns its traced outline, or null when no clear
 * product shape is found or the image cannot be read. Used by the Studio preview and by the
 * render worker (inside headless Chromium), so both trace exactly the same way.
 */
export async function traceImageUrl(url: string, size = TRACE_SIZE): Promise<Outline | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // signed storage URLs allow CORS; without it the canvas is unreadable
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const scale = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(8, Math.round(img.naturalWidth * scale));
    const h = Math.max(8, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return traceOutline(ctx.getImageData(0, 0, w, h).data, w, h);
  } catch {
    return null; // unreadable image: the template frames the photo instead
  }
}
