// Type-only mirror of supabase/functions/_shared/copywriter.ts (Deno code, loaded at test time).
export type CopySuggestions = { headlines: string[]; captions: string[]; hashtags: string[] };
export declare function guardCopy(
  s: CopySuggestions,
  input: { businessName: string; productName: string | null },
): CopySuggestions;
