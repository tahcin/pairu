// Works out a safe per-acre dose from a CIB&RC row, or refuses to.
//
// The register prints the formulation dose per hectare, often without a unit ("3.0", "500"), and
// sometimes with a unit that is wrong by 1000x ("3 ml" where the active-ingredient column shows it
// must be litres). So a unit is never taken on trust: the printed number is checked against the
// expected product quantity, computed from the active-ingredient dose (dose_ai_g_ha) and the
// percentage in the product label. Only a scale that agrees within a factor of 1.5 is used. If
// nothing agrees, the app shows the row as printed and tells the farmer to check the label.

export type DoseStatus =
  | "inferred"
  | "printed"
  | "per_litre"
  | "per_kg_seed"
  | "seed_soil"
  | "bio_as_printed"
  | "bio_water"
  | "bio_unit_from_code"
  | "low_water"
  | "unreconciled"
  | "not_a_rate";

// For seed, tuber, soil and nursery rows: which treatment the register describes.
export type TreatmentKind = "seed" | "tuber" | "soil" | "nursery";

export interface DoseResult {
  status: DoseStatus;
  per_acre: { value: string; unit: string } | null;
  per_ha: { value: string; unit: string } | null;
  per_litre?: { value: string; unit: string } | null;
  treatment?: TreatmentKind;
  // Water per hectare is shown per acre only when it is a real spray volume (100 L/ha or more).
  water_ok?: boolean;
  // Lowest per-hectare amount in g or ml, for checks.
  base_lo?: number;
  reason: string;
}

const HA_PER_ACRE = 0.404686;
const TOLERANCE = 1.5;
// Plausible amount of product per hectare, in g or ml. Outside this, an interpretation is rejected.
const MIN_PER_HA = 5;
const MAX_PER_HA = 60000;

const LIQUID = ["SC", "EC", "SL", "EW", "OD", "CS", "ME", "SE", "ZC", "FS", "DC", "SO", "UL", "LF", "L.F", "AS", "CL", "L"];
// Granules and dusts are broadcast: they are never mixed per litre of water.
const GRANULE = ["GR", "CG", "G", "GB", "DP", "D"];
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

