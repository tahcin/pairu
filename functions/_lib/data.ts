// Loads the built data files. They are served as static assets under /data/ (copied there at
// build time by scripts/copy-data.mjs) and read through the ASSETS binding, so the Worker bundle
// stays small however large the CIB&RC register grows.
import type { Banned, Disease, Env, Hazard, KB, RegisteredUse } from "./types";

export interface Data {
  kb: KB;
  uses: RegisteredUse[];
  banned: Banned[];
  hazard: Hazard;
  diseaseById: Map<string, Disease>;
  // Reviewed Telugu for KB text (data/kb_te.json), keyed by disease id; empty until that file exists.
  kbTe: Map<string, Record<string, any>>;
  kbTeTag: string;
}

let cached: Promise<Data> | null = null;

async function load<T>(env: Env, origin: string, name: string, fallback: T): Promise<T> {
  try {
    const res = await env.ASSETS.fetch(new URL(`/data/${name}`, origin).toString());
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export function getData(env: Env, request: Request): Promise<Data> {
  if (!cached) {
    const origin = new URL(request.url).origin;
    cached = (async () => {
      const [kb, uses, banned, hazard, te] = await Promise.all([
        load<KB>(env, origin, "kb.json", { crops: [], diseases: [] }),
        load<RegisteredUse[]>(env, origin, "registered_uses.json", []),
        load<Banned[]>(env, origin, "banned.json", []),
        load<Hazard>(env, origin, "hazard.json", {}),
        load<any>(env, origin, "kb_te.json", null),
      ]);
      const diseaseById = new Map(kb.diseases.map((d) => [d.id, d]));
      // Accept {diseases: [{id, ...}]}, {diseases: {id: {...}}} or a plain {id: {...}} map.
      const kbTe = new Map<string, Record<string, any>>();
      const src = te && (te.diseases ?? te);
      if (Array.isArray(src)) for (const x of src) x && x.id && kbTe.set(x.id, x);
      else if (src && typeof src === "object") for (const [k, v] of Object.entries(src)) if (v && typeof v === "object") kbTe.set(k, v as Record<string, any>);
      return { kb, uses, banned, hazard, diseaseById, kbTe, kbTeTag: String(kbTe.size) };
    })();
    cached.catch(() => (cached = null));
  }
  return cached;
}
