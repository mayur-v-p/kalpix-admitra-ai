import {
  buildAdProps,
  FORMATS,
  FPS,
  OUTLINE_HIGHLIGHT_DURATION_FRAMES,
  OutlineHighlight,
} from '@admitra/styles-engine';
import { Player } from '@remotion/player';
import { useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Pencil, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FormMessage } from '@/components/ui/form-field';
import { campaignsKey } from '@/features/campaigns/hooks';
import { adImagePath } from '@/features/products/ad-image';
import { productsKey, useProducts } from '@/features/products/hooks';
import { mergeBriefs, useAiBrief } from '@/features/voice/ai-brief';
import { adOffer, createAdFromVoice, type CheckedAd } from '@/features/voice/create-ad';
import {
  inr,
  parseAnswer,
  parseBrief,
  salePrice,
  yesOrNo,
  type AdCta,
  type AdGoal,
  type BriefField,
} from '@/features/voice/parse';
import {
  canListen,
  listenOnce,
  speak,
  stopSpeaking,
  type SpeechLang,
} from '@/features/voice/speech';
import { MicDot, SpeakYourAd, type VoiceBriefState } from '@/features/voice/voice-panel';
import { useSignedUrl, useWorkspace, workspaceKey } from '@/features/workspace/hooks';
import { useAuth } from '@/features/auth/auth-context';
import { cn } from '@/lib/utils';
import { trialLimitText } from '@/lib/trial';
import { PageError, PageLoading } from './page-state';

const GOALS: { value: AdGoal; label: string }[] = [
  { value: 'festival', label: 'Festival sale' },
  { value: 'sale', label: 'Discount offer' },
  { value: 'new_product', label: 'New product' },
  { value: 'event', label: 'Event' },
  { value: 'visit', label: 'Store opening' },
  { value: 'booking', label: 'Bookings' },
];
const CTAS: { value: AdCta; label: string }[] = [
  { value: 'whatsapp', label: 'Order on WhatsApp' },
  { value: 'call', label: 'Call now' },
  { value: 'visit', label: 'Visit us today' },
  { value: 'order', label: 'Order now' },
  { value: 'book', label: 'Book now' },
];

/** Questions for "Fill by voice", in the language the owner spoke. */
const QUESTIONS: Record<BriefField, Record<SpeechLang, string>> = {
  product: {
    hi: 'किस चीज़ का ऐड है?',
    mr: 'कोणत्या वस्तूची जाहिरात आहे?',
    en: 'Which product is the ad for?',
  },
  price: { hi: 'कीमत कितनी है?', mr: 'किंमत किती आहे?', en: 'What is the price?' },
  discount: { hi: 'कितनी छूट है?', mr: 'किती सवलत आहे?', en: 'How much discount?' },
  dates: {
    hi: 'ऑफर किस तारीख से किस तारीख तक है?',
    mr: 'ऑफर कोणत्या तारखेपासून कोणत्या तारखेपर्यंत आहे?',
    en: 'From which date to which date?',
  },
  time: { hi: 'कोई समय बताना है?', mr: 'काही वेळ सांगायची आहे का?', en: 'Any time of day?' },
};

