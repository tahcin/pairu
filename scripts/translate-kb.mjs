// Builds data/kb_<lang>.json (same format as data/kb_te.json) for the other Indian languages, so
// the app serves farmer-facing KB text without any live translation.
// One Gemini call per crop per language: gemma-4-31b-it first (with backoff on 503), then
// gemini-3.5-flash-lite as a fallback with a hard cap of 150 calls. Product and chemical names stay
// in English; numbers and units are kept as they are. Every key is validated; gaps are retried.
// Run: node scripts/translate-kb.mjs [langs...]   (reads GEMINI_API_KEY from env or .dev.vars)
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const LANGS = { hi: "Hindi", ta: "Tamil", kn: "Kannada", mr: "Marathi", bn: "Bengali", or: "Odia", gu: "Gujarati", pa: "Punjabi", ml: "Malayalam" };
const SCRIPT_NAME = { hi: "Devanagari", mr: "Devanagari", bn: "Bengali", pa: "Gurmukhi", gu: "Gujarati", or: "Odia", ta: "Tamil", kn: "Kannada", ml: "Malayalam" };
const PRIMARY = "gemma-4-31b-it";
const FALLBACK = "gemini-3.5-flash-lite";
// Second free-tier model with its own daily quota, tried before the capped fallback. It is also the
// live app's first vision model, so its use here is capped too (SPARE_CAP) to leave quota for diagnosis.
const SPARE = "gemini-3.1-flash-lite";
const SPARE_CAP = Number(process.env.SPARE_CAP || 40);
const FALLBACK_CAP = Number(process.env.FALLBACK_CAP || 150);
const calls = { [PRIMARY]: 0, [SPARE]: 0, [FALLBACK]: 0, failed: 0 };

let key = process.env.GEMINI_API_KEY;
if (!key && existsSync(".dev.vars")) key = (readFileSync(".dev.vars", "utf8").match(/^GEMINI_API_KEY\s*=\s*"?([^"\n]+)"?/m) || [])[1];
if (!key) throw new Error("GEMINI_API_KEY missing");

const kb = JSON.parse(readFileSync("data/kb.json", "utf8"));
let gemmaFails = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// English source for one crop, in the kb_te.json shape.
function sourceFor(crop) {
  const diseases = {};
  const questions = {};
  for (const d of kb.diseases.filter((x) => x.crop === crop.id)) {
    diseases[d.id] = {
      name: d.name_en,
      symptoms: d.symptoms || [],
      prevention: d.prevention || [],
      practices: d.practices || [],
      favourable_conditions: d.favourable_conditions || "",
      organic_bio: (d.organic_bio || []).map((o) => o.text),
      avoid: (d.avoid || []).map((a) => a.text),
      etl: d.etl?.text || "",
    };
    for (const q of d.discriminators || []) questions[q.id] = q.question;
  }
  return { crop: crop.name_en, diseases, questions };
}

function extractJson(text) {
  const t = text.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "").trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  return JSON.parse(t.slice(a, b + 1));
}

async function gemini(model, prompt, timeoutMs = 90000) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: model.startsWith("gemini-") ? { responseMimeType: "application/json", temperature: 0.2 } : { temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw Object.assign(new Error(`${model} ${res.status}`), { status: res.status });
  const j = await res.json();
  return (j.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
}

async function translate(obj, lang) {
  const prompt = [
    `Translate every string value in this JSON from English into ${LANGS[lang]} for small farmers in India. Write only in the ${SCRIPT_NAME[lang]} script; never use letters of any other Indian script.`,
    "Use plain, everyday village words a farmer would say, short clear sentences, and the local common names of pests and diseases where they exist.",
    "Keep pesticide, product and chemical names (for example imidacloprid, Pseudomonas fluorescens, Bordeaux mixture) exactly in English letters.",
    "Keep every number, percentage and unit exactly as written. Do not add or drop information.",
    "Return only JSON with exactly the same keys and the same number of items in every list. Do not translate keys.",
    "",
    JSON.stringify(obj),
  ].join("\n");
  // gemma is tried twice per crop; after six failures in a row it is skipped (circuit breaker) in
  // favour of the fallback model, which has a hard call cap.
  for (let i = 0; i < 2 && gemmaFails < (process.env.NO_GEMMA ? 0 : 6); i++) {
    try {
      calls[PRIMARY]++;
      const out = extractJson(await gemini(PRIMARY, prompt, 150000));
      gemmaFails = 0;
      return out;
    } catch (e) {
      gemmaFails++;
      await sleep(3000);
    }
  }
  for (let i = 0; i < 2 && calls[SPARE] < SPARE_CAP; i++) {
    try {
      calls[SPARE]++;
      await sleep(4500);
      return extractJson(await gemini(SPARE, prompt));
    } catch (e) {
      await sleep(5000);
    }
  }
  if (calls[FALLBACK] >= FALLBACK_CAP) throw new Error("fallback cap reached");
  calls[FALLBACK]++;
  await sleep(4500); // stay under 15 requests a minute
  return extractJson(await gemini(FALLBACK, prompt));
}

// Unicode blocks of each script; a translation containing letters of another Indian script is
// a model glitch (seen: Bengali letters inside a Kannada pest name) and is redone.
const SCRIPT = { hi: [0x0900, 0x097f], mr: [0x0900, 0x097f], bn: [0x0980, 0x09ff], pa: [0x0a00, 0x0a7f], gu: [0x0a80, 0x0aff], or: [0x0b00, 0x0b7f], ta: [0x0b80, 0x0bff], te: [0x0c00, 0x0c7f], kn: [0x0c80, 0x0cff], ml: [0x0d00, 0x0d7f] };
let CUR = "";
function foreignScript(text) {
  const [lo, hi] = SCRIPT[CUR] || [0, 0];
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c === 0x0964 || c === 0x0965) continue; // the danda is shared by several scripts
    if (c >= 0x0900 && c <= 0x0d7f && (c < lo || c > hi)) return true;
  }
  return false;
}

