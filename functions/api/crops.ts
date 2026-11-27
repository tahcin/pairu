import { getData } from "../_lib/data";
import type { Env } from "../_lib/types";
import { json } from "../_lib/util";

// Crop list with names in every language, for the crop picker.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const d = await getData(env, request);
  return json({ crops: d.kb.crops.map((c) => ({ id: c.id, name_en: c.name_en, names: c.names })), fixture: Boolean(d.kb._fixture) });
};
