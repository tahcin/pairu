import { getData } from "../_lib/data";
import type { Env } from "../_lib/types";
import { json } from "../_lib/util";

// Lets the app and the evidence page know which data is loaded (real or fixture) and its size.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const d = await getData(env, request);
  return json({
    fixture: Boolean(d.kb._fixture),
    crops: d.kb.crops.length,
    diseases: d.kb.diseases.length,
    registered_uses: d.uses.length,
    banned: d.banned.length,
    hazard: Object.keys(d.hazard).length,
  });
};
