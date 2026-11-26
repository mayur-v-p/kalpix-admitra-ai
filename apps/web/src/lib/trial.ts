/** Plain message for a free-try limit raised by the database (trial_limit), or null. */
export function trialLimitText(e: unknown): string | null {
  const err = e as { message?: string; details?: string; detail?: string | null } | null;
  if (err?.message !== 'trial_limit') return null;
  switch (err.details ?? err.detail) {
    case 'products':
      return 'The free try includes one product. Save your work to add more.';
    case 'campaigns':
      return 'The free try includes two campaigns. Save your work to add more.';
    case 'one_size':
      return 'The free try exports the 9:16 size only.';
    case 'daily_export':
      return 'The free try allows one export a day from this internet connection. Save your work to export more.';
    default:
      return 'This is beyond the free try. Save your work to continue.';
  }
}
