// Translates the English UI strings (src/i18n/en.json) into the other Indian languages with
// Gemini, once, at build time. Telugu and Hindi are written by hand (te.json, hi.json) and are
// only created here as drafts if missing. Run: node scripts/translate-ui.mjs [--force] [langs...]
// Reads GEMINI_API_KEY from the environment or from .dev.vars; never prints it.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ALL = ["ta", "kn", "mr", "bn", "or", "gu", "pa", "ml"];
const HAND = ["te", "hi"];
const args = process.argv.slice(2);
const force = args.includes("--force");
const asked = args.filter((a) => !a.startsWith("--"));
const langs = asked.length ? asked : [...ALL, ...HAND];



const en = JSON.parse(readFileSync("src/i18n/en.json", "utf8"));
const keys = Object.keys(en);

// Sarvam ran out of credits on 27 Nov, so UI strings are now translated with Gemini (gemini-3.5-flash-lite,
// as gemma-4-31b-it was returning 503), one call per language with all missing keys as JSON.
const NAMES = { ta: "Tamil", kn: "Kannada", mr: "Marathi", bn: "Bengali", or: "Odia", gu: "Gujarati", pa: "Punjabi", ml: "Malayalam", te: "Telugu", hi: "Hindi" };
let gkey = process.env.GEMINI_API_KEY;
if (!gkey && existsSync(".dev.vars")) gkey = (readFileSync(".dev.vars", "utf8").match(/^GEMINI_API_KEY\s*=\s*"?([^"\n]+)"?/m) || [])[1];
async function geminiJson(obj, lang) {
  const prompt = `Translate every string value in this JSON from English into ${NAMES[lang]} for an app used by small farmers in India. Use plain everyday words. Keep numbers, phone numbers and "KVK", "WHO", "IPM", "CIB&RC" as they are. Return only JSON with the same keys.\n\n${JSON.stringify(obj)}`;
  for (const model of ["gemini-3.5-flash-lite", "gemini-3.5-flash-lite"]) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": gkey },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: "application/json" } }),
        signal: AbortSignal.timeout(90000),
      });
      if (!res.ok) throw new Error(`${model} ${res.status}`);
      const j = await res.json();
      const t = (j.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
      return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    } catch (e) {
      console.error(lang, String(e));
      await new Promise((r) => setTimeout(r, 3000));
    }
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
  const out = { ...prev };
  const got = await geminiJson(Object.fromEntries(missing.map((k) => [k, en[k]])), lang);
  for (const k of missing) if (typeof got[k] === "string" && got[k].trim()) out[k] = got[k].trim();
  const ordered = Object.fromEntries(keys.map((k) => [k, out[k]]));
  writeFileSync(file, JSON.stringify(ordered, null, 2) + "\n");
  console.log(`${lang}: wrote ${missing.length} strings`);
}
