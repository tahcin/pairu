import { getData } from "../_lib/data";
import { matchSpoken, symptomList } from "../_lib/describe";
import { toEnglish, translateMany } from "../_lib/sarvam";
import type { Env } from "../_lib/types";
import { bad, isLang, json } from "../_lib/util";

// GET /api/symptoms?crop=paddy&lang=te: symptom statements for the crop, translated.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const crop = url.searchParams.get("crop") || "";
  const lang = url.searchParams.get("lang") || "en";
  if (!isLang(lang)) return bad("unsupported lang");
  const data = await getData(env, request);
  if (!data.kb.crops.some((c) => c.id === crop)) return bad("unknown crop");
  const items = symptomList(data, crop);
  // Reviewed Telugu where kb_te.json has it, Sarvam for the rest.
  const reviewed = items.map((it) => {
    if (lang !== "te") return null;
    const [id, i] = it.key.split(":");
    const v = data.kbTe.get(id)?.symptoms?.[Number(i)];
    return typeof v === "string" ? v : null;
  });
  let texts = items.map((it) => it.text);
  try {
    const tr = await translateMany(env, items.map((it, j) => (reviewed[j] ? "" : it.text)), lang);
    texts = items.map((_, j) => reviewed[j] || tr[j]);
  } catch {
    // Fall back to English only if translation is down; the client shows a notice.
    return json({ items, lang: "en" });
  }
  return json({ items: items.map((it, j) => ({ ...it, text: texts[j] })), lang });
};

// POST /api/symptoms {crop, text}: which statements the farmer's spoken words match.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { crop?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return bad("Body must be JSON");
  }
  const data = await getData(env, request);
  if (!body.crop || !data.kb.crops.some((c) => c.id === body.crop)) return bad("unknown crop");
  const text = (body.text || "").trim();
  if (!text) return json({ keys: [] });
  let english = text;
  try {
    english = await toEnglish(env, text);
  } catch {
    // Use the words as given.
  }
  return json({ keys: matchSpoken(symptomList(data, body.crop), english), english });
};
