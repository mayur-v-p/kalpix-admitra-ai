import { ImageOff, Loader2 } from 'lucide-react';
import { useSignedUrl } from '@/features/workspace/hooks';
import { cn } from '@/lib/utils';
import type { Product } from './api';

/** Shows the cutout when ready, otherwise the original photo, on a checkerboard backdrop. */
export function ProductImage({ product, className }: { product: Product; className?: string }) {
  const path =
    product.cutout_status === 'ready' && product.cutout_path
      ? product.cutout_path
      : product.image_path;
  const { data: url } = useSignedUrl(path, 'product-images');
  const working = product.cutout_status === 'pending' || product.cutout_status === 'processing';

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden bg-paper-deep',
        'bg-[length:16px_16px] bg-[linear-gradient(45deg,#e6e2d8_25%,transparent_25%,transparent_75%,#e6e2d8_75%),linear-gradient(45deg,#e6e2d8_25%,transparent_25%,transparent_75%,#e6e2d8_75%)] bg-[position:0_0,8px_8px]',
        className,
      )}
    >
      {url ? (
        <img src={url} alt={product.name} className="h-full w-full object-contain" />
      ) : (
        <ImageOff className="h-8 w-8 text-concrete" aria-label="No photo" />
      )}
      {working && (
        <span className="absolute right-2 bottom-2 inline-flex items-center gap-1.5 rounded-full bg-ink/80 px-3 py-1 text-sm text-paper">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Removing background
        </span>
      )}
    </div>
  );
}
