// Translates the English UI strings (src/i18n/en.json) into the other Indian languages with
// Sarvam, once, at build time. Telugu and Hindi are written by hand (te.json, hi.json) and are
// only created here as drafts if missing. Run: node scripts/translate-ui.mjs [--force] [langs...]
// Reads SARVAM_API_KEY from the environment or from .dev.vars; never prints it.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ALL = ["ta", "kn", "mr", "bn", "or", "gu", "pa", "ml"];
const HAND = ["te", "hi"];
const args = process.argv.slice(2);
const force = args.includes("--force");
const asked = args.filter((a) => !a.startsWith("--"));
const langs = asked.length ? asked : [...ALL, ...HAND];

let key = process.env.SARVAM_API_KEY;
if (!key && existsSync(".dev.vars")) {
  const m = readFileSync(".dev.vars", "utf8").match(/^SARVAM_API_KEY\s*=\s*"?([^"\n]+)"?/m);
  if (m) key = m[1].trim();
}
if (!key) throw new Error("SARVAM_API_KEY missing");

const en = JSON.parse(readFileSync("src/i18n/en.json", "utf8"));
const keys = Object.keys(en);

async function translate(text, lang) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("https://api.sarvam.ai/translate", {
      method: "POST",
      headers: { "content-type": "application/json", "api-subscription-key": key },
      body: JSON.stringify({ input: text, source_language_code: "en-IN", target_language_code: lang === "or" ? "od-IN" : `${lang}-IN`, model: "sarvam-translate:v1" }),
    });
    if (res.ok) return (await res.json()).translated_text;
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw new Error(`translate failed for ${lang}`);
}

for (const lang of langs) {
  const file = `src/i18n/${lang}.json`;
  if (HAND.includes(lang) && existsSync(file)) {
    console.log(`${lang}: hand-written file exists, skipping`);
    continue;
  }
  const prev = existsSync(file) && !force ? JSON.parse(readFileSync(file, "utf8")) : {};
  const missing = keys.filter((k) => !prev[k]);
  if (!missing.length) {
    console.log(`${lang}: up to date`);
    continue;
  }
  // Translate in batches of lines so each call stays under the 2,000 character limit.
  const out = { ...prev };
  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    const joined = batch.map((k) => en[k]).join("\n");
    const lines = (await translate(joined, lang)).split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (lines.length === batch.length) batch.forEach((k, i) => (out[k] = lines[i]));
    else for (const k of batch) out[k] = (await translate(en[k], lang)).trim();
    batch = [];
  };
  let len = 0;
  for (const k of missing) {
    if (len + en[k].length > 1500) {
      await flush();
      len = 0;
    }
    batch.push(k);
    len += en[k].length + 1;
  }
  await flush();
  const ordered = Object.fromEntries(keys.map((k) => [k, out[k]]));
  writeFileSync(file, JSON.stringify(ordered, null, 2) + "\n");
  console.log(`${lang}: wrote ${missing.length} strings`);
}
