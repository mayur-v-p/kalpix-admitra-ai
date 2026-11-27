// OpenAI calls for the Edge Functions (understand-brief, generate-copy).
//
// Secrets: OPENAI_API_KEY lives only in Supabase secrets, never in the website.
// Model:   OPENAI_MODEL (default below) can be changed without code.
//
// Every call asks for Structured Outputs (a strict JSON schema), so the answer is always the
// shape we asked for or an error. Callers still check every value before use, and fall back
// to the no-AI path when this throws (no key, timeout, refusal, bad answer).

export const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';

export function openaiConfigured(): boolean {
  return Boolean(Deno.env.get('OPENAI_API_KEY'));
}

export type JsonCall = {
  /** Short schema name, letters/underscores only. */
  name: string;
  schema: Record<string, unknown>;
  system: string;
  user: string;
  timeoutMs?: number;
  /** Used only by non-reasoning models (reasoning models ignore temperature). */
  temperature?: number;
  /** Answer size limit (reasoning models count their thinking in it too). */
  maxTokens?: number;
};

export async function openaiJson<T>(call: JsonCall): Promise<T> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('openai_not_configured');
  const model = Deno.env.get('OPENAI_MODEL') || DEFAULT_OPENAI_MODEL;
  // gpt-5 / o-series are reasoning models: no temperature, and a low effort keeps them fast.
  const reasoning = /^(gpt-5|o\d)/.test(model);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(call.timeoutMs ?? 12000),
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: call.system },
        { role: 'user', content: call.user },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: call.name, strict: true, schema: call.schema },
      },
      ...(reasoning
        ? { reasoning_effort: 'low', max_completion_tokens: call.maxTokens ?? 3000 }
        : { temperature: call.temperature ?? 0.2, max_completion_tokens: call.maxTokens ?? 1200 }),
    }),
  });
  // Never log the response body: it can echo what the owner said.
  if (!res.ok) throw new Error(`openai_http_${res.status}`);
  const data = await res.json();
  const message = data?.choices?.[0]?.message;
  if (!message || message.refusal) throw new Error('openai_refused');
  if (typeof message.content !== 'string') throw new Error('openai_empty');
  return JSON.parse(message.content) as T;
}
