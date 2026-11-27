# Pairu design audit (before the redesign)

Walked on the live app (https://pairu.pages.dev, commit ac3aad6) on 27 Nov 2026, 19:40 to 20:10 IST, in a mobile-emulated Chrome tab at 360x740 and 390x844, in Telugu, Hindi and English. Screens: language, crops, photo, sample sheet, photo picked, diagnosing, advice card (tomato late blight sample), not sure (blurry rice blast sample), describe instead, My checks entry, About and Evidence. Before screenshots: `docs/design/before/`.

## Breaking issues

1. **The crop grid overflows at 360 px in every language.** The tiles use `repeat(3, 1fr)`, whose minimum is the longest word ("Black gram", "Groundnut", "బంగాళదుంప", "మొక్కజొన్న"), so the page becomes 387 to 404 px wide and the third column is cut off and the page scrolls sideways. On the most common cheap Android width, the first real screen looks broken.
2. **Tile heights are uneven in Hindi and Telugu** because labels wrap to one or two lines inside a fixed aspect ratio; the grid looks ragged.
3. **The Evidence page never shows the lab vs field table** (`lab_vs_field` in results.json has a `table` key, which the generic renderer skips), and that is the single most persuasive result we have: Pairu holds about 70% on field photos where the lab-trained CNN drops to 39%.
4. **About is out of date:** it still says 12 crops, 66 diseases, 2,804 approved uses, 94 banned entries and "accepted at 0.75 with a 0.25 lead", while the live system has 13 crops, 77 diseases and pests, 2,806 uses, 96 entries and the 0.9 first look plus second look.

## Hierarchy and layout

- Language screen: three taglines stacked in three scripts before the choice push the language grid below the fold at 360; the heading "భాష · भाषा · Language" reads as a label, not a question. Telugu is a big green block that looks like a selected state rather than the suggested choice.
- Crop screen: the tagline and the question are both body-weight paragraphs of similar size; the crop question is the only thing that matters. "About Pairu (English)" is a lone underlined link with no footer structure. My checks is a plain ghost button.
- Photo screen: the camera block is a big green slab, but there is no framing guide or hint of what a good photo looks like; the tip sits below in grey. Gallery, describe and sample links are three different weights (button, underlined link, underlined link) stacked with uneven gaps.
- Photo picked: the preview, a ghost "take another photo" button, a boxed voice panel and the check button compete; the main action ("Check my crop") is at the bottom, below the fold at 360 when a note is shown.
- Advice card: 4,400 px long. The hero mixes the photo, crop, disease, English name and pathogen, a coloured confidence box and a second confidence line, then a sticky Listen/Share bar that eats 60 px under the header on every scroll. There is no single "what to do first" answer: the farmer must read symptoms before reaching the treatment. Every section is always open, so prevention and practices push KVK and sources very far down.
- Treatment rows: dose, per hectare, water and waiting days are in a two-column grid with small grey labels, so the eye cannot find "how much" and "how many days" quickly; IPM and hazard notes appear as separate full-width strips; the source line is plain grey text, not a link.
- Not sure screen: fine in tone, but the KVK card leads with an empty state ("choose your district") and a weak underlined link, and the Kisan Call Centre (the real escape) is nested inside it.
- Evidence: a wall of wide tables that need horizontal scrolling on a phone; column headers wrap to four lines; the key result is a paragraph, not a number. Method and steps are raw key and value dumps ("second look decided verified 47").

## Copy

- Repeated copy: the tagline appears on both the language and crop screens; "We are fairly sure" then "A second look checked the key signs" say confidence twice in two styles; the bottom of the advice card repeats the Kisan Call Centre card.
- Some labels are long sentences used as button text ("Press and hold this button, then speak about the problem"), which wrap to three lines in Telugu.
- "Other or not sure" mixes two meanings on one tile.

## States, loading, errors

- Diagnosing: a thin grey bar slides under the photo and the title changes once after six seconds. It does not feel alive and does not say what is happening (looking at the leaf, comparing with the list, checking the signs).
- Advice loading: grey placeholder bars are good, but the "Listen" button is a washed-out green while disabled, which looks broken.
- Errors are ochre boxes identical to notices, so an error and a tip look the same.
- Sample sheet close button is a pill labelled "Close" that is cut off at 360 in Telugu ("మూసివేయండి").

## Accessibility and touch

- Focus styles: none defined; keyboard focus is invisible on custom buttons.
- Several text links are 48 px tall but only as wide as the text; fine, but they look secondary to the point of being missed.
- Grey body text (#4a5543 on #f5efe3) passes AA but is weak in sunlight for long paragraphs.
- Hold-to-speak buttons have no visual hint of "hold" beyond the text.

## Consistency

- Five radii (10, 12, 14, 20, 22 px), four border widths, and colours hard-coded in many rules (#244828, #6b4210, #5a3a0e, #fffefb, #fffaf0).
- Crop icons mix outline stalks (paddy) with flat fruit (tomato, mango) and a detailed cotton boll; stroke widths differ; some fill the 64 px box and some use half of it.
- Two different sheet patterns (samples, districts) with slightly different headers.

## Motion

- Only two animations exist: the sliding bar and a "pulse" that scales the mic button (feels jumpy). Screen changes are instant cuts with a jump to the top; nothing eases in.

## Performance

- One 300 KB JS bundle loads About and Evidence code on the farmer's first screen.
- Geist is loaded from jsDelivr (an extra DNS and TLS round trip on 3G); Indic scripts fall back to whatever the phone has, which is fine on Android (Noto is the system font) but uneven on desktops used by judges.
