// Text and numbers for the phone landing. Wording and figures are identical to the desktop film
// (src/pages/landing/Film.tsx), which copies them from submission/contrast.md and eval/results.json.

export interface Register {
  total: number;
  crops: { id: string; en: string; te: string; count: number }[];
  types: string[];
  brownSpot: { te: string; en: string; uses: number; shown: number; top: { product: string; dose: string; wait: number; ipm: boolean; who: string | null }[] };
  // [crop index, type index, flag]; flag 0 other, 1 brown spot use on the card, 2 brown spot use
  // not shown, 3 to 5 the card's first three rows.
  u: [number, number, number][];
}

export const DEMO = "https://drive.google.com/drive/folders/1WckhEcr0AZLbTv4PRPkgxdbW2QGeMv4g";
export const REPO = "https://github.com/tahcin/pairu";
export const PHOTO = "https://commons.wikimedia.org/wiki/File:Rice_paddy_fields_at_Dusipeta,_Amadalavalasa_Mandal.Srikakulam_district.jpg";
export const NAME_TE = "గోధుమ రంగు ఆకుమచ్చ తెగులు";
export const TAGLINE = "Crop advice limited to what the Government of India has approved for your crop";

// The brown spot name in other scripts, exactly as in data/kb_<lang>.json (paddy_brown_spot.name)
// and data/kb.json (name_en). Languages without their own entry are left out.
export const NAMES: { lang: string; label: string; name: string }[] = [
  { lang: "hi", label: "Hindi", name: "भूरा धब्बा रोग (ब्राउन स्पॉट)" },
  { lang: "ta", label: "Tamil", name: "பழுப்புப் புள்ளி நோய்" },
  { lang: "kn", label: "Kannada", name: "Brown spot (ಕಂದು ಚುಕ್ಕೆ ರೋಗ)" },
  { lang: "bn", label: "Bengali", name: "বাদামী দাগ রোগ" },
  { lang: "or", label: "Odia", name: "ମାଟିଆ ଦାଗ ରୋଗ" },
  { lang: "en", label: "English", name: "Brown spot" },
];

// Claims a general AI made about curling chilli leaves, checked against the register for chilli
// (submission/contrast.md, asked 27 Nov 2026 of gemini-3.5-flash-lite).
export const CLAIMS = [
  { said: "Diafenthiuron 50% WP, 400 g per acre, for thrips", why: "Registered on chilli for mites only, and about 1.65 times the approved dose" },
  { said: "Imidacloprid 17.8% SL, 50 to 60 ml per acre", why: "Never mentions the 40 days to wait before picking" },
  { said: "Fipronil 5% SC, 400 to 500 ml per acre", why: "Up to about 1.2 times the approved dose, and no waiting period" },
  { said: "Spinetoram 11.7% SC, 180 to 200 ml per acre", why: "The dose is right, but no waiting period" },
];

// eval/results.json: v2.all_in_list_diseased_only and lab_vs_field (PlantDoc).
export const RESULTS = [
  {
    key: "ev1",
    title: "65 diseased leaves.",
    n: 65,
    note: "Lab photos and rice field photos, including the half used to choose Pairu's 0.9 threshold. Answered and wrong: 18.5% against 41.5%.",
    rows: [
      { who: "Pairu", right: 44, wrong: 12, unsure: 9 },
      { who: "The same model, asked an open question", right: 38, wrong: 27, unsure: 0 },
    ],
  },
  {
    key: "ev2",
    title: "44 photos from real fields.",
    n: 44,
    note: "PlantDoc. Right: 70.5% against 38.6%. Small n, a margin of roughly 13 points, and labels known to be noisy.",
    rows: [
      { who: "Pairu", right: 31, wrong: 8, unsure: 5 },
      { who: "A PlantVillage CNN trained on lab photos", right: 17, wrong: 23, unsure: 4 },
    ],
  },
];

export const fmt = (n: number) => n.toLocaleString("en-IN");

let regPromise: Promise<Register> | null = null;
export function loadRegister(): Promise<Register> {
  if (!regPromise) regPromise = fetch("/landing/register.json").then((r) => r.json());
  return regPromise;
}
