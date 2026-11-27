import { tts } from "../_lib/sarvam";
import type { Env } from "../_lib/types";
import { bad, isLang, json } from "../_lib/util";

// Returns MP3 rather than WAV (smaller on a rural mobile connection). Long text is split into
// parts under Bulbul's limit; `audios` holds the parts in order and `audio` is the first part.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { text?: string; lang?: string };
  try {
    body = await request.json();
  } catch {
    return bad("Body must be JSON");
  }
  const text = (body.text || "").trim();
  if (!text) return bad("text required");
  if (text.length > 12000) return bad("text too long", 413);
  if (!isLang(body.lang)) return bad("unsupported lang");
  try {
    const r = await tts(env, text, body.lang);
    return json({ audio: r.audios[0], audios: r.audios, mime: r.mime, cached: r.cached });
  } catch (e) {
    return json({ error: "Text to speech failed", detail: String(e).slice(0, 300) }, 502);
  }
};
