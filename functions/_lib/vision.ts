// Vision step: show the model the photo and the closed list of diseases we hold for the crop, and
// get back strict JSON. Gemini free tier first (two models), Claude Haiku only as a last resort.
import Anthropic from "@anthropic-ai/sdk";
import { MODEL_ORDER, firstThatWorks, generateJson } from "./models";
import type { Crop, Disease, Env } from "./types";

// Model order lives in models.ts: gemini-3.5-flash-lite, gemini-3.1-flash-lite, gemma-4-31b-it.
export const PRIMARY = MODEL_ORDER[0];
export const SECONDARY = MODEL_ORDER[1];
export const LAST_RESORT = "claude-haiku-5-5";

// A slow model call falls back to the next model instead of hanging.
export const MODEL_TIMEOUT_MS = 12000;

// Hard daily cap on the paid Claude fallback: count calls per UTC day in KV (only a number is
// stored) and stop calling Claude after the cap, so the request falls back to "please try again".
export const CLAUDE_DAILY_CAP = 40;
async function claudeAllowed(env: Env): Promise<boolean> {
  if (!env.ANTHROPIC_API_KEY || !env.PAIRU_CACHE) return false;
  const key = `claude-calls:${new Date().toISOString().slice(0, 10)}`;
  try {
    const used = parseInt((await env.PAIRU_CACHE.get(key)) || "0", 10) || 0;
    if (used >= CLAUDE_DAILY_CAP) return false;
    await env.PAIRU_CACHE.put(key, String(used + 1), { expirationTtl: 3 * 86400 });
    return true;
  } catch {
    return false; // if the counter cannot be read or written, do not spend
  }
}

export const QUALITIES = ["ok", "blurry", "not_a_plant", "too_far"] as const;

export interface VisionOut {
  crop_detected: string;
  crop_matches: boolean;
  image_quality: string;
  candidates: { id: string; confidence: number; seen: string[]; seen_symptoms: number[] }[];
}

export function buildPrompt(crops: Crop[], diseases: Disease[], chosenCrop: string | null, note: string): string {
  const lines: string[] = [];
  lines.push(
    "You are a careful plant pathologist looking at one photo a farmer in India took of a crop.",
    chosenCrop
      ? `The farmer says the crop is: ${chosenCrop}.`
      : "The farmer did not say which crop this is; work it out from the photo.",
    "Choose the most likely conditions ONLY from this list of ids. Never invent an id.",
    "",
  );
  for (const crop of crops) {
    lines.push(`Crop ${crop.id} (${crop.name_en}):`);
    for (const d of diseases.filter((x) => x.crop === crop.id)) {
      if (d.id.endsWith("_healthy")) continue;
      lines.push(`- id ${d.id}: ${d.name_en}. Looks like: ${d.photo_cues.join("; ")}.`);
      if (chosenCrop && d.symptoms.length) {
        lines.push(`  Symptoms (numbered from 0): ${d.symptoms.map((s, i) => `[${i}] ${s}`).join(" ")}`);
      }
    }
    lines.push(`- id ${crop.id}_healthy: the leaf or plant looks healthy, no disease signs.`);
  }
  lines.push(
    "- id unknown: a problem is visible but it matches nothing in the list, or you cannot tell.",
    "",
    "Return JSON with:",
    "crop_detected: the crop id you see in the photo (from the crop ids above), or other.",
    "crop_matches: true if the photo shows the crop the farmer named (or true when no crop was named and you are fairly sure of the crop).",
    "image_quality: ok, blurry (out of focus), not_a_plant (no crop leaf or plant in view) or too_far (plant too small to judge).",
    "candidates: up to three ids from the list, most likely first, each with confidence between 0 and 1 (the confidences together must not add up to more than 1; be honest and use low numbers when unsure), seen: the 'looks like' cues you actually see in this photo, and seen_symptoms: the numbers of the listed symptoms of that id that are visible in the photo.",
  );
  if (note.trim()) {
    lines.push("", `The farmer also described the problem (may be in an Indian language): "${note.trim().slice(0, 600)}"`);
  }
  return lines.join("\n");
}

function geminiSchema(ids: string[], cropIds: string[]) {
  return {
    type: "object",
    properties: {
      crop_detected: { type: "string", enum: [...cropIds, "other"] },
      crop_matches: { type: "boolean" },
      image_quality: { type: "string", enum: [...QUALITIES] },
      candidates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: ids },
            confidence: { type: "number" },
            seen: { type: "array", items: { type: "string" } },
            seen_symptoms: { type: "array", items: { type: "integer" } },
          },
          required: ["id", "confidence", "seen", "seen_symptoms"],
        },
      },
    },
    required: ["crop_detected", "crop_matches", "image_quality", "candidates"],
  };
}

async function callGemini(env: Env, model: string, prompt: string, imageB64: string, schema: unknown): Promise<VisionOut> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ inline_data: { mime_type: "image/jpeg", data: imageB64 } }, { text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema },
    }),
    signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  return JSON.parse(text) as VisionOut;
}

async function callClaude(env: Env, prompt: string, imageB64: string, ids: string[], cropIds: string[]): Promise<VisionOut> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: MODEL_TIMEOUT_MS, maxRetries: 0 });
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      crop_detected: { type: "string", enum: [...cropIds, "other"] },
      crop_matches: { type: "boolean" },
      image_quality: { type: "string", enum: [...QUALITIES] },
      candidates: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string", enum: ids },
            confidence: { type: "number" },
            seen: { type: "array", items: { type: "string" } },
            seen_symptoms: { type: "array", items: { type: "integer" } },
          },
          required: ["id", "confidence", "seen", "seen_symptoms"],
        },
      },
    },
    required: ["crop_detected", "crop_matches", "image_quality", "candidates"],
  };
  const response = await client.messages.create({
    model: LAST_RESORT,
    max_tokens: 2000,
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageB64 } },
          { type: "text", text: prompt },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("claude refused");
  const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return JSON.parse(text) as VisionOut;
}

export async function runVision(
  env: Env,
  prompt: string,
  imageB64: string,
  ids: string[],
  cropIds: string[],
): Promise<{ out: VisionOut; model: string; errors: string[] }> {
  const schema = geminiSchema(ids, cropIds);
  let errors: string[] = [];
  try {
    const r = await firstThatWorks(env, (model) => generateJson<VisionOut>(env, model, prompt, imageB64, schema));
    return { out: r.value, model: r.model, errors: r.errors };
  } catch (e) {
    errors = (e as { errors?: string[] }).errors || [String(e)];
  }
  if (await claudeAllowed(env)) {
    try {
      return { out: await callClaude(env, prompt, imageB64, ids, cropIds), model: LAST_RESORT, errors };
    } catch (e) {
      errors.push(String(e));
    }
  } else {
    errors.push("claude daily cap reached");
  }
  throw new Error(errors.join(" | "));
}
