// Reviews the machine-translated UI strings for one language with Claude and applies corrections.
// Gemini quota was nearly used up and Sarvam was out of credits on 27 Nov, so one Claude call per
// language. Run: node scripts/review-i18n-claude.mjs <lang>
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const NAMES = { ta: "Tamil", kn: "Kannada", mr: "Marathi", bn: "Bengali", or: "Odia", gu: "Gujarati", pa: "Punjabi (Gurmukhi)", ml: "Malayalam" };
const lang = process.argv[2];
if (!NAMES[lang]) throw new Error("language?");
let apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey && existsSync(".dev.vars")) apiKey = (readFileSync(".dev.vars", "utf8").match(/^ANTHROPIC_API_KEY\s*=\s*"?([^"\n]+)"?/m) || [])[1];
const client = new Anthropic({ apiKey });
const en = JSON.parse(readFileSync("src/i18n/en.json", "utf8"));
const file = `src/i18n/${lang}.json`;
const cur = JSON.parse(readFileSync(file, "utf8"));
const pairs = Object.fromEntries(Object.keys(en).map((k) => [k, { en: en[k], [lang]: cur[k] ?? null }]));

const prompt = [
  `You are reviewing the ${NAMES[lang]} interface strings of Pairu, a phone app for small farmers in India: the farmer photographs a sick crop leaf and gets the disease and government-approved treatment in their own language.`,
  "Context for tricky words: 'checks' and 'My checks' mean the farmer's past crop check-ups (never bank cheques); 'spray' means spraying pesticide on a crop; 'label' means the label on the pesticide bottle or packet; 'KVK' is Krishi Vigyan Kendra; 'sample' photos are example leaf photos.",
  "For each key you get the English source and the current translation (null means missing).",
  `Return only JSON {"corrections": {key: new ${NAMES[lang]} text}} containing ONLY keys whose translation is missing, wrong, misleading, unnatural for a farmer, or in the wrong script. Keep placeholders like {n}, {total}, {crop}, {cue} exactly. Keep numbers, phone numbers and the words KVK, WHO, IPM, CIB&RC, WhatsApp as they are. Write only in the ${NAMES[lang]} script.`,
  "",
  JSON.stringify(pairs),
].join("\n");

const msg = await client.messages
  .stream({ model: "claude-sonnet-5-5", max_tokens: 32000, output_config: { effort: "low" }, messages: [{ role: "user", content: prompt }] })
  .finalMessage();
if (msg.stop_reason === "refusal") throw new Error("refused");
const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
const out = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)).corrections || {};
let applied = 0;
for (const [k, v] of Object.entries(out)) {
  if (!(k in en) || typeof v !== "string" || !v.trim()) continue;
  const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  if (ph(v) !== ph(en[k])) continue;
  cur[k] = v.trim();
  applied++;
}
const ordered = Object.fromEntries(Object.keys(en).map((k) => [k, cur[k]]).filter(([, v]) => v !== undefined));
writeFileSync(file, JSON.stringify(ordered, null, 2) + "\n");
writeFileSync(`scripts/raw/i18n-review-${lang}.json`, JSON.stringify(out, null, 1));
console.log(`${lang}: ${applied} corrections applied (output tokens ${msg.usage.output_tokens})`);