// True when a farmer-facing sentence came back with no letters of the target script at all
// (left in English, or romanised). Product lines (organic_bio, avoid) may legitimately stay English.
function noTargetScript(text) {
  const [lo, hi] = SCRIPT[CUR] || [0, 0];
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c >= lo && c <= hi) return false;
  }
  return true;
}
const MUST_TRANSLATE = ["name", "favourable_conditions", "etl", "symptoms", "prevention", "practices"];

// Check shape: every key present, lists the same length, every string non-empty and in the right script.
function gaps(src, out, path = "") {
  const g = [];
  if (typeof src === "string") {
    if (src.trim() && !(typeof out === "string" && out.trim() && !foreignScript(out))) g.push(path);
    return g;
  }
  if (Array.isArray(src)) {
    if (!Array.isArray(out) || out.length !== src.length) return [path];
    src.forEach((s, i) => g.push(...gaps(s, out[i], `${path}[${i}]`)));
    return g;
  }
  for (const k of Object.keys(src)) g.push(...gaps(src[k], out?.[k], `${path}.${k}`));
  return g;
}

// --fix-script: re-translate only the single strings that contain letters of another script.
if (process.argv.includes("--fix-script")) {
  for (const lang of process.argv.slice(2).filter((a) => !a.startsWith("--"))) {
    CUR = lang;
    const file = `data/kb_${lang}.json`;
    const doc = JSON.parse(readFileSync(file, "utf8"));
    const todo = {};
    for (const d of kb.diseases) {
      const t = doc.diseases[d.id];
      if (!t) continue;
      const src = sourceFor(kb.crops.find((c) => c.id === d.crop)).diseases[d.id];
      for (const [k, v] of Object.entries(t)) {
        const bad = (x) => typeof x === "string" && x.trim() && (foreignScript(x) || (MUST_TRANSLATE.includes(k) && noTargetScript(x)));
        if (typeof v === "string" && bad(v)) todo[`${d.id}|${k}`] = src[k];
        if (Array.isArray(v)) v.forEach((x, i) => bad(x) && (todo[`${d.id}|${k}|${i}`] = src[k][i]));
      }
    }
    for (const [q, v] of Object.entries(doc.questions || {})) if (foreignScript(v) || noTargetScript(v)) for (const d of kb.diseases) for (const x of d.discriminators || []) if (x.id === q) todo[`q|${q}`] = x.question;
    const n = Object.keys(todo).length;
    if (!n) continue;
    const out = {};
    const keys = Object.keys(todo);
    for (let i = 0; i < keys.length; i += 60) {
      try {
        Object.assign(out, await translate(Object.fromEntries(keys.slice(i, i + 60).map((k) => [k, todo[k]])), lang));
      } catch (e) {
        console.error(lang, String(e));
      }
    }
    let fixed = 0;
    for (const [key, val] of Object.entries(out)) {
      if (!(key in todo) || typeof val !== "string" || !val.trim() || foreignScript(val) || noTargetScript(val)) continue;
      const [id, field, idx] = key.split("|");
      if (id === "q") doc.questions[field] = val;
      else if (idx !== undefined) doc.diseases[id][field][Number(idx)] = val;
      else doc.diseases[id][field] = val;
      fixed++;
    }
    writeFileSync(file, JSON.stringify(doc, null, 1) + "\n");
    console.log(`${lang}: fixed ${fixed} of ${n} strings  calls ${JSON.stringify(calls)}`);
  }
  console.log("done", JSON.stringify(calls));
  process.exit(0);
}

const langs = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(LANGS);
for (const lang of langs) {
  CUR = lang;
  const file = `data/kb_${lang}.json`;
  const doc = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : { version: 1, lang, about: `${LANGS[lang]} text for data/kb.json, keyed like data/kb_te.json. Machine translated with ${PRIMARY} (fallback ${FALLBACK}); not yet reviewed by a person.`, crops: {}, diseases: {}, questions: {} };
  for (const crop of kb.crops) {
    const src = sourceFor(crop);
    const have = { crop: doc.crops[crop.id] || "", diseases: Object.fromEntries(Object.keys(src.diseases).map((id) => [id, doc.diseases[id]])), questions: Object.fromEntries(Object.keys(src.questions).map((q) => [q, doc.questions[q]])) };
    if (!gaps(src, have).length) continue;
    let out = null;
    for (let tries = 0; tries < 3 && (!out || gaps(src, out).length); tries++) {
      try {
        out = await translate(src, lang);
      } catch (e) {
        calls.failed++;
        console.error(`${lang} ${crop.id}: ${e.message}`);
      }
    }
    if (!out) continue;
    const bad = gaps(src, out);
    // Keep whatever validated; anything missing stays out (the app falls back for that string).
    if (typeof out.crop === "string" && out.crop.trim()) doc.crops[crop.id] = crop.names?.[lang] || out.crop;
    for (const id of Object.keys(src.diseases)) {
      const o = out.diseases?.[id];
      if (o && !gaps(src.diseases[id], o).length) doc.diseases[id] = o;
    }
    for (const q of Object.keys(src.questions)) if (typeof out.questions?.[q] === "string" && out.questions[q].trim() && !foreignScript(out.questions[q])) doc.questions[q] = out.questions[q];
    console.log(`${lang} ${crop.id}: ${bad.length ? `${bad.length} gaps` : "ok"}  calls ${JSON.stringify(calls)}`);
    writeFileSync(file, JSON.stringify(doc, null, 1) + "\n");
  }
}
console.log("done", JSON.stringify(calls));
