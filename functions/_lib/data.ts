// Loads the built data files. They are served as static assets under /data/ (copied there at
// build time by scripts/copy-data.mjs) and read through the ASSETS binding, so the Worker bundle
// stays small however large the CIB&RC register grows.
import type { Banned, Disease, Env, Hazard, KB, RegisteredUse } from "./types";
import { registerStatic } from "./sarvam";

export interface Data {
  kb: KB;
  uses: RegisteredUse[];
  banned: Banned[];
  hazard: Hazard;
  diseaseById: Map<string, Disease>;
  // Reviewed Telugu for KB text (data/kb_te.json), keyed by disease id; empty until that file exists.
  kbTe: Map<string, Record<string, any>>;
  kbTeTag: string;
  kbTeQuestions: Record<string, string> | null;
}

let cached: Promise<Data> | null = null;

async function load<T>(env: Env, origin: string, name: string, fallback: T): Promise<T> {
  try {
    const res = await env.ASSETS.fetch(new URL(`/data/${name}`, origin).toString());
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

const STATIC_LANGS = ["hi", "ta", "kn", "mr", "bn", "or", "gu", "pa", "ml"];

function registerKb(kb: KB, lang: string, doc: any) {
  const ds = doc?.diseases;
  if (!ds || typeof ds !== "object") return;
  const pairs: [string, string][] = [];
  const str = (x: unknown) => (typeof x === "string" ? x : x && typeof x === "object" && "text" in (x as object) ? String((x as { text: unknown }).text) : "");
  const list = (en: unknown[] | undefined, tr: unknown) => {
    if (!Array.isArray(en) || !Array.isArray(tr) || en.length !== tr.length) return;
    en.forEach((e, i) => pairs.push([str(e), str(tr[i])]));
  };
  for (const d of kb.diseases) {
    const t = ds[d.id];
    if (!t) continue;
    if (t.name) pairs.push([d.name_en, String(t.name)]);
    if (t.favourable_conditions && d.favourable_conditions) pairs.push([d.favourable_conditions, String(t.favourable_conditions)]);
    list(d.symptoms, t.symptoms);
    list(d.prevention, t.prevention);
    list(d.practices, t.practices);
    list(d.organic_bio, t.organic_bio);
    list(d.avoid, t.avoid);
    if (d.etl?.text && t.etl) pairs.push([d.etl.text, str(t.etl)]);
    if (d.first_action?.text && t.first_action) pairs.push([d.first_action.text, str(t.first_action)]);
    for (const q of d.discriminators || []) if (doc.questions?.[q.id]) pairs.push([q.question, String(doc.questions[q.id])]);
    // Second-look confirm question ("Do you see <cue>?", built in verify.ts from photo_cues[0]):
    // the translated template with the translated cue, so it is never sent in English.
    const cue = d.photo_cues?.[0];
    const trCue = Array.isArray(t.photo_cues) ? t.photo_cues[0] : null;
    if (cue && trCue && typeof doc.confirm_template === "string")
      pairs.push([`Do you see ${cue.trim().replace(/\.$/, "")}?`, doc.confirm_template.replace("{cue}", String(trCue))]);
  }
  registerStatic(lang, pairs);
}

export function getData(env: Env, request: Request): Promise<Data> {
  if (!cached) {
    const origin = new URL(request.url).origin;
    cached = (async () => {
      const [kb, uses, banned, hazard, te] = await Promise.all([
        load<KB>(env, origin, "kb.json", { crops: [], diseases: [] }),
        load<RegisteredUse[]>(env, origin, "registered_uses.json", []),
        load<Banned[]>(env, origin, "banned.json", []),
        load<Hazard>(env, origin, "hazard.json", {}),
        load<any>(env, origin, "kb_te.json", null),
      ]);
      // Static KB translations for every language (kb_te.json and kb_<lang>.json), registered as
      // English -> translation pairs so no live translation is needed.
      const others = await Promise.all(STATIC_LANGS.map((l) => load<any>(env, origin, `kb_${l}.json`, null)));
      registerKb(kb, "te", te);
      STATIC_LANGS.forEach((l, i) => registerKb(kb, l, others[i]));
      const diseaseById = new Map(kb.diseases.map((d) => [d.id, d]));
      // Accept {diseases: [{id, ...}]}, {diseases: {id: {...}}} or a plain {id: {...}} map.
      const kbTe = new Map<string, Record<string, any>>();
      const src = te && (te.diseases ?? te);
      if (Array.isArray(src)) for (const x of src) x && x.id && kbTe.set(x.id, x);
      else if (src && typeof src === "object") for (const [k, v] of Object.entries(src)) if (v && typeof v === "object") kbTe.set(k, v as Record<string, any>);
      const kbTeQuestions = te && te.questions && typeof te.questions === "object" ? (te.questions as Record<string, string>) : null;
      return { kb, uses, banned, hazard, diseaseById, kbTe, kbTeTag: String(kbTe.size), kbTeQuestions };
    })();
    cached.catch(() => (cached = null));
  }
  return cached;
}
