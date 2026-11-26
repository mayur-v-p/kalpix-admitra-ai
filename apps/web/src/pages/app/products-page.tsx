import { BadgeCheck, Plus, ShieldAlert } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { ButtonLink } from '@/components/ui/button';
import { useProducts } from '@/features/products/hooks';
import { ProductImage } from '@/features/products/product-image';
import { formatPrice } from '@/features/products/schemas';
import { useWorkspace } from '@/features/workspace/hooks';
import { PageError, PageHeader, PageLoading } from './page-state';

export function ProductsPage() {
  const workspace = useWorkspace();
  const products = useProducts(workspace.data?.workspace.id);

  if (workspace.isLoading || products.isLoading) return <PageLoading />;
  if (workspace.isError || !workspace.data)
    return <PageError onRetry={() => workspace.refetch()} />;
  if (!workspace.data.business) return <Navigate to="/app/onboarding" replace />;
  if (products.isError) return <PageError onRetry={() => products.refetch()} />;

  const list = products.data ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <PageHeader
          eyebrow="Library"
          title="Products"
          intro="Add each product once. Its photo, cutout and confirmed price are reused in every ad."
        />
        <ButtonLink to="/app/products/new" variant="dark" className="mb-8 w-full md:w-auto">
          <Plus className="h-5 w-5" aria-hidden="true" /> Add product
        </ButtonLink>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-10 text-center">
          <p className="text-lg">No products yet.</p>
          <p className="mt-2 text-muted">
            Start with your best-seller: a clear photo on a plain background works best.
          </p>
          <ButtonLink to="/app/products/new" variant="primary" className="mt-6">
            Add your first product
          </ButtonLink>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((product) => (
            <li key={product.id}>
              <Link
                to={`/app/products/${product.id}`}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-soft transition-colors hover:border-ink/40"
              >
                <ProductImage product={product} className="aspect-square" />
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <p className="text-lg font-medium">{product.name}</p>
                  <p className="text-muted">{formatPrice(product.price)}</p>
                  <p className="mt-auto pt-2 text-sm">
                    {product.price === null ? (
                      <span className="text-muted">Add a price to use it in offers</span>
                    ) : product.price_confirmed_at ? (
                      <span className="inline-flex items-center gap-1.5 text-indigo-deep">
                        <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Price confirmed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-lamp-deep">
                        <ShieldAlert className="h-4 w-4" aria-hidden="true" /> Price needs
                        confirming
                      </span>
                    )}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
