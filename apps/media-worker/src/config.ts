// Worker settings, from environment variables only. The secret key never leaves the server:
// this process runs on a private machine/container, never in a browser.
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';

function required(name: string): string {
  const v = process.env[name];
  if (!v)
    throw new Error(`Missing environment variable ${name} (see apps/media-worker/.env.example)`);
  return v;
}

const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

const supabaseUrl = required('SUPABASE_URL').replace(/\/$/, '');

export const config = {
  supabaseUrl,
  /** Service-role / secret key: the worker writes job status, files and credits. */
  secretKey: required('SUPABASE_SECRET_KEY'),
  /** Public link encoded in QR codes (a phone must reach it). */
  qrBaseUrl: (process.env.QR_BASE_URL ?? `${supabaseUrl}/functions/v1/qr-redirect`).replace(
    /\/$/,
    '',
  ),
  workerId: process.env.WORKER_ID ?? `${hostname()}-${process.pid}`,
  pollMs: num('POLL_INTERVAL_MS', 3000),
  leaseSeconds: num('LEASE_SECONDS', 900),
  /** Frames rendered in parallel. 1 fits a small machine; raise it on a 4 GB+ container. */
  concurrency: num('RENDER_CONCURRENCY', 1),
  workDir: process.env.WORK_DIR ?? join(tmpdir(), 'admitra-renders'),
  browserExecutable: process.env.BROWSER_EXECUTABLE || null,
  /** Remotion license key, if the company needs one (remotion.dev/license). */
  remotionLicenseKey: process.env.REMOTION_LICENSE_KEY || null,
};
