import { buildCard, type AdviceCard } from "../_lib/advice";
import { getData } from "../_lib/data";
import { translateMany } from "../_lib/sarvam";
import type { Env } from "../_lib/types";
import { bad, isLang, json, kvGetJSON, kvPutJSON, sha256 } from "../_lib/util";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  const lang = url.searchParams.get("lang") || "en";
  if (!isLang(lang)) return bad("unsupported lang");
  const data = await getData(env, request);
  const d = data.diseaseById.get(id);
  if (!d) return bad("unknown disease id", 404);

  const card = buildCard(d, data, lang);
  if (lang === "en") return json({ ...card, translated: false });

  const key = `adv:v1:${lang}:${await sha256(JSON.stringify(card))}`;
  const hit = await kvGetJSON<AdviceCard>(env.PAIRU_CACHE, key);
  if (hit) return json({ ...hit, translated: true, cached: true });

  // Translate every farmer-facing sentence in one batch; product names and doses stay as printed.
  const hasLocalName = Boolean(d.names?.[lang]);
  const items: string[] = [
    hasLocalName ? "" : card.name_en,
    card.favourable_conditions,
    ...card.symptoms,
    ...card.organic.map((o) => o.text),
    ...card.prevention,
    ...card.practices,
  ];
  let tr: string[];
  try {
    tr = await translateMany(env, items, lang);
  } catch (e) {
    return json({ ...card, lang: "en", translated: false, translate_error: String(e).slice(0, 200) });
  }
  let i = 0;
  const name = tr[i++];
  const out: AdviceCard = {
    ...card,
    name: hasLocalName ? card.name : name || card.name_en,
    favourable_conditions: tr[i++],
    symptoms: card.symptoms.map(() => tr[i++]),
    organic: card.organic.map((o) => ({ ...o, text: tr[i++] })),
    prevention: card.prevention.map(() => tr[i++]),
    practices: card.practices.map(() => tr[i++]),
  };
  await kvPutJSON(env.PAIRU_CACHE, key, out, 30);
  return json({ ...out, translated: true, cached: false });
};
