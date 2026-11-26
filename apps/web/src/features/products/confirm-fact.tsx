import { BadgeCheck, ShieldAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type Props = {
  /** What is being confirmed, e.g. "price" or "phone number". */
  label: string;
  /** The exact value that will appear on ads. */
  value: ReactNode;
  confirmedAt: string | null;
  onConfirm: () => Promise<void>;
  disabled?: boolean;
};

/**
 * PRD rule: prices, phone numbers and addresses appear on ads only after the owner confirms
 * them. Shows the state and asks for an explicit "yes, this is correct".
 */
export function ConfirmFact({ label, value, confirmedAt, onConfirm, disabled }: Props) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (confirmedAt) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-indigo-soft px-4 py-3 text-ink">
        <BadgeCheck className="h-5 w-5 shrink-0 text-indigo-deep" aria-hidden="true" />
        <span>
          {value} confirmed on{' '}
          {new Date(confirmedAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-lamp-deep/40 bg-lamp-soft p-4">
      <p className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-lamp-deep" aria-hidden="true" />
        <span>
          This {label} is not confirmed yet. Ads will only show it after you confirm it is correct.
        </span>
      </p>
      {asking ? (
        <div className="mt-3">
          <p className="font-medium">
            Is <span className="underline decoration-lamp-deep decoration-2">{value}</span> the
            correct {label} customers should see?
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="dark"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await onConfirm();
                  setAsking(false);
                } catch {
                  setError(`Could not confirm the ${label}. Please try again.`);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Confirming…' : `Yes, confirm ${label}`}
            </Button>
            <Button variant="ghost" onClick={() => setAsking(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          className="mt-3"
          onClick={() => setAsking(true)}
          disabled={disabled}
        >
          Confirm {label}
        </Button>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
