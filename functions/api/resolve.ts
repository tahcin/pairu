import { getData } from "../_lib/data";
import { resolve } from "../_lib/decide";
import type { Candidate, Env } from "../_lib/types";
import { bad, json } from "../_lib/util";

// Pure code, no model: the farmer's yes/no answers pick between the top two candidates.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { candidates?: Candidate[]; answers?: Record<string, boolean> };
  try {
    body = await request.json();
  } catch {
    return bad("Body must be JSON");
  }
  if (!Array.isArray(body.candidates) || !body.candidates.length) return bad("candidates required");
  const data = await getData(env, request);
  return json(resolve(body.candidates, body.answers || {}, data.diseaseById));
};
