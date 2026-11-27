// Builds the advice card for one disease: KB text plus the CIB&RC registered uses for that crop
// and target, with banned actives removed and WHO class Ia/Ib flagged.
import type { Data } from "./data";
import type { Banned, Disease, RegisteredUse } from "./types";
import { formKind, isGranule, resolveDose, type DoseStatus } from "./dose";

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
  dose_treatment: string | null;
  // Unit for a bare printed number, from the formulation type (ml for liquids, g for solids), so a
  // number is never shown without a unit. Only for values of 20 or more; no per-acre figure.
  dose_raw_unit: string | null;
  // Same product printed with doses that disagree on this card: shown once, as printed, no numbers.
  dose_conflict: { raw: string; water: string; status: string }[] | null;
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
  mixture: boolean;
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
  do_first: DoFirst;
  first_action: { text: string; kind: string } | null;
  safety_note: { text: string; sources: { title: string; url: string }[] } | null;
  avoid_mixtures: boolean;
  etl: { text: string; source: { title: string; url: string } | null } | null;
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

// Product per hectare in g or ml where it can be worked out: a checked per-hectare dose, or a
// per-litre dose times the printed water volume. Null when the row cannot be put on that scale.
function perHaBase(d: ReturnType<typeof resolveDose>, waterRaw: string): number | null {
  if (d.base_lo) return d.base_lo;
  if (d.per_litre) {
    const v = parseFloat(d.per_litre.value);
    const s = d.per_litre.unit === "l" || d.per_litre.unit === "kg" ? 1000 : 1;
    const w = parseFloat((waterRaw || "").replace(/[^\d.]+/g, " ").trim().split(" ")[0]);
    if (v > 0 && w >= 100) return v * s * w;
  }
  return null;
}

// When one product appears more than once on a card and the doses differ by more than 2x (or one
// cannot be compared), show it once with every printed value and no computed figure.
function mergeConflicts(list: Treatment[], baseOf: Map<Treatment, number | null>): Treatment[] {
  const groups = new Map<string, Treatment[]>();
  for (const t of list) {
    const k = norm(t.product);
    groups.set(k, [...(groups.get(k) || []), t]);
  }
  const out: Treatment[] = [];
  const done = new Set<string>();
  for (const t of list) {
    const k = norm(t.product);
    if (done.has(k)) continue;
    const g = groups.get(k) as Treatment[];
    if (g.length === 1) {
      out.push(t);
      done.add(k);
      continue;
    }
    const bases = g.map((x) => baseOf.get(x) ?? null);
    const known = bases.filter((b): b is number => b !== null);
    const spread = known.length ? Math.max(...known) / Math.min(...known) : 1;
    const conflict = known.length !== bases.length || spread > 2;
    if (!conflict) {
      out.push(t);
      done.add(k);
      continue;
    }
    done.add(k);
    out.push({
      ...t,
      dose_status: "unreconciled",
      dose_per_acre: null,
      dose_per_ha: null,
      dose_per_litre: null,
      water_per_acre: null,
      dose_conflict: g.map((x) => ({ raw: x.dose_raw, water: x.water_per_ha || x.water_note, status: x.dose_treatment || x.dose_status })),
    });
  }
  return out;
}

function rawUnit(raw: string, label: string): string | null {
  const m = (raw || "").trim().match(/^(\d+(?:\.\d+)?)(?:\s*(?:-|to|–)\s*\d+(?:\.\d+)?)?\s*(?:\/\s*ha)?$/i);
  if (!m || parseFloat(m[1]) < 20) return null;
  const kind = formKind(label) ?? (isGranule(label) ? "solid" : null);
  return kind === "liquid" ? "ml" : kind === "solid" ? "g" : null;
}

