// Works out a safe per-acre dose from a CIB&RC row, or refuses to.
//
// The register prints the formulation dose per hectare, often without a unit ("3.0", "500"), and
// sometimes with a unit that is wrong by 1000x ("3 ml" where the active-ingredient column shows it
// must be litres). So a unit is never taken on trust: the printed number is checked against the
// expected product quantity, computed from the active-ingredient dose (dose_ai_g_ha) and the
// percentage in the product label. Only a scale that agrees within a factor of 1.5 is used. If
// nothing agrees, the app shows the row as printed and tells the farmer to check the label.

export type DoseStatus = "inferred" | "printed" | "per_litre" | "per_kg_seed" | "bio_as_printed" | "unreconciled" | "not_a_rate";

export interface DoseResult {
  status: DoseStatus;
  per_acre: { value: string; unit: string } | null;
  per_ha: { value: string; unit: string } | null;
  per_litre?: { value: string; unit: string } | null;
  // Lowest per-hectare amount in g or ml, for checks.
  base_lo?: number;
  reason: string;
}

const HA_PER_ACRE = 0.404686;
const TOLERANCE = 1.5;
// Plausible amount of product per hectare, in g or ml. Outside this, an interpretation is rejected.
const MIN_PER_HA = 5;
const MAX_PER_HA = 60000;

const LIQUID = ["SC", "EC", "SL", "EW", "OD", "CS", "ME", "SE", "ZC", "FS", "DC", "SO", "UL", "LF", "L.F", "AS", "CL"];
const SOLID = ["WP", "WG", "WDG", "DF", "SG", "SP", "GR", "CG", "DP", "WS", "G", "DS", "GB", "TB", "WSG"];

export function formKind(label: string): "liquid" | "solid" | null {
  const up = (label || "").toUpperCase().replace(/[()]/g, " ");
  let last: { kind: "liquid" | "solid"; at: number } | null = null;
  for (const [codes, kind] of [
    [LIQUID, "liquid"],
    [SOLID, "solid"],
  ] as const) {
    for (const c of codes) {
      const re = new RegExp(`(?:^|[\\s%\\d/])${c.replace(".", "\\.")}(?=$|[\\s,.;)/])`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(up))) if (!last || m.index > last.at) last = { kind, at: m.index };
    }
  }
  if (last) return last.kind;
  if (/LIQUID|LIQ\b/.test(up)) return "liquid";
  if (/POWDER|GRANULE|TABLET/.test(up)) return "solid";
  return null;
}

export function percents(label: string): number[] {
  return [...(label || "").matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => parseFloat(m[1])).filter((n) => n > 0 && n <= 100);
}

// Active-ingredient dose: the first number, and the sum of a leading "a + b + c" group.
export function aiDose(raw: string): { first: number; sum: number } | null {
  const m = (raw || "").match(/(\d+(?:\.\d+)?)((?:\s*[+,]\s*\d+(?:\.\d+)?\s*(?:g|kg)?)*)/i);
  if (!m) return null;
  const first = parseFloat(m[1]);
  if (!(first > 0)) return null;
  const rest = [...(m[2] || "").matchAll(/\d+(?:\.\d+)?/g)].map((x) => parseFloat(x[0]));
  return { first, sum: first + rest.reduce((a, b) => a + b, 0) };
}

type Unit = "g" | "kg" | "ml" | "l";
function normUnit(u: string): Unit | null {
  const x = u.toLowerCase().replace(/\./g, "");
  if (!x) return null;
  if (["g", "gm", "gms", "gram", "grams", "gr"].includes(x)) return "g";
  if (["kg", "kgs"].includes(x)) return "kg";
  if (["ml", "mls"].includes(x)) return "ml";
  if (["l", "lt", "ltr", "lit", "litre", "litres", "liter", "liters"].includes(x)) return "l";
  return null;
}

// A plain per-hectare rate: "500", "300-400 g", "2000 to 2500", "1.5 kg per ha", "500 ml/ha".
export function parseRate(raw: string): { lo: number; hi: number | null; unit: Unit | null } | null {
  const m = (raw || "")
    .trim()
    .match(/^(\d+(?:\.\d+)?)(?:\s*(?:-|to|–)\s*(\d+(?:\.\d+)?))?\s*([a-z.]+)?\s*(?:(?:per|\/)\s*(?:ha|hectare)\.?)?$/i);
  if (!m) return null;
  const unit = m[3] ? normUnit(m[3]) : null;
  if (m[3] && !unit) return null;
  const lo = parseFloat(m[1]);
  if (!(lo > 0)) return null;
  return { lo, hi: m[2] ? parseFloat(m[2]) : null, unit };
}

const fmt = (n: number) => {
  if (n >= 100) return String(Math.round(n / 5) * 5);
  if (n >= 10) return String(Math.round(n));
  return String(Math.round(n * 10) / 10);
};

// Formats an amount given in g or ml (base units) with the right unit for the product kind.
function show(base: number, kind: "liquid" | "solid"): [string, string] {
  const small = kind === "liquid" ? "ml" : "g";
  const big = kind === "liquid" ? "l" : "kg";
  return base >= 1000 ? [fmt(base / 1000), big] : [fmt(base), small];
}

function range(lo: number, hi: number | null, kind: "liquid" | "solid"): { value: string; unit: string } {
  const [lv, lu] = show(lo, kind);
  if (hi === null || hi === lo) return { value: lv, unit: lu };
  const [hv, hu] = show(hi, kind);
  if (lu === hu) return { value: `${lv}-${hv}`, unit: lu };
  return { value: `${lv} ${lu} to ${hv}`, unit: hu };
}

const SCALE: Record<Unit, number> = { g: 1, ml: 1, kg: 1000, l: 1000 };

