import type { Lang } from "../i18n";

export interface Candidate {
  id: string;
  confidence: number;
  seen: string[];
  seen_symptoms?: number[];
}
export interface Question {
  id: string;
  disease: string;
  question: string;
  yes: string;
  no: string;
}
export interface Diagnosis {
  crop: string | null;
  crop_detected: string | null;
  crop_confident: boolean;
  image_quality: "ok" | "blurry" | "not_a_plant" | "too_far";
  candidates: Candidate[];
  status: "decided" | "ask" | "unsure";
  questions: Question[];
  model: string;
  cached: boolean;
  stage?: 1 | 2;
  verified?: boolean;
  check?: { set: string[]; answers: Record<string, string> };
}
export interface Treatment {
  product: string;
  actives: string[];
  type: string;
  bio: boolean;
  target: string;
  dose_raw: string;
  dose_status: "inferred" | "printed" | "per_litre" | "per_kg_seed" | "bio_as_printed" | "unreconciled" | "not_a_rate";
  dose_per_ha: { value: string; unit: string } | null;
  dose_per_acre: { value: string; unit: string } | null;
  dose_per_litre: { value: string; unit: string } | null;
  water_per_ha: string;
  water_per_acre: string | null;
  water_note: string;
  waiting_days: number | null;
  waiting_raw: string;
  who_class: string | null;
  highly_hazardous: boolean;
  restricted: string | null;
  note: string;
  ipm_recommended?: boolean;
  avoid?: boolean;
  source: { file?: string; page?: number; url?: string };
}
export interface Advice {
  id: string;
  crop: string;
  lang: string;
  name: string;
  name_en: string;
  names?: Record<string, string>;
  kind: string;
  pathogen: string;
  healthy: boolean;
  symptoms: string[];
  favourable_conditions: string;
  organic: { text: string; source: { title: string; url: string } | null }[];
  avoid?: { text: string; source: { title: string; url: string } | null }[];
  etl?: { text: string; source: { title: string; url: string } | null } | null;
  bio_products: Treatment[];
  chemicals: Treatment[];
  banned_removed: number;
  prevention: string[];
  practices: string[];
  sources: { title: string; url: string }[];
  fixture: boolean;
  translated: boolean;
  pending?: boolean;
}
export interface Weather {
  rain_24h_mm: number;
  wind_kmh: number;
  spray_ok: boolean;
  reason: "ok" | "rain" | "wind";
}
export interface CropInfo {
  id: string;
  name_en: string;
  names: Record<string, string>;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error("offline");
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  return body as T;
}

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  crops: () => call<{ crops: CropInfo[]; fixture: boolean }>("/api/crops"),
  diagnose: (crop: string | null, image: string, note: string, lang: Lang) =>
    call<Diagnosis>("/api/diagnose", post({ crop, image, note, lang })),
  resolve: (candidates: Candidate[], answers: Record<string, boolean>, check?: Diagnosis["check"]) =>
    call<{ id: string | null; status: "decided" | "unsure" }>("/api/resolve", post({ candidates, answers, check })),
  advice: (id: string, lang: Lang) => call<Advice>(`/api/advice?id=${encodeURIComponent(id)}&lang=${lang}`),
  tts: (text: string, lang: Lang) => call<{ audios: string[]; mime: string }>("/api/tts", post({ text, lang })),
  stt: (audio: Blob, lang: Lang) => {
    const form = new FormData();
    const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
    form.append("audio", audio, `speech.${ext}`);
    form.append("lang", lang);
    return call<{ text: string; lang: string | null }>("/api/stt", { method: "POST", body: form });
  },
  symptoms: (crop: string, lang: Lang) => call<{ items: { key: string; text: string }[]; lang: string }>(`/api/symptoms?crop=${crop}&lang=${lang}`),
  matchSpoken: (crop: string, text: string) => call<{ keys: string[] }>("/api/symptoms", post({ crop, text })),
  describe: (crop: string, keys: string[], lang: Lang) => call<Diagnosis>("/api/describe", post({ crop, keys, lang })),
  weather: (lat: number, lon: number) => call<Weather>(`/api/weather?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`),
};
