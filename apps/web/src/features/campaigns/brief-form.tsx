import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormMessage, SelectField, TextField } from '@/components/ui/form-field';
import type { Product } from '@/features/products/api';
import { formatPrice } from '@/features/products/schemas';
import type { Campaign } from './api';
import { campaignLanguageOptions, ctaOptions, goalOptions } from './options';
import { briefSchema, type BriefInput, type BriefValues } from './schemas';

type Props = {
  campaign?: Campaign | null;
  products: Product[];
  defaultLanguage: string;
  submitLabel: string;
  onSubmit: (values: BriefValues) => Promise<void>;
  extraActions?: ReactNode;
};

/** The campaign brief: goal, product, offer, dates, call to action and language. */
export function BriefForm({
  campaign,
  products,
  defaultLanguage,
  submitLabel,
  onSubmit,
  extraActions,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BriefInput, unknown, BriefValues>({
    resolver: zodResolver(briefSchema),
    defaultValues: {
      name: campaign?.name ?? '',
      goal: (campaign?.goal ?? 'sale') as BriefInput['goal'],
      product_id: campaign?.product_id ?? products[0]?.id ?? '',
      offer_text: campaign?.offer_text ?? '',
      start_date: campaign?.start_date ?? '',
      end_date: campaign?.end_date ?? '',
      cta: (campaign?.cta ?? 'whatsapp') as BriefInput['cta'],
      language: (campaign?.language ?? defaultLanguage) as BriefInput['language'],
    },
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      await onSubmit(values);
    } catch {
      setError('Could not save the campaign. Please try again.');
    }
  });

  return (
    <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
      <TextField
        id="name"
        label="Campaign name"
        placeholder="e.g. Chai Week"
        hint="Only you see this name."
        error={errors.name?.message}
        {...register('name')}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <SelectField id="goal" label="Goal" options={goalOptions} {...register('goal')} />
        <SelectField
          id="product_id"
          label="Product"
          options={[
            ...products.map((p) => ({
              value: p.id,
              label: p.price === null ? p.name : `${p.name} (${formatPrice(p.price)})`,
            })),
            { value: '', label: 'No specific product' },
          ]}
          {...register('product_id')}
        />
      </div>
      <TextField
        id="offer_text"
        label="Offer"
        optional
        placeholder="e.g. 20% OFF or Buy 1 Get 1"
        hint="Shown big on the ad, exactly as typed, after you confirm it."
        error={errors.offer_text?.message}
        {...register('offer_text')}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <TextField
          id="start_date"
          label="Starts"
          type="date"
          optional
          error={errors.start_date?.message}
          {...register('start_date')}
        />
        <TextField
          id="end_date"
          label="Ends"
          type="date"
          optional
          error={errors.end_date?.message}
          {...register('end_date')}
        />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <SelectField id="cta" label="Call to action" options={ctaOptions} {...register('cta')} />
        <SelectField
          id="language"
          label="Ad language"
          options={campaignLanguageOptions}
          {...register('language')}
        />
      </div>

      {error && <FormMessage tone="error">{error}</FormMessage>}

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
