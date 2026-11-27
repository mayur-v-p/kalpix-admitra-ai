import { Download, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Campaign } from '@/features/campaigns/api';
import { adImagePath } from '@/features/products/ad-image';
import { useSignedUrl } from '@/features/workspace/hooks';
import type { Tables } from '@/types/database';
import { cn } from '@/lib/utils';
import { shareVideo, videoLink, type AdStatus } from './ads-api';
import { PURPOSE_LABELS } from './labels';
import { MiniAd } from './mini-ad';
import { campaignMini } from './mini-ad-data';
import type { Purpose } from '@admitra/styles-engine';

type Business = Pick<Tables<'business_profiles'>, 'name' | 'industry' | 'specialities'>;

const STATUS: Record<AdStatus, { label: string; cls: string }> = {
  ready: { label: 'Ready', cls: 'bg-[#e3f3ef] text-[#1f6b5f]' },
  making: { label: 'Making video', cls: 'bg-[#fdf0d6] text-[#7a4a06]' },
  draft: { label: 'Draft', cls: 'bg-[#f1eee6] text-[#4a4862]' },
  failed: { label: 'Export failed', cls: 'bg-red-50 text-red-800' },
};

/** The quick look of a campaign, with its own product photo or the business photo. */
export function CampaignMini({
  campaign,
  business,
  product,
  businessPhoto,
  index,
  width,
}: {
  campaign: Campaign;
  business: Business;
  product: Tables<'products'> | null | undefined;
  businessPhoto: string | null;
  index: number;
  width?: number;
}) {
  const productUrl = useSignedUrl(adImagePath(product), 'product-images');
  const photo = product ? (productUrl.data ?? null) : businessPhoto;
  return <MiniAd ad={campaignMini(campaign, business, product, photo, index)} width={width} />;
}

export function AdCard({
  campaign,
  business,
  product,
  businessPhoto,
  index,
  status,
  progress,
  readyJobId,
}: {
  campaign: Campaign;
  business: Business;
  product: Tables<'products'> | null | undefined;
  businessPhoto: string | null;
  index: number;
  status: AdStatus;
  progress?: number;
  readyJobId?: string;
}) {
  const [busy, setBusy] = useState<'download' | 'share' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const s = STATUS[status];
  const when = new Date(campaign.updated_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });

  const act = async (kind: 'download' | 'share') => {
    if (!readyJobId) return;
    setBusy(kind);
    setError(null);
    try {
      const url = await videoLink(readyJobId, `${campaign.name}.mp4`);
      if (!url) throw new Error('no video');
      if (kind === 'share') await shareVideo(url, campaign.name);
      else window.location.assign(url);
    } catch {
      setError('Could not get the video. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="kx-card kx-lift flex flex-col gap-3 rounded-[26px] p-3.5">
      <div className="relative self-center overflow-hidden rounded-[20px] shadow-[0_14px_28px_rgb(35_34_89/0.2)]">
        <CampaignMini
          campaign={campaign}
          business={business}
          product={product}
          businessPhoto={businessPhoto}
          index={index}
        />
        <span
          className={cn(
            'absolute top-7 left-2 rounded-full px-2.5 py-1 text-[11px] font-bold shadow',
            s.cls,
          )}
        >
          {s.label}
        </span>
      </div>
      <div className="px-1">
        <h3 className="truncate font-display text-xl leading-tight font-medium tracking-normal normal-case">
          {campaign.name}
        </h3>
        <p className="text-sm text-muted">
          {PURPOSE_LABELS[(campaign.purpose as Purpose) ?? 'promote'] ?? 'Ad'} · {when}
        </p>
      </div>
      {status === 'making' && (
        <div className="px-1">
          <div
            className="h-2 overflow-hidden rounded-full bg-[#efebf9]"
            role="progressbar"
            aria-label="Video progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((progress ?? 0) * 100)}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#f6c96f] to-[#e8b04b] transition-all"
              style={{ width: `${Math.max(4, Math.round((progress ?? 0) * 100))}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Making your video… {Math.round((progress ?? 0) * 100)}%
          </p>
        </div>
      )}
      {error && (
        <p className="px-1 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-1.5 px-1 pb-1">
        <Link
          to={`/app/campaigns/${campaign.id}/studio`}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-[#14132e] to-[#2b2a6b] text-sm font-semibold text-white"
        >
          Open
        </Link>
        {readyJobId && (
          <>
            <button
              type="button"
              onClick={() => act('download')}
              disabled={busy !== null}
              aria-label={`Download ${campaign.name}`}
              className="inline-flex min-h-11 w-11 items-center justify-center rounded-xl border border-ink/15 bg-white disabled:opacity-50"
            >
              <Download className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => act('share')}
              disabled={busy !== null}
              aria-label={`Share ${campaign.name}`}
              className="inline-flex min-h-11 w-11 items-center justify-center rounded-xl bg-[#e3f3ef] text-[#1f6b5f] disabled:opacity-50"
            >
              <Share2 className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </article>
  );
}
