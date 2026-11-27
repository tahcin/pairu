# Pairu design notes

The redesign of 27 Nov 2026 (commits 0c03ef5 onwards). The audit that led to it is in `design-audit.md`; before and after screenshots are in `docs/design/before/` and `docs/design/after/`.

## The system

All values live in `src/tokens.css`; `src/styles.css` uses only those tokens, and `src/pages/pages.css` holds the English judge pages and loads only with them.

- **Colour.** One warm theme: paper `#f6f1e7`, surface `#fffdf8`, ink `#1d2719` with two softer inks, and a field green `#2d5b34` for the brand and the main action. Turmeric `#b06d14` means "check this" (best guess, spray-yet threshold, restricted use) and brick `#a1311f` means danger (WHO Ia and Ib, avoid lists, errors), so a notice and an error no longer look alike. Body text is darker than before for sunlight.
- **Type.** Geist (self-hosted, 57 KB, preloaded) for Latin, then Noto Sans for each Indian script from Google Fonts, which serves unicode-range slices so a phone downloads only the script on screen, after first paint (`display=swap`). Sizes 14, 16, 18, 21, 26 and 32 px; body 18 px with a 1.55 line height for Indic scripts.
- **Space and shape.** A 4 px grid, a 16 px gutter, radii of 10, 14 and 20 px, one 1.5 px border weight, tap targets of 52 to 64 px (88 px for Yes and No). No shadows beyond a hairline, no gradients as decoration, no italics, no kicker labels.
- **Motion.** 140, 220 and 420 ms with one ease-out curve. Screens fade in (opacity only, because a transform would trap the fixed action bar and sheets), sheets rise, folds rotate their chevron, the confidence meter grows once. Everything collapses to near zero under `prefers-reduced-motion`.

## Screens and decisions

- **Language.** The question "choose your language" in Telugu, with Hindi and English beneath, instead of a three-script tagline wall; Telugu is a full-width suggested choice; the tagline sits once below the grid.
- **Crops.** Fixed the 360 px overflow (`minmax(0, 1fr)` columns, a fixed icon row, labels that wrap anywhere), so tiles are even in every script. Icons redrawn in one style: flat filled shapes, a base tone and one shade, no outlines, on a soft paper disc. "Other or not sure" is a wide dashed tile at the end. My checks is a row with the last photo and a count. A small English footer links How it works, Evidence and Plain AI vs Pairu.
- **Photo.** A title says what to do; the camera is a dark viewfinder with framing corners, a dashed leaf outline as a framing guide and a white shutter button; the daylight tip has a sun icon; gallery and "describe instead" are equal rows; the sample link stays a link. After the photo, "Retake" is a pill on the image, the voice note is one optional hold-to-speak row, and "Check my crop" is pinned to the bottom.
- **Diagnosing.** A slow band of light sweeps over the real photo inside the same framing corners, with three steps that tick in turn: looking at the leaf, comparing with this crop's diseases, a second closer look. These are the steps the server really takes; only the timing is approximate. The describe path shows the crop icon in place of a photo.
- **Questions.** "Question 1 of 3" with a segmented progress bar, the photo above for comparison, one large question, big Yes and No with icons, and "I cannot tell" as a quiet full-width escape. Each question fades in.
- **Result.** The local disease name at 32 px, the English and scientific names small, and confidence as words in a green (fairly sure) or turmeric (best guess) band, with the score as a thin meter only on a first-look answer. A dark "What to do first" card gives the first natural option, else the first approved product with its dose, and jumps to all treatments. Listen and Share sit in a fixed bottom bar in the thumb's reach.
- **Advice.** Sections are collapsible cards (native `details`): signs and what to do open, prevention, practices and sources closed, so expert help is no longer 4,000 px down. Each treatment shows the product name, an IPM tick, hazard and restriction flags, then two large facts: the dose (per acre, with per hectare beneath, or per litre, or as printed) and the wait before harvest in days, then water, how to use, and a source link to the register.
- **Not sure.** The photo, a plain title, the reason (blurry, too far, other crop) and the honest body, then "Take another photo" and a "Talk to an expert" card that leads with the free Kisan Call Centre number and then the nearest KVK by district.
- **Evidence.** Two headline comparisons computed from `eval/results.json` (wrong answers on diseased leaves, and field photos named right against the lab-trained CNN), then the lab vs field results as labelled stacked bars (right, answered and wrong, said not sure), v1 vs v2 vs the bare model the same way, the out-of-list refusals, and the caveats as their own block. Every original table and method note is kept in folds under "Every table". Bar colours were checked with the dataviz palette validator (green and a lighter orange pass the colour-blind check); numbers are always written next to each bar.
- **Plain AI vs Pairu** (`/compare`). The farmer's question, then one card per claim: what a general AI said, what the register approves for chilli, and the problem in a red band (turmeric where the dose was right but the waiting period was missing). Content, date, model and source note are copied from `submission/contrast.md` without additions; Gemini's verbatim answer is in a fold.
- **About.** Numbers brought in line with the data (13 crops, 77 diseases and pests, 2,806 approved uses, 96 banned entries, 48 follow-up questions, 24 KVKs, the 0.9 first look and the second look), and a link to the comparison page.

## Performance

- The eight languages not needed on the first screen load on demand (Telugu, Hindi and English are bundled); the saved language loads before first paint, so nothing flashes in English.
- About, Evidence, Compare and the advice card are separate chunks; the advice chunk is prefetched while the farmer takes the photo.
- First-screen JavaScript went from 121 KB to 76 KB gzipped. Geist is self-hosted and preloaded; Noto loads without blocking.
- The service worker (`pairu-v3`) precaches Geist and caches the Noto font files it fetches; offline, Android phones fall back to their built-in Noto fonts.

## Strings added

Hand-written in English, Telugu and Hindi: `doFirst`, `seeAllSteps`, `wk1`, `wk2`, `wk2any`, `wk3`, `qOf`, `waitShort`, `daysN`, `retakeShort`. The other eight languages fall back to English for these until they are translated (the translation script needs Gemini, whose quota was held for the demo).
