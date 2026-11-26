import { zodResolver } from '@hookform/resolvers/zod';
import { ImageUp, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormMessage, SelectField } from '@/components/ui/form-field';
import { removeFile, uploadLogo, saveBrandKit, type BrandKit, type WorkspaceBundle } from './api';
import { brandDefaults } from './form-defaults';
import { useSignedUrl } from './hooks';
import { fontOptions, toneOptions } from './options';
import { brandSchema, LOGO_TYPES, validateLogo, type BrandFormValues } from './schemas';

type Props = {
  bundle: WorkspaceBundle;
  businessId: string;
  submitLabel: string;
  onSaved: (kit: BrandKit) => void;
  extraActions?: ReactNode;
};

/** Logo, colours, fonts and tone, with a live preview of how an ad will look. */
export function BrandForm({ bundle, businessId, submitLabel, onSaved, extraActions }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const existingPath = bundle.brandKit?.logo_path ?? null;
  const { data: existingUrl } = useSignedUrl(removeLogo ? null : existingPath);

  const { register, handleSubmit, control, setValue, formState } = useForm<BrandFormValues>({
    resolver: zodResolver(brandSchema),
    defaultValues: brandDefaults(bundle.brandKit),
  });
  const values = useWatch({ control });

  // Object URL for the chosen file, released when it changes or the form closes.
  const localPreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : null), [logoFile]);
  useEffect(
    () => () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    },
    [localPreview],
  );

  const onPickLogo = (file: File | undefined) => {
    if (!file) return;
    const problem = validateLogo(file);
    setLogoError(problem);
    if (!problem) {
      setLogoFile(file);
      setRemoveLogo(false);
    }
  };

  const submit = handleSubmit(async (form) => {
    setError(null);
    setSaved(false);
    try {
      let logo_path: string | null | undefined = undefined;
      if (logoFile) logo_path = await uploadLogo(bundle.workspace.id, logoFile);
      else if (removeLogo) logo_path = null;

      const kit = await saveBrandKit(
        bundle,
        businessId,
        logo_path === undefined ? form : { ...form, logo_path },
      );
      // Tidy up the replaced file only after the new one is saved.
      if (existingPath && logo_path !== undefined && existingPath !== logo_path)
        await removeFile(existingPath);
      setLogoFile(null);
      setRemoveLogo(false);
      setSaved(true);
      onSaved(kit);
    } catch {
      setError('Could not save your brand kit. Please try again.');
    }
  });

  const logoUrl = localPreview ?? existingUrl ?? null;
  const toneExample = toneOptions.find((t) => t.value === values.tone)?.example;

  return (
    <form className="grid gap-8 lg:grid-cols-[1fr_20rem]" onSubmit={submit} noValidate>
      <div className="flex flex-col gap-6">
        <fieldset>
          <legend className="font-medium">Logo</legend>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-line bg-card">
              {logoUrl ? (
                <img src={logoUrl} alt="Your logo" className="h-full w-full object-contain" />
              ) : (
                <ImageUp className="h-7 w-7 text-muted" aria-hidden="true" />
              )}
            </div>
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-ink/25 px-5 hover:border-ink focus-within:outline-2 focus-within:outline-ink">
              {logoUrl ? 'Change logo' : 'Upload logo'}
              <input
                type="file"
                accept={LOGO_TYPES.join(',')}
                className="sr-only"
                onChange={(e) => onPickLogo(e.target.files?.[0])}
              />
            </label>
            {logoUrl && (
              <Button
                variant="ghost"
                onClick={() => {
                  setLogoFile(null);
                  setRemoveLogo(true);
                }}
              >
                <X className="h-4 w-4" aria-hidden="true" /> Remove
              </Button>
            )}
          </div>
          <p className="mt-2 text-sm text-muted">
            PNG, JPG or WebP, up to 5 MB. A transparent PNG looks best.
          </p>
          {logoError && (
            <p className="mt-1 text-sm text-red-700" role="alert">
              {logoError}
            </p>
          )}
        </fieldset>

        <fieldset>
          <legend className="font-medium">Brand colours</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {(
              [
                ['primary_color', 'Main'],
                ['secondary_color', 'Background'],
                ['accent_color', 'Highlight'],
              ] as const
            ).map(([name, label]) => (
              <div
                key={name}
                className="flex items-center gap-3 rounded-xl border border-line bg-card p-2"
              >
                <input
                  type="color"
                  aria-label={`${label} colour picker`}
                  value={values[name] ?? '#000000'}
                  onChange={(e) =>
                    setValue(name, e.target.value.toUpperCase(), { shouldValidate: true })
                  }
                  className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent"
                />
                <div className="min-w-0 flex-1">
                  <label htmlFor={name} className="block text-sm text-muted">
                    {label}
                  </label>
                  <input
                    id={name}
                    className="w-full bg-transparent font-mono text-base uppercase"
                    maxLength={7}
                    {...register(name)}
                  />
                </div>
              </div>
            ))}
          </div>
          {(['primary_color', 'secondary_color', 'accent_color'] as const).map(
            (n) =>
              formState.errors[n] && (
                <p key={n} className="mt-1 text-sm text-red-700" role="alert">
                  {formState.errors[n]?.message}
                </p>
              ),
          )}
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            id="font_heading"
            label="Heading font"
            options={fontOptions}
            {...register('font_heading')}
          />
          <SelectField
            id="font_body"
            label="Text font"
            options={fontOptions}
            {...register('font_body')}
          />
        </div>

        <fieldset>
          <legend className="font-medium">Tone of voice</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {toneOptions.map((tone) => (
              <label
                key={tone.value}
                className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-line bg-card p-3 has-[:checked]:border-ink has-[:checked]:bg-lamp-soft"
              >
                <input
                  type="radio"
                  value={tone.value}
                  className="mt-1 h-5 w-5 accent-ink"
                  {...register('tone')}
                />
                <span>
                  <span className="block font-medium">{tone.label}</span>
                  <span className="block text-sm text-muted">“{tone.example}”</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && <FormMessage tone="error">{error}</FormMessage>}
        {saved && !error && <FormMessage tone="success">Brand kit saved.</FormMessage>}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {extraActions}
          <Button
            type="submit"
            variant="dark"
            size="lg"
            className="w-full sm:w-auto"
            disabled={formState.isSubmitting}
          >
            {formState.isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </div>

      {/* Live preview */}
      <aside aria-label="Preview" className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 text-sm font-medium tracking-[0.2em] text-muted uppercase">Preview</p>
        <div
          className="@container flex aspect-[4/5] flex-col justify-between rounded-2xl p-6 shadow-soft"
          style={{ backgroundColor: values.secondary_color, color: values.primary_color }}
        >
          <div className="flex items-center gap-3">
            {logoUrl && <img src={logoUrl} alt="" className="h-10 w-10 rounded object-contain" />}
            <p
              className="text-lg tracking-[0.15em] uppercase"
              style={{ fontFamily: values.font_heading }}
            >
              {bundle.business?.name ?? 'Your business'}
            </p>
          </div>
          <div>
            <p
              className="text-4xl leading-none font-medium"
              style={{ fontFamily: values.font_heading }}
            >
              20% OFF
            </p>
            <div
              className="mt-2 h-1.5 w-24 rounded-full"
              style={{ backgroundColor: values.accent_color }}
            />
            <p className="mt-4 text-base" style={{ fontFamily: values.font_body }}>
              {toneExample}
            </p>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted">
          Example only. Real ads use your confirmed offer and price.
        </p>
      </aside>
    </form>
  );
}
