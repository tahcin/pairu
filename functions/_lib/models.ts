// Model order and quota handling shared by the first look (vision.ts) and the second look (verify.ts).
// First look: gemini-3.1-flash-lite, gemini-3.5-flash-lite, gemma-4-31b-it (short timeout, it often
// answers 503), then Claude in vision.ts only, behind its daily cap. Second look: 3.5, 3.1, Gemma.
// This is the configuration all published accuracy numbers were measured with. A model that answers 429
// RESOURCE_EXHAUSTED is skipped for the rest of the UTC day through a KV flag, so later requests
// do not wait on it.
import type { Env } from "./types";

export const FIRST_LOOK_ORDER = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemma-4-31b-it"] as const;
export const SECOND_LOOK_ORDER = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemma-4-31b-it"] as const;
export const MODEL_ORDER = FIRST_LOOK_ORDER;
const TIMEOUT: Record<string, number> = { "gemma-4-31b-it": 10000 };
const DEFAULT_TIMEOUT = 12000;

const today = () => new Date().toISOString().slice(0, 10);
const skipKey = (model: string) => `skip:${model}:${today()}`;
const memSkip = new Set<string>();

export async function isSkipped(env: Env, model: string): Promise<boolean> {
  const k = skipKey(model);
  if (memSkip.has(k)) return true;
  try {
    if (env.PAIRU_CACHE && (await env.PAIRU_CACHE.get(k))) {
      memSkip.add(k);
      return true;
    }
  } catch {
    // no flag
  }
  return false;
}

async function markExhausted(env: Env, model: string) {
  const k = skipKey(model);
  memSkip.add(k);
  try {
    await env.PAIRU_CACHE?.put(k, "1", { expirationTtl: 2 * 86400 });
  } catch {
    // memory flag still applies in this isolate
  }
}

export class QuotaError extends Error {}

// One generateContent call with an inline JPEG. Gemini models get JSON mode with the schema; Gemma
// does not support JSON mode, so the schema goes into the prompt and the JSON is read from the text.
export async function generateJson<T>(env: Env, model: string, prompt: string, imageB64: string, schema: unknown): Promise<T> {
  const gemma = model.startsWith("gemma");
  const text = gemma ? `${prompt}\n\nReply with only a JSON object that follows this JSON schema, nothing else:\n${JSON.stringify(schema)}` : prompt;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ inline_data: { mime_type: "image/jpeg", data: imageB64 } }, { text }] }],
      generationConfig: gemma ? { temperature: 0.2 } : { responseMimeType: "application/json", responseSchema: schema },
    }),
    signal: AbortSignal.timeout(TIMEOUT[model] || DEFAULT_TIMEOUT),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    if (res.status === 429 || /RESOURCE_EXHAUSTED/.test(body)) {
      await markExhausted(env, model);
      throw new QuotaError(`${model} 429`);
    }
    throw new Error(`${model} ${res.status}: ${body}`);
  }
  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
  const out = (body.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
  const a = out.indexOf("{");
  const b = out.lastIndexOf("}");
  return JSON.parse(gemma ? out.slice(a, b + 1) : out) as T;
}

// Try each model in order, skipping those flagged as exhausted today.
export async function firstThatWorks<T>(
  env: Env,
  call: (model: string) => Promise<T>,
  order: readonly string[] = FIRST_LOOK_ORDER,
): Promise<{ value: T; model: string; errors: string[] }> {
  const errors: string[] = [];
  for (const model of order) {
    if (await isSkipped(env, model)) {
      errors.push(`${model} skipped (quota)`);
      continue;
    }
    try {
      return { value: await call(model), model, errors };
    } catch (e) {
      errors.push(String(e));
    }
  }
  throw Object.assign(new Error(errors.join(" | ")), { errors });
}
