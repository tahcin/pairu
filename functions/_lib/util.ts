export function json(data: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });
}

export function bad(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export async function sha256(...parts: (string | Uint8Array)[]): Promise<string> {
  const enc = new TextEncoder();
  const chunks = parts.map((p) => (typeof p === "string" ? enc.encode(p) : p));
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.length;
  }
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function kvGetJSON<T>(kv: KVNamespace | undefined, key: string): Promise<T | null> {
  if (!kv) return null;
  try {
    return (await kv.get(key, "json")) as T | null;
  } catch {
    return null;
  }
}

export async function kvPutJSON(kv: KVNamespace | undefined, key: string, value: unknown, ttlDays = 30) {
  if (!kv) return;
  try {
    await kv.put(key, JSON.stringify(value), { expirationTtl: ttlDays * 86400 });
  } catch {
    // Cache writes are best effort; the free tier allows 1,000 writes a day.
  }
}

// Language codes used in the app mapped to Sarvam's BCP-47 codes.
export const LANGS = ["te", "hi", "ta", "kn", "mr", "bn", "or", "gu", "pa", "ml", "en"] as const;
export type Lang = (typeof LANGS)[number];
// Sarvam spells Odia as "od-IN"; every other code is "<lang>-IN".
export function sarvamCode(lang: string): string {
  return lang === "or" ? "od-IN" : `${lang}-IN`;
}
export function isLang(x: unknown): x is Lang {
  return typeof x === "string" && (LANGS as readonly string[]).includes(x);
}
