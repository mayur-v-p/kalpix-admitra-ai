import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { detectProduct, type VoiceBrief } from './parse';

/**
 * AI understanding of "Speak your ad" (Edge Function understand-brief, OpenAI on the server).
 *
 * Optional by design: with no key on the server, an error, or no answer within 20 seconds,
 * this gives null and the screen keeps what Kalpix's own parser understood. Either way the
 * owner checks, edits and confirms every value before it can appear on an ad.
 */
const TIMEOUT_MS = 20000;

export async function understandBrief(
  text: string,
  productNames: string[],
): Promise<VoiceBrief | null> {
  const call = supabase.functions
    .invoke<{ brief: VoiceBrief }>('understand-brief', {
      body: { text: text.slice(0, 600), products: productNames.slice(0, 50) },
    })
    .then(({ data, error }) => (error || !data?.brief ? null : data.brief))
    .catch(() => null);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
  return Promise.race([call, timeout]);
}

/**
 * Puts the two readings together: the AI's values win, the parser fills anything the AI left
 * out. The product is matched to the owner's library, so an existing product (and its photo)
 * is reused.
 */
export function mergeBriefs(
  basic: VoiceBrief,
  ai: VoiceBrief | null,
  library: { id: string; name: string }[],
): VoiceBrief {
  if (!ai) return basic;
  const merged: VoiceBrief = { ...basic };
  for (const [k, value] of Object.entries(ai) as [keyof VoiceBrief, unknown][]) {
    if (value !== undefined && value !== null && k !== 'productId')
      (merged as Record<string, unknown>)[k] = value;
  }
  if (ai.product) {
    const name = ai.product.toLowerCase();
    const exact = library.find((p) => p.name.toLowerCase() === name);
    const found = exact
      ? { product: exact.name, productId: exact.id }
      : detectProduct(ai.product, library);
    if (found.productId) {
      merged.product = found.product ?? ai.product;
      merged.productId = found.productId;
    } else if (name !== basic.product?.toLowerCase()) {
      // A different product than the parser's guess: drop the parser's library match.
      merged.productId = undefined;
    }
  }
  return merged;
}

/** Runs once per sentence; the result is cached, so going back and forth costs nothing. */
export function useAiBrief(transcript: string, productNames: string[] | undefined) {
  return useQuery({
    queryKey: ['ai-brief', transcript, productNames?.join('|') ?? ''],
    queryFn: () => understandBrief(transcript, productNames ?? []),
    enabled: Boolean(transcript.trim()) && productNames !== undefined,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  });
}
