# Pairu (పైరు)

Pairu helps a farmer photograph a sick leaf and hear, in their own language, what the disease is, how sure we are, and what to do about it, using only treatments that the Government of India has approved for that crop. *Pairu* is Telugu for a standing crop.

**Live app:** https://pairu.pages.dev

Built for Avishkaar Season 4 (Virtual Track, AITAM Tekkali), problem statement AG-03: "Develop an intelligent multilingual recommendation system that provides reliable crop-specific disease-management guidance, including disease symptoms, treatment options, preventive measures, and recommended farming practices in farmers' native languages."

![Pairu in Telugu: crop tiles, a follow-up question, the advice card and approved treatments](docs/screenshot.png)

## What it does

1. The farmer picks a language (Telugu first, then Hindi, Tamil, Kannada, Marathi, Bengali, Odia, Gujarati, Punjabi, Malayalam and English) and taps one of 12 crop tiles.
2. They take a photo of the leaf and, if they like, hold the mic button and describe the problem in their own words.
3. Pairu names the disease with an honest confidence score. When two diseases look alike, it asks two or three yes/no questions that tell them apart. When it is still unsure, or the photo is blurry or shows a different crop, it says so and offers the Kisan Call Centre (1800-180-1551) instead of guessing.
4. The advice card shows the local disease name, the symptoms (marking the ones seen in the photo), organic and biological options first, then chemicals that CIB&RC has registered for that crop and that problem, with dose per acre, water and the waiting period before harvest, followed by prevention and this week's field practices. It can be read aloud, shared on WhatsApp, and it checks whether rain or wind in the next 24 hours makes spraying a bad idea.

No account is needed, and the app shell works offline as a PWA. There is also a "Try a sample photo" sheet with six labelled photos that are not in the evaluation set, and an `/about` page explaining how Pairu decides.

## How it works

**The model proposes, code decides.**

- `POST /api/diagnose` sends the photo (resized to 1024 px on the phone) and the closed list of diseases we hold for that crop to the vision model, with a JSON schema whose id field can only be one of those ids, `<crop>_healthy` or `unknown`. The chain is Gemini 3.1 Flash Lite, then Gemini 3.5 Flash Lite, and Claude Haiku 5.5 only if both fail.
- Code then decides (`functions/_lib/decide.ts`): it answers when the top confidence is at least 0.75 and leads the second by at least 0.25; it asks up to three yes/no questions when the top two are known look-alikes; otherwise it says it is unsure. `POST /api/resolve` counts the answers as votes, and a tie stays unsure. No model is involved in that step.
- `GET /api/advice` builds the card from the knowledge base and joins treatments from the CIB&RC register in code (`functions/_lib/advice.ts`): banned and withdrawn actives are dropped, crop-specific restrictions are applied, WHO class Ia and Ib products are flagged and listed after safer ones, and when nothing is approved for that crop and problem the card says so plainly. A model never writes a dose.
- Sarvam translates the card (`sarvam-translate:v1`), transcribes speech (`saarika:v2.5`) and reads the answer aloud (`bulbul:v3`). Open-Meteo gives the spray-weather check. Results and translations are cached in Workers KV.

| Layer | Tools |
|---|---|
| Front end | React 18, Vite, TypeScript, PWA, on Cloudflare Pages |
| API | Cloudflare Pages Functions (TypeScript), Workers KV |
| Vision | Gemini 3.1 Flash Lite, Gemini 3.5 Flash Lite, Claude Haiku 5.5 as last resort |
| Language and voice | Sarvam AI translate, speech to text, text to speech |
| Weather | Open-Meteo |
| Data pipeline | Python, pdfplumber, poppler |

## Data sources

Every fact in `data/` traces to a public source; full details, parsing rules and counts are in [data/SOURCES.md](data/SOURCES.md).

