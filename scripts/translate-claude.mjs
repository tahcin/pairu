// One-off (27 Nov, Gemini quota nearly gone, Sarvam out of credits): translates the new UI keys,
// the confirm-question template and the KB photo cues with Claude, one call per language batch.
// Run: node scripts/translate-claude.mjs <batch: a|b>   (reads ANTHROPIC_API_KEY from env or .dev.vars)
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const BATCHES = { a: ["hi", "ta", "kn", "mr", "bn"], b: ["or", "gu", "pa", "ml"] };
const NAMES = { hi: "Hindi (Devanagari)", ta: "Tamil (Tamil script)", kn: "Kannada (Kannada script)", mr: "Marathi (Devanagari)", bn: "Bengali (Bengali script)", or: "Odia (Odia script)", gu: "Gujarati (Gujarati script)", pa: "Punjabi (Gurmukhi script)", ml: "Malayalam (Malayalam script)" };
const UI_KEYS = ["doFirst", "seeAllSteps", "wk1", "wk2", "wk2any", "wk3", "qOf", "waitShort", "daysN", "retakeShort", "confirmQ"];

let apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey && existsSync(".dev.vars")) apiKey = (readFileSync(".dev.vars", "utf8").match(/^ANTHROPIC_API_KEY\s*=\s*"?([^"\n]+)"?/m) || [])[1];
const client = new Anthropic({ apiKey });

const en = JSON.parse(readFileSync("src/i18n/en.json", "utf8"));
const kb = JSON.parse(readFileSync("data/kb.json", "utf8"));
const cues = Object.fromEntries(kb.diseases.filter((d) => d.photo_cues?.length && !d.id.endsWith("_healthy")).map((d) => [d.id, d.photo_cues[0]]));
const batch = BATCHES[process.argv[2]];
if (!batch) throw new Error("batch a or b");

const source = { ui: Object.fromEntries(UI_KEYS.map((k) => [k, en[k]])), cues };
const prompt = [
  "You translate short strings for Pairu, an app that helps small farmers in India find crop diseases from a leaf photo.",
  `Translate the JSON below into each of these languages: ${batch.map((l) => `${l} = ${NAMES[l]}`).join("; ")}.`,
  "Rules: plain everyday village words; keep placeholders like {n}, {total}, {crop} and {cue} exactly as they are; write each language only in its own script;",
  "the cues are short descriptions of what a farmer sees on the plant (for example 'spindle shaped leaf spots'): translate them as short noun phrases that fit into the confirm question template;",
  'confirmQ is a yes/no question template, "Do you see: {cue}?", where {cue} is replaced by one of the translated cues.',
  `Return only JSON of the form {${batch.map((l) => `"${l}": {"ui": {...same keys}, "cues": {...same keys}}`).join(", ")}} with every key present.`,
  "",
  JSON.stringify(source),
].join("\n");

const stream = client.messages.stream({
  model: "claude-sonnet-5-5",
  max_tokens: 64000,
  output_config: { effort: "low" },
  messages: [{ role: "user", content: prompt }],
});
const msg = await stream.finalMessage();
if (msg.stop_reason === "refusal") throw new Error("refused");
const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
const out = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
writeFileSync(`scripts/raw/claude-tr-${process.argv[2]}.json`, JSON.stringify(out, null, 1));
console.log("usage", JSON.stringify(msg.usage), "langs", Object.keys(out).join(","));
