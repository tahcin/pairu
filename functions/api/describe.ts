import { getData } from "../_lib/data";
import { scoreDescription } from "../_lib/describe";
import type { Env } from "../_lib/types";
import { bad, isLang, json } from "../_lib/util";
import { translateMany } from "../_lib/sarvam";

// POST /api/describe {crop, keys, lang}: pure code scoring of picked symptom statements.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { crop?: string; keys?: string[]; lang?: string };
  try {
    body = await request.json();
  } catch {
    return bad("Body must be JSON");
  }
  const data = await getData(env, request);
  if (!body.crop || !data.kb.crops.some((c) => c.id === body.crop)) return bad("unknown crop");
  const r = scoreDescription(data, body.crop, Array.isArray(body.keys) ? body.keys.slice(0, 60) : []);
  const lang = isLang(body.lang) ? body.lang : "en";
  if (lang !== "en" && r.questions.length) {
    try {
      const tr = await translateMany(env, r.questions.map((q) => q.question), lang);
      r.questions = r.questions.map((q, i) => ({ ...q, question: tr[i] || q.question }));
    } catch {
      // keep English questions
    }
  }
  return json({ ...r, crop: body.crop, image_quality: "ok", crop_confident: true, crop_detected: body.crop });
};
