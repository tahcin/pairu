// Builds the advice card for one disease: KB text plus the CIB&RC registered uses for that crop
// and target, with banned actives removed and WHO class Ia/Ib flagged.
import type { Data } from "./data";
import type { Banned, Disease, RegisteredUse } from "./types";
import { resolveDose, type DoseStatus } from "./dose";

const HA_PER_ACRE = 0.404686; // 1 acre = 0.404686 hectare

export interface Treatment {
  product: string;
  actives: string[];
  type: string;
  bio: boolean;
  target: string;
  dose_raw: string;
  dose_status: DoseStatus;
  dose_per_ha: { value: string; unit: string } | null;
  dose_per_acre: { value: string; unit: string } | null;
  dose_per_litre: { value: string; unit: string } | null;
  water_per_ha: string;
  water_per_acre: string | null;
  water_note: string;
  waiting_days: number | null;
  waiting_raw: string;
  who_class: string | null;
  highly_hazardous: boolean;
  restricted: string | null;
  note: string;
  ipm_recommended: boolean;
  avoid: boolean;
  source: RegisteredUse["source"];
}

export interface AdviceCard {
  id: string;
  crop: string;
  lang: string;
  name: string;
  name_en: string;
  names: Record<string, string>;
  kind: string;
  pathogen: string;
  healthy: boolean;
  symptoms: string[];
  favourable_conditions: string;
  organic: { text: string; source: { title: string; url: string } | null }[];
  bio_products: Treatment[];
  chemicals: Treatment[];
  avoid: { text: string; source: { title: string; url: string } | null }[];
  banned_removed: number;
  prevention: string[];
  practices: string[];
  sources: { title: string; url: string }[];
  fixture: boolean;
}

const norm = (s: string) => s.toLowerCase().replace(/[\s\-_.]+/g, "").trim();

const fmt = (n: number) => {
  if (n >= 100) return String(Math.round(n / 5) * 5);
  if (n >= 10) return String(Math.round(n));
  return String(Math.round(n * 10) / 10);
};

// Converts a per-hectare quantity to per acre only when the printed value is a plain number or
// range, optionally with a unit and "per ha", e.g. "300-400 g", "1.5 kg per ha", "2000 to 2500".
// When the list prints no unit we convert the number but keep the unit unknown (unit: null), and
// the app says so instead of guessing grams or millilitres. Anything else stays as printed.
export function perAcre(raw: string): { value: string; unit: string | null } | null {
  const m = (raw || "")
    .trim()
    .match(/^(\d+(?:\.\d+)?)(?:\s*(?:-|to|–)\s*(\d+(?:\.\d+)?))?\s*(g|gm|gms|kg|ml|l|lt|lit|litre|litres|liter|liters)?\.?(?:\s*(?:per|\/)\s*(?:ha|hectare)\.?)?$/i);
  if (!m) return null;
  const unit = (m[3] || "").toLowerCase();
  const u = !unit ? "" : unit.startsWith("g") ? "g" : unit === "kg" ? "kg" : unit === "ml" ? "ml" : "l";
  const conv = (v: number): [string, string] => {
    if (u === "kg" && v < 1) return [fmt(v * 1000), "g"];
    if (u === "l" && v < 1) return [fmt(v * 1000), "ml"];
    return [fmt(v), u];
  };
  const [lv, lu] = conv(parseFloat(m[1]) * HA_PER_ACRE);
  if (!m[2]) return { value: lv, unit: lu || null };
  const [hv, hu] = conv(parseFloat(m[2]) * HA_PER_ACRE);
  if (lu === hu) return { value: `${lv}-${hv}`, unit: lu || null };
  return { value: `${lv} ${lu} to ${hv}`, unit: hu };
}

// Crops whose produce is eaten as a fruit or vegetable (for the dimethoate rule).
const FRUIT_VEG = new Set(["chilli", "tomato", "brinjal", "banana", "mango", "potato", "onion"]);
// Restriction scopes that mean "not for field use on our crops" at all.
const SCOPE_DROP = new Set(["agriculture", "all crops except wheat"]);

// Applies banned.json at join time. Banned or withdrawn actives are dropped; restrictions drop the
// row when they name this crop or rule out field use, and otherwise travel with it as a note.
export function checkBan(
  actives: string[],
  u: RegisteredUse,
  crop: string,
  banned: Map<string, Banned>,
): { drop: boolean; flag: string | null } {
  let flag: string | null = null;
  // A combination product is dropped when ANY of its actives is banned (names and aliases from
  // banned.json). The label is not text-matched: "Meptyl Dinocap" is not the banned dinocap.
  for (const a of actives) {
    const b = banned.get(norm(a));
    if (!b) continue;
    if (b.status === "banned" || b.status === "withdrawn") return { drop: true, flag: null };
    if (b.banned_on_crops?.includes(crop)) return { drop: true, flag: null };
    const scope = b.restricted_scope || "";
    if (SCOPE_DROP.has(scope)) return { drop: true, flag: null };
    if (norm(b.active) === "carbofuran" && !/3\s*%\s*CG/i.test(u.product_label)) return { drop: true, flag: null };
    if (scope === "vegetables" && FRUIT_VEG.has(crop)) return { drop: true, flag: null };
    if (scope === "fruits and vegetables eaten raw") {
      if (FRUIT_VEG.has(crop)) flag = b.note || scope;
      continue;
    }
    if (scope) flag = b.note || scope;
  }
  return { drop: false, flag };
}

