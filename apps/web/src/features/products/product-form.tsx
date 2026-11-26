import { zodResolver } from '@hookform/resolvers/zod';
import { ImageUp } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormMessage, TextAreaField, TextField } from '@/components/ui/form-field';
import { useSignedUrl } from '@/features/workspace/hooks';
import type { Product } from './api';
import { trialLimitText } from '@/lib/trial';
import {
  PHOTO_TYPES,
  productSchema,
  validatePhoto,
  type ProductFormInput,
  type ProductFormValues,
} from './schemas';

type Props = {
  product?: Product | null;
  submitLabel: string;
  onSubmit: (values: ProductFormValues, photo: File | null) => Promise<void>;
  extraActions?: ReactNode;
};

/** Photo, name, description and price. A new photo replaces the old one on save. */
export function ProductForm({ product, submitLabel, onSubmit, extraActions }: Props) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { data: existingUrl } = useSignedUrl(product?.image_path, 'product-images');
  const localUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(
    () => () => {
      if (localUrl) URL.revokeObjectURL(localUrl);
    },
    [localUrl],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? '',
      description: product?.description ?? '',
      price: product?.price === null || product?.price === undefined ? '' : String(product.price),
    },
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    setSaved(false);
    try {
      await onSubmit(values, photo);
      setPhoto(null);
      setSaved(true);
    } catch (e) {
      setError(
        trialLimitText(e) ??
          'Could not save the product. Please check your connection and try again.',
      );
    }
  });

  const preview = localUrl ?? existingUrl ?? null;

  return (
    <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
      <fieldset>
        <legend className="font-medium">Product photo</legend>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex aspect-square w-full max-w-48 items-center justify-center overflow-hidden rounded-xl border border-line bg-paper-deep">
            {preview ? (
              <img
                src={preview}
                alt="Product photo preview"
                className="h-full w-full object-contain"
              />
            ) : (
              <ImageUp className="h-8 w-8 text-muted" aria-hidden="true" />
            )}
          </div>
          <div>
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-ink/25 px-5 hover:border-ink focus-within:outline-2 focus-within:outline-ink">
              {preview ? 'Choose another photo' : 'Choose a photo'}
              <input
                type="file"
                accept={PHOTO_TYPES.join(',')}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const problem = validatePhoto(file);
                  setPhotoError(problem);
                  if (!problem) setPhoto(file);
                }}
              />
            </label>
            <p className="mt-2 text-sm text-muted">
              PNG, JPG or WebP, up to 10 MB. One product, plain background, good light.
            </p>
            {photoError && (
              <p className="mt-1 text-sm text-red-700" role="alert">
                {photoError}
              </p>
            )}
          </div>
        </div>
      </fieldset>

      <TextField
        id="name"
        label="Product name"
        error={errors.name?.message}
        {...register('name')}
      />
      <TextAreaField
        id="description"
        label="Description"
        optional
        hint="Ingredients, sizes or what makes it special. Used for ad copy."
        error={errors.description?.message}
        {...register('description')}
      />
      <TextField
        id="price"
        label="Price (₹)"
        inputMode="decimal"
        optional
        placeholder="e.g. 30 or 29.50"
        hint="Shown on ads only after you confirm it."
        error={errors.price?.message}
        {...register('price')}
      />

      {error && <FormMessage tone="error">{error}</FormMessage>}
      {saved && !error && <FormMessage tone="success">Saved.</FormMessage>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {extraActions}
        <Button
          type="submit"
          variant="dark"
          size="lg"
          className="w-full sm:w-auto"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