// Mode-of-action spread in the three shown first: no active may appear in all three (so the farmer
// is not offered three products of the same chemistry, for example three azoxystrobin products).
function diversify(list: Treatment[]): Treatment[] {
  const top: Treatment[] = [];
  const later: Treatment[] = [];
  for (const t of list) {
    if (top.length >= 3) {
      later.push(t);
      continue;
    }
    const counts = new Map<string, number>();
    for (const x of [...top, t]) for (const a of new Set(x.actives.map(norm))) counts.set(a, (counts.get(a) || 0) + 1);
    if ([...counts.values()].some((c) => c > 2)) later.push(t);
    else top.push(t);
  }
  return [...top, ...later];
}

// The "what to do first" line. The KB's first_action wins; otherwise a safe rule: for a virus,
// removing infected plants; else the first natural option; else the first product that is not
// highly hazardous (WHO Ia/Ib), not restricted, not avoided, not a ready-mix where mixtures are
// advised against, not a seed/soil/nursery row and with a checked dose; else the first practice.
export type DoFirst =
  | { source: "first_action"; kind: string }
  | { source: "organic"; index: number }
  | { source: "practice"; index: number }
  | { source: "product"; group: "bio" | "chem"; index: number }
  | null;

export function safeForFirst(t: Treatment, noMix: boolean): boolean {
  if (t.avoid || t.restricted !== null || t.dose_conflict) return false;
  if (t.who_class === "Ia" || t.who_class === "Ib") return false;
  if (noMix && t.mixture) return false;
  if (["seed_soil", "per_kg_seed", "low_water", "unreconciled", "not_a_rate"].includes(t.dose_status)) return false;
  if (t.bio) return t.dose_status !== "bio_as_printed" || /[a-z]/i.test(t.dose_raw);
  return Boolean(t.dose_per_acre || t.dose_per_litre);
}

