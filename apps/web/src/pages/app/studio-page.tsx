import {
  ASPECTS,
  checkRecipe,
  Composer,
  FORMATS,
  FPS,
  OUTLINE_HIGHLIGHT_DURATION_FRAMES,
  OutlineHighlight,
  STYLES,
  type Aspect,
  type Purpose,
} from '@admitra/styles-engine';
import { composerExtras, recipeContext } from '@/features/design/api';
import { AiEditPanel } from '@/features/design/ai-edit-panel';
import { BusinessDetailsCard } from '@/features/design/business-details';
import { LookPicker } from '@/features/design/look-picker';
import { Player } from '@remotion/player';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useBusinessPhotos } from '@/features/design/business-photos';
import type { StudioState } from '@/features/design/quick-ad';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { FormMessage, TextAreaField, TextField } from '@/components/ui/form-field';
import { buildAdProps, type MissingFact } from '@/features/campaigns/ad-props';
import {
  confirmCampaignFacts,
  CopyError,
  generateCopy,
  updateCampaign,
  type Campaign,
  type CopyDrafts,
} from '@/features/campaigns/api';
import { useBillingStatus } from '@/features/billing/hooks';
import { BriefForm } from '@/features/campaigns/brief-form';
import { campaignKey, campaignsKey, useCampaign } from '@/features/campaigns/hooks';
import { outlineStyleOptions, type OutlineStyleValue } from '@/features/campaigns/options';
import { formatValidity } from '@/features/campaigns/schemas';
import { qrUrlFor } from '@/features/exports/api';
import { ExportPanel } from '@/features/exports/export-panel';
import { StudioVoiceBar } from '@/features/voice/studio-voice-bar';
import { useQrCode } from '@/features/exports/hooks';
import { ConfirmFact } from '@/features/products/confirm-fact';
import { useProduct, useProducts } from '@/features/products/hooks';
import { adImagePath } from '@/features/products/ad-image';
import { pictureFor, REPRESENTATION_NOTE, useProductPictures } from '@/features/products/pictures';
import { useProductOutline } from '@/features/products/use-product-outline';
import { sceneFor } from '@/features/scenes/api';
import { useClip, useSceneTypes } from '@/features/scenes/hooks';
import { ScenePicker } from '@/features/scenes/scene-picker';
import { useSignedUrl, useWorkspace } from '@/features/workspace/hooks';
import { cn } from '@/lib/utils';
import { PageError, PageLoading } from './page-state';

const missingText: Record<MissingFact, { text: string; to: (c: Campaign) => string }> = {
  offer: { text: 'Offer and dates', to: () => '#facts' },
  price: { text: 'Product price', to: (c) => `/app/products/${c.product_id}` },
  phone: { text: 'Phone number', to: () => '/app/business' },
  address: { text: 'Address', to: () => '/app/business' },
};

const copyErrors: Record<string, string> = {
  rate_limited: 'You have generated a lot of copy this hour. Please try again a little later.',
};

