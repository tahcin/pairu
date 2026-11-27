// Builds the advice card for one disease: KB text plus the CIB&RC registered uses for that crop
// and target, with banned actives removed and WHO class Ia/Ib flagged.
import type { Data } from "./data";
import type { Banned, Disease, RegisteredUse } from "./types";

const HA_PER_ACRE = 0.404686; // 1 acre = 0.404686 hectare

export interface Treatment {
  product: string;
  actives: string[];
  type: string;
  bio: boolean;
  target: string;
  dose_per_ha: string;
  dose_per_acre: { value: string; unit: string | null } | null;
  water_per_ha: string;
  water_per_acre: string | null;
  water_note: string;
  waiting_days: number | null;
  waiting_raw: string;
  who_class: string | null;
  highly_hazardous: boolean;
  restricted: string | null;
  note: string;
  source: RegisteredUse["source"];
}

export interface AdviceCard {
  id: string;
  crop: string;
  lang: string;
  name: string;
  name_en: string;
  kind: string;
  pathogen: string;
  healthy: boolean;
  symptoms: string[];
  favourable_conditions: string;
  organic: { text: string; source: { title: string; url: string } | null }[];
  bio_products: Treatment[];
  chemicals: Treatment[];
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
    const t: Treatment = {
      product: u.product_label,
      actives,
      type: u.pesticide_type,
      bio: u.pesticide_type.startsWith("bio"),
      target: u.target_raw,
      dose_per_ha: u.dose_formulation_raw || "",
      dose_per_acre: perAcre(u.dose_formulation_raw),
      water_per_ha: waterOk ? u.water_l_ha : "",
      water_per_acre: water ? `${water.value} ${water.unit}` : null,
      water_note: waterOk ? "" : u.water_l_ha || "",
      waiting_days: u.waiting_period_days,
      waiting_raw: u.waiting_period_raw || "",
      who_class: worst,
      highly_hazardous: worst === "Ia" || worst === "Ib",
      restricted,
      note: u.note_raw || "",
      source: u.source,
    };
    (t.bio ? bio : chem).push(t);
  }
  // Safer products first among chemicals: unflagged before flagged.
  chem.sort((a, b) => Number(a.highly_hazardous) - Number(b.highly_hazardous));
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
    kind: d.kind,
    pathogen: d.pathogen || "",
    healthy: d.id.endsWith("_healthy"),
    symptoms: d.symptoms || [],
    favourable_conditions: d.favourable_conditions || "",
    organic: (d.organic_bio || []).map((o) => ({
      text: o.text,
      source: typeof o.source === "number" && d.sources[o.source] ? d.sources[o.source] : null,
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
