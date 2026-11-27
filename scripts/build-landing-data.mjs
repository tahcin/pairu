// Builds public/landing/register.json for the landing page: one entry per approved use in
// data/registered_uses.json for our 13 crops (crop, product type, and whether it is a paddy brown
// spot use), plus the first rows of the live paddy brown spot advice card. Reads data/ only;
// the advice card is fetched read-only from the live API in English (no model call).
// Run: node scripts/build-landing-data.mjs
import { readFileSync, writeFileSync } from "node:fs";

const uses = JSON.parse(readFileSync("data/registered_uses.json", "utf8")).filter((u) => u.crop_id);
const kb = JSON.parse(readFileSync("data/kb.json", "utf8"));
const ORDER = ["paddy", "cotton", "chilli", "tomato", "groundnut", "brinjal", "potato", "maize", "mango", "onion", "blackgram", "banana", "cashew"];
const crops = ORDER.map((id) => {
  const c = kb.crops.find((x) => x.id === id);
  return { id, en: c.name_en, te: c.names?.te || "", count: uses.filter((u) => u.crop_id === id).length };
});
const TYPES = ["fungicide", "insecticide", "bio-fungicide", "bio-insecticide", "herbicide"];
const bs = kb.diseases.find((d) => d.id === "paddy_brown_spot");
const isBs = (u) => u.crop_id === "paddy" && bs.cibrc_targets.includes(u.target_norm);

const res = await fetch("https://pairu.tahcin.tech/api/advice?id=paddy_brown_spot&lang=en");
const card = await res.json();
const shown = [...card.bio_products, ...card.chemicals];
const top = card.chemicals.filter((p) => !p.avoid).slice(0, 3);
const norm = (s) => s.toLowerCase().replace(/\s+/g, "");

const out = {
  built: new Date().toISOString().slice(0, 10),
  source: "data/registered_uses.json (CIB&RC Major Uses of Pesticides, as on 30.09.2026) and /api/advice?id=paddy_brown_spot&lang=en",
  total: uses.length,
  crops,
  types: TYPES,
  brownSpot: {
    te: bs.names?.te || "",
    en: bs.name_en,
    // The same disease's name in other languages, exactly as in data/kb_<lang>.json (skipped if absent).
    names: Object.fromEntries(
      ["hi", "ta", "kn", "bn", "or"]
        .map((l) => {
          try {
            const t = JSON.parse(readFileSync(`data/kb_${l}.json`, "utf8"));
            return [l, t.diseases?.paddy_brown_spot?.name || ""];
          } catch {
            return [l, ""];
          }
        })
        .filter(([, n]) => n),
    ),
    uses: uses.filter(isBs).length,
    shown: shown.length,
    top: top.map((p) => ({
      product: p.product,
      dose: p.dose_per_acre ? `${p.dose_per_acre.value} ${p.dose_per_acre.unit}` : p.dose_per_litre ? `${p.dose_per_litre.value} ${p.dose_per_litre.unit} per litre` : p.dose_raw,
      wait: p.waiting_days,
      ipm: Boolean(p.ipm_recommended),
      who: p.who_class || null,
    })),
  },
  // [crop index, type index, flag]: flag 0 = other, 1 = paddy brown spot use shown on the card,
  // 2 = brown spot use not shown, 3..5 = one of the card's first three rows.
  u: uses.map((u) => {
    const ci = ORDER.indexOf(u.crop_id);
    const ti = Math.max(0, TYPES.indexOf(u.pesticide_type));
    let f = 0;
    if (isBs(u)) {
      const t = top.findIndex((p) => norm(p.product) === norm(u.product_label));
      f = t >= 0 ? 3 + t : shown.some((p) => norm(p.product) === norm(u.product_label)) ? 1 : 2;
    }
    return [ci, ti, f];
  }),
};
// Each of the three rows keeps exactly one particle; duplicates of the same row fall back to "shown".
const seen = new Set();
for (const r of out.u) if (r[2] >= 3) { if (seen.has(r[2])) r[2] = 1; else seen.add(r[2]); }
writeFileSync("public/landing/register.json", JSON.stringify(out));
console.log(out.total, out.brownSpot.uses, out.brownSpot.shown, out.u.filter((r) => r[2] >= 3).length, out.u.filter((r) => r[2] === 1).length, out.u.filter((r) => r[2] === 2).length);
console.log(out.brownSpot.top);