export function StudioPage() {
  const { id } = useParams();
  const { state: routeState } = useLocation() as { state: StudioState | null };
  const queryClient = useQueryClient();
  const workspace = useWorkspace();
  const campaign = useCampaign(id);
  const products = useProducts(workspace.data?.workspace.id);
  const billing = useBillingStatus(workspace.data?.workspace.id);
  const product = useProduct(campaign.data?.product_id ?? undefined);
  // The image ads use: the AI-enhanced one if chosen, else the cutout, else the photo.
  const cutoutPath = adImagePath(product.data);
  const productUrl = useSignedUrl(cutoutPath, 'product-images');
  const logoUrl = useSignedUrl(workspace.data?.brandKit?.logo_path);
  const outline = useProductOutline(productUrl.data, cutoutPath);
  const qrCode = useQrCode(id);
  const sceneTypes = useSceneTypes(workspace.data?.business?.industry);
  const clip = useClip(campaign.data?.scene_clip_id);
  const sceneVideo = useSignedUrl(clip.data?.file_path, 'ai-clips');
  const bizPhotos = useBusinessPhotos(workspace.data?.business?.id);
  const businessPhoto =
    bizPhotos.data?.find((p) => p.is_main)?.url ?? bizPhotos.data?.[0]?.url ?? null;
  // AI pictures of the product. A product without a photo keeps checking until its first
  // pictures are ready (they are made in the background right after it was added).
  const pictures = useProductPictures(
    campaign.data?.product_id,
    Boolean(product.data && !product.data.image_path),
  );

  const [aspect, setAspect] = useState<Aspect>('9:16');
  const [drafts, setDrafts] = useState<CopyDrafts | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [headline, setHeadline] = useState<string | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [copySaved, setCopySaved] = useState(false);
  const [editingBrief, setEditingBrief] = useState(false);

  if (workspace.isLoading || campaign.isLoading) return <PageLoading />;
  if (workspace.isError || !workspace.data)
    return <PageError onRetry={() => workspace.refetch()} />;
  const { business, location, brandKit } = workspace.data;
  if (!business || !campaign.data) {
    return (
      <div className="mx-auto max-w-lg">
        <FormMessage tone="error">This campaign does not exist or was deleted.</FormMessage>
        <Link to="/app/campaigns" className="mt-4 inline-flex min-h-11 items-center underline">
          Back to campaigns
        </Link>
      </div>
    );
  }
  const c = campaign.data;

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: campaignKey(c.id) }),
      queryClient.invalidateQueries({ queryKey: campaignsKey(c.workspace_id) }),
    ]);

  const save = async (values: Parameters<typeof updateCampaign>[1]) => {
    await updateCampaign(c.id, values);
    await refresh();
  };

  const { props, missing } = buildAdProps({
    campaign: { ...c, headline: headline ?? c.headline },
    business,
    location,
    brandKit,
    product: product.data ?? null,
    // No product ("Promote my business", greetings): the main business photo.
    productImageUrl: c.product_id ? (productUrl.data ?? null) : businessPhoto,
    productOutline: outline.data ?? null,
    logoUrl: logoUrl.data ?? null,
    aspect,
    // Same rule as the export (create_render_job): paid plans and packs remove it.
    watermark: billing.data?.watermark ?? true,
    qrUrl: qrUrlFor(qrCode.data),
    scene: sceneFor(
      clip.data,
      sceneTypes.data?.find((t) => t.id === clip.data?.scene_type_id),
      sceneVideo.data,
    ),
  });
  // AI-designed look (Composer): the saved recipe is checked again every time it is drawn.
  const pictureList = pictures.data ?? [];
  const mainUrl = props.productImageUrl ?? null;
  const ctx = recipeContext(
    c,
    business,
    product.data?.name ?? null,
    Boolean(mainUrl),
    pictureList.filter((p) => p.use_in_ads).map((p) => p.id),
  );
  const recipe = c.design ? checkRecipe(c.design, ctx) : null;
  // The picture the chosen design uses (same rule as the export).
  const shown = pictureFor(recipe?.picture, pictureList, mainUrl);
  const previewAd = { ...props, productImageUrl: shown.url };
  const useComposer = c.style_id === 'composer' && recipe !== null;
  const extras = composerExtras(business);
  const previewExtras = {
    ...extras,
    imageNote: shown.picture?.kind === 'generated' ? REPRESENTATION_NOTE : null,
  };
  const detailsNotice =
    useComposer &&
    !business.details_confirmed_at &&
    (business.opening_hours || business.since_year || business.registration_no)
      ? 'Confirm your hours and registration number in "Business details for ads" to show them.'
      : useComposer && ctx.sector === 'real_estate' && !extras.registration
        ? 'Property ads must show the RERA number: add and confirm it in "Business details for ads".'
        : null;
  const refreshWorkspace = () => queryClient.invalidateQueries({ queryKey: ['workspace'] });

  const sceneNotice =
    c.scene_clip_id && clip.data && clip.data.status !== 'COMPLETED'
      ? 'Approve the AI scene first (or choose "No scene"), then export.'
      : null;
  const { width, height } = FORMATS[aspect];

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        to="/app/campaigns"
        className="mb-2 inline-flex min-h-11 items-center gap-2 text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All campaigns
      </Link>
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium tracking-[0.25em] text-indigo-deep uppercase">Studio</p>
          <h1 className="text-[clamp(30px,4.5vw,42px)] leading-[1.05]">{c.name}</h1>
        </div>
        <a href="#export" className={cn(buttonVariants({ variant: 'dark' }), 'w-full md:w-auto')}>
          <Download className="h-5 w-5" aria-hidden="true" /> Export
        </a>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        {/* Preview */}
        <section aria-label="Preview" className="min-w-0">
          <div role="radiogroup" aria-label="Size" className="mb-3 flex flex-wrap gap-2">
            {ASPECTS.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={aspect === a}
                onClick={() => setAspect(a)}
                className={cn(
                  'min-h-11 rounded-full border px-4 text-base',
                  aspect === a
                    ? 'border-ink bg-ink text-paper'
                    : 'border-line bg-card hover:border-ink/50',
                )}
              >
                {a} <span className="hidden sm:inline">· {FORMATS[a].label}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-center rounded-2xl bg-paper-deep p-3 md:p-6">
            <div
              className="w-full overflow-hidden rounded-lg shadow-billboard"
              style={{
                maxWidth:
                  aspect === '9:16' ? 380 : aspect === '4:5' ? 460 : aspect === '1:1' ? 520 : 900,
              }}
            >
              {useComposer ? (
                <Player
                  key={`composer-${aspect}`}
                  component={Composer}
                  inputProps={{ aspect, recipe, ad: previewAd, extras: previewExtras }}
                  durationInFrames={recipe.duration * FPS}
                  fps={FPS}
                  compositionWidth={width}
                  compositionHeight={height}
                  style={{ width: '100%', aspectRatio: `${width} / ${height}` }}
                  controls
                  loop
                  autoPlay
                  acknowledgeRemotionLicense
                />
              ) : (
                <Player
                  key={aspect}
                  component={OutlineHighlight}
                  inputProps={props}
                  durationInFrames={OUTLINE_HIGHLIGHT_DURATION_FRAMES}
                  fps={FPS}
                  compositionWidth={width}
                  compositionHeight={height}
                  style={{ width: '100%', aspectRatio: `${width} / ${height}` }}
                  controls
                  loop
                  autoPlay
                  acknowledgeRemotionLicense
                />
              )}
            </div>
          </div>
          {detailsNotice && (
            <div className="mt-3">
              <FormMessage tone="info">{detailsNotice}</FormMessage>
            </div>
          )}
          {missing.length > 0 && (
            <div className="mt-3 rounded-xl border border-lamp-deep/40 bg-lamp-soft p-4">
              <p className="font-medium">Not shown on the ad until confirmed:</p>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {missing.map((m) => (
                  <li key={m}>
                    {missingText[m].to(c).startsWith('#') ? (
                      <a
                        href={missingText[m].to(c)}
                        className="inline-flex min-h-11 items-center underline"
                      >
                        {missingText[m].text}
                      </a>
                    ) : (
                      <Link
                        to={missingText[m].to(c)}
                        className="inline-flex min-h-11 items-center underline"
                      >
                        {missingText[m].text}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {useComposer && (
            <AiEditPanel
              campaignId={c.id}
              recipe={recipe}
              ctx={ctx}
              brandColors={[
                brandKit?.primary_color,
                brandKit?.secondary_color,
                brandKit?.accent_color,
              ].filter((x): x is string => typeof x === 'string')}
              onApply={(r) => save({ style_id: 'composer', design: r })}
            />
          )}

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <fieldset>
              <legend className="font-medium">Style</legend>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Style">
                {STYLES.filter((s) => s.available).map((s) => {
                  const active = s.id === 'composer' ? useComposer : !useComposer;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        if (s.id === 'composer') {
                          if (recipe) void save({ style_id: 'composer' });
                          else
                            document
                              .getElementById('looks-title')
                              ?.scrollIntoView({ behavior: 'smooth' });
                        } else void save({ style_id: 'outline_highlight' });
                      }}
                      className={cn(
                        'inline-flex min-h-11 items-center rounded-full border px-4',
                        active
                          ? 'border-ink bg-ink text-paper'
                          : 'border-line bg-card hover:border-ink/50',
                      )}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <fieldset hidden={useComposer}>
              <legend className="font-medium">Outline</legend>
              <div
                className="mt-2 flex flex-wrap gap-2"
                role="radiogroup"
                aria-label="Outline style"
              >
                {outlineStyleOptions.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={c.outline_style === m.value}
                    onClick={() => save({ outline_style: m.value as OutlineStyleValue })}
                    className={cn(
                      'min-h-11 rounded-full border px-4',
                      c.outline_style === m.value
                        ? 'border-ink bg-ink text-paper'
                        : 'border-line bg-card hover:border-ink/50',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <LookPicker
            campaignId={c.id}
            purpose={c.purpose as Purpose}
            ctx={ctx}
            ad={props}
            extras={extras}
            current={useComposer ? recipe : null}
            onPurpose={(p) => save({ purpose: p })}
            onUse={(r) => save({ style_id: 'composer', design: r })}
            autoStart={Boolean(routeState?.autoDesign) && !c.design}
            pictures={pictureList}
            mainUrl={mainUrl}
          />
        </section>

        {/* Controls */}
        <aside className="flex flex-col gap-6" aria-label="Campaign details">
          <StudioVoiceBar
            campaign={c}
            product={product.data ?? null}
            onChanged={() =>
              Promise.all([
                refresh(),
                queryClient.invalidateQueries({ queryKey: ['product', c.product_id] }),
              ])
            }
          />
          <ExportPanel
            campaignId={c.id}
            campaignName={c.name}
            workspaceId={c.workspace_id}
            blocked={missing.length > 0}
            notice={sceneNotice}
            trial={workspace.data?.workspace.is_trial ?? false}
          />
          <ScenePicker
            workspaceId={c.workspace_id}
            productId={c.product_id}
            sceneTypes={sceneTypes.data ?? []}
            clip={clip.data ?? null}
            testMode={!clip.data || clip.data.provider === 'mock'}
            onSelect={(clipId) => save({ scene_clip_id: clipId })}
          />
          <BusinessDetailsCard key={business.id} business={business} onSaved={refreshWorkspace} />
          <section id="facts" className="rounded-2xl border border-line bg-card p-5 shadow-soft">
            <h2 className="font-sans text-lg font-medium tracking-normal normal-case">
              Offer and dates
            </h2>
            {c.offer_text ? (
              <div className="mt-3">
                <ConfirmFact
                  label="offer"
                  value={[c.offer_text, formatValidity(c.start_date, c.end_date)]
                    .filter(Boolean)
                    .join(' · ')}
                  confirmedAt={c.facts_confirmed_at}
                  onConfirm={async () => {
                    await confirmCampaignFacts(c.id);
                    await refresh();
                  }}
                />
              </div>
            ) : (
              <p className="mt-2 text-muted">
                No offer on this campaign. Add one in the brief below.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-sans text-lg font-medium tracking-normal normal-case">Ad copy</h2>
              <Button
                variant="outline"
                disabled={copyBusy}
                onClick={async () => {
                  setCopyBusy(true);
                  setCopyError(null);
                  try {
                    setDrafts(await generateCopy(c.id));
                  } catch (e) {
                    setCopyError(
                      (e instanceof CopyError && copyErrors[e.code]) ||
                        'Could not write copy right now. Please try again.',
                    );
                  } finally {
                    setCopyBusy(false);
                  }
                }}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />{' '}
                {copyBusy ? 'Writing…' : 'Write with AI'}
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted">
              Drafts never include prices or offers; those come only from your confirmed details.
              {drafts?.provider === 'mock' ? ' Test mode: sample lines.' : ''}
              {drafts?.provider === 'openai' ? ' Written by AI: read it before you use it.' : ''}
            </p>
            {copyError && (
              <div className="mt-3">
                <FormMessage tone="error">{copyError}</FormMessage>
              </div>
            )}
            {drafts && (
              <div className="mt-4">
                <p className="text-sm font-medium">Pick a headline</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {drafts.headlines.map((h) => (
                    <li key={h}>
                      <button
                        type="button"
                        onClick={() => {
                          setHeadline(h);
                          setCopySaved(false);
                        }}
                        className="min-h-11 w-full rounded-xl border border-line px-3 py-2 text-left hover:border-ink"
                      >
                        {h}
                      </button>
                    </li>
                  ))}
                </ul>
                {drafts.captions.length > 0 && (
                  <>
                    <p className="mt-3 text-sm font-medium">Pick a caption</p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {drafts.captions.map((t) => (
                        <li key={t}>
                          <button
                            type="button"
                            onClick={() => {
                              setCaption(t);
                              setCopySaved(false);
                            }}
                            className="min-h-11 w-full rounded-xl border border-line px-3 py-2 text-left text-sm hover:border-ink"
                          >
                            {t}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
            <form
              className="mt-4 flex flex-col gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                await save({
                  headline: (headline ?? c.headline ?? '').trim() || null,
                  caption: (caption ?? c.caption ?? '').trim() || null,
                  hashtags: drafts?.hashtags ?? c.hashtags,
                });
                setCopySaved(true);
              }}
            >
              <TextField
                id="headline"
                label="Headline on the ad"
                maxLength={80}
                value={headline ?? c.headline ?? ''}
                onChange={(e) => {
                  setHeadline(e.target.value);
                  setCopySaved(false);
                }}
              />
              <TextAreaField
                id="caption"
                label="Post caption"
                optional
                maxLength={600}
                value={caption ?? c.caption ?? ''}
                onChange={(e) => {
                  setCaption(e.target.value);
                  setCopySaved(false);
                }}
              />
              {(drafts?.hashtags ?? c.hashtags).length > 0 && (
                <p className="text-sm text-muted">{(drafts?.hashtags ?? c.hashtags).join(' ')}</p>
              )}
              {copySaved && <FormMessage tone="success">Copy saved.</FormMessage>}
              <Button type="submit" variant="dark">
                Save copy
              </Button>
            </form>
          </section>

          <section className="rounded-2xl border border-line bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-sans text-lg font-medium tracking-normal normal-case">Brief</h2>
              <Button
                variant="ghost"
                onClick={() => setEditingBrief((v) => !v)}
                aria-expanded={editingBrief}
              >
                {editingBrief ? 'Close' : 'Edit brief'}
              </Button>
            </div>
            {editingBrief && (
              <div className="mt-4">
                <BriefForm
                  campaign={c}
                  products={products.data ?? []}
                  defaultLanguage={c.language}
                  submitLabel="Save brief"
                  onSubmit={async (values) => {
                    await save(values);
                    setEditingBrief(false);
                  }}
                />
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