export function treatmentsFor(d: Disease, data: Data): { bio: Treatment[]; chem: Treatment[]; bannedRemoved: number } {
  const targets = new Set((d.cibrc_targets || []).map((t) => t.toLowerCase().trim()));
  const banned = new Map<string, Banned>();
  for (const b of data.banned) {
    banned.set(norm(b.active), b);
    for (const a of b.aka || []) banned.set(norm(a), b);
  }
  // Optional KB fields from the government IPM (AESA) packages.
  const recommended = new Set((d.recommended_actives || []).map((r) => norm(r.active)));
  const avoidSet = new Set((d.avoid || []).flatMap((x) => [...(x.actives || []), ...(x.active ? [x.active] : [])]).map(norm));
  const hazard = new Map(Object.entries(data.hazard).map(([k, v]) => [norm(k), v.who_class]));
  const bio: Treatment[] = [];
  const chem: Treatment[] = [];
  const seen = new Set<string>();
  let bannedRemoved = 0;
  for (const u of data.uses) {
    if (u.crop_id !== d.crop || !targets.has((u.target_norm || "").toLowerCase().trim())) continue;
    const actives = u.active_ingredients || [];
    const verdict = checkBan(actives, u, d.crop, banned);
    if (verdict.drop) {
      bannedRemoved++;
      continue;
    }
    const restricted = verdict.flag;
    const key = `${norm(u.product_label)}|${u.crop_id}|${u.dose_formulation_raw}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const classes = actives.map((a) => hazard.get(norm(a))).filter(Boolean) as string[];
    const order = ["Ia", "Ib", "II", "III", "U"];
    const worst = classes.sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] || null;
    const water = /^[\d.\s\-to–]+$/i.test(u.water_l_ha || "") ? perAcre(`${u.water_l_ha} l`) : null;
    const waterOk = Boolean(water);
    const dose = resolveDose(u);
    const t: Treatment = {
      product: u.product_label,
      actives,
      type: u.pesticide_type,
      bio: u.pesticide_type.startsWith("bio"),
      target: u.target_raw,
      dose_raw: u.dose_formulation_raw || "",
      dose_status: dose.status,
      dose_per_ha: dose.per_ha,
      dose_per_acre: dose.per_acre,
      dose_per_litre: dose.per_litre || null,
      // Water volume is only worked out per acre next to a checked per-hectare dose.
      water_per_ha: waterOk ? u.water_l_ha : "",
      water_per_acre: water && dose.per_acre ? `${water.value} ${water.unit}` : null,
      water_note: waterOk ? "" : u.water_l_ha || "",
      waiting_days: u.waiting_period_days,
      waiting_raw: u.waiting_period_raw || "",
      who_class: worst,
      highly_hazardous: worst === "Ia" || worst === "Ib",
      restricted,
      note: u.note_raw || "",
      ipm_recommended: actives.some((a) => recommended.has(norm(a))),
      avoid: actives.some((a) => avoidSet.has(norm(a))),
      source: u.source,
    };
    (t.bio ? bio : chem).push(t);
  }
  // Order for chemicals, which decides the three shown before "show more": not hazardous or
  // restricted first, then a checked per-acre dose, then lower WHO class, then a known waiting period.
  const WHO_ORDER: Record<string, number> = { U: 0, III: 1, II: 2, Ib: 4, Ia: 5 };
  // A missing WHO class is unknown, not safe, so it sorts after class II.
  const who = (t: Treatment) => (t.who_class ? WHO_ORDER[t.who_class] ?? 3 : 3);
  const key = (t: Treatment) => [
    Number(t.avoid),
    Number(t.highly_hazardous || t.restricted !== null),
    Number(!t.ipm_recommended),
    Number(!t.dose_per_acre),
    who(t),
    Number(t.waiting_days == null),
  ];
  const cmp = (a: Treatment, b: Treatment) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return 0;
  };
  chem.sort(cmp);
  bio.sort((a, b) => Number(b.ipm_recommended) - Number(a.ipm_recommended));
  return { bio, chem, bannedRemoved };
}

export function buildCard(d: Disease, data: Data, lang: string): AdviceCard {
  const { bio, chem, bannedRemoved } = treatmentsFor(d, data);
  return {
    id: d.id,
    crop: d.crop,
    lang,
    name: d.names?.[lang] || d.name_en,
    name_en: d.name_en,
    names: d.names || {},
    kind: d.kind,
    pathogen: d.pathogen || "",
    healthy: d.id.endsWith("_healthy"),
    symptoms: d.symptoms || [],
    favourable_conditions: d.favourable_conditions || "",
    organic: (d.organic_bio || []).map((o) => ({
      text: o.text,
      source: typeof o.source === "number" && d.sources[o.source] ? d.sources[o.source] : null,
    })),
    avoid: (d.avoid || []).map((x) => ({
      text: x.text,
      source: typeof x.source === "number" ? d.sources[x.source] || null : x.source && typeof x.source === "object" ? x.source : null,
    })),
    bio_products: bio,
    chemicals: chem,
    banned_removed: bannedRemoved,
    prevention: d.prevention || [],
    practices: d.practices || [],
    sources: d.sources || [],
    fixture: Boolean(data.kb._fixture),
  };
}
