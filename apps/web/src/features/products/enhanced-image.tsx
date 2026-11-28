import { Check, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';
import { useSignedUrl } from '@/features/workspace/hooks';
import { cn } from '@/lib/utils';
import { chooseProductImage, CutoutError, requestEnhancedImage, type Product } from './api';

const messages: Record<string, string> = {
  rate_limited: 'You have enhanced a lot of photos this hour. Please try again later.',
  already_processing: 'The photo is already being enhanced.',
  image_changed: 'The photo changed while it was being enhanced. Please try again.',
  no_image: 'Add a photo first.',
};

/**
 * "Your photo for ads": the owner's whole photo (no cut-out) and its AI-enhanced version
 * (better light, colour and background; the product kept the same). The enhanced one is used
 * by default once it is ready; the owner can switch back to the original any time.
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
  const originalUrl = useSignedUrl(product.image_path, 'product-images');
  const enhancedUrl = useSignedUrl(product.enhanced_path, 'product-images');
  const ready = product.enhanced_status === 'ready' && Boolean(product.enhanced_path);
  const working = busy || product.enhanced_status === 'processing';
  const testMode = product.enhanced_provider === 'mock';

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

  return (
    <section aria-labelledby="photo-heading">
      <h2
        id="photo-heading"
        className="mb-1 font-sans text-base font-medium tracking-normal normal-case"
      >
        Your photo for ads
      </h2>
      {!product.image_path ? (
        <p className="text-sm text-muted">
          No photo yet. Kalpix makes AI pictures from the product name below; add your real photo
          any time for the best ads.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">
            {ready && !testMode
              ? 'AI made your photo ad-ready: better light, colour and background, same product. Pick which one ads use.'
              : 'Kalpix makes your photo ad-ready with AI: better light, colour and background, same product.'}
            {testMode ? ' Test mode: the photo is not changed.' : ''}
          </p>

          <div
            role="radiogroup"
            aria-label="Photo used on ads"
            className="mt-3 grid grid-cols-2 gap-2"
          >
            {[
              { key: false, label: 'Your photo', url: originalUrl.data, show: true },
              { key: true, label: 'Enhanced by AI', url: enhancedUrl.data, show: ready },
            ].map((o) =>
              o.show ? (
                <button
                  key={o.label}
                  type="button"
                  role="radio"
                  aria-checked={product.use_enhanced === o.key}
                  disabled={busy || !ready}
                  onClick={() => run(() => chooseProductImage(product.id, o.key))}
                  className={cn(
                    'flex flex-col gap-1.5 rounded-xl border p-1.5 text-left text-sm',
                    product.use_enhanced === o.key ? 'border-lamp bg-lamp-soft' : 'border-line',
                  )}
                >
                  <span className="block aspect-[4/5] w-full overflow-hidden rounded-lg bg-paper-deep">
                    {o.url && <img src={o.url} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <span className="flex items-center gap-1 px-1 font-medium">
                    {product.use_enhanced === o.key && (
                      <Check className="h-4 w-4 text-lamp-deep" aria-hidden="true" />
                    )}
                    {o.label}
                  </span>
                  {product.use_enhanced === o.key && (
                    <span className="px-1 text-xs text-muted">Used on ads</span>
                  )}
                </button>
              ) : (
                <div
                  key={o.label}
                  className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line p-3 text-center text-sm text-muted"
                >
                  <Sparkles
                    className={cn('h-5 w-5 text-lamp', working && 'animate-pulse')}
                    aria-hidden="true"
                  />
                  {working ? 'Enhancing with AI… about 20 seconds' : 'Enhanced version'}
                </div>
              ),
            )}
          </div>

          {product.enhanced_status === 'failed' && !error && (
            <div className="mt-3">
              <FormMessage tone="error">The photo could not be enhanced.</FormMessage>
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
            disabled={working}
            onClick={() => run(() => requestEnhancedImage(product.id))}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {working ? 'Enhancing…' : ready ? 'Make a new version' : 'Enhance with AI'}
          </Button>
        </>
      )}
    </section>
  );
}
