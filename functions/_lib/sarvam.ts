// Sarvam translate, text-to-speech and speech-to-text, with KV caching for the first two.
import type { Env } from "./types";
import { kvGetJSON, kvPutJSON, sarvamCode, sha256 } from "./util";

const BASE = "https://api.sarvam.ai";
const TRANSLATE_MODEL = "sarvam-translate:v1";
const TRANSLATE_LIMIT = 1800; // the model accepts 2,000 characters; keep a margin
const TTS_LIMIT = 2400; // bulbul accepts 2,500 characters per request
export const TTS_MODEL = "bulbul:v3";
export const TTS_SPEAKER = "priya";

async function translateOnce(env: Env, text: string, lang: string): Promise<string> {
  const res = await fetch(`${BASE}/translate`, {
    method: "POST",
    headers: { "content-type": "application/json", "api-subscription-key": env.SARVAM_API_KEY },
    body: JSON.stringify({
      input: text,
      source_language_code: "en-IN",
      target_language_code: sarvamCode(lang),
      model: TRANSLATE_MODEL,
    }),
  });
  if (!res.ok) throw new Error(`translate ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { translated_text: string };
  return body.translated_text;
}

// Pack lines into chunks under the limit. A single line longer than the limit is split on sentences.
export function chunkLines(lines: string[], limit: number): string[][] {
  const chunks: string[][] = [];
  let cur: string[] = [];
  let len = 0;
  for (const line of lines) {
    if (len + line.length + 1 > limit && cur.length) {
      chunks.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(line);
    len += line.length + 1;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

// Translate many short strings with as few calls as possible: join them with newlines, translate
// a chunk, split it back. If the line count comes back different, translate that chunk one string
// at a time so nothing gets misaligned.
// Static translations from data/kb_<lang>.json, registered by data.ts: English text -> translation.
// These answer first, so no live translation is needed for any KB text in any language.
const STATIC = new Map<string, Map<string, string>>();
const normText = (t: string) => t.replace(/\s+/g, " ").trim();
export function registerStatic(lang: string, pairs: [string, string][]) {
  const m = STATIC.get(lang) || new Map<string, string>();
  for (const [en, tr] of pairs) if (en && tr) m.set(normText(en), tr);
  STATIC.set(lang, m);
}
// Changes whenever the static translations change, so cached advice cards are rebuilt.
export function staticSize(lang: string): string {
  const m = STATIC.get(lang);
  if (!m) return "0";
  let chars = 0;
  let h = 0;
  for (const v of m.values()) {
    chars += v.length;
    for (let i = 0; i < v.length; i += 7) h = (h * 31 + v.charCodeAt(i)) >>> 0;
  }
  return `${m.size}.${chars}.${h.toString(36)}`;
}
export function staticTranslation(text: string, lang: string): string | undefined {
  return STATIC.get(lang)?.get(normText(text));
}

export async function translateMany(env: Env, items: string[], lang: string): Promise<string[]> {
  if (lang === "en") return items;
  const out = new Array<string>(items.length);
  const stat = STATIC.get(lang);
  if (stat) items.forEach((text, i) => {
    const hit = text && stat.get(normText(text));
    if (hit) out[i] = hit;
  });
  if (out.filter((x) => x !== undefined).length === items.length) return out;
  const todo: { i: number; text: string }[] = [];
  await Promise.all(
    items.map(async (text, i) => {
      if (out[i] !== undefined) return;
      const t = text.replace(/\s*\n\s*/g, " ").trim();
      if (!t) {
        out[i] = text;
        return;
      }
      const hit = await kvGetJSON<string>(env.PAIRU_CACHE, `tr:${lang}:${await sha256(t)}`);
      if (hit) out[i] = hit;
      else todo.push({ i, text: t });
    }),
  );
  if (!todo.length) return out;
  todo.sort((a, b) => a.i - b.i);
  const groups = chunkLines(todo.map((t) => t.text), TRANSLATE_LIMIT);
  let k = 0;
  const jobs: Promise<void>[] = [];
  for (const group of groups) {
    const slice = todo.slice(k, k + group.length);
    k += group.length;
    jobs.push(
      (async () => {
       try {
        let parts: string[] | null = null;
        if (group.join("\n").length <= TRANSLATE_LIMIT) {
          const joined = await translateOnce(env, group.join("\n"), lang);
          const split = joined.split(/\n+/).map((s) => s.trim()).filter(Boolean);
          if (split.length === group.length) parts = split;
        }
        if (!parts) {
          parts = [];
          for (const g of group) parts.push(await translateOnce(env, g.slice(0, TRANSLATE_LIMIT), lang));
        }
        for (let j = 0; j < slice.length; j++) {
          out[slice[j].i] = parts[j];
          await kvPutJSON(env.PAIRU_CACHE, `tr:${lang}:${await sha256(slice[j].text)}`, parts[j], 90);
        }
       } catch {
        // Live translation unavailable (for example Sarvam out of credits): keep the English for
        // these few strings rather than failing the whole card.
        for (const t of slice) if (out[t.i] === undefined) out[t.i] = t.text;
       }
      })(),
    );
  }
  await Promise.all(jobs);
  return out;
}

// Split text for TTS on sentence ends (including the Devanagari danda) under the limit.
export function splitForSpeech(text: string, limit = TTS_LIMIT): string[] {
  const sentences = text.split(/(?<=[.!?।\n])\s+/);
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (s.length > limit) {
      if (cur) out.push(cur);
      cur = "";
      for (let i = 0; i < s.length; i += limit) out.push(s.slice(i, i + limit));
      continue;
    }
    if ((cur + " " + s).length > limit && cur) {
      out.push(cur);
      cur = s;
    } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

export async function tts(env: Env, text: string, lang: string): Promise<{ audios: string[]; mime: string; cached: boolean }> {
  const key = `tts:${TTS_MODEL}:${TTS_SPEAKER}:16k:${lang}:${await sha256(text)}`;
  const hit = await kvGetJSON<{ audios: string[]; mime: string }>(env.PAIRU_CACHE, key);
  if (hit) return { ...hit, cached: true };
  const parts = splitForSpeech(text);
  const audios = await Promise.all(
    parts.map(async (p) => {
      const res = await fetch(`${BASE}/text-to-speech`, {
        method: "POST",
        headers: { "content-type": "application/json", "api-subscription-key": env.SARVAM_API_KEY },
        body: JSON.stringify({
          text: p,
          language_code: sarvamCode(lang),
          speaker: TTS_SPEAKER,
          model: TTS_MODEL,
          output_audio_codec: "mp3",
          speech_sample_rate: 16000,
          pace: 0.95,
        }),
      });
      if (!res.ok) throw new Error(`tts ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { audios: string[] };
      return body.audios.join("");
    }),
  );
  const value = { audios, mime: "audio/mpeg" };
  await kvPutJSON(env.PAIRU_CACHE, key, value, 30);
  return { ...value, cached: false };
}

