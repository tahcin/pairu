import { getData } from "../_lib/data";
import { decide } from "../_lib/decide";
import type { Candidate, Env, Question } from "../_lib/types";
import { translateMany } from "../_lib/sarvam";
import { bad, isLang, json, kvGetJSON, kvPutJSON, sha256 } from "../_lib/util";
import { buildPrompt, QUALITIES, runVision } from "../_lib/vision";
import { DECIDE_V2, secondLook, VERIFY_MIN } from "../_lib/verify";

const PROMPT_VERSION = "v2"; // v2: second look (functions/_lib/verify.ts) between 0.4 and 0.9

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { crop?: string | null; image?: string; note?: string; lang?: string };
  try {
    body = await request.json();
  } catch {
    return bad("Body must be JSON");
  }
  const image = (body.image || "").replace(/^data:image\/\w+;base64,/, "");
  if (!image || image.length < 1000) return bad("image is required (base64 JPEG)");
  if (image.length > 3_000_000) return bad("image too large; resize to 1024px first", 413);
  const note = (body.note || "").slice(0, 600);

  const data = await getData(env, request);
  const crop = body.crop ? data.kb.crops.find((c) => c.id === body.crop) : null;
  if (body.crop && !crop) return bad(`unknown crop ${body.crop}`);
  const crops = crop ? [crop] : data.kb.crops;
  const diseases = data.kb.diseases.filter((d) => crops.some((c) => c.id === d.crop));
  const ids = [...new Set([...diseases.map((d) => d.id), ...crops.map((c) => `${c.id}_healthy`), "unknown"])];

  const kbTag = data.kb._fixture ? "fixture" : String(data.kb.diseases.length);
  const key = `dx:${PROMPT_VERSION}:${kbTag}:${await sha256(image, "|", crop?.id || "", "|", note)}`;
  const lang = isLang(body.lang) ? body.lang : "en";
  const hit = await kvGetJSON<DxResult>(env.PAIRU_CACHE, key);
  if (hit) return json({ ...(await localise(env, hit, lang)), cached: true });

  let vision;
  try {
    vision = await runVision(env, buildPrompt(crops, diseases, crop?.id || null, note), image, ids, data.kb.crops.map((c) => c.id));
  } catch (e) {
    return json({ error: "All vision models failed", detail: String(e).slice(0, 500) }, 502);
  }
  const { out, model } = vision;

  // Keep only ids from our list, clamp confidences, renormalise if they add up to more than 1.
  const allowed = new Set(ids);
  let cands: Candidate[] = [];
  const seenIds = new Set<string>();
  for (const c of out.candidates || []) {
    if (!allowed.has(c.id) || seenIds.has(c.id)) continue;
    seenIds.add(c.id);
    const conf = Math.max(0, Math.min(1, Number(c.confidence) || 0));
    cands.push({ id: c.id, confidence: conf, seen: (c.seen || []).slice(0, 6), seen_symptoms: (c.seen_symptoms || []).filter((n) => Number.isInteger(n)) });
  }
  const sum = cands.reduce((s, c) => s + c.confidence, 0);
  if (sum > 1) cands = cands.map((c) => ({ ...c, confidence: c.confidence / sum }));
  cands.sort((a, b) => b.confidence - a.confidence);
  cands = cands.slice(0, 3).map((c) => ({ ...c, confidence: Math.round(c.confidence * 100) / 100 }));

  const quality = (QUALITIES as readonly string[]).includes(out.image_quality) ? out.image_quality : "ok";
  const detected = out.crop_detected && out.crop_detected !== "other" ? out.crop_detected : null;
  const result: Record<string, unknown> & { status: string; questions: Question[]; candidates: Candidate[] } = {
    crop: crop?.id || detected,
    crop_detected: detected,
    crop_confident: Boolean(out.crop_matches),
    image_quality: quality,
    candidates: cands,
    status: "unsure",
    questions: [],
    model,
    stage: 1,
    verified: false,
  };
  const top = cands[0];
  const cropId = crop?.id || (out.crop_matches ? detected : null);
  // A different crop in the photo than the one chosen is not something to diagnose through.
  const otherCrop = Boolean(crop && detected && detected !== crop.id && !out.crop_matches);
  if (otherCrop || quality !== "ok" || !top || top.id === "unknown") {
    result.status = "unsure";
  } else if (top.confidence >= DECIDE_V2) {
    result.status = "decided";
  } else if (top.confidence < VERIFY_MIN || !cropId) {
    // Too unsure to check, or no crop to check against: the first-look rules apply.
    Object.assign(result, decide(cands, true, data.diseaseById));
    if (result.status === "decided") result.status = "unsure";
  } else {
    // The second look: Gemini answers our yes/no questions from the photo, code decides.
    try {
      const v = await secondLook(env, cropId, image, cands, data.diseaseById, kbTag);
      if (v) {
        Object.assign(result, {
          status: v.status,
          questions: v.questions,
          candidates: v.candidates,
          verified: v.verified,
          check: v.check,
          verify_model: v.verify_model,
          stage: 2,
        });
      } else {
        Object.assign(result, decide(cands, true, data.diseaseById));
      }
    } catch {
      // If the second look fails, fall back to the first-look questions rather than fail the farmer.
      Object.assign(result, decide(cands, true, data.diseaseById), { stage: 1, verify_failed: true });
    }
    // Below 0.9 nothing is decided without the second look agreeing.
    if (result.stage === 1 && result.status === "decided") result.status = "unsure";
  }
  await kvPutJSON(env.PAIRU_CACHE, key, result, 30);
  return json({ ...(await localise(env, result, lang)), cached: false });
};

type DxResult = { questions: Question[] } & Record<string, unknown>;

// Follow-up questions are stored in English and translated (with caching) for the farmer.
async function localise<T extends DxResult>(env: Env, r: T, lang: string): Promise<T> {
  if (lang === "en" || !r.questions?.length) return r;
  try {
    const tr = await translateMany(env, r.questions.map((q) => q.question), lang);
    return { ...r, questions: r.questions.map((q, i) => ({ ...q, question: tr[i] || q.question, question_en: q.question })) };
  } catch {
    return r;
  }
}
