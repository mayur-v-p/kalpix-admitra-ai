import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';
import { CODE, startEnrollment, verifyCode, type Enrollment } from './mfa';

function CodeInput({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  id: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">
        6-digit code from your authenticator app
      </label>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="min-h-12 w-40 rounded-xl border border-line bg-paper px-4 text-lg tracking-[0.4em]"
      />
    </div>
  );
}

/** Ask for the current code (the user already has an authenticator). */
export function MfaChallenge({ factorId, onDone }: { factorId: string; onDone: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await verifyCode(factorId, code);
    setBusy(false);
    if (ok) onDone();
    else {
      setError(true);
      setCode('');
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <CodeInput id="mfa-code" value={code} onChange={setCode} />
      {error && <FormMessage tone="error">That code did not work. Try the newest one.</FormMessage>}
      <Button type="submit" variant="dark" disabled={!CODE.test(code) || busy} className="w-fit">
        {busy ? 'Checking…' : 'Verify'}
      </Button>
    </form>
  );
}

/** Turn on two-step login: scan the QR code, then confirm with a code. */
export function MfaSetup({ onDone }: { onDone: () => void }) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const begin = async () => {
    setError(null);
    setBusy(true);
    try {
      setEnrollment(await startEnrollment());
    } catch {
      setError('Two-step login could not be started. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollment) return;
    setBusy(true);
    const ok = await verifyCode(enrollment.factorId, code);
    setBusy(false);
    if (ok) onDone();
    else {
      setError('That code did not work. Check the time on your phone and try the newest code.');
      setCode('');
    }
  };

  if (!enrollment)
    return (
      <div className="flex flex-col gap-3">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <Button variant="dark" className="w-fit" onClick={() => void begin()} disabled={busy}>
          {busy ? 'Starting…' : 'Turn on two-step login'}
        </Button>
      </div>
    );

  return (
    <form onSubmit={confirm} className="flex flex-col gap-4">
      <ol className="list-decimal space-y-2 pl-5">
        <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, Authy).</li>
        <li>Scan this QR code, or type the key below.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <img
        src={enrollment.qrCode}
        alt="QR code for your authenticator app"
        className="h-48 w-48 rounded-xl border border-line bg-white p-2"
      />
      <p className="text-sm break-all text-muted">
        Key: <code className="text-ink">{enrollment.secret}</code>
      </p>
      <CodeInput id="mfa-setup-code" value={code} onChange={setCode} />
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Button type="submit" variant="dark" disabled={!CODE.test(code) || busy} className="w-fit">
        {busy ? 'Checking…' : 'Confirm and turn on'}
      </Button>
    </form>
  );
}