| File | Source | Counts |
|---|---|---|
| `registered_uses.json` | CIB&RC "Major Uses of Pesticides" lists as on 30.09.2026 (fungicides, insecticides, bio-fungicides, bio-insecticides) | 4,454 records parsed, 2,804 for our 12 crops |
| `banned.json` | CIB&RC list of pesticides banned, refused registration and restricted in use, 31.10.2026 | 94 entries |
| `hazard.json` | WHO Recommended Classification of Pesticides by Hazard, 2019 edition | 160 actives classed |
| `kb.json` | TNAU Agritech Portal, NIPHM and DPPQS AESA based IPM packages, DPPQS advisories, ICAR-IIHR, Vikaspedia, Crop Protection Network | 12 crops, 66 diseases and pests plus healthy entries, 82 follow-up questions covering 25 look-alike pairs, 24 Telugu disease names |

Crops: paddy, cotton, chilli, groundnut, maize, tomato, brinjal, banana, mango, black gram, potato and onion. The CIB&RC lists are, in their own words, "for guidance and not for legal purposes", so the app always tells farmers to follow the product label.

## Run it locally

Needs Node 20 or later.

```bash
git clone https://github.com/tahcin/pairu.git
cd pairu
npm install
cp .dev.vars.example .dev.vars   # then add your GEMINI_API_KEY and SARVAM_API_KEY (ANTHROPIC_API_KEY is optional)
npm run pages:dev                # builds, then serves the app and /api with Wrangler
```

`npm run dev` serves the front end on its own. Never commit `.dev.vars`.

Rebuild the data from the original PDFs (needs Python 3 and `pdftotext` from poppler):

```bash
scripts/build_all.sh                                          # CIB&RC uses, banned list, WHO classes, checks
python3 -I scripts/build_kb.py && python3 -I scripts/check_kb.py
```

Deploy to Cloudflare Pages:

```bash
npx wrangler pages secret put GEMINI_API_KEY --project-name pairu   # and SARVAM_API_KEY, ANTHROPIC_API_KEY
npm run deploy
```

## Evaluation

`eval/testset.json` is a frozen set of 95 labelled leaf photos (77 PlantVillage lab photos and 18 field photos of rice from Sethy et al.) across tomato, potato, maize and paddy; 80 show a problem Pairu holds and 15 are outside its list, to check that it refuses rather than guesses. `eval/run.py` runs each photo through Pairu (answering any follow-up questions as a farmer looking at the real leaf would) and through the same model asked an open question, and `eval/score.py` reports top-1 accuracy, accuracy when answered, the refusal rate and the confidently-wrong rate. Results are written to `eval/results.json` and shown on the app's `/evidence` page.

```bash
eval/serve_local.sh                                # local API with the Gemini key only
python3 -I eval/run.py --base http://127.0.0.1:8817
python3 -I eval/score.py eval/runs/<run>.jsonl
```

Lab photos on a plain background are easier than a farmer's field photo, and only four of the twelve crops have public labelled sets we could use, so the numbers are an honest lower bar to beat, not a field guarantee.

## Licence and credits

Code: MIT (see [LICENSE](LICENSE)).

Data and services: CIB&RC and DPPQS, Ministry of Agriculture and Farmers Welfare, Government of India; WHO (hazard classification, CC BY-NC-SA 3.0 IGO); Tamil Nadu Agricultural University; NIPHM; ICAR-IIHR; Vikaspedia; Crop Protection Network; PlantVillage (Mohanty et al. 2016, CC BY-SA 3.0); Rice Leaf Disease Image Samples (Sethy et al. 2020, Mendeley Data, CC BY 4.0); Google Gemini; Sarvam AI; Open-Meteo; Cloudflare.

## How it was built

Pairu was built by Team Solus (Mohammad Tahcin Sarwar Barbhuiya, IIM Bangalore) during Avishkaar Season 4, inside the 24-hour build window from Nov 27, 11:30 to Nov 28, 11:30 IST, 2026, with AI coding assistance. No code or data came from earlier projects. It is a prototype: the advice comes from public government and university sources, and a farmer should still follow the product label and, when in doubt, call the Kisan Call Centre.
