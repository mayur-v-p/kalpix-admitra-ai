import type { ReactNode } from 'react';

/**
 * The v3 headline: the first half of the words thin, the rest bold ("Simple plans" thin,
 * "in rupees" bold). The words and spaces stay the same, so screen readers read it normally.
 */
export function ThinBold({ text, accentLast = false }: { text: ReactNode; accentLast?: boolean }) {
  if (typeof text !== 'string') return <>{text}</>;
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return <span className="font-bold">{text}</span>;
  const cut = Math.ceil(words.length / 2);
  const thin = words.slice(0, cut).join(' ');
  const bold = words.slice(cut);
  const last = bold.pop()!;
  return (
    <>
      <span className="font-light">{thin}</span>{' '}
      <span className="font-bold">
        {bold.length > 0 && `${bold.join(' ')} `}
        <span className={accentLast ? 'text-blue' : undefined}>{last}</span>
      </span>
    </>
  );
}