export async function stt(env: Env, file: File, lang: string | null): Promise<{ text: string; lang: string | null }> {
  // Browsers label recordings like "audio/webm;codecs=opus", which Sarvam rejects; send the bare type.
  const type = (file.type || "audio/webm").split(";")[0].trim() || "application/octet-stream";
  const clean = new File([await file.arrayBuffer()], file.name || "audio.webm", { type });
  const form = new FormData();
  form.append("file", clean, clean.name);
  form.append("model", "saarika:v2.5");
  form.append("language_code", lang ? sarvamCode(lang) : "unknown");
  const res = await fetch(`${BASE}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": env.SARVAM_API_KEY },
    body: form,
  });
  if (!res.ok) throw new Error(`stt ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { transcript: string; language_code?: string };
  const code = body.language_code ? body.language_code.split("-")[0] : lang;
  return { text: body.transcript, lang: code === "od" ? "or" : code };
}

// Farmer's words (any supported language) to English, for matching against KB symptoms.
export async function toEnglish(env: Env, text: string, lang: string): Promise<string> {
  if (lang === "en") return text;
  const res = await fetch(`${BASE}/translate`, {
    method: "POST",
    headers: { "content-type": "application/json", "api-subscription-key": env.SARVAM_API_KEY },
    body: JSON.stringify({ input: text.slice(0, 1800), source_language_code: sarvamCode(lang), target_language_code: "en-IN", model: TRANSLATE_MODEL }),
  });
  if (!res.ok) throw new Error(`translate ${res.status}`);
  return ((await res.json()) as { translated_text: string }).translated_text;
}
