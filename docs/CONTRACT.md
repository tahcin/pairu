# Pairu build contract

Shared spec for every workstream. Read it fully before you start, and do not change a schema without noting it at the end of this file.

**Product:** Pairu. A farmer photographs a sick leaf, optionally speaks what they see, and gets in their own language: the disease (with honest confidence), its symptoms, treatment options (organic and bio first, then chemicals approved by CIB&RC for that crop, with dose and waiting period), prevention and recommended practices, read aloud. Problem statement AG-03 of Avishkaar Season 4: "intelligent multilingual recommendation system that provides reliable crop-specific disease-management guidance, including disease symptoms, treatment options, preventive measures, and recommended farming practices in farmers' native languages."

**Hard rules**

- Everything is written from scratch now (build window Nov 27 11:30 to Nov 28 11:30 IST). Do not copy code or data files from any other folder in this machine, including `google-code-for-communities-2026/` (Parchi). Re-download public sources yourself.
- Real data only, every fact traceable to a public source listed in `data/SOURCES.md`. Never invent a dose, a product, a statistic or a citation. If a source can't be found, leave the field empty and say so.
- Zero budget. Gemini free tier and Sarvam are fine. The Claude key is paid: use it only where this contract says, and never in bulk jobs.
- Writing style for all copy, comments and docs: no em dashes; plain, warm, flowing sentences; no emoji in the UI.
- Git: commit in this repo (`avishkaar-2026/app`) with small, clear messages. No `Co-Authored-By` lines. Never commit `.dev.vars`.
- Secrets live in `.dev.vars` (GEMINI_API_KEY, SARVAM_API_KEY, ANTHROPIC_API_KEY). Never print them.
- Python: use `python3 -I` for scripts that read downloaded files; keep raw downloads in `scripts/raw/` (gitignored). On this Mac, set `SSL_CERT_FILE=$(python3 -c "import certifi;print(certifi.where())")` if HTTPS fails with a certificate error.

## Layout

```
app/
  data/                 built JSON (committed) + SOURCES.md
  scripts/              Python builders for data/ (re-runnable)
  src/                  React app (Vite + TS)
  functions/api/        Cloudflare Pages Functions (TS)
  eval/                 test set manifest, runner, results
  docs/                 this file, architecture notes
```

## Crops (ids are fixed)

`paddy, cotton, chilli, groundnut, maize, tomato, brinjal, banana, mango, blackgram, potato, onion`

## data/registered_uses.json (DATA)

