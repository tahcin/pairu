import { getData } from "../_lib/data";
import { secondLook } from "../_lib/verify";
import type { Candidate, Env } from "../_lib/types";
import { bad, json } from "../_lib/util";

// Eval only: runs the second look on first-look candidates saved from an earlier run, so the
// accuracy test does not repeat the first model call. Off unless EVAL_DEBUG is "1", which only
// eval/serve_local.sh sets; in production this path answers 404.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (env.EVAL_DEBUG !== "1") return json({ error: "not found" }, 404);
  let body: { crop?: string; image?: string; candidates?: Candidate[] };
  try {
    body = await request.json();
  } catch {
    return bad("Body must be JSON");
  }
  const image = (body.image || "").replace(/^data:image\/\w+;base64,/, "");
  if (!body.crop || !image || !Array.isArray(body.candidates)) return bad("crop, image and candidates required");
  const data = await getData(env, request);
  const kbTag = data.kb._fixture ? "fixture" : String(data.kb.diseases.length);
  try {
    return json(await secondLook(env, body.crop, image, body.candidates, data.diseaseById, kbTag));
  } catch (e) {
    return json({ error: "second look failed", detail: String(e).slice(0, 800) }, 502);
  }
};
