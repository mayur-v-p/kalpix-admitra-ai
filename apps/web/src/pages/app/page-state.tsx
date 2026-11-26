import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';

export function PageLoading() {
  return (
    <div className="flex min-h-64 items-center justify-center" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-ink" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function PageError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-lg">
      <FormMessage tone="error">
        We could not load your workspace. Please check your connection.
      </FormMessage>
      <Button variant="outline" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
}) {
  return (
    <div className="mb-8 max-w-2xl">
      {eyebrow && (
        <p className="mb-2 text-sm font-medium tracking-[0.25em] text-sage-deep uppercase">
          {eyebrow}
        </p>
      )}
      <h1 className="text-3xl uppercase md:text-4xl">{title}</h1>
      {intro && <p className="mt-3 text-muted">{intro}</p>}
    </div>
  );
}