Array of records from the CIB&RC "Major Uses of Pesticides" lists (https://ppqs.gov.in/divisions/cib-rc/major-uses-of-pesticides), fungicides, insecticides, bio-fungicides and bio-insecticides (herbicides optional):

```json
{
  "crop_id": "paddy",                 // one of the crop ids above, or null if not one of ours
  "crop_raw": "Paddy (Rice)",
  "target_raw": "Blast",              // disease or pest exactly as printed
  "target_norm": "blast",             // lowercase, trimmed, common spelling fixes
  "active_ingredients": ["tricyclazole"],
  "product_label": "Tricyclazole 75% WP",
  "pesticide_type": "fungicide",      // fungicide | insecticide | bio-fungicide | bio-insecticide | herbicide
  "dose_ai_g_ha": "225-300",          // as printed
  "dose_formulation_raw": "300-400 g",// per hectare, as printed
  "water_l_ha": "500-1000",
  "waiting_period_days": 21,          // integer or null
  "waiting_period_raw": "21",
  "source": {"file": "....pdf", "page": 12}
}
```

Also `data/banned.json` (`[{"active": "...", "status": "banned" | "restricted" | "withdrawn", "note": "...", "source": {...}}]`) and `data/hazard.json` (`{"<active>": {"who_class": "Ia" | "Ib" | "II" | "III" | "U", "source": ...}}`, WHO Recommended Classification of Pesticides by Hazard).

## data/kb.json (KB)

```json
{
  "crops": [
    {"id": "paddy", "name_en": "Paddy", "names": {"te": "వరి", "hi": "धान", "ta": "...", "kn": "...", "mr": "...", "bn": "...", "or": "...", "gu": "...", "pa": "...", "ml": "..."},
      "diseases": ["paddy_blast", "paddy_blb", "..."]}
  ],
  "diseases": [
    {
      "id": "paddy_blast",
      "crop": "paddy",
      "name_en": "Blast",
      "names": {"te": "అగ్గి తెగులు", "hi": "..."},      // farmers' common names where known; leave missing rather than guess
      "kind": "fungal",                                  // fungal | bacterial | viral | pest | nutrient | abiotic
      "pathogen": "Magnaporthe oryzae (Pyricularia oryzae)",
      "symptoms": ["Spindle or eye-shaped spots with grey centres and brown edges on leaves", "..."],
      "photo_cues": ["spindle-shaped lesions", "grey centre", "brown margin"],   // what a camera sees, for the vision prompt
      "look_alikes": ["paddy_brown_spot"],
      "discriminators": [
        {"id": "q1", "question": "Are the spots shaped like a spindle or an eye, pointed at both ends, with a grey centre?", "yes": "paddy_blast", "no": "paddy_brown_spot"}
      ],
      "favourable_conditions": "...",
      "prevention": ["..."],
      "practices": ["..."],                              // what to do this week, field management
      "organic_bio": [{"text": "Spray Pseudomonas fluorescens 1% WP at ...", "source": 0}],
      "cibrc_targets": ["blast", "leaf blast", "neck blast"],  // target_norm values in registered_uses.json for this crop
      "sources": [{"title": "TNAU Agritech Portal: Rice diseases", "url": "https://agritech.tnau.ac.in/..."}]
    }
  ]
}
```

Include a `healthy` entry per crop (`<crop>_healthy`, kind `abiotic`) so the app can say the leaf looks healthy. Aim for 4 to 6 important diseases or pests per crop, chosen for Andhra Pradesh and India, and make sure the PlantVillage classes for tomato, potato, maize and pepper-like crops we hold are covered where they apply (tomato early blight, late blight, leaf curl virus, septoria, bacterial spot; potato early and late blight; maize common rust, northern leaf blight, grey leaf spot).

## API (APP), all JSON, under /api

- `POST /api/diagnose` body `{crop: id|null, image: "<base64 jpeg, max 1024px>", note: "free text, any language", lang: "te"}` returns
  ```json
  {"crop": "paddy", "crop_confident": true, "image_quality": "ok|blurry|not_a_plant|too_far",
   "candidates": [{"id": "paddy_blast", "confidence": 0.62, "seen": ["grey centre"]}],
   "status": "decided|ask|unsure",
   "questions": [{"id": "q1", "disease": "paddy_blast", "question": "...", "yes": "paddy_blast", "no": "paddy_brown_spot"}],
   "model": "gemini-3.1-flash-lite", "cached": false}
  ```
  The model may only choose ids from the KB list for that crop (plus `<crop>_healthy` and `unknown`). Code decides the status: `decided` if top confidence ≥ 0.75 and the gap to the second ≥ 0.25; `ask` if the top two are look-alikes with discriminators; otherwise `unsure`. Fallback chain: gemini-3.1-flash-lite, gemini-3.5-flash-lite, then Claude (`claude-haiku-5-5`) only if both fail. Cache by SHA-256 of the image plus crop.
- `POST /api/resolve` body `{candidates, answers: {"q1": true}}` returns the final `{id, status}`; pure code, no model.
- `GET /api/advice?id=paddy_blast&lang=te` returns the advice card: KB text plus treatments joined from `registered_uses.json` (bio first; banned removed; WHO Ia/Ib flagged), translated to `lang` with Sarvam (cache translations; English skips translation).
- `POST /api/tts` `{text, lang}` returns `{audio: base64 wav}` via Sarvam Bulbul.
- `POST /api/stt` multipart audio returns `{text, lang}` via Sarvam Saarika.
- `GET /api/weather?lat=&lon=` returns `{rain_24h_mm, wind_kmh, spray_ok, reason}` from Open-Meteo.

## Languages (codes used everywhere)

`te hi ta kn mr bn or gu pa ml en` mapped to Sarvam `xx-IN`.

## Change log

(Note any schema change here with the time and why.)

- **2026-11-27 16:45 IST, DATA:** `registered_uses.json` has one record per (crop, target): when a printed target cell lists several pests, `target_raw` keeps the whole cell and each record carries one `target_norm`. Optional `note_raw` holds an application note printed under a row (10 records). `source` is `{file, page}` with the PDF page number. Added `data/targets_by_crop.json` as `{crop_id: [{target_norm, rows}]}` for the KB. `banned.json` maps "refused registration" to `status: "banned"` (see `source.section`) and adds optional `printed_name`, `aka`, `formulation`, `banned_on_crops` (our crop ids a restriction names) and `restricted_scope`. `hazard.json` entries add `who_name`; `source` is `{file, url, edition, table_page}`. Why: the app needs single target names to join on, and crop-level restrictions to filter treatments.
- **2026-11-27 17:20 IST, APP:** `/api/diagnose` question ids are `<disease_id>.<qid>` (two diseases can both have a `q1`), questions come back translated to `lang` (English kept in `question_en`), candidates carry `seen_symptoms` (indices into the disease's `symptoms`), and the response adds `crop_detected`. `/api/tts` returns MP3, not WAV, as `{audio, audios, mime}`: long text is split under Bulbul's 2,500 character limit and `audios` holds the parts in order (smaller downloads on rural mobile data). `/api/stt` takes multipart field `audio` (or `file`) plus optional `lang`, and uses `saarika:v2.5`. Sarvam's code for Odia is `od-IN`, mapped in code. Added `GET /api/crops` and `GET /api/health`. Data files are served as static assets under `/data/` and read by the functions through the ASSETS binding (scripts/copy-data.mjs copies them at build time; a real file in `data/` wins over `data/fixtures/`).

- 2026-11-27 18:40 IST (KB): data/kb.json adds a top-level `"version": 1`; TNAU sources carry an extra `original` field (the agritech.tnau.ac.in address) next to `url` (the Internet Archive copy we read, since TNAU timed out from our network). Discriminator ids look like `q_<yes id>_<no id>` and the same question object appears on both diseases of a pair. Additive only.
- 2026-11-27 19:30 IST (KB round 2): each disease may carry `avoid: [{"text", "actives": [...], "source": n}]` (products or practices a source says to avoid; the app should flag products whose actives are listed), `recommended_actives: [{"active", "source": n}]` (actives the AESA, DPPQS or TNAU page names for that problem; the app ranks approved products with these actives first), and `names_source: {"te": "vikaspedia" | "descriptive"}`. Every entry now has `names.te`. A Telugu version of the farmer-facing text is in `data/kb_te.json` (see SOURCES.md).