const dateLabel = (v?: string) =>
  v
    ? new Date(v + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '';

type Values = Omit<CheckedAd, 'photo'>;
type RowKey = 'goal' | 'product' | 'price' | 'discount' | 'dates' | 'time' | 'cta' | 'businessName';

export function VoiceBriefPage() {
  const { state } = useLocation() as { state: VoiceBriefState | null };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const ws = useWorkspace();
  const workspaceId = ws.data?.workspace.id;
  const products = useProducts(workspaceId);
  const transcript = state?.transcript ?? '';
  const lang: SpeechLang = state?.lang ?? 'hi';

  const [edits, setEdits] = useState<{ for: string; values: Values } | null>(null);
  const [seenFor, setSeenFor] = useState(transcript);
  const [photo, setPhoto] = useState<File | null>(null);
  const [editing, setEditing] = useState<RowKey | null>(null);
  const [asking, setAsking] = useState<BriefField | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopFill = useRef(false);

  // A new sentence starts a fresh brief (photo and open editor reset with it).
  if (seenFor !== transcript) {
    setSeenFor(transcript);
    setPhoto(null);
    setEditing(null);
  }

  // AI reading (optional, on the server): its values replace the parser's when they arrive.
  const productNames = useMemo(() => products.data?.map((p) => p.name), [products.data]);
  const ai = useAiBrief(transcript, productNames);

  // What was said, understood once the product library is known (to match product names).
  const parsed = useMemo<Values | null>(() => {
    if (!products.data || !ws.data) return null;
    const library = products.data.map((p) => ({ id: p.id, name: p.name }));
    const b = mergeBriefs(parseBrief(transcript, library), ai.data ?? null, library);
    const found = products.data.find((p) => p.id === b.productId);
    return {
      goal: b.goal ?? 'sale',
      occasion: b.occasion,
      product: b.product,
      productId: b.productId,
      price: b.price ?? (found?.price != null ? Number(found.price) : undefined),
      discount: b.discount,
      from: b.from,
      to: b.to,
      time: b.time,
      cta: b.cta ?? 'whatsapp',
      language: b.language ?? (lang === 'en' ? 'en' : lang),
      businessType: ws.data.business ? undefined : (b.businessType ?? 'other'),
    };
  }, [transcript, products.data, ws.data, lang, ai.data]);
  // The owner's edits win over what was understood, for this sentence only.
  const v = edits && edits.for === transcript ? edits.values : parsed;

  const matched = products.data?.find((p) => p.id === v?.productId) ?? null;
  const matchedUrl = useSignedUrl(adImagePath(matched), 'product-images');
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => (photoUrl ? URL.revokeObjectURL(photoUrl) : undefined), [photoUrl]);
  useEffect(() => () => stopSpeaking(), []);

  if (ws.isLoading || products.isLoading || (!v && !ws.isError)) return <PageLoading />;
  if (ws.isError || !ws.data || !v) return <PageError onRetry={() => ws.refetch()} />;
  const { business, location, brandKit } = ws.data;

  const set = (patch: Partial<Values>) =>
    setEdits((cur) => {
      const base = cur && cur.for === transcript ? cur.values : v;
      return { for: transcript, values: { ...base, ...patch } };
    });
  const hasSale = Boolean(v.price && v.discount);
  const missing: BriefField[] = [];
  if (!v.product) missing.push('product');
  if (!v.price) missing.push('price');
  if (!v.discount) missing.push('discount');
  if (!v.from && !v.to) missing.push('dates');
  const needsBusiness = !business;
  const offer = adOffer(v);

  // ---------------------------------------------------------------- live preview (not saved)
  const now = new Date().toISOString();
  const { props } = buildAdProps({
    campaign: {
      headline: null,
      offer_text: offer,
      start_date: v.from ?? null,
      end_date: v.to ?? v.from ?? null,
      facts_confirmed_at: now, // preview only: shows what the ad will look like once confirmed
      cta: v.cta,
      language: v.language,
      outline_style: 'brand',
    },
    business: business ?? {
      name: v.businessName || 'Your shop',
      phone: null,
      phone_confirmed_at: null,
    },
    location,
    brandKit,
    product: v.product
      ? { name: v.product, price: v.price ?? null, price_confirmed_at: now }
      : null,
    productImageUrl: photoUrl ?? matchedUrl.data ?? null,
    productOutline: null,
    logoUrl: null,
    aspect: '9:16',
    watermark: true,
  });
  const { width, height } = FORMATS['9:16'];

  // ---------------------------------------------------------------- voice
  const answer = async (field: BriefField) => {
    setAsking(field);
    await speak(QUESTIONS[field][lang], lang);
    const said = await listenOnce(lang).catch(() => '');
    if (said) {
      const got = parseAnswer(field, said);
      set(got as Partial<Values>);
    }
    setAsking(null);
    return Boolean(said);
  };
  const fillByVoice = async () => {
    stopFill.current = false;
    for (const f of missing) {
      if (stopFill.current) break;
      const ok = await answer(f);
      if (!ok) break;
    }
  };

  const readBack = () => {
    const parts: string[] = [];
    if (v.product) parts.push(v.product);
    if (hasSale)
      parts.push(
        `${v.discount}% छूट, ${inr(v.price!)} की जगह ${inr(salePrice(v.price!, v.discount!))}`,
      );
    else if (v.price) parts.push(inr(v.price));
    else if (v.discount) parts.push(`${v.discount}% छूट`);
    if (v.from || v.to)
      parts.push(
        `${dateLabel(v.from) || dateLabel(v.to)} से ${dateLabel(v.to) || dateLabel(v.from)} तक`,
      );
    if (v.time) parts.push(v.time);
    return (
      (parts.length ? parts.join(', ') : GOALS.find((g) => g.value === v.goal)?.label) + '। सही है?'
    );
  };
  const openConfirm = () => {
    setEditing(null);
    setError(null);
    setConfirming(true);
    void speak(readBack(), lang);
  };
  const sayYes = async () => {
    const said = await listenOnce(lang).catch(() => '');
    const yn = yesOrNo(said);
    if (yn === 'yes') void create();
    else if (yn === 'no') setConfirming(false);
  };
  const create = async () => {
    if (!workspaceId) return;
    stopSpeaking();
    setBusy(true);
    setError(null);
    try {
      const id = await createAdFromVoice(workspaceId, business, { ...v, photo });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: campaignsKey(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: productsKey(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: workspaceKey(user?.id) }),
      ]);
      navigate(`/app/campaigns/${id}/studio`, { replace: true });
    } catch (e) {
      setError(
        trialLimitText(e) ?? 'The ad could not be created. Please check the details and try again.',
      );
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  // ---------------------------------------------------------------- rows
  type Row = {
    key: RowKey;
    label: string;
    shown: string;
    sub?: string;
    empty: boolean;
    optional?: boolean;
  };
  const rows: Row[] = [
    ...(needsBusiness
      ? [
          {
            key: 'businessName' as const,
            label: 'Shop name',
            shown: v.businessName || '+ Add shop name',
            empty: !v.businessName,
          },
        ]
      : []),
    {
      key: 'goal',
      label: 'Ad type',
      shown: GOALS.find((g) => g.value === v.goal)?.label ?? 'Discount offer',
      sub: v.occasion,
      empty: false,
    },
    {
      key: 'product',
      label: 'Product',
      shown: v.product || '+ Add product',
      sub: matched
        ? 'From your products · photo added'
        : v.product
          ? photo
            ? 'New product · photo added'
            : 'New product · add a photo below'
          : undefined,
      empty: !v.product,
    },
    {
      key: 'price',
      label: 'Price',
      shown: v.price ? inr(v.price) : '+ Add price',
      empty: !v.price,
    },
    {
      key: 'discount',
      label: 'Discount',
      shown: v.discount ? `${v.discount}%` : '+ Add discount',
      sub: hasSale
        ? `Sale price ${inr(salePrice(v.price!, v.discount!))} · worked out by Kalpix`
        : undefined,
      empty: !v.discount,
    },
    {
      key: 'dates',
      label: 'Offer dates',
      shown:
        v.from || v.to
          ? `${dateLabel(v.from) || dateLabel(v.to)} – ${dateLabel(v.to) || dateLabel(v.from)}`
          : '+ Add dates',
      empty: !v.from && !v.to,
    },
    { key: 'time', label: 'Time', shown: v.time || 'Optional', empty: !v.time, optional: true },
    {
      key: 'cta',
      label: 'Button on the ad',
      shown: CTAS.find((c) => c.value === v.cta)?.label ?? '',
      empty: false,
    },
  ];
  const missingNames = [
    needsBusiness && !v.businessName ? 'shop name' : null,
    ...missing.map((m) => m),
  ].filter(Boolean);

  const editor = (key: RowKey) => {
    const input = 'min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-card px-3 text-base';
    switch (key) {
      case 'goal':
        return (
          <div className="flex flex-wrap gap-1.5">
            {GOALS.map((g) => (
              <button
                key={g.value}
                type="button"
                aria-pressed={v.goal === g.value}
                onClick={() => set({ goal: g.value })}
                className={cn(
                  'min-h-10 rounded-lg border px-3 text-sm font-medium',
                  v.goal === g.value
                    ? 'border-indigo-deep bg-indigo-deep text-white'
                    : 'border-line bg-card',
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        );
      case 'cta':
        return (
          <select
            aria-label="Button on the ad"
            className={input}
            value={v.cta}
            onChange={(e) => set({ cta: e.target.value as AdCta })}
          >
            {CTAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        );
      case 'dates':
        return (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <input
              aria-label="Offer starts"
              type="date"
              className={input}
              value={v.from ?? ''}
              onChange={(e) => set({ from: e.target.value || undefined })}
            />
            <span className="text-muted">to</span>
            <input
              aria-label="Offer ends"
              type="date"
              className={input}
              value={v.to ?? ''}
              onChange={(e) => set({ to: e.target.value || undefined })}
            />
          </div>
        );
      case 'price':
      case 'discount':
        return (
          <input
            aria-label={key === 'price' ? 'Price in rupees' : 'Discount in percent'}
            type="number"
            inputMode="numeric"
            min={key === 'price' ? 1 : 1}
            max={key === 'discount' ? 90 : undefined}
            className={input}
            value={v[key] ?? ''}
            onChange={(e) => set({ [key]: e.target.value ? Number(e.target.value) : undefined })}
          />
        );
      case 'product':
        return (
          <input
            aria-label="Product"
            className={input}
            value={v.product ?? ''}
            maxLength={80}
            onChange={(e) =>
              set({
                product: e.target.value || undefined,
                productId: products.data?.find(
                  (p) => p.name.toLowerCase() === e.target.value.toLowerCase(),
                )?.id,
              })
            }
          />
        );
      case 'businessName':
        return (
          <input
            aria-label="Shop name"
            className={input}
            value={v.businessName ?? ''}
            maxLength={120}
            onChange={(e) => set({ businessName: e.target.value || undefined })}
          />
        );
      default:
        return (
          <input
            aria-label="Time"
            className={input}
            value={v.time ?? ''}
            maxLength={20}
            placeholder="e.g. 5–9 PM"
            onChange={(e) => set({ time: e.target.value || undefined })}
          />
        );
    }
  };
  const voiceField = (key: RowKey): BriefField | null =>
    key === 'product' || key === 'price' || key === 'discount' || key === 'dates' || key === 'time'
      ? key
      : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-[0.2em] text-indigo uppercase">New ad</p>
          <h1
            className="mt-1 text-[clamp(32px,5vw,46px)] leading-[1.05] font-medium tracking-[-0.01em]"
            aria-label="Check your ad."
          >
            <span aria-hidden="true">
              <span className="word">Check</span>{' '}
              <span className="word [animation-delay:120ms]">your</span>{' '}
              <span className="word text-indigo [animation-delay:240ms]">ad.</span>
            </span>
          </h1>
          {transcript ? (
            <>
              <p className="mt-2 max-w-2xl text-muted">You said: “{transcript}”</p>
              {ai.isFetching ? (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-soft px-3 py-1 text-sm text-indigo-deep" role="status">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" /> AI is reading what you said…
                </p>
              ) : ai.data ? (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-soft px-3 py-1 text-sm text-indigo-deep">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Understood by AI. Please check every line.
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 max-w-2xl text-muted">
              Tap “Speak your ad” and say what you want, or fill the lines below.
            </p>
          )}
        </div>
        <SpeakYourAd />
      </div>

      {error && <FormMessage tone="error">{error}</FormMessage>}

      <div className="flex flex-col items-start gap-8 lg:flex-row">
        <section
          aria-label="Ad details"
          className="w-full min-w-0 flex-1 overflow-hidden rounded-3xl border border-line bg-card shadow-soft"
        >
          {rows.map((r, i) => {
            const isEditing = editing === r.key;
            const vf = voiceField(r.key);
            return (
              <div
                key={r.key}
                className={cn(
                  i > 0 && 'border-t border-line',
                  asking === vf && vf ? 'bg-lamp-soft' : r.empty && !r.optional ? 'bg-paper' : '',
                )}
              >
                {isEditing ? (
                  <div className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span className="w-32 shrink-0 text-muted">{r.label}</span>
                    {editor(r.key)}
                    {vf && canListen() && (
                      <button
                        type="button"
                        aria-label={`Say the ${r.label.toLowerCase()}`}
                        onClick={() => void answer(vf)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-lamp"
                      >
                        <MicDot size="sm" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="min-h-11 rounded-xl bg-ink px-4 font-semibold text-white"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing(r.key)}
                    className="flex min-h-14 w-full items-center gap-4 px-5 py-2 text-left"
                  >
                    <span className="w-32 shrink-0 text-muted">{r.label}</span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block text-[17px]',
                          r.empty
                            ? r.optional
                              ? 'text-concrete'
                              : 'font-medium text-[#9A5B00]'
                            : 'font-semibold',
                        )}
                      >
                        {r.shown}
                      </span>
                      {r.sub && <span className="block text-sm text-muted">{r.sub}</span>}
                    </span>
                    <Pencil className="h-4 w-4 text-muted" aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}
          {v.product && !matched && (
            <label className="flex min-h-14 cursor-pointer items-center gap-4 border-t border-line px-5 py-2">
              <span className="w-32 shrink-0 text-muted">Product photo</span>
              <span className="flex flex-1 items-center gap-2 font-medium">
                <ImagePlus className="h-5 w-5" aria-hidden="true" />
                {photo ? photo.name : 'Add a photo (optional)'}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
          <p className="border-t border-line bg-paper px-5 py-3 text-sm text-muted">
            {business
              ? 'Shop name, logo and phone come from your profile · '
              : 'Your shop details can be completed later · '}
            <Link to="/app/business" className="underline">
              Change
            </Link>
          </p>
        </section>

        <div className="mx-auto flex flex-col items-center gap-2.5">
          <div className="w-[250px] overflow-hidden rounded-3xl shadow-billboard">
            <Player
              component={OutlineHighlight}
              inputProps={props}
              durationInFrames={OUTLINE_HIGHLIGHT_DURATION_FRAMES}
              fps={FPS}
              compositionWidth={width}
              compositionHeight={height}
              style={{ width: '100%', aspectRatio: `${width} / ${height}` }}
              loop
              autoPlay
              acknowledgeRemotionLicense
            />
          </div>
          <p className="text-sm text-muted">Live preview · updates as you edit</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
        <p
          aria-live="polite"
          className={cn('font-medium', missingNames.length ? 'text-[#9A5B00]' : 'text-[#1E5A35]')}
        >
          {missingNames.length
            ? `Missing: ${missingNames.join(', ')}. Add now, or create the ad and add them later in the Studio.`
            : 'All details are filled.'}
        </p>
        <div className="flex gap-2.5">
          {missing.length > 0 && canListen() && (
            <button
              type="button"
              onClick={() => void fillByVoice()}
              disabled={Boolean(asking)}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-ink/20 bg-card px-4 font-semibold disabled:opacity-60"
            >
              <MicDot size="sm" /> Fill by voice
            </button>
          )}
          <button
            type="button"
            onClick={openConfirm}
            disabled={busy || (needsBusiness && !v.businessName)}
            className="btn-shine min-h-12 rounded-xl bg-lamp px-6 font-bold text-ink disabled:opacity-60"
          >
            Create ad
          </button>
        </div>
      </div>

      {asking && (
        <div
          role="status"
          className="animate-page-in fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-ink px-5 py-3 text-paper shadow-float"
        >
          <span className="h-3 w-3 animate-ping rounded-full bg-lamp" aria-hidden="true" />
          {QUESTIONS[asking][lang]}
          <button
            type="button"
            onClick={() => {
              stopFill.current = true;
              stopSpeaking();
              setAsking(null);
            }}
            className="ml-2 underline"
          >
            Stop
          </button>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="readback"
            className="animate-page-in flex w-full max-w-lg flex-col gap-4 rounded-3xl bg-card p-6"
          >
            <h2 id="readback" className="font-sans text-xl font-semibold tracking-normal">
              Is this right? · सही है?
            </h2>
            <p className="rounded-2xl bg-paper px-4 py-3 text-lg leading-relaxed">{readBack()}</p>
            {missingNames.length > 0 && (
              <p className="text-sm text-muted">
                Not filled yet: {missingNames.join(', ')}. You can add them in the Studio; downloads
                wait until every price and date is confirmed.
              </p>
            )}
            <p className="text-sm text-muted">Kalpix reads this aloud. Tap, or say “haan”.</p>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => void create()}
                disabled={busy}
                className="min-h-12 flex-1 rounded-xl bg-lamp px-5 font-bold text-ink disabled:opacity-60"
              >
                {busy ? 'Creating…' : 'हाँ, ऐड बनाइए · Yes, create'}
              </button>
              {canListen() && (
                <button
                  type="button"
                  onClick={() => void sayYes()}
                  disabled={busy}
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-ink/20 bg-card px-4 font-semibold"
                >
                  <MicDot size="sm" /> Say it
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="min-h-12 rounded-xl border border-ink/20 bg-card px-4 font-semibold"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
