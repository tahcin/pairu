import { stt } from "../_lib/sarvam";
import type { Env } from "../_lib/types";
import { bad, isLang, json } from "../_lib/util";

// Multipart upload with field "audio" (or "file") and optional "lang".
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("Send multipart/form-data with an audio file");
  }
  const file = (form.get("audio") || form.get("file")) as unknown as File | null;
  if (!file || typeof file === "string") return bad("audio file required");
  if (file.size > 5_000_000) return bad("audio too large", 413);
  const lang = form.get("lang");
  try {
    return json(await stt(env, file, isLang(lang) && lang !== "en" ? lang : null));
  } catch (e) {
    return json({ error: "Speech to text failed", detail: String(e).slice(0, 300) }, 502);
  }
};
