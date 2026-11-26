// Renders one export job: every chosen size as MP4 (video), GIF (WhatsApp/preview) and PNG
// (poster), uploads them to the private renders bucket and records them in creative_assets.
import {
  buildAdProps,
  FORMATS,
  phase,
  STYLES_ENGINE_VERSION,
  type Aspect,
  type FactSnapshot,
} from '@admitra/styles-engine';
import {
  makeCancelSignal,
  renderMedia,
  renderStill,
  selectComposition,
  type HeadlessBrowser,
} from '@remotion/renderer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from './config';

export type JobParams = FactSnapshot & {
  assets: { productImagePath: string | null; logoPath: string | null };
  qrCode: string | null;
  watermark: boolean;
};

export type RenderJob = {
  id: string;
  workspace_id: string;
  campaign_id: string | null;
  formats: Aspect[];
  params: JobParams;
};

/** An error that retrying cannot fix (bad snapshot, missing files). */
export class PermanentError extends Error {}

const COMPOSITION = 'OutlineHighlight';
const GIF_WIDTH = 480; // small enough for WhatsApp, sharp enough on a phone
const GIF_EVERY_NTH_FRAME = 3; // 10 fps
const POSTER_FRAME = phase('offer')[1] - 1; // product, name and offer all on screen

// Share of the work per output, for the progress bar.
const WEIGHT = { mp4: 0.7, gif: 0.22, png: 0.08 } as const;
type Kind = keyof typeof WEIGHT;
const MIME: Record<Kind, string> = { mp4: 'video/mp4', gif: 'image/gif', png: 'image/png' };

async function signed(db: SupabaseClient, bucket: string, path: string | null) {
  if (!path) return null;
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, 2 * 60 * 60);
  if (error || !data) throw new PermanentError(`A file used by the ad is missing (${bucket}).`);
  return data.signedUrl;
}

export async function renderJob(opts: {
  db: SupabaseClient;
  job: RenderJob;
  serveUrl: string;
  browser: HeadlessBrowser;
  /** Called with 0..1. Resolves false when this worker no longer owns the job: stop. */
  onProgress: (progress: number) => Promise<boolean>;
}) {
  const { db, job, serveUrl, browser } = opts;
  const p = job.params;
  if (!p?.campaign || !p.business || !Array.isArray(job.formats) || job.formats.length === 0) {
    throw new PermanentError('The export request is incomplete.');
  }

  const [productImageUrl, logoUrl] = await Promise.all([
    signed(db, 'product-images', p.assets?.productImagePath ?? null),
    signed(db, 'brand-assets', p.assets?.logoPath ?? null),
  ]);
  const qrUrl = p.qrCode ? `${config.qrBaseUrl}?c=${p.qrCode}` : null;

  const { cancelSignal, cancel } = makeCancelSignal();
  let lost = false;
  let done = 0; // finished sizes
  const total = job.formats.length;
  const report = async (part: number) => {
    const ok = await opts.onProgress(Math.min(0.99, (done + part) / total));
    if (!ok && !lost) {
      lost = true;
      cancel();
    }
  };

  const dir = join(config.workDir, job.id);
  await mkdir(dir, { recursive: true });
  try {
    for (const aspect of job.formats) {
      if (!(aspect in FORMATS)) throw new PermanentError(`Unknown size ${aspect}`);
      // THE FACT GATE, again: the worker builds the ad with the same function as the preview.
      const { props, missing } = buildAdProps({
        ...p,
        aspect,
        productImageUrl,
        logoUrl,
        watermark: p.watermark !== false,
        qrUrl,
      });
      if (missing.length > 0) {
        throw new PermanentError(`Facts not confirmed: ${missing.join(', ')}`);
      }
      // Leave the outline unset so the composition traces the product in Chromium.
      const inputProps: Record<string, unknown> = { ...props };
      delete inputProps.productOutline;

      const composition = await selectComposition({
        serveUrl,
        id: COMPOSITION,
        inputProps,
        puppeteerInstance: browser,
        logLevel: 'error',
      });
      const { width, height } = composition;
      const slug = aspect.replace(':', 'x');
      const common = {
        composition,
        serveUrl,
        inputProps,
        puppeteerInstance: browser,
        cancelSignal,
        concurrency: config.concurrency,
        logLevel: 'error' as const,
        licenseKey: config.remotionLicenseKey,
      };

      const outputs: { kind: Kind; file: string; w: number; h: number }[] = [];
      let partDone = 0;

      const mp4 = join(dir, `${slug}.mp4`);
      await renderMedia({
        ...common,
        codec: 'h264',
        crf: 20,
        pixelFormat: 'yuv420p',
        imageFormat: 'jpeg',
        jpegQuality: 92,
        outputLocation: mp4,
        onProgress: ({ progress }) => void report(WEIGHT.mp4 * progress),
      });
      outputs.push({ kind: 'mp4', file: mp4, w: width, h: height });
      partDone += WEIGHT.mp4;

      const gif = join(dir, `${slug}.gif`);
      const gifScale = GIF_WIDTH / width;
      await renderMedia({
        ...common,
        codec: 'gif',
        everyNthFrame: GIF_EVERY_NTH_FRAME,
        numberOfGifLoops: null, // loop forever
        scale: gifScale,
        outputLocation: gif,
        onProgress: ({ progress }) => void report(partDone + WEIGHT.gif * progress),
      });
      outputs.push({
        kind: 'gif',
        file: gif,
        w: Math.round(width * gifScale),
        h: Math.round(height * gifScale),
      });

      const png = join(dir, `${slug}.png`);
      await renderStill({
        composition,
        serveUrl,
        inputProps,
        puppeteerInstance: browser,
        cancelSignal,
        frame: POSTER_FRAME,
        imageFormat: 'png',
        output: png,
        logLevel: 'error',
        licenseKey: config.remotionLicenseKey,
      });
      outputs.push({ kind: 'png', file: png, w: width, h: height });

      for (const o of outputs) {
        const path = `${job.workspace_id}/${job.id}/${slug}.${o.kind}`;
        const body = await readFile(o.file);
        const { error: upErr } = await db.storage
          .from('renders')
          .upload(path, body, { contentType: MIME[o.kind], upsert: true });
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
        const { error: rowErr } = await db.from('creative_assets').upsert(
          {
            workspace_id: job.workspace_id,
            campaign_id: job.campaign_id,
            job_id: job.id,
            format: aspect,
            kind: o.kind,
            path,
            width: o.w,
            height: o.h,
            duration_seconds:
              o.kind === 'png' ? null : composition.durationInFrames / composition.fps,
            bytes: (await stat(o.file)).size,
          },
          { onConflict: 'job_id,format,kind' },
        );
        if (rowErr) throw new Error(`Saving the file record failed: ${rowErr.message}`);
      }
      done += 1;
      await report(0);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  if (lost) throw new Error('lease_lost');
  return { templateVersion: STYLES_ENGINE_VERSION };
}
