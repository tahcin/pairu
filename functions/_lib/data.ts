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
      const [kb, uses, banned, hazard] = await Promise.all([
        load<KB>(env, origin, "kb.json", { crops: [], diseases: [] }),
        load<RegisteredUse[]>(env, origin, "registered_uses.json", []),
        load<Banned[]>(env, origin, "banned.json", []),
        load<Hazard>(env, origin, "hazard.json", {}),
      ]);
      const diseaseById = new Map(kb.diseases.map((d) => [d.id, d]));
      return { kb, uses, banned, hazard, diseaseById };
    })();
    cached.catch(() => (cached = null));
  }
  return cached;
}
