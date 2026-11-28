import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';
import {
  confirmProductPrice,
  createProduct,
  deleteProduct,
  requestEnhancedImage,
  updateProduct,
} from '@/features/products/api';
import { ConfirmFact } from '@/features/products/confirm-fact';
import { EnhancedImage } from '@/features/products/enhanced-image';
import { productKey, productsKey, useProduct } from '@/features/products/hooks';
import { ProductForm } from '@/features/products/product-form';
import { ProductPictures } from '@/features/products/product-pictures';
import { formatPrice } from '@/features/products/schemas';
import { useWorkspace } from '@/features/workspace/hooks';
import { PageError, PageHeader, PageLoading } from './page-state';

/** Set when the page opens right after saving: the first AI pictures are made straight away. */
type ProductPageState = { makePictures?: boolean } | null;

/** /app/products/new and /app/products/:id */
export function ProductPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { state } = useLocation() as { state: ProductPageState };
  const queryClient = useQueryClient();
  const workspace = useWorkspace();
  const product = useProduct(id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (workspace.isLoading || (!isNew && product.isLoading)) return <PageLoading />;
  if (workspace.isError || !workspace.data)
    return <PageError onRetry={() => workspace.refetch()} />;
  const { business, workspace: ws } = workspace.data;
  if (!business) return <Navigate to="/app/onboarding" replace />;
  if (!isNew && (product.isError || !product.data)) {
    return (
      <div className="mx-auto max-w-lg">
        <FormMessage tone="error">This product does not exist or was deleted.</FormMessage>
        <Link to="/app/products" className="mt-4 inline-flex min-h-11 items-center underline">
          Back to products
        </Link>
      </div>
    );
  }

  const refresh = async (productId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: productsKey(ws.id) }),
      productId && queryClient.invalidateQueries({ queryKey: productKey(productId) }),
    ]);
  };

  // A new photo is made ad-ready with AI straight away (no cut-out); the card shows progress.
  const enhance = async (productId: string) => {
    try {
      await requestEnhancedImage(productId);
    } catch {
      // The photo card shows the failed state and a "try again" button.
    } finally {
      await refresh(productId);
    }
  };

  const current = product.data ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to="/app/products"
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All products
      </Link>
      <PageHeader
        eyebrow="Products"
        title={isNew ? 'Add a product' : (current?.name ?? 'Product')}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <div className="rounded-2xl border border-line bg-card p-5 shadow-soft md:p-8">
            <ProductForm
              product={current}
              submitLabel={isNew ? 'Save product' : 'Save changes'}
              onSubmit={async (values, photo) => {
                if (isNew) {
                  const created = await createProduct(
                    { workspaceId: ws.id, businessId: business.id },
                    values,
                    photo,
                  );
                  await refresh(created.id);
                  navigate(`/app/products/${created.id}`, {
                    replace: true,
                    state: { makePictures: true } satisfies ProductPageState,
                  });
                  if (created.image_path) void enhance(created.id);
                } else if (current) {
                  const updated = await updateProduct(current, values, photo);
                  await refresh(updated.id);
                  if (photo) void enhance(updated.id);
                }
              }}
            />
          </div>
          {current && (
            <ProductPictures product={current} autoStart={Boolean(state?.makePictures)} />
          )}
        </div>

        {current && (
          <aside className="flex flex-col gap-6" aria-label="Ad readiness">
            <EnhancedImage product={current} onChanged={() => refresh(current.id)} />

            <section>
              <h2 className="mb-2 font-sans text-base font-medium tracking-normal normal-case">
                Price on ads
              </h2>
              {current.price === null ? (
                <p className="text-muted">Add a price to use this product in offers.</p>
              ) : (
                <ConfirmFact
                  label="price"
                  value={formatPrice(current.price)}
                  confirmedAt={current.price_confirmed_at}
                  onConfirm={async () => {
                    await confirmProductPrice(current.id);
                    await refresh(current.id);
                  }}
                />
              )}
            </section>

            <section className="border-t border-line pt-6">
              {confirmDelete ? (
                <div className="flex flex-col gap-2">
                  <p>Delete “{current.name}” and its photos? This cannot be undone.</p>
                  <Button
                    variant="dark"
                    className="bg-red-700 hover:bg-red-800"
                    disabled={deleting}
                    onClick={async () => {
                      setDeleting(true);
                      try {
                        await deleteProduct(current);
                        await refresh();
                        navigate('/app/products', { replace: true });
                      } finally {
                        setDeleting(false);
                      }
                    }}
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete product'}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full text-red-700"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete product
                </Button>
              )}
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
