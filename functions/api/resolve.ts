import { getData } from "../_lib/data";
import { resolve } from "../_lib/decide";
import { checkQuestions, resolveCheck, type Answer } from "../_lib/verify";
import type { Candidate, Env } from "../_lib/types";
import { bad, json } from "../_lib/util";

// Pure code, no model: the farmer's yes/no answers pick between the top two candidates, or, after
// a second look, settle the questions the photo could not.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { candidates?: Candidate[]; answers?: Record<string, boolean>; check?: { set?: string[]; answers?: Record<string, Answer> } };
  try {
    body = await request.json();
  } catch {
    return bad("Body must be JSON");
  }
  if (!Array.isArray(body.candidates) || !body.candidates.length) return bad("candidates required");
  const data = await getData(env, request);
  // After a second look: the photo's answers plus the farmer's (the farmer's win), same rules.
  // Questions are rebuilt from the knowledge base, never taken from the request.
  if (body.check && Array.isArray(body.check.set) && body.check.set.length) {
    const set = body.check.set.filter((id) => data.diseaseById.has(id)).slice(0, 5);
    const questions = checkQuestions(set, data.diseaseById);
    const r = resolveCheck(set, questions, { ...(body.check.answers || {}), ...(body.answers || {}) });
    return json({ id: r.status === "decided" ? r.id : null, status: r.status === "decided" ? "decided" : "unsure", alive: r.alive });
  }
  return json(resolve(body.candidates, body.answers || {}, data.diseaseById));
};
