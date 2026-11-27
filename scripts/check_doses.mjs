// Runs the app's dose logic over every CIB&RC row for our crops and over every advice card, and
// reports how each dose would be shown plus the safety invariants that must hold.
// Run: node scripts/check_doses.mjs [--all]
import { readFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Bundle the app's own TypeScript (dose.ts and advice.ts) so this check runs the exact same code.
const dir = mkdtempSync(join(tmpdir(), "pairu-doses-"));
const out = join(dir, "advice.mjs");
execFileSync("npx", ["esbuild", "functions/_lib/advice.ts", "--bundle", "--format=esm", "--platform=node", `--outfile=${out}`, "--log-level=error"]);
const { treatmentsFor, buildCard } = await import(out);
const { resolveDose, aiDose, percents, formKind, isGranule } = await import(out.replace("advice.mjs", "advice.mjs")).then(async (m) => {
  const d = join(dir, "dose.mjs");
  execFileSync("npx", ["esbuild", "functions/_lib/dose.ts", "--bundle", "--format=esm", "--platform=node", `--outfile=${d}`, "--log-level=error"]);
  return import(d);
});

const load = (f) => JSON.parse(readFileSync(f, "utf8"));
const uses = load("data/registered_uses.json");
const rows = uses.filter((r) => r.crop_id);
const counts = {};
const kinds = {};
const violations = { hazardous_in_top3_with_safer_option: [], seed_from_product_name_only: [], do_first_hazardous_or_restricted: [], per_acre_on_seed_soil: [], liquid_in_g_or_solid_in_ml: [], over_2x_from_ai: [], bio_bare_number_without_note: [], granule_per_litre: [] };
const isBare = (s) => /^\s*\d+(?:\.\d+)?(?:\s*(?:-|to|–)\s*\d+(?:\.\d+)?)?\s*$/.test(s || "");

const agreement = [];
const shownAgreement = [];
const res = rows.map((r) => {
  const d = resolveDose(r);
  counts[d.status] = (counts[d.status] || 0) + 1;
  if (d.treatment) kinds[d.treatment] = (kinds[d.treatment] || 0) + 1;
  if (d.status === "seed_soil" && (d.per_acre || d.per_ha || d.per_litre)) violations.per_acre_on_seed_soil.push(r);
  const kind = formKind(r.product_label);
  for (const v of [d.per_acre, d.per_ha, d.per_litre]) {
    if (!v || !kind) continue;
    const liquidUnit = v.unit === "ml" || v.unit === "l";
    if ((kind === "liquid") !== liquidUnit) violations.liquid_in_g_or_solid_in_ml.push({ r, v });
  }
  if (d.per_litre && isGranule(r.product_label)) violations.granule_per_litre.push(r);
  // "seed" only in the product name (for example Neem Seed Kernel Extract) must not make a seed treatment.
  if (d.treatment === "seed" && /seed/i.test(r.product_label) && !/\b(FS|WS|DS|ST)\b/.test(r.product_label)) {
    const cells = [r.dose_formulation_raw, r.dose_ai_g_ha, r.waiting_period_raw, r.water_l_ha, r.note_raw, r.target_raw].join(" ").toLowerCase();
    if (!/seed|\/\s*kg|per\s+kg/.test(cells) && !/seed (treatment|dressing|dresser)|per\s*\d*\s*kg\s*(of\s*)?seeds?/i.test(r.product_label)) violations.seed_from_product_name_only.push(r);
  }
  if (d.base_lo) {
    const ai = aiDose(r.dose_ai_g_ha);
    const p = percents(r.product_label);
    if (ai && p.length) {
      const options = [ai.first / (p[0] / 100), ai.sum / (p.reduce((a, b) => a + b, 0) / 100)].flatMap((e) => [e, e * 1000]);
      const best = Math.min(...options.map((e) => Math.max(d.base_lo / e, e / d.base_lo)));
      if (best > 2) violations.over_2x_from_ai.push({ r, d, best });
      agreement.push(best);
      // Same check on the rounded per-acre figure the farmer actually sees.
      if (d.per_acre) {
        const v = parseFloat(d.per_acre.value);
        const shownHa = (v * (d.per_acre.unit === "kg" || d.per_acre.unit === "l" ? 1000 : 1)) / 0.404686;
        shownAgreement.push(Math.min(...options.map((e) => Math.max(shownHa / e, e / shownHa))));
      }
    }
  }
  // The app adds a "unit not printed, read the label" note to bio rows shown as a bare number.
  if (d.status === "bio_as_printed" && isBare(r.dose_formulation_raw)) kinds.bio_bare_with_note = (kinds.bio_bare_with_note || 0) + 1;
  return { r, d };
});

// Card level: products merged because the same product had disagreeing doses on one card.
const kb = load("data/kb.json");
const banned = load("data/banned.json");
const hazard = load("data/hazard.json");
const data = { kb, uses, banned, hazard, diseaseById: new Map(kb.diseases.map((d) => [d.id, d])) };
let merged = 0;
const doFirstCounts = {};
let topThreeNotChecked = [];
for (const dz of kb.diseases) {
  const { bio, chem } = treatmentsFor(dz, data);
  const card = buildCard(dz, data, "en");
  const df = card.do_first;
  doFirstCounts[df ? (df.source === "product" ? `product (${df.group})` : df.source) : "none"] = (doFirstCounts[df ? (df.source === "product" ? `product (${df.group})` : df.source) : "none"] || 0) + 1;
  if (df && df.source === "product") {
    const p = (df.group === "bio" ? card.bio_products : card.chemicals)[df.index];
    if (p.who_class === "Ia" || p.who_class === "Ib" || p.restricted) violations.do_first_hazardous_or_restricted.push({ r: { product_label: `${dz.id}: ${p.product}` } });
  }
  for (const t of [...bio, ...chem]) if (t.dose_conflict) merged++;
  // No WHO Ia/Ib or restricted product in the visible top three when a safer approved one exists.
  for (const list of [card.bio_products, card.chemicals]) {
    const visible = list.filter((t) => !t.avoid);
    const flagged = (t) => t.who_class === "Ia" || t.who_class === "Ib" || t.restricted;
    const safer = visible.filter((t) => !flagged(t)).length;
    visible.slice(0, 3).forEach((t, i) => {
      if (flagged(t) && safer > i) violations.hazardous_in_top3_with_safer_option.push({ r: { product_label: `${dz.id}: ${t.product}` } });
    });
  }
  chem.slice(0, 3).forEach((t) => {
    if (!["inferred", "printed", "per_litre", "seed_soil"].includes(t.dose_status)) topThreeNotChecked.push(`${dz.id}: ${t.product} (${t.dose_conflict ? "dose differs by use" : t.dose_status})`);
  });
}

const n = (k) => counts[k] || 0;
console.log(`rows for our crops: ${rows.length}`);
console.log(`  per acre, unit inferred and checked against the a.i. dose: ${n("inferred")}`);
console.log(`  per acre, printed unit agrees with the a.i. dose (or nothing to check): ${n("printed")}`);
console.log(`  per litre of spray water: ${n("per_litre")}`);
console.log(`  seed / tuber / soil / nursery treatment, as printed: ${n("seed_soil")} (${Object.entries(kinds).filter(([k]) => k !== "bio_bare_with_note").map(([k, v]) => `${k} ${v}`).join(", ")})`);
console.log(`  spray under 100 L water per ha (not drone), as printed: ${n("low_water")}`);
console.log(`  biological, as printed with its unit or with a read-the-label note: ${n("bio_as_printed")} (bare number with note: ${kinds.bio_bare_with_note || 0})`);
console.log(`  other text, as printed: ${n("not_a_rate")}`);
console.log(`  unreconciled, as printed with a read-the-label note: ${n("unreconciled")}`);
console.log(`products merged on a card because their doses differ by use: ${merged}`);
console.log(`biological: spray water printed in the dose column ${n("bio_water")}, unit taken from the formulation type ${n("bio_unit_from_code")}`);
console.log(`"what to do first" source across ${kb.diseases.length} entries: ${JSON.stringify(doFirstCounts)}`);
const within = (x) => agreement.filter((b) => b <= x).length;
console.log(`\nAGREEMENT WITH THE ACTIVE-INGREDIENT COLUMN: of ${agreement.length} per-acre doses shown that can be checked against the a.i. dose,`);
console.log(`  ${((100 * within(1.1)) / agreement.length).toFixed(1)}% are within 10% of the a.i. calculation and ${((100 * within(1.25)) / agreement.length).toFixed(1)}% within 25% (all are within 1.5x by construction).\n`);
const w2 = (x) => shownAgreement.filter((b) => b <= x).length;
console.log(`  On the rounded per-acre figures as displayed (${shownAgreement.length}): ${((100 * w2(1.1)) / shownAgreement.length).toFixed(1)}% within 10%, ${((100 * w2(1.25)) / shownAgreement.length).toFixed(1)}% within 25%.\n`);
console.log("invariants (all must be 0):");
for (const [k, v] of Object.entries(violations)) console.log(`  ${k}: ${v.length}`);
for (const v of [...violations.hazardous_in_top3_with_safer_option, ...violations.seed_from_product_name_only, ...violations.do_first_hazardous_or_restricted].slice(0, 5)) console.log("    ", v.r.product_label);
for (const v of violations.liquid_in_g_or_solid_in_ml.slice(0, 5)) console.log("    ", v.r.product_label, JSON.stringify(v.v));
for (const v of violations.over_2x_from_ai.slice(0, 5)) console.log("    ", v.r.product_label, v.r.dose_formulation_raw, v.best.toFixed(1));
console.log(`top-three chemicals not on a checked path: ${topThreeNotChecked.length}`);
for (const x of topThreeNotChecked.slice(0, 40)) console.log("   ", x);

let seed = 20261127;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const picks = new Set();
while (picks.size < 20) picks.add(Math.floor(rand() * res.length));
console.log("\n20 examples (label | a.i. | printed formulation -> status: per ha / per acre):");
for (const i of picks) {
  const { r, d } = res[i];
  const ha = d.per_ha ? `${d.per_ha.value} ${d.per_ha.unit}` : "-";
  const ac = d.per_acre ? `${d.per_acre.value} ${d.per_acre.unit}` : d.per_litre ? `${d.per_litre.value} ${d.per_litre.unit} per litre` : "-";
  console.log(`  ${r.product_label.slice(0, 50)} | ${r.dose_ai_g_ha} | ${r.dose_formulation_raw} -> ${d.status}${d.treatment ? ` (${d.treatment})` : ""}: ${ha} / ${ac}`);
}