function chooseFirst(d: Disease, bio: Treatment[], chem: Treatment[]): DoFirst {
  if (d.id.endsWith("_healthy")) return null;
  if (d.first_action?.text) return { source: "first_action", kind: d.first_action.kind || "practice" };
  const practices = d.practices || [];
  if (d.kind === "viral") {
    const i = practices.findIndex((p) => /uproot|rogue|roguing|pull out|remove (and|&) (destroy|burn)|destroy (infected|affected)|remove infected|remove affected/i.test(p));
    if (i >= 0) return { source: "practice", index: i };
  }
  if ((d.organic_bio || []).length) return { source: "organic", index: 0 };
  // Mostly seed, tuber or soil treatments in the register: the problem starts in the seed or soil,
  // so a field spray is not the first step; show the first practice (rotation, clean seed) instead.
  const all = [...bio, ...chem];
  const soilRows = all.filter((t) => t.dose_status === "seed_soil").length;
  const sprayRows = all.filter((t) => t.dose_per_acre || t.dose_per_litre).length;
  if (soilRows > 0 && soilRows >= sprayRows && practices.length) return { source: "practice", index: 0 };
  const noMix = Boolean(d.avoid_mixtures);
  const b = bio.findIndex((t) => safeForFirst(t, noMix));
  if (b >= 0) return { source: "product", group: "bio", index: b };
  const c = chem.findIndex((t) => safeForFirst(t, noMix));
  if (c >= 0) return { source: "product", group: "chem", index: c };
  if (practices.length) return { source: "practice", index: 0 };
  return null;
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
    // aka is a list; guard against a plain string, which would iterate letter by letter.
    const aka = Array.isArray(b.aka) ? b.aka : typeof b.aka === "string" ? [b.aka] : [];
    for (const a of aka) if (a && a.length > 2) banned.set(norm(a), b);
  }
  // Optional KB fields from the government IPM (AESA) packages.
  const recommended = new Set((d.recommended_actives || []).map((r) => norm(r.active)));
  const avoidSet = new Set((d.avoid || []).flatMap((x) => [...(x.actives || []), ...(x.active ? [x.active] : [])]).map(norm));
  const hazard = new Map(Object.entries(data.hazard).map(([k, v]) => [norm(k), v.who_class]));
  const baseOf = new Map<Treatment, number | null>();
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
      dose_treatment: dose.treatment || null,
      dose_raw_unit: rawUnit(u.dose_formulation_raw, u.product_label),
      dose_conflict: null,
      // Water volume is only worked out per acre next to a checked per-hectare dose.
      water_per_ha: waterOk ? u.water_l_ha : "",
      water_per_acre: water && dose.per_acre && dose.water_ok ? `${water.value} ${water.unit}` : null,
      water_note: waterOk ? "" : u.water_l_ha || "",
      waiting_days: u.waiting_period_days,
      waiting_raw: u.waiting_period_raw || "",
      who_class: worst,
      highly_hazardous: worst === "Ia" || worst === "Ib",
      restricted,
      note: u.note_raw || "",
      ipm_recommended: actives.some((a) => recommended.has(norm(a))),
      mixture: actives.length > 1,
      avoid: actives.some((a) => avoidSet.has(norm(a))),
      source: u.source,
    };
    (t.bio ? bio : chem).push(t);
    baseOf.set(t, perHaBase(dose, u.water_l_ha));
  }
  const mergedChem = mergeConflicts(chem, baseOf);
  const mergedBio = mergeConflicts(bio, baseOf);
  chem.length = 0;
  chem.push(...mergedChem);
  bio.length = 0;
  bio.push(...mergedBio);

  // Order for chemicals, which decides the three shown before "show more": not hazardous or
  // restricted first, then a checked per-acre dose, then lower WHO class, then a known waiting period.
  const WHO_ORDER: Record<string, number> = { U: 0, III: 1, II: 2, Ib: 4, Ia: 5 };
  // A missing WHO class is unknown, not safe, so it sorts after class II.
  const who = (t: Treatment) => (t.who_class ? WHO_ORDER[t.who_class] ?? 3 : 3);
  const noMix = Boolean(d.avoid_mixtures);
  // A row on a checked dose path (per acre or per litre, reconciled with the register) comes before
  // any "read the label" row, so an unchecked row reaches the top three only when there are not
  // three checked ones.
  const checked = (t: Treatment) => ["inferred", "printed", "per_litre", "bio_unit_from_code"].includes(t.dose_status) && !t.dose_conflict;
  // Order: single actives before ready-mixes where mixtures are advised against; then actives the
  // government IPM package recommends for this problem; then rows on a checked dose path;
  // sprays before granules; safer (not highly hazardous or restricted) before flagged; then a
  // per-acre dose, lower WHO class and a known waiting period. Diversity of actives is applied after.
  const key = (t: Treatment) => [
    Number(t.avoid),
    // Where the package advises against mixtures, a ready-mix never outranks a single active, even
    // one with a recommended active, so the card never contradicts its own "avoid" box.
    Number(noMix && t.mixture),
    Number(!t.ipm_recommended),
    Number(!checked(t)),
    Number(isGranule(t.product)),
    Number(t.highly_hazardous || t.restricted !== null),
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
  bio.sort((a, b) => Number(!checked(a)) - Number(!checked(b)) || Number(b.ipm_recommended) - Number(a.ipm_recommended));
  return { bio: diversify(bio), chem: diversify(chem), bannedRemoved };
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
    do_first: chooseFirst(d, bio, chem),
    first_action: d.first_action?.text ? { text: d.first_action.text, kind: d.first_action.kind || "practice" } : null,
    avoid_mixtures: Boolean(d.avoid_mixtures),
    safety_note: d.safety_note?.text
      ? {
          text: d.safety_note.text,
          sources: (d.safety_note.sources || [])
            .map((x) => (typeof x === "number" ? d.sources[x] : x))
            .filter(Boolean) as { title: string; url: string }[],
        }
      : null,
    etl: d.etl && d.etl.text
      ? {
          text: d.etl.text,
          source: typeof d.etl.source === "number" ? d.sources[d.etl.source] || null : d.etl.source && typeof d.etl.source === "object" ? d.etl.source : null,
        }
      : null,
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
