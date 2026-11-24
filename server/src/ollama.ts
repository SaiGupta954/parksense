import { reconcile } from './reconcile.js';
import {
  ReadSchema,
  SIGN_JSON_SCHEMA,
  STRICT_REMINDER,
  SYSTEM_PROMPT,
  type ReadResult,
} from './schema.js';

export const PREFERRED_MODELS = ['qwen2.5vl:7b', 'gemma3:4b', 'llama3.2-vision'] as const;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

export interface OllamaClient {
  url: string;
  listModels(): Promise<string[]>;
  chat(model: string, messages: ChatMessage[]): Promise<string>;
}

export class OllamaError extends Error {
  constructor(
    message: string,
    readonly code: 'unreachable' | 'timeout' | 'bad_response',
  ) {
    super(message);
  }
}

type FetchLike = typeof fetch;

export function createOllamaClient(
  url: string,
  { fetchImpl = fetch, timeoutMs = 120_000 }: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): OllamaClient {
  const base = url.replace(/\/+$/, '');
  return {
    url: base,
    async listModels() {
      let res: Response;
      try {
        res = await fetchImpl(`${base}/api/tags`, { signal: AbortSignal.timeout(3000) });
      } catch {
        throw new OllamaError('Ollama is not reachable', 'unreachable');
      }
      if (!res.ok) throw new OllamaError(`Ollama /api/tags returned ${res.status}`, 'bad_response');
      const body = (await res.json()) as { models?: Array<{ name?: string; model?: string }> };
      return (body.models ?? []).map((m) => m.name ?? m.model ?? '').filter(Boolean);
    },
    async chat(model, messages) {
      let res: Response;
      try {
        res = await fetchImpl(`${base}/api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model,
            messages,
            stream: false,
            format: SIGN_JSON_SCHEMA,
            options: { temperature: 0 },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
          throw new OllamaError('The model took too long to answer', 'timeout');
        }
        throw new OllamaError('Ollama is not reachable', 'unreachable');
      }
      if (!res.ok) throw new OllamaError(`Ollama /api/chat returned ${res.status}`, 'bad_response');
      const body = (await res.json()) as { message?: { content?: string } };
      return body.message?.content ?? '';
    },
  };
}

/** First preferred model that is installed. Accepts "name", "name:latest" and "name:<tag>" forms. */
export function pickModel(installed: readonly string[], prefs: readonly string[]): string | null {
  for (const pref of prefs) {
    const hasTag = pref.includes(':');
    const found = installed.find(
      (name) =>
        name === pref || (!hasTag && (name === `${pref}:latest` || name.startsWith(`${pref}:`))),
    );
    if (found) return found;
  }
  return null;
}

function parseModelJson(text: string): ReadResult | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const parsed = ReadSchema.safeParse(json);
  if (!parsed.success) return null;
  const signs = [...parsed.data.signs]
    .sort((a, b) => a.order - b.order)
    .map((s) => (s.anytime ? { ...s, start: null, end: null } : s));
  return reconcile({ ...parsed.data, signs });
}

export type ReadOutcome =
  { ok: true; result: ReadResult; attempts: number } | { ok: false; attempts: number };

/** Ask the model to transcribe the signs. Retries once with a stricter reminder if the JSON is invalid. */
export async function readSignWithModel(
  client: OllamaClient,
  model: string,
  imageBase64: string,
): Promise<ReadOutcome> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: 'Transcribe every parking sign on this pole, top to bottom, as JSON.',
      images: [imageBase64],
    },
  ];
  const first = await client.chat(model, messages);
  const firstParsed = parseModelJson(first);
  if (firstParsed) return { ok: true, result: firstParsed, attempts: 1 };

  const retry = await client.chat(model, [
    ...messages,
    { role: 'assistant', content: first.slice(0, 4000) },
    { role: 'user', content: STRICT_REMINDER },
  ]);
  const retryParsed = parseModelJson(retry);
  if (retryParsed) return { ok: true, result: retryParsed, attempts: 2 };
  return { ok: false, attempts: 2 };
}
