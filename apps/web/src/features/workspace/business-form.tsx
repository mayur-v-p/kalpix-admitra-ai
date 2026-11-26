import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormMessage, SelectField, TextAreaField, TextField } from '@/components/ui/form-field';
import { industryOptions, languageOptions } from './options';
import { businessSchema, type BusinessFormInput, type BusinessFormValues } from './schemas';

type Props = {
  defaultValues: BusinessFormInput;
  onSubmit: (values: BusinessFormValues) => Promise<void>;
  submitLabel: string;
  /** Hide the industry select when it was chosen in an earlier step. */
  showIndustry?: boolean;
  extraActions?: ReactNode;
};

/** Business details: name, industry, description, contact, languages and main address. */
export function BusinessForm({
  defaultValues,
  onSubmit,
  submitLabel,
  showIndustry = true,
  extraActions,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BusinessFormInput, unknown, BusinessFormValues>({
    resolver: zodResolver(businessSchema),
    defaultValues,
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    setSaved(false);
    try {
      await onSubmit(values);
      setSaved(true);
    } catch {
      setError('Could not save your details. Please check your connection and try again.');
    }
  });

  return (
    <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
      <TextField
        id="name"
        label="Business name"
        autoComplete="organization"
        error={errors.name?.message}
        {...register('name')}
      />
      {showIndustry && (
        <SelectField
          id="industry"
          label="Industry"
          options={industryOptions}
          error={errors.industry?.message}
          {...register('industry')}
        />
      )}
      <TextAreaField
        id="description"
        label="What do you sell?"
        optional
        hint="One or two lines. AI uses this to write ad copy; it never invents prices or offers."
        error={errors.description?.message}
        {...register('description')}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <TextField
          id="phone"
          label="Phone / WhatsApp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          optional
          placeholder="+91 98765 43210"
          hint="Shown on your ads. You will confirm it before your first export."
          error={errors.phone?.message}
          {...register('phone')}
        />
        <TextField
          id="website"
          label="Website or Instagram link"
          type="url"
          inputMode="url"
          optional
          placeholder="https://"
          error={errors.website?.message}
          {...register('website')}
        />
      </div>
      <div className="grid gap-5 md:grid-cols-[2fr_1fr]">
        <TextField
          id="address"
          label="Shop address"
          autoComplete="street-address"
          optional
          error={errors.address?.message}
          {...register('address')}
        />
        <TextField
          id="city"
          label="City"
          autoComplete="address-level2"
          optional
          error={errors.city?.message}
          {...register('city')}
        />
      </div>
      <fieldset>
        <legend className="font-medium">Ad languages</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {languageOptions.map((lang) => (
            <label
              key={lang.value}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-card px-3 has-[:checked]:border-ink has-[:checked]:bg-lamp-soft"
            >
              <input
                type="checkbox"
                value={lang.value}
                className="h-5 w-5 accent-ink"
                {...register('languages')}
              />
              {lang.label}
            </label>
          ))}
        </div>
        {errors.languages && (
          <p className="mt-1.5 text-sm text-red-700" role="alert">
            {errors.languages.message}
          </p>
        )}
      </fieldset>

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
