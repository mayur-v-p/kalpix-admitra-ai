import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';
import { useSignedUrl } from '@/features/workspace/hooks';
import { cn } from '@/lib/utils';
import { chooseProductImage, CutoutError, requestEnhancedImage, type Product } from './api';

const messages: Record<string, string> = {
  rate_limited: 'You have enhanced a lot of images this hour. Please try again later.',
  already_processing: 'The image is already being enhanced.',
  image_changed: 'The photo changed while it was being enhanced. Please try again.',
  no_image: 'Add a photo first.',
};

/**
 * PRD 4.1: the ad may use an AI-enhanced version of the product instead of the exact photo.
 * The owner always compares and chooses; nothing changes on an ad until they do.
 */
export function EnhancedImage({
  product,
  onChanged,
}: {
  product: Product;
  onChanged: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const original =
    product.cutout_status === 'ready' && product.cutout_path
      ? product.cutout_path
      : product.image_path;
  const originalUrl = useSignedUrl(original, 'product-images');
  const enhancedUrl = useSignedUrl(product.enhanced_path, 'product-images');
  const ready = product.enhanced_status === 'ready' && Boolean(product.enhanced_path);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setError(
        (e instanceof CutoutError && messages[e.code]) || 'That did not work. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!product.image_path) return null;

  return (
    <section aria-labelledby="enhanced-heading">
      <h2
        id="enhanced-heading"
        className="mb-1 font-sans text-base font-medium tracking-normal normal-case"
      >
        AI-enhanced image
      </h2>
      <p className="text-sm text-muted">
        Optional: a cleaner, brighter version of the product for your ads. You choose which one is
        used.
        {product.enhanced_provider === 'mock' ? ' Test mode: the image is not changed yet.' : ''}
      </p>

      {ready && (
        <div
          role="radiogroup"
          aria-label="Image used on ads"
          className="mt-3 grid grid-cols-2 gap-2"
        >
          {[
            { key: false, label: 'Original', url: originalUrl.data },
            { key: true, label: 'AI-enhanced', url: enhancedUrl.data },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={product.use_enhanced === o.key}
              disabled={busy}
              onClick={() => run(() => chooseProductImage(product.id, o.key))}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl border p-2 text-sm',
                product.use_enhanced === o.key ? 'border-ink bg-lamp-soft' : 'border-line',
              )}
            >
              <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-paper-deep">
                {o.url && <img src={o.url} alt="" className="h-full w-full object-contain" />}
              </span>
              {o.label}
              {product.use_enhanced === o.key && <span className="text-xs">Used on ads</span>}
            </button>
          ))}
        </div>
      )}

      {product.enhanced_status === 'failed' && !error && (
        <div className="mt-3">
          <FormMessage tone="error">The image could not be enhanced.</FormMessage>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      )}
      <Button
        variant="outline"
        className="mt-3 w-full"
        disabled={busy || product.enhanced_status === 'processing'}
        onClick={() => run(() => requestEnhancedImage(product.id))}
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        {busy || product.enhanced_status === 'processing'
          ? 'Enhancing…'
          : ready
            ? 'Make a new version'
            : 'Enhance with AI'}
      </Button>
    </section>
  );
}