export function isGranule(label: string): boolean {
  const up = ` ${(label || "").toUpperCase().replace(/[()]/g, " ")} `;
  return GRANULE.some((c) => new RegExp(`[\\s%\\d/]${c}(?=[\\s,.;)/])`).test(up)) || /GRANULE/.test(up);
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

// Rounding never changes a printed value such as 12.5 kg: one decimal below 100, steps of 5 above.
const fmt = (n: number) => {
  if (n >= 100) return String(Math.round(n / 5) * 5);
  return String(Math.round(n * 10) / 10);
};

// Formats an amount given in g or ml (base units) with the right unit for the product kind.
function show(base: number, kind: "liquid" | "solid"): [string, string] {
  const small = kind === "liquid" ? "ml" : "g";
  const big = kind === "liquid" ? "l" : "kg";
  return base >= 1000 ? [fmt(base / 1000), big] : [fmt(base), small];
}

// Per-acre figures are rounded for a farmer (no false precision such as 64.7 ml): 2 significant
// figures below 100, the nearest 5 from 100 to 1,000, 2 significant figures above. The printed
// per-hectare value is always shown next to it unrounded.
export function fmtAcre(n: number): string {
  if (n >= 100 && n <= 1000) return String(Math.round(n / 5) * 5);
  if (n <= 0) return "0";
  const p = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return String(Math.round((Math.round(n / p) * p) * 1000) / 1000);
}

function showAcre(base: number, kind: "liquid" | "solid"): [string, string] {
  const small = kind === "liquid" ? "ml" : "g";
  const big = kind === "liquid" ? "l" : "kg";
  return base >= 1000 ? [fmtAcre(base / 1000), big] : [fmtAcre(base), small];
}

function range(lo: number, hi: number | null, kind: "liquid" | "solid", acre = false): { value: string; unit: string } {
  const sh = acre ? showAcre : show;
  const [lv, lu] = sh(lo, kind);
  if (hi === null || hi === lo) return { value: lv, unit: lu };
  const [hv, hu] = sh(hi, kind);
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
  waiting_period_raw?: string;
  note_raw?: string;
  target_raw?: string;
}

function within(got: number, expected: number) {
  const r = got / expected;
  return r >= 1 / TOLERANCE && r <= TOLERANCE;
}

const PER_LITRE_TEXT = /(?:per|\/)\s*(?:l|lit|litre|liter|lt)\b|\bper\s+litre|\/\s*litre/i;

// Seed, tuber, sett, seedling-dip, soil and nursery treatments, detected from ANY cell of the row.
export function treatmentKind(row: DoseRow): TreatmentKind | null {
  // The product name is never searched for words like "seed" ("Neem Seed Kernel Extract" is a
  // foliar spray). Only the dose, a.i., waiting-period, water and note cells are, plus explicit
  // treatment phrases and the seed-treatment formulation codes (FS, WS, DS, ST) in the label.
  const label = (row.product_label || "").toLowerCase();
  const cells = [row.dose_formulation_raw, row.dose_ai_g_ha, row.waiting_period_raw, row.water_l_ha, row.note_raw].filter(Boolean).join(" | ").toLowerCase();
  const target = (row.target_raw || "").toLowerCase();
  const explicit = (re: RegExp) => re.test(cells) || re.test(label) || re.test(target);
  if (/\btuber|\bsett\b|\bsetts\b|seed piece|seed potato/.test(cells) || explicit(/tuber (treatment|dip)/)) return "tuber";
  if (/nursery|seedling dip|root dip|seedling root/.test(cells) || explicit(/nursery (treatment|bed)/)) return "nursery";
  if (/\bseeds?\b|\/\s*kg\b|per\s+kg\b/.test(cells) || explicit(/seed (treatment|dressing|dresser)|per\s*\d*\s*kg\s*(of\s*)?seeds?|\/\s*kg\s*seed/) || /\b(FS|WS|DS|ST)\b/.test(row.product_label || ""))
    return "seed";
  if (/\bsoil\b|drench|furrow application/.test(cells) || explicit(/soil (application|drench|treatment)/)) return "soil";
  return null;
}

export function resolveDose(row: DoseRow): DoseResult {
  const raw = (row.dose_formulation_raw || "").trim();
  const asPrinted = (status: DoseStatus, reason: string, extra: Partial<DoseResult> = {}): DoseResult => ({ status, per_acre: null, per_ha: null, reason, ...extra });
  const bio = (row.pesticide_type || "").startsWith("bio");

  // 1. Seed, tuber, soil and nursery treatments: never a field spray, never per acre.
  const treat = treatmentKind(row);
  if (treat) return asPrinted("seed_soil", `${treat} treatment, shown as printed`, { treatment: treat });

  const granule = isGranule(row.product_label);
  const kind = formKind(row.product_label) ?? (granule ? "solid" : null);
  const water = parseRate(row.water_l_ha || "");
  const drone = /drone/i.test(`${row.water_l_ha} ${row.note_raw}`);
  // Granules are broadcast: never shown with spray water.
  const waterOk = Boolean(water && water.lo >= 100 && !granule);

  // 2. Printed as a concentration in spray water ("1 ml/litre water", "0.1%"). Not for granules.
  if (!granule && (PER_LITRE_TEXT.test(raw) || /%/.test(raw))) return asPrinted("per_litre", "printed per litre of water");

  // 3. A spray at under 100 L of water per hectare that is not a drone use is not a normal field
  //    spray (often a soil or tuber use): show it as printed.
  if (water && water.lo < 100 && !drone && !granule) return asPrinted("low_water", "water volume under 100 L/ha, shown as printed");

  const rate = parseRate(raw);
  if (!rate) return asPrinted(bio ? "bio_as_printed" : "not_a_rate", "not a plain rate");
  // Biological rows printed with a unit: shown with that unit, as printed. A printed volume of 100
  // litres or more is the spray water, not the dose (Trichoderma "500 liter/ha").
  if (bio && rate.unit === "l" && rate.lo >= 100) return asPrinted("bio_water", "a spray-water volume printed in the dose column", { water_ok: false });
  if (bio && rate.unit) return asPrinted("bio_as_printed", "biological product with a printed unit");
  // A granule printed with spray water and under 1 kg per hectare: the label code and dose disagree
  // (likely a WG printed as GR), so no figure is shown.
  if (granule && water && !rate.unit && rate.lo < 1000 && rate.lo >= 1) return asPrinted("unreconciled", "granule code but spray water and a small dose: label code and dose disagree");

  const ai = aiDose(row.dose_ai_g_ha);
  const pcts = percents(row.product_label);
  const fractions = pcts.length ? [pcts[0] / 100, pcts.reduce((a, b) => a + b, 0) / 100] : [];
  const aiValues = ai ? [ai.first, ai.sum] : [];

  // The unit family must match the formulation: liquids in ml or l, solids in g or kg.
  const familyOk = (u: Unit) => !kind || (kind === "liquid" ? u === "ml" || u === "l" : u === "g" || u === "kg");

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
        per_acre: range(lo * HA_PER_ACRE, hi !== null ? hi * HA_PER_ACRE : null, kind, true),
        base_lo: lo,
        water_ok: waterOk,
        reason: note,
      };
    };
    const matchHa = (s: number) => {
      const got = rate.lo * s;
      if (got < MIN_PER_HA || got > MAX_PER_HA) return null;
      return expectations.find((x) => within(got, x.e)) || null;
    };
    const matchLitre = (s: number) => {
      if (!water || granule) return null;
      for (const v of [water.lo, water.hi ?? water.lo]) {
        const got = rate.lo * s * v;
        const hit = expectations.find((x) => within(got, x.e));
        if (hit) return { ...hit, v };
      }
      return null;
    };

    if (rate.unit && familyOk(rate.unit)) {
      const s = SCALE[rate.unit];
      const hit = matchHa(s);
      if (hit) return perHa(s, "printed", `printed unit agrees with ${hit.note}`);
      const lit = matchLitre(s);
      if (lit && rate.lo * s <= 50)
        return { ...asPrinted("per_litre", `per litre: x ${lit.v} l water agrees with ${lit.note}`), per_litre: range(rate.lo * s, rate.hi !== null ? rate.hi * s : null, kind) };
      if (s === 1 && rate.lo <= 10 && !granule)
        return {
          ...asPrinted("per_litre", "printed in g or ml with a value too small for a hectare: read as per litre of water"),
          per_litre: range(rate.lo, rate.hi, kind),
        };
    }
    // Infer the scale only from a number of 1 or more: values below 1 are usually concentrations.
    if (rate.lo >= 1 && !bio) {
      for (const s of [1, 1000]) {
        if (rate.unit && SCALE[rate.unit] === s && familyOk(rate.unit)) continue;
        const hit = matchHa(s);
        if (hit) return perHa(s, "inferred", `inferred unit agrees with ${hit.note}`);
      }
    }
    // A solid printed below 1 is kilograms when the a.i. column agrees (chlorothalonil 75% WP,
    // "0.88-1.150" with a.i. "0.66-0.863" means 0.88-1.15 kg/ha). Liquids below 1 stay refused:
    // those are usually concentrations for a dip (pencycuron "0.25-0.50").
    if (rate.lo < 1 && !rate.unit && kind === "solid" && !bio) {
      const hit = matchHa(1000);
      if (hit) return perHa(1000, "inferred", `kilograms, agrees with ${hit.note}`);
    }
    if (bio && rate.lo >= 1) {
      for (const s of [1, 1000]) {
        const hit = matchHa(s);
        if (hit) return perHa(s, "inferred", `biological, unit inferred from ${hit.note}`);
      }
    }
    return asPrinted(bio ? "bio_as_printed" : "unreconciled", "printed number does not agree with the a.i. dose");
  }

  // Nothing to check against: trust only a printed unit of the right family, in the plausible range.
  if (rate.unit && familyOk(rate.unit) && !bio) {
    const s = SCALE[rate.unit];
    const lo = rate.lo * s;
    const k = kind || (rate.unit === "ml" || rate.unit === "l" ? "liquid" : "solid");
    if (lo >= MIN_PER_HA && lo <= MAX_PER_HA) {
      const hi = rate.hi !== null ? rate.hi * s : null;
      return {
        status: "printed",
        per_acre: range(lo * HA_PER_ACRE, hi !== null ? hi * HA_PER_ACRE : null, k, true),
        per_ha: range(lo, hi, k),
        base_lo: lo,
        water_ok: waterOk,
        reason: "unit as printed; no a.i. dose to check against",
      };
    }
  }
  // Biological product printed as a bare number of 20 or more: the formulation type gives the unit
  // family (EC, SC, SL are millilitres; WP, WG are grams), so the number is never shown bare.
  if (bio && !rate.unit && kind && rate.lo >= 20 && rate.lo * 1 <= MAX_PER_HA) {
    const hi = rate.hi;
    return {
      status: "bio_unit_from_code",
      per_ha: range(rate.lo, hi, kind),
      per_acre: range(rate.lo * HA_PER_ACRE, hi !== null ? hi * HA_PER_ACRE : null, kind, true),
      base_lo: rate.lo,
      water_ok: waterOk,
      reason: "biological, unit from the formulation type",
    };
  }
  return asPrinted(bio ? "bio_as_printed" : "unreconciled", "no usable unit and nothing to check it against");
}
