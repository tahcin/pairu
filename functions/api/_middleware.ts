import type { Env } from "../_lib/types";
import { json } from "../_lib/util";

// Per-IP rate limits for the endpoints that spend model or voice quota. Generous for a demo.
// Counters live in the Cloudflare Cache API rather than KV: KV's free tier allows only 1,000
// writes a day, which the cache of diagnoses and translations already uses.
const LIMITS: Record<string, { max: number; windowSec: number }> = {
  "/api/diagnose": { max: 20, windowSec: 600 },
  "/api/tts": { max: 40, windowSec: 600 },
  "/api/stt": { max: 40, windowSec: 600 },
  "/api/advice": { max: 150, windowSec: 600 },
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const rule = LIMITS[url.pathname];
  if (!rule || ctx.request.method === "OPTIONS") return ctx.next();
  const ip = ctx.request.headers.get("cf-connecting-ip") || "unknown";
  const window = Math.floor(Date.now() / 1000 / rule.windowSec);
  const key = new Request(`https://ratelimit.pairu.internal${url.pathname}/${encodeURIComponent(ip)}/${window}`);
  const cache = caches.default;
  let count = 0;
  try {
    const hit = await cache.match(key);
    if (hit) count = parseInt(await hit.text(), 10) || 0;
  } catch {
    return ctx.next();
  }
  if (count >= rule.max) {
    const retry = rule.windowSec - (Math.floor(Date.now() / 1000) % rule.windowSec);
    return json({ error: "rate_limited", retry_after_sec: retry }, 429, { "retry-after": String(retry) });
  }
  ctx.waitUntil(
    cache.put(key, new Response(String(count + 1), { headers: { "cache-control": `max-age=${rule.windowSec}` } })).catch(() => undefined),
  );
  return ctx.next();
};
