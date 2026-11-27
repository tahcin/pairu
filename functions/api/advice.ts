import { buildCard, type AdviceCard } from "../_lib/advice";
import { getData } from "../_lib/data";
import { staticSize, translateMany } from "../_lib/sarvam";
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

  const key = `adv:v3:${lang}:${data.kbTeTag}:${staticSize(lang)}:${await sha256(JSON.stringify(card))}`;
  const hit = await kvGetJSON<AdviceCard>(env.PAIRU_CACHE, key);
  if (hit) return json({ ...hit, translated: true, cached: true });

  // Reviewed Telugu from data/kb_te.json is used as is; Sarvam translates only what it lacks.
  const rv = lang === "te" ? data.kbTe.get(id) : undefined;
  const list = (field: string, n: number): (string | null)[] => {
    const v = rv?.[field];
    if (!Array.isArray(v) || v.length !== n) return new Array(n).fill(null);
    return v.map((x: unknown) => (typeof x === "string" ? x : x && typeof x === "object" && "text" in x ? String((x as { text: unknown }).text) : null));
  };
  const reviewed = {
    name: (typeof rv?.name === "string" && rv.name) || d.names?.[lang] || null,
    favourable_conditions: typeof rv?.favourable_conditions === "string" ? rv.favourable_conditions : null,
    symptoms: list("symptoms", card.symptoms.length),
    organic: list("organic_bio", card.organic.length),
    prevention: list("prevention", card.prevention.length),
    practices: list("practices", card.practices.length),
    avoid: list("avoid", card.avoid.length),
    resistance_note: typeof rv?.resistance_note === "string" ? rv.resistance_note : rv?.resistance_note && typeof rv.resistance_note === "object" && typeof rv.resistance_note.text === "string" ? rv.resistance_note.text : null,
    safety_note: typeof rv?.safety_note === "string" ? rv.safety_note : rv?.safety_note && typeof rv.safety_note === "object" && typeof rv.safety_note.text === "string" ? rv.safety_note.text : null,
    first_action: typeof rv?.first_action === "string" ? rv.first_action : rv?.first_action && typeof rv.first_action === "object" && typeof rv.first_action.text === "string" ? rv.first_action.text : null,
    etl: typeof rv?.etl === "string" ? rv.etl : rv?.etl && typeof rv.etl === "object" && typeof rv.etl.text === "string" ? rv.etl.text : null,
  };

  // Translate every remaining farmer-facing sentence in one batch; product names and doses stay as printed.
  const need = (orig: string, done: string | null) => (done ? "" : orig);
  const items: string[] = [
    reviewed.name ? "" : card.name_en,
    need(card.favourable_conditions, reviewed.favourable_conditions),
    ...card.symptoms.map((x, j) => need(x, reviewed.symptoms[j])),
    ...card.organic.map((o, j) => need(o.text, reviewed.organic[j])),
    ...card.prevention.map((x, j) => need(x, reviewed.prevention[j])),
    ...card.practices.map((x, j) => need(x, reviewed.practices[j])),
    ...card.avoid.map((x, j) => need(x.text, reviewed.avoid[j])),
    card.etl ? need(card.etl.text, reviewed.etl) : "",
    card.first_action ? need(card.first_action.text, reviewed.first_action) : "",
    card.safety_note ? need(card.safety_note.text, reviewed.safety_note) : "",
    card.resistance_note ? need(card.resistance_note.text, reviewed.resistance_note) : "",
  ];
  let tr: string[];
  try {
    tr = await translateMany(env, items, lang);
  } catch (e) {
    return json({ ...card, lang: "en", translated: false, translate_error: String(e).slice(0, 200) });
  }
  let i = 0;
  const name = tr[i++];
  const pick = (done: string | null) => {
    const t = tr[i++];
    return done || t;
  };
  const out: AdviceCard = {
    ...card,
    name: reviewed.name || name || card.name_en,
    favourable_conditions: pick(reviewed.favourable_conditions),
    symptoms: card.symptoms.map((_, j) => pick(reviewed.symptoms[j])),
    organic: card.organic.map((o, j) => ({ ...o, text: pick(reviewed.organic[j]) })),
    prevention: card.prevention.map((_, j) => pick(reviewed.prevention[j])),
    practices: card.practices.map((_, j) => pick(reviewed.practices[j])),
    avoid: card.avoid.map((x, j) => ({ ...x, text: pick(reviewed.avoid[j]) })),
  };
  const etlText = pick(reviewed.etl);
  if (card.etl) out.etl = { ...card.etl, text: etlText || card.etl.text };
  const faText = pick(reviewed.first_action);
  if (card.first_action) out.first_action = { ...card.first_action, text: faText || card.first_action.text };
  const snText = pick(reviewed.safety_note);
  if (card.safety_note) out.safety_note = { ...card.safety_note, text: snText || card.safety_note.text };
  const rnText = pick(reviewed.resistance_note);
  if (card.resistance_note) out.resistance_note = { ...card.resistance_note, text: rnText || card.resistance_note.text };
  await kvPutJSON(env.PAIRU_CACHE, key, out, 30);
  return json({ ...out, translated: true, cached: false });
};
