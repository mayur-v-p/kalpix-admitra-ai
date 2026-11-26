// Kalpix media worker: claims export jobs from Postgres, renders them, saves the files.
//
//   claim_render_job  -> PROCESSING under a lease (another worker takes over if this one dies)
//   heartbeat         -> progress for the Studio (Realtime) + lease extension
//   complete          -> COMPLETED, reserved credits spent
//   fail              -> back to the queue while attempts remain, else FAILED + credits returned
//
// Run: npm run dev -w apps/media-worker   (reads apps/media-worker/.env)
import { bundle } from '@remotion/bundler';
import { ensureBrowser, openBrowser, type HeadlessBrowser } from '@remotion/renderer';
import { createClient } from '@supabase/supabase-js';
import { realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config';
import { PermanentError, renderJob, type RenderJob } from './render-job';

const log = (msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));

const db = createClient(config.supabaseUrl, config.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let stopping = false;
let current: { id: string } | null = null;

async function claim(): Promise<RenderJob | null> {
  const { data, error } = await db.rpc('claim_render_job', {
    p_worker: config.workerId,
    p_lease_seconds: config.leaseSeconds,
  });
  if (error) throw new Error(`claim failed: ${error.message}`);
  return ((data as RenderJob[] | null) ?? [])[0] ?? null;
}

/** Progress at most every 3 s or 5 %, as architecture.md 4.7 asks. */
function heartbeat(jobId: string) {
  let lastAt = 0;
  let lastValue = -1;
  let owned = true;
  return async (progress: number) => {
    const now = Date.now();
    if (now - lastAt < 3000 && progress - lastValue < 0.05) return owned;
    lastAt = now;
    lastValue = progress;
    const { data, error } = await db.rpc('heartbeat_render_job', {
      p_job: jobId,
      p_worker: config.workerId,
      p_progress: progress,
      p_lease_seconds: config.leaseSeconds,
    });
    if (!error) owned = data !== false;
    return owned;
  };
}

async function runOne(job: RenderJob, serveUrl: string, browser: HeadlessBrowser) {
  const started = Date.now();
  current = { id: job.id };
  log('job.start', { job: job.id, formats: job.formats });
  try {
    const { templateVersion } = await renderJob({
      db,
      job,
      serveUrl,
      browser,
      onProgress: heartbeat(job.id),
    });
    const { error } = await db.rpc('complete_render_job', {
      p_job: job.id,
      p_worker: config.workerId,
      p_template_version: templateVersion,
    });
    if (error) throw new Error(`complete failed: ${error.message}`);
    log('job.completed', { job: job.id, seconds: Math.round((Date.now() - started) / 1000) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const retry = !(e instanceof PermanentError);
    // Owners see this text; keep it free of URLs and internals.
    const shown = e instanceof PermanentError ? message : 'The export failed. Please try again.';
    const { data } = await db.rpc('fail_render_job', {
      p_job: job.id,
      p_worker: config.workerId,
      p_error: shown,
      p_retry: retry,
    });
    log('job.failed', { job: job.id, status: data, error: message.slice(0, 300) });
  } finally {
    current = null;
  }
}

async function main() {
  log('worker.start', { worker: config.workerId, concurrency: config.concurrency });

  if (!config.browserExecutable) {
    await ensureBrowser({ logLevel: 'error' }); // downloads Chrome Headless Shell once
  }
  const here = dirname(fileURLToPath(import.meta.url));
  // Real path: on Windows a lowercase drive letter would otherwise bundle React twice.
  const entryPoint = realpathSync.native(join(here, 'remotion', 'index.ts'));
  log('bundle.start');
  const serveUrl = await bundle({ entryPoint, onProgress: () => undefined });
  log('bundle.ready');

  let browser = await openBrowser('chrome', {
    browserExecutable: config.browserExecutable,
    chromiumOptions: { gl: 'swangle' },
    logLevel: 'error',
  });

  while (!stopping) {
    let job: RenderJob | null = null;
    try {
      job = await claim();
    } catch (e) {
      log('claim.error', { error: e instanceof Error ? e.message : String(e) });
    }
    if (!job) {
      await new Promise((r) => setTimeout(r, config.pollMs));
      continue;
    }
    await runOne(job, serveUrl, browser);
    // A fresh browser after each job keeps memory flat on small machines.
    await browser.close({ silent: true }).catch(() => undefined);
    if (!stopping) {
      browser = await openBrowser('chrome', {
        browserExecutable: config.browserExecutable,
        chromiumOptions: { gl: 'swangle' },
        logLevel: 'error',
      });
    }
  }
  await browser.close({ silent: true }).catch(() => undefined);
  log('worker.stopped');
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (stopping) process.exit(1);
    stopping = true;
    log('worker.stopping', { signal, job: current?.id ?? null });
    if (!current) return; // the loop ends after its current wait
    // Hand the job straight back to the queue (credits stay reserved) and exit.
    void db
      .rpc('fail_render_job', {
        p_job: current.id,
        p_worker: config.workerId,
        p_error: 'The worker restarted; the export will continue shortly.',
        p_retry: true,
      })
      .then(
        () => process.exit(0),
        () => process.exit(0),
      );
  });
}

main().catch((e) => {
  log('worker.crashed', { error: e instanceof Error ? e.message : String(e) });
  process.exit(1);
});
