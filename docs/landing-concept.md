# Landing concept: "Every dot is a real approved use"

A short film you scroll through. One idea carries it: Pairu's advice is limited to what the Government of India has approved, so the register itself becomes the visual system. Nothing on screen is decorative data; every particle is one row of `data/registered_uses.json`.

## References (Awwwards Sites of the Day and nominees, 28 Nov 2026), for craft, not form

- Polpharma Biologics: a product rule ("equivalent within defined tolerances") became the whole design system. Ours: "only approved uses" becomes the particle system.
- 197 historias ilustradas: three.js storytelling where each element stands for a real record, with restraint and respect.
- Santal: scroll-scrubbed 3D narrative with long, calm camera moves and type that waits for the image.
- Huxley Saga: large type and WebGL sharing one frame, chapters that feel like film cuts.

## Scenes (one pinned stage, scrubbed by scroll)

| Progress | Scene | Picture | Words |
|---|---|---|---|
| 0 to 0.10 | Field | A WebGL paddy field in late-afternoon light, instanced blades moving in the wind, fading into paper | పైరు, "Pairu, Telugu for a standing crop" |
| 0.10 to 0.26 | Descent | The camera sinks into the field and settles on one rice leaf with brown spots | "Somewhere in this field, one leaf has small brown spots." |
| 0.26 to 0.40 | Scan | A light sweep crosses the leaf; each spot gains a crisp ring as it is seen; the disease name builds in Telugu | గోధుమ రంగు ఆకుమచ్చ తెగులు, the tagline |
| 0.40 to 0.70 | Register | The leaf dissolves into 2,806 particles; they sort by crop (13 columns, counts), then paddy (803), then brown spot (31), then the card's first three rows (product, dose per acre, days to wait) | "Every dot is a real approved use." |
| 0.70 to 0.80 | Contrast | Chilli's 475 approved uses on one side; four claims from a general AI arrive and are rejected one by one, each with its reason | From `submission/contrast.md` |
| 0.80 to 0.95 | Evidence | Dot grids, one dot per test photo: right, wrong, not sure | 65 diseased leaves (12 vs 27 wrong), 44 field photos (31 vs 17 right), with n and caveats |
| after | Finale | The live app in a phone frame, buttons, footer | Open the app, Watch the demo |

## Rules

- Real data only: `public/landing/register.json` is built by `scripts/build-landing-data.mjs` from `data/registered_uses.json`, `data/kb.json` and the live English advice card (read-only). Evidence numbers are copied from `eval/results.json`.
- Palette: paper, field green, turmeric, brick, ink. No decorative gradients, glows, glass, emoji, italics, kicker labels.
- Motion: scrubbed by scroll, eased, never looping except the wind in the field (the field is a place, and wind is what makes it alive) and it stops when the field is off screen.
- Performance: DPR capped at 1.5, blade count adapts after the first second, rendering pauses when the film is off screen or the tab is hidden.
- Fallback: narrow windows, reduced motion and no WebGL get a static, stacked version of the same story with the Srikakulam photograph instead of the field.
- Only wide windows at `/` and `/home` show it; narrow windows at `/` open the app unchanged.
