// Runs the app's dose logic (functions/_lib/dose.ts) over every CIB&RC row for our crops and
// reports how each dose would be shown. Run: node scripts/check_doses.mjs [--all]
// Also checks that no row shown with a per-acre figure is more than 2x away from the dose the
// active-ingredient column implies.
import { readFileSync } from "node:fs";
import { resolveDose, aiDose, percents, parseRate } from "../functions/_lib/dose.ts";

const rows = JSON.parse(readFileSync("data/registered_uses.json", "utf8")).filter((r) => r.crop_id);
const counts = {};
const bad = [];
const out = rows.map((r) => {
  const d = resolveDose(r);
  counts[d.status] = (counts[d.status] || 0) + 1;
  if (d.per_ha) {
    const ai = aiDose(r.dose_ai_g_ha);
    const p = percents(r.product_label);
    const shown = d.base_lo;
    if (ai && p.length) {
      const options = [ai.first / (p[0] / 100), ai.sum / (p.reduce((a, b) => a + b, 0) / 100)].flatMap((e) => [e, e * 1000]);
      const best = Math.min(...options.map((e) => Math.max(shown / e, e / shown)));
      if (best > 2) bad.push({ r, d, best });
    }
  }
  return { r, d };
});

console.log(`rows for our crops: ${rows.length}`);
console.log(`inferred unit (checked against a.i.): ${counts.inferred || 0}`);
console.log(`printed unit (agrees with a.i., or no a.i. to check): ${counts.printed || 0}`);
console.log(`unreconciled (shown as printed, "check the label"): ${counts.unreconciled || 0}`);
console.log(`per litre of spray water: ${counts.per_litre || 0}`);
console.log(`per kg of seed (seed treatment, shown as printed): ${counts.per_kg_seed || 0}`);
console.log(`biological products (shown as printed with instructions, no computed numbers): ${counts.bio_as_printed || 0}`);
console.log(`other text, not a plain rate (shown as printed): ${counts.not_a_rate || 0}`);
console.log(`shown more than 2x away from the a.i. calculation: ${bad.length}`);
for (const b of bad.slice(0, 10)) console.log("  BAD", b.r.product_label, "|", b.r.dose_ai_g_ha, "|", b.r.dose_formulation_raw, "->", JSON.stringify(b.d.per_ha));

// 20 examples, seeded so reruns match.
let seed = 20261127;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const picks = new Set();
while (picks.size < 20) picks.add(Math.floor(rand() * out.length));
console.log("\n20 examples (label | a.i. | printed formulation -> status: per ha / per acre):");
for (const i of picks) {
  const { r, d } = out[i];
  const ha = d.per_ha ? `${d.per_ha.value} ${d.per_ha.unit}` : "-";
  const ac = d.per_acre ? `${d.per_acre.value} ${d.per_acre.unit}` : d.per_litre ? `${d.per_litre.value} ${d.per_litre.unit} per litre` : "-";
  console.log(`  ${r.product_label.slice(0, 50)} | ${r.dose_ai_g_ha} | ${r.dose_formulation_raw} -> ${d.status}: ${ha} / ${ac}`);
}
if (process.argv.includes("--all")) for (const { r, d } of out) if (d.status === "unreconciled") console.log("U", r.product_label, "|", r.dose_ai_g_ha, "|", r.dose_formulation_raw, "|", d.reason);