export interface DoseRow {
  product_label: string;
  dose_ai_g_ha: string;
  dose_formulation_raw: string;
  water_l_ha?: string;
  pesticide_type?: string;
}

function within(got: number, expected: number) {
  const r = got / expected;
  return r >= 1 / TOLERANCE && r <= TOLERANCE;
}

const PER_LITRE_TEXT = /(?:per|\/)\s*(?:l|lit|litre|liter|lt)\b|\bper\s+litre|\/\s*litre/i;
const SEED_TEXT = /seed|\/\s*kg\b|per\s+kg\b/i;

export function resolveDose(row: DoseRow): DoseResult {
  const raw = (row.dose_formulation_raw || "").trim();
  const asPrinted = (status: DoseStatus, reason: string): DoseResult => ({ status, per_acre: null, per_ha: null, reason });

  // Biological products: the list often mixes doses with instructions, so show them as printed.
  if ((row.pesticide_type || "").startsWith("bio")) return asPrinted("bio_as_printed", "biological product, shown as printed");

  // Seed treatments are dosed per kg of seed, never per hectare.
  if (SEED_TEXT.test(`${raw} ${row.dose_ai_g_ha}`) || /seed/i.test(row.product_label) || /\b(FS|WS|DS)\b/i.test(row.product_label))
    return asPrinted("per_kg_seed", "seed treatment, dosed per kg of seed");

  // Printed as a concentration in spray water ("1 ml/litre water", "0.1%").
  if (PER_LITRE_TEXT.test(raw) || /%/.test(raw)) return asPrinted("per_litre", "printed per litre of water");

  const rate = parseRate(raw);
  if (!rate) return asPrinted("not_a_rate", "not a plain rate");
  const kind = formKind(row.product_label);
  const ai = aiDose(row.dose_ai_g_ha);
  const pcts = percents(row.product_label);
  const fractions = pcts.length ? [pcts[0] / 100, pcts.reduce((a, b) => a + b, 0) / 100] : [];
  const aiValues = ai ? [ai.first, ai.sum] : [];
  const water = parseRate(row.water_l_ha || "");

  if (ai && fractions.length && kind) {
    const expectations: { e: number; note: string }[] = [];
    for (const aScale of [1, 1000])
      for (let i = 0; i < fractions.length; i++)
        expectations.push({ e: (aiValues[i] * aScale) / fractions[i], note: `a.i. ${aiValues[i] * aScale} g at ${Math.round(fractions[i] * 1000) / 10}%` });

    const perHa = (s: number, status: DoseStatus, note: string): DoseResult => {
      const lo = rate.lo * s;
      const hi = rate.hi !== null ? rate.hi * s : null;
      return {
        status,
        per_ha: range(lo, hi, kind),
        per_acre: range(lo * HA_PER_ACRE, hi !== null ? hi * HA_PER_ACRE : null, kind),
        base_lo: lo,
        reason: note,
      };
    };
    const matchHa = (s: number) => {
      const got = rate.lo * s;
      if (got < MIN_PER_HA || got > MAX_PER_HA) return null;
      return expectations.find((x) => within(got, x.e)) || null;
    };
    // Per litre of spray water: the dose times the water volume should give the per-hectare amount.
    const matchLitre = (s: number) => {
      if (!water) return null;
      const vols = [water.lo, water.hi ?? water.lo];
      for (const v of vols) {
        const got = rate.lo * s * v;
        const hit = expectations.find((x) => within(got, x.e));
        if (hit) return { ...hit, v };
      }
      return null;
    };

    // 1. The printed unit, read per hectare.
    if (rate.unit) {
      const s = SCALE[rate.unit];
      const hit = matchHa(s);
      if (hit) return perHa(s, "printed", `printed unit agrees with ${hit.note}`);
      // 2. The printed unit, read per litre of water (e.g. "3 ml" with 1,000 l of water per ha).
      const lit = matchLitre(s);
      if (lit && rate.lo * s <= 50)
        return {
          status: "per_litre",
          per_acre: null,
          per_ha: null,
          per_litre: range(rate.lo * s, rate.hi !== null ? rate.hi * s : null, kind),
          reason: `per litre: x ${lit.v} l water agrees with ${lit.note}`,
        };
      // A few grams or millilitres cannot be a per-hectare dose; the list means per litre of water.
      if (s === 1 && rate.lo <= 10)
        return {
          status: "per_litre",
          per_acre: null,
          per_ha: null,
          per_litre: range(rate.lo, rate.hi, kind),
          reason: "printed in g or ml with a value too small for a hectare: read as per litre of water",
        };
    }
    // 3. No usable printed unit: infer g/ml or kg/l only if it agrees with the a.i. dose.
    for (const s of [1, 1000]) {
      if (rate.unit && SCALE[rate.unit] === s) continue;
      const hit = matchHa(s);
      if (hit) return perHa(s, "inferred", `inferred unit agrees with ${hit.note}`);
    }
    return asPrinted("unreconciled", "printed number does not agree with the a.i. dose");
  }

  // Nothing to check against: trust only a printed unit, within the plausible range.
  if (rate.unit) {
    const s = SCALE[rate.unit];
    const lo = rate.lo * s;
    const k = kind || (rate.unit === "ml" || rate.unit === "l" ? "liquid" : "solid");
    if (lo >= MIN_PER_HA && lo <= MAX_PER_HA) {
      const hi = rate.hi !== null ? rate.hi * s : null;
      return {
        status: "printed",
        per_acre: range(lo * HA_PER_ACRE, hi !== null ? hi * HA_PER_ACRE : null, k),
        per_ha: range(lo, hi, k),
        base_lo: lo,
        reason: "unit as printed; no a.i. dose to check against",
      };
    }
  }
  return asPrinted("unreconciled", "no unit printed and nothing to check it against");
}
