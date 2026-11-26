import { ASPECTS, FORMATS, type Aspect } from '@admitra/styles-engine';
import { useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';
import { useSignedUrl } from '@/features/workspace/hooks';
import { cn } from '@/lib/utils';
import {
  createRenderJob,
  CREDITS_PER_SIZE,
  downloadUrl,
  ExportError,
  isActive,
  type CreativeAsset,
  type ExportErrorCode,
  type RenderJob,
} from './api';
import { trialLimitText } from '@/lib/trial';
import { creditsKey, jobsKey, useCampaignJobs, useCredits, useJobAssets } from './hooks';

const errorText: Record<ExportErrorCode, string> = {
  facts_not_confirmed: 'Confirm the details listed under the preview first, then export.',
  insufficient_credits: 'You do not have enough credits for these sizes. Choose fewer sizes.',
  export_in_progress: 'This campaign is already being exported. It will be ready shortly.',
  rate_limited: 'You have exported a lot this hour. Please try again a little later.',
  invalid_formats: 'Choose at least one size.',
  clip_not_approved: 'Approve the AI scene first (or choose "No scene"), then export.',
  trial_limit: 'This is beyond the free try. Save your work to export more.',
  export_failed: 'Could not start the export. Please try again.',
};

const KIND_LABEL = { mp4: 'Video (MP4)', gif: 'GIF', png: 'Poster (PNG)' } as const;

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'ad';

export function ExportPanel({
  campaignId,
  campaignName,
  workspaceId,
  blocked,
  notice,
  trial = false,
}: {
  campaignId: string;
  campaignName: string;
  workspaceId: string;
  /** Unconfirmed facts remain: the database would refuse the export. */
  blocked: boolean;
  /** Another reason the export would be refused (e.g. an unapproved AI scene). */
  notice?: string | null;
  /** Free try: 9:16 only, low resolution (the database enforces it). */
  trial?: boolean;
}) {
  const queryClient = useQueryClient();
  const credits = useCredits(workspaceId);
  const jobs = useCampaignJobs(campaignId);
  const offered: readonly Aspect[] = trial ? ['9:16'] : ASPECTS;
  const [sizes, setSizes] = useState<Aspect[]>([...offered]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = jobs.data?.[0] ?? null;
  const running = isActive(latest);
  const cost = sizes.length * CREDITS_PER_SIZE;
  const available = credits.data?.available ?? 0;

  // When an export finishes or fails, the balance changed (spent or returned).
  const latestStatus = latest?.status;
  useEffect(() => {
    if (latestStatus === 'COMPLETED' || latestStatus === 'FAILED') {
      void queryClient.invalidateQueries({ queryKey: creditsKey(workspaceId) });
    }
  }, [latestStatus, queryClient, workspaceId]);

  const toggle = (a: Aspect) =>
    setSizes((s) =>
      s.includes(a) ? s.filter((x) => x !== a) : ASPECTS.filter((x) => x === a || s.includes(x)),
    );

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await createRenderJob(campaignId, sizes);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: jobsKey(campaignId) }),
        queryClient.invalidateQueries({ queryKey: creditsKey(workspaceId) }),
      ]);
    } catch (e) {
      setError(trialLimitText(e) ?? errorText[e instanceof ExportError ? e.code : 'export_failed']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id="export"
      aria-labelledby="export-heading"
      className="scroll-mt-24 rounded-2xl border border-line bg-card p-5 shadow-soft"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="export-heading"
          className="font-sans text-lg font-medium tracking-normal normal-case"
        >
          Export
        </h2>
        <p className="text-sm text-muted" aria-live="polite">
          {credits.isLoading ? 'Credits…' : `${available} credit${available === 1 ? '' : 's'} left`}
        </p>
      </div>
      <p className="mt-1 text-sm text-muted">
        Each size gives a video (MP4), a GIF and a poster (PNG). {CREDITS_PER_SIZE} credit per size;
        if an export fails, the credits come back automatically.
      </p>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Sizes</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {offered.map((a) => (
            <label
              key={a}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3',
                sizes.includes(a) ? 'border-ink bg-lamp-soft' : 'border-line',
              )}
            >
              <input
                type="checkbox"
                className="h-5 w-5 accent-ink"
                checked={sizes.includes(a)}
                onChange={() => toggle(a)}
                disabled={running || busy}
              />
              <span>
                {a} <span className="text-sm text-muted">{FORMATS[a].label}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {blocked && (
        <div className="mt-3">
          <FormMessage tone="info">{errorText.facts_not_confirmed}</FormMessage>
        </div>
      )}
      {notice && (
        <div className="mt-3">
          <FormMessage tone="info">{notice}</FormMessage>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      )}
      <Button
        variant="dark"
        className="mt-4 w-full"
        onClick={start}
        disabled={
          blocked || Boolean(notice) || busy || running || sizes.length === 0 || cost > available
        }
      >
        <Download className="h-5 w-5" aria-hidden="true" />
        {busy
          ? 'Starting…'
          : `Export ${sizes.length} size${sizes.length === 1 ? '' : 's'} · ${cost} credit${cost === 1 ? '' : 's'}`}
      </Button>
      {!credits.isLoading && cost > available && !running && (
        <p className="mt-2 text-sm text-muted">Not enough credits for {cost} sizes.</p>
      )}

      {latest && <JobStatus job={latest} campaignName={campaignName} />}
    </section>
  );
}

function JobStatus({ job, campaignName }: { job: RenderJob; campaignName: string }) {
  const done = job.status === 'COMPLETED';
  const assets = useJobAssets(job.id, done);

  if (isActive(job)) {
    const pct = Math.round(job.progress * 100);
    return (
      <div className="mt-5" aria-live="polite">
        <p className="text-sm font-medium">
          {job.status === 'PROCESSING'
            ? `Rendering ${job.formats.join(', ')}…`
            : 'Waiting for the renderer…'}
        </p>
        <div
          className="mt-2 h-3 overflow-hidden rounded-full bg-paper-deep"
          role="progressbar"
          aria-label="Export progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div
            className="h-full rounded-full bg-lamp transition-all"
            style={{ width: `${Math.max(3, pct)}%` }}
          />
        </div>
        <p className="mt-1 text-sm text-muted">
          {pct}% · you can leave this page; the files will be here when they are ready.
        </p>
      </div>
    );
  }

  if (job.status === 'FAILED' || job.status === 'CANCELLED') {
    return (
      <div className="mt-5">
        <FormMessage tone="error">
          {job.error ?? 'The export failed.'} Your {job.cost} credit
          {job.cost === 1 ? ' was' : 's were'} returned.
        </FormMessage>
      </div>
    );
  }

  if (!done) return null;
  const byFormat = new Map<string, CreativeAsset[]>();
  for (const a of assets.data ?? []) byFormat.set(a.format, [...(byFormat.get(a.format) ?? []), a]);

  return (
    <div className="mt-5">
      <FormMessage tone="success">Your ad is ready to download.</FormMessage>
      <ul className="mt-3 flex flex-col gap-3">
        {job.formats.map((f) => (
          <li key={f} className="flex gap-3 rounded-xl border border-line p-3">
            <Poster asset={byFormat.get(f)?.find((a) => a.kind === 'png')} label={f} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {f} <span className="text-sm text-muted">{FORMATS[f as Aspect]?.label}</span>
              </p>
              <div className="mt-1 flex flex-wrap gap-x-3">
                {(byFormat.get(f) ?? [])
                  .sort(
                    (a, b) =>
                      ['mp4', 'gif', 'png'].indexOf(a.kind) - ['mp4', 'gif', 'png'].indexOf(b.kind),
                  )
                  .map((a) => (
                    <DownloadLink
                      key={a.id}
                      asset={a}
                      fileName={`${slug(campaignName)}-${f.replace(':', 'x')}.${a.kind}`}
                    />
                  ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Poster({ asset, label }: { asset: CreativeAsset | undefined; label: string }) {
  const url = useSignedUrl(asset?.path, 'renders');
  return (
    <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-paper-deep">
      {url.data && (
        <img src={url.data} alt={`Poster, ${label}`} className="h-full w-full object-contain" />
      )}
    </div>
  );
}

function DownloadLink({ asset, fileName }: { asset: CreativeAsset; fileName: string }) {
  const [failed, setFailed] = useState(false);
  const mb = asset.bytes ? ` · ${(asset.bytes / 1024 / 1024).toFixed(1)} MB` : '';
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-1 text-left underline"
      onClick={async () => {
        setFailed(false);
        try {
          window.location.assign(await downloadUrl(asset, fileName));
        } catch {
          setFailed(true);
        }
      }}
    >
      {KIND_LABEL[asset.kind as keyof typeof KIND_LABEL] ?? asset.kind}
      <span className="text-sm text-muted">{mb}</span>
      {failed && <span className="text-sm text-red-800"> (try again)</span>}
    </button>
  );
}
