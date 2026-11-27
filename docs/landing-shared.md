# Landing: what the desktop film and the mobile version share

The desktop film (900 px and up) lives in `src/pages/landing/` and is owned by the desktop workstream. The mobile version lives in `src/pages/LandingMobile.tsx`, `src/pages/landing-mobile.css` and `src/landing-mobile/`, owned by the mobile workstream. Neither edits the other's files.

## Read-only for the mobile version

| What | Where | Notes |
|---|---|---|
| Register data for the particles | `public/landing/register.json` (served at `/landing/register.json`) | `{ total, crops[{id,en,te,count}], types[], brownSpot{te,en,uses,shown,top[{product,dose,wait,ipm,who}]}, u[[cropIndex, typeIndex, flag]] }`. `flag`: 0 other, 1 brown spot use on the card, 2 brown spot use not shown, 3 to 5 the card's first three rows. 2,806 entries. |
| Its builder | `scripts/build-landing-data.mjs` | Reads `data/` and the live English advice card (read-only, no model call). Re-run only if `data/` changes; do not change its output format without telling the desktop workstream. |
| Scene timing and chapters | `src/pages/landing/timing.ts` | `T` (progress points) and `CHAPTERS`. Import if useful; copy if you need different values. |
| Static story, dot grids, claims and results copy | `src/pages/landing/Film.tsx` exports `Story` and `Dots`; the `CLAIMS` and `RESULTS` text is in the same file | Text is copied from `submission/contrast.md` and `eval/results.json`; keep the wording and numbers identical. |
| Palette, type and motion tokens | `src/tokens.css` (global) | Paper, ink, field green, turmeric, brick; Geist and Noto Sans; `--ease`, `--t-*`. |
| Fonts | `public/fonts/Geist-Variable.woff2`, `public/fonts/GeistMono-Variable.woff2` (the `@font-face` for Geist Mono is in `src/pages/landing/film.css`; declare your own if you need it) | |
| Field photograph (CC BY-SA 4.0, K.Venkataramana) | `public/photos/paddy-srikakulam-900.webp`, `-1500.webp` | Credit it wherever it is shown. |
| Sample leaf | `public/samples/tomato_late_blight.jpg` and the other five | |

## Router change points

- `src/App.tsx`: `landingAtRoot()` decides that `/` shows the landing only when `window.innerWidth >= 900` and the page is not in an iframe; phones and narrow windows at `/` open the app. Keep this as is. `/home` always renders `<Landing />`; `/app` always renders the app. `urlLang()` reads `?lang=` (used by the phone frame). The popstate handler skips `scrollTo(0, 0)` while `window.__pairuKeepScroll` is set (the desktop film sets it when the phone grows into the app).
- `src/pages/Landing.tsx`: `canFilm()` picks the desktop `Film` (900 px and up, WebGL, no reduced motion) or the static `Story`. The mobile router change belongs here: under 900 px, render `LandingMobile` instead of `Story` (keep `Story` as the fallback for no WebGL or reduced motion).

## Deploying

Only from a clean worktree at HEAD, after both workstreams have pushed, and then check that the six sample diagnoses still return `cached: true`.
