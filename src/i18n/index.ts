// UI strings. English, Telugu and Hindi are written by hand and bundled with the first screen; the
// other eight languages were translated once from English by scripts/translate-ui.mjs, are checked
// in, and load on demand (each is about 25 KB) so the first screen stays small on 3G.
import en from "./en.json";
import te from "./te.json";
import hi from "./hi.json";

export type Key = keyof typeof en;
export type Lang = "te" | "hi" | "ta" | "kn" | "mr" | "bn" | "or" | "gu" | "pa" | "ml" | "en";

const tables: Partial<Record<Lang, Partial<Record<Key, string>>>> = { en, te, hi };

const loaders: Partial<Record<Lang, () => Promise<{ default: Partial<Record<Key, string>> }>>> = {
  ta: () => import("./ta.json"),
  kn: () => import("./kn.json"),
  mr: () => import("./mr.json"),
  bn: () => import("./bn.json"),
  or: () => import("./or.json"),
  gu: () => import("./gu.json"),
  pa: () => import("./pa.json"),
  ml: () => import("./ml.json"),
};

export function langReady(lang: Lang): boolean {
  return Boolean(tables[lang]);
}

// Resolves once the strings for this language are in memory. On failure (offline before the file
// was ever cached) the app falls back to English strings, never to raw keys.
export async function loadLang(lang: Lang): Promise<void> {
  if (tables[lang]) return;
  const load = loaders[lang];
  if (!load) return;
  try {
    tables[lang] = (await load()).default;
  } catch {
    // English fallback through t().
  }
}

// Order on the first screen: Telugu first for Andhra Pradesh, then by number of speakers.
export const LANGUAGES: { code: Lang; native: string; english: string }[] = [
  { code: "te", native: "తెలుగు", english: "Telugu" },
  { code: "hi", native: "हिन्दी", english: "Hindi" },
  { code: "ta", native: "தமிழ்", english: "Tamil" },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada" },
  { code: "mr", native: "मराठी", english: "Marathi" },
  { code: "bn", native: "বাংলা", english: "Bengali" },
  { code: "or", native: "ଓଡ଼ିଆ", english: "Odia" },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati" },
  { code: "pa", native: "ਪੰਜਾਬੀ", english: "Punjabi" },
  { code: "ml", native: "മലയാളം", english: "Malayalam" },
  { code: "en", native: "English", english: "English" },
];

export function t(lang: Lang, key: Key): string {
  return tables[lang]?.[key] || tables.en?.[key] || key;
}

// t() with {name} placeholders filled in.
export function tf(lang: Lang, key: Key, vars: Record<string, string | number>): string {
  return t(lang, key).replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function langName(code: Lang): string {
  return LANGUAGES.find((l) => l.code === code)?.native || code;
}
