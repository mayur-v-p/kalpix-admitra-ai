import type { Purpose } from '@admitra/styles-engine';
import { BadgeCheck, Pencil, Plus, Search, ShieldAlert, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { FormMessage } from '@/components/ui/form-field';
import { PURPOSE_LABELS } from '@/features/design/labels';
import { MiniAd } from '@/features/design/mini-ad';
import { useQuickAd } from '@/features/design/use-quick-ad';
import { adImagePath } from '@/features/products/ad-image';
import { useProducts } from '@/features/products/hooks';
import { ProductImage } from '@/features/products/product-image';
import { formatPrice } from '@/features/products/schemas';
import { useSignedUrl, useWorkspace } from '@/features/workspace/hooks';
import type { Tables } from '@/types/database';
import { PageError, PageLoading } from './page-state';

type Product = Tables<'products'>;
const PRODUCT_PURPOSES: Purpose[] = ['promote', 'offer', 'new_arrivals', 'menu'];
const PRODUCT_PURPOSE_LABEL: Partial<Record<Purpose, string>> = { promote: 'Promote this product' };

function CreatePanel({
  product,
  businessName,
  onClose,
  onStart,
  busy,
}: {
  product: Product;
  businessName: string;
  onClose: () => void;
  onStart: (p: Purpose) => void;
  busy: boolean;
}) {
  const [purpose, setPurpose] = useState<Purpose>('promote');
  const photo = useSignedUrl(adImagePath(product), 'product-images');
  const confirmedPrice =
    product.price !== null && product.price_confirmed_at ? formatPrice(product.price) : null;
  return (
    <section
      aria-labelledby="create-title"
      className="kx-night kx-rise relative isolate flex flex-wrap items-center gap-8 overflow-hidden rounded-[30px] p-7 text-white shadow-[0_26px_54px_rgb(20_19_46/0.3)]"
    >
      <div
        className="kx-orb -top-24 -right-16 h-64 w-64 bg-[#e8b04b] opacity-35"
        aria-hidden="true"
      />
      <div
        className="kx-orb -bottom-36 left-1/4 h-60 w-60 bg-[#5b57d6] opacity-45 [animation-delay:-5s]"
        aria-hidden="true"
      />
      <div className="kx-float relative mx-auto rounded-[30px] bg-[#0b0a1c] p-2 shadow-[0_30px_56px_rgb(0_0_0/0.5)] [--r:-3deg]">
        <div className="overflow-hidden rounded-[22px]">
          <MiniAd
            ad={{
              photo: photo.data ?? null,
              line1: product.name,
              line2: PRODUCT_PURPOSE_LABEL[purpose] ? null : PURPOSE_LABELS[purpose],
              price: confirmedPrice,
              cta: 'Order on WhatsApp',
              business: businessName,
              bg: '#2a1a10',
              ink: '#fff8ee',
              accent: '#f2a541',
            }}
          />
        </div>
      </div>
      <div className="relative flex min-w-0 flex-[1_1_320px] flex-col gap-4">
        <p className="kx-eyebrow text-[#fbe7bf]">New ad</p>
        <h2
          id="create-title"
          className="-mt-1 text-[clamp(28px,3vw,38px)] leading-tight font-medium tracking-normal text-white normal-case"
        >
          Create an ad for <span className="kx-gold-text">{product.name}</span>
        </h2>
        <fieldset>
          <legend className="mb-2.5 text-[#d8d6f5]">What is this ad for?</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Ad purpose">
            {PRODUCT_PURPOSES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={purpose === p}
                onClick={() => setPurpose(p)}
                className={
                  purpose === p
                    ? 'min-h-11 rounded-full border border-white bg-white px-4 font-semibold text-[#232259]'
                    : 'min-h-11 rounded-full border border-white/35 bg-white/5 px-4 font-semibold text-white hover:bg-white/10'
                }
              >
                {PRODUCT_PURPOSE_LABEL[p] ?? PURPOSE_LABELS[p]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="mt-1 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onStart(purpose)}
            disabled={busy}
            className="kx-btn-gold kx-sweep inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-bold disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />{' '}
            {busy ? 'Starting…' : 'Design my ad'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-full border border-white/35 bg-white/5 px-5 font-semibold text-white hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}

export function ProductsPage() {
  const workspace = useWorkspace();
  const products = useProducts(workspace.data?.workspace.id);
  const quick = useQuickAd(workspace.data?.business);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (workspace.isLoading || products.isLoading) return <PageLoading />;
  if (workspace.isError || !workspace.data)
    return <PageError onRetry={() => workspace.refetch()} />;
  const business = workspace.data.business;
  if (!business) return <Navigate to="/app/onboarding" replace />;
  if (products.isError) return <PageError onRetry={() => products.refetch()} />;

  const all = products.data ?? [];
  const q = query.trim().toLowerCase();
  const list = q ? all.filter((p) => p.name.toLowerCase().includes(q)) : all;
  const selected = all.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-7">
      <header className="kx-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kx-eyebrow text-indigo">Products</p>
          <h1 className="mt-1.5 text-[clamp(34px,4.2vw,48px)] leading-[1.06] font-medium tracking-[-0.015em]">
            What you <span className="kx-grad">sell</span>
          </h1>
          <p className="mt-2 text-muted">
            Add each product once, then turn it into an ad in one tap.
          </p>
        </div>
        <Link
          to="/app/products/new"
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-r from-[#14132e] to-[#2b2a6b] px-6 font-semibold text-white shadow-[0_10px_24px_rgb(20_19_46/0.25)]"
        >
          <Plus className="h-5 w-5" aria-hidden="true" /> Add product
        </Link>
      </header>

      {all.length > 3 && (
        <label className="kx-rise flex min-h-12 max-w-md items-center gap-2.5 rounded-full border border-ink/10 bg-white/85 px-5 shadow-[0_8px_20px_rgb(35_34_89/0.06)]">
          <Search className="h-[18px] w-[18px] text-muted" aria-hidden="true" />
          <span className="sr-only">Search products</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products"
            className="min-w-0 flex-1 bg-transparent text-base outline-none"
          />
        </label>
      )}

      {quick.error && <FormMessage tone="error">{quick.error}</FormMessage>}
      {selected && (
        <CreatePanel
          key={selected.id}
          product={selected}
          businessName={business.name}
          busy={quick.busy !== null}
          onClose={() => setSelectedId(null)}
          onStart={(p) => void quick.start(p, selected)}
        />
      )}

      {all.length === 0 ? (
        <div className="kx-card rounded-[26px] p-10 text-center">
          <p className="text-lg">No products yet.</p>
          <p className="mt-2 text-muted">
            Start with your best-seller: a clear photo on a plain background works best.
          </p>
          <Link
            to="/app/products/new"
            className="kx-btn-gold kx-sweep mt-6 inline-flex min-h-12 items-center rounded-full px-6 font-bold"
          >
            Add your first product
          </Link>
        </div>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((product, i) => (
            <li
              key={product.id}
              className="kx-rise"
              style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
            >
              <article
                className={`kx-card kx-lift flex h-full flex-col overflow-hidden rounded-[26px] ${selectedId === product.id ? 'outline-3 outline-offset-3 outline-[#e8b04b]' : ''}`}
              >
                <div className="relative">
                  <ProductImage product={product} className="aspect-[4/3]" />
                  {product.price !== null && (
                    <span className="absolute top-3 right-3 rounded-full bg-[#14132e]/80 px-3 py-1 font-display text-base text-white backdrop-blur">
                      {formatPrice(product.price)}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h2 className="font-display text-[22px] font-medium tracking-normal normal-case">
                    {product.name}
                  </h2>
                  <p className="text-sm">
                    {product.price === null ? (
                      <span className="text-muted">Add a price to use it in offers</span>
                    ) : product.price_confirmed_at ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#1f6b5f]">
                        <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Price confirmed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#b4530a]">
                        <ShieldAlert className="h-4 w-4" aria-hidden="true" /> Confirm the price to
                        show it
                      </span>
                    )}
                  </p>
                  <div className="mt-auto flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(product.id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="kx-btn-gold inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 font-bold"
                    >
                      <Sparkles className="h-4 w-4" aria-hidden="true" /> Create ad
                    </button>
                    <Link
                      to={`/app/products/${product.id}`}
                      aria-label={`Edit ${product.name}`}
                      className="inline-flex min-h-11 w-11 items-center justify-center rounded-2xl border border-ink/15 bg-white"
                    >
                      <Pencil className="h-[18px] w-[18px]" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
