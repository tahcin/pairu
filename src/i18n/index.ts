// UI strings. English, Telugu and Hindi are written by hand; the other eight languages are
// translated once from English with Sarvam by scripts/translate-ui.mjs and checked in.
import en from "./en.json";
import te from "./te.json";
import hi from "./hi.json";
import ta from "./ta.json";
import kn from "./kn.json";
import mr from "./mr.json";
import bn from "./bn.json";
import or from "./or.json";
import gu from "./gu.json";
import pa from "./pa.json";
import ml from "./ml.json";

export type Key = keyof typeof en;
export type Lang = "te" | "hi" | "ta" | "kn" | "mr" | "bn" | "or" | "gu" | "pa" | "ml" | "en";

const tables: Record<Lang, Partial<Record<Key, string>>> = { en, te, hi, ta, kn, mr, bn, or, gu, pa, ml };

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
  return tables[lang]?.[key] || tables.en[key] || key;
}

export function langName(code: Lang): string {
  return LANGUAGES.find((l) => l.code === code)?.native || code;
}
