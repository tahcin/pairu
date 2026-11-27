# Data sources

Every fact in `data/` traces back to a public source listed here. Raw downloads live in `scripts/raw/` (gitignored) and are rebuilt with the scripts named in each section.

## registered_uses.json and targets_by_crop.json

**Source:** Central Insecticides Board and Registration Committee (CIB&RC), Directorate of Plant Protection, Quarantine and Storage, Government of India: "Major Uses of Pesticides (Registered under the Insecticides Act, 1968)", lists as on 30.09.2026, linked from https://ppqs.gov.in/divisions/cib-rc/major-uses-of-pesticides (downloaded 27 Nov 2026).

| File | Pages | Used for |
|---|---|---|
| [Fungicide MUP  as on 30.09.2026.pdf](https://ppqs.gov.in/sites/default/files/Fungicide%20MUP%20%20as%20on%2030.09.2026.pdf) | 91 | fungicide (single products and combinations) |
| [MUP (insecticide)  30.09.2026.pdf](https://ppqs.gov.in/sites/default/files/MUP%20%28insecticide%29%20%2030.09.2026.pdf) | 108 | insecticide (agricultural use, pages 2 to 87; public health, household and locust sections are not used) |
| [3. bio fungicides MUP as on 30.09.2026.pdf](https://ppqs.gov.in/sites/default/files/3.%20bio%20fungicides%20MUP%20as%20on%2030.09.2026.pdf) | 20 | bio-fungicide |
| [MUP (bio insecticide) 30.09.2026.pdf](https://ppqs.gov.in/sites/default/files/MUP%20%28bio%20insecticide%29%2030.09.2026.pdf) | 19 | bio-insecticide (agricultural use only; public health section not used) |

Herbicides (`4. Herbicides MUP as on 30.09.2026.pdf`) are downloaded but not parsed, since Pairu is about diseases and pests.

The document carries the CIB&RC disclaimer that it "has been compiled on the basis of available information for guidance and not for legal purposes". The app should say the same and point farmers to the product label.

**How it is built:** `scripts/fetch_sources.sh`, then `scripts/extract_tables.py` (pdfplumber table rows with page numbers), then `scripts/build_registered_uses.py`, then `scripts/check_data.py`. `scripts/build_all.sh` runs the lot.

- Dose (a.i. and formulation), water and waiting period strings are kept as printed. Line breaks inside a cell are joined with a space, or with nothing after a hyphen or a word broken mid-line.
- `waiting_period_days` is an integer only when the printed cell is a single whole number (optionally followed by "days"). Ranges, "NA", "Nil", "-" and sentences give `null`, with the printed text kept in `waiting_period_raw`.
- A row with an empty crop cell under a crop shares that crop, as the printed table is read. A water or waiting-period cell drawn across two rows is copied to the second row (the PDF stores it once).
- One record is written per (crop, target) pair. When the printed target cell names several pests or diseases ("Thrips and Fruit borer"), `target_raw` keeps the whole cell and each record has one `target_norm`. "Early & Late blight" becomes "early blight" and "late blight"; "Shoot and fruit borer" stays one pest.
- `target_norm` is lowercase with the scientific name in brackets dropped, a leading crop name dropped ("rice leaf folder" becomes "leaf folder") and common spellings unified (downey to downy, leafspot to leaf spot, white fly to whitefly, damping-off to damping off, bakane to bakanae, plant hoppers to plant hopper, and so on; the full list is in the script).
- Crop ids: rice, paddy, transplanted or direct seeded rice to `paddy`; chilli or chillies to `chilli`; groundnut; maize or corn; tomato; brinjal or eggplant; banana; mango; black gram, blackgram, urd or urad to `blackgram`; potato (not sweet potato); onion. Every other crop is kept with `crop_id: null`. A cell naming two of our crops ("Rice (Paddy) & cotton") gives a record for each. Stored-grain and godown rows are never mapped to a crop.
- Active names are taken from the product label, lowercased, with these fixes: chlorpyriphos to chlorpyrifos, lambda cyhalothrin to lambda-cyhalothrin, thiophanate methyl to thiophanate-methyl, sulphur to sulfur, copper sulphate to copper sulfate, metalaxy l to metalaxyl, thaimethoxam to thiamethoxam, pyrifluinazon to pyrifluquinazon, flubendamide to flubendiamide, kitazin to iprobenfos, "Cartap Hydrofipronil ide" (a typo on insecticide page 60) to cartap hydrochloride, Flumite to flufenzine (the label prints both names), and Bt "krustaki" to kurstaki.

**Counts (build of 27 Nov 2026):**

- 4,454 records in all, 2,804 for our 12 crops, from 204 distinct active ingredients.
- By crop: paddy 803, cotton 494, chilli 475, tomato 291, groundnut 193, brinjal 155, potato 126, maize 103, mango 53, onion 44, blackgram 42, banana 25.
- By type (our crops): insecticide 1,606, fungicide 1,032, bio-insecticide 91, bio-fungicide 75.
- Printed use rows read: fungicides 1,168, insecticides 1,277, bio-fungicides 101, bio-insecticides 149.
- **Left out, not guessed: 56 use rows** (fungicides 24, insecticides 24, bio-fungicides 4, bio-insecticides 4) whose dose cells could not be placed cleanly in the four columns, whose target cell held a product name, or whose text layer is garbled. Most are stored-grain fumigation tables (aluminium phosphide, EDCT), seed-treatment tables with a different column layout, and multi-line combination doses. A further 29 stray text fragments (repeated overlay text, building termite notes) were ignored. Examples are written to `scripts/raw/registered_uses_stats.json` on each build.
- Pest names with garbled glyphs in the PDF text layer (for example "Rice 38igut" on insecticide page 38) are dropped from `target_norm`; `target_raw` keeps the printed cell.

**Checks:** `scripts/check_data.py` validates every record against `docs/CONTRACT.md` and spot-checks random rows against the cited page. Over all 2,804 records for our crops, every token of every dose, water and waiting-period string was found on the cited page for 90.4 percent; the rest are cells whose lines come out interleaved with neighbouring columns in the page text (hyphenated ranges split over lines), which were checked by eye in samples and read correctly.

`targets_by_crop.json` maps each of our crop ids to its sorted `target_norm` values with row counts, so the knowledge base can fill `cibrc_targets` from names that really occur.

## banned.json

**Source:** CIB&RC, "List of pesticides which are banned, refused registration and restricted in use", updated on 31.10.2026, linked from https://ppqs.gov.in/divisions/cib-rc/registered-products. File: [list_of_pesticides_which_are_banned_refused_registration_and_restricted_in_use (31.10.26).pdf](https://ppqs.gov.in/sites/default/files/list_of_pesticides_which_are_banned_refused_registration_and_restricted_in_use%20%2831.10.26%29.pdf) (6 pages, downloaded 27 Nov 2026).

**How it is built:** `scripts/build_banned.py`. The numbered lists in sections I and II are parsed from the PDF text and checked against the counts printed in the PDF (50 banned, 5 banned for use but made for export, 8 withdrawn, 18 refused registration). Section III (16 restricted pesticides) is free text, so each restriction is transcribed in the script by hand with its page number.

- `status`: `banned` for section I.A and I.B and for section II (refused registration; never registered, so the app treats it as banned), `withdrawn` for section I.C, `restricted` for section III. The section is in `source.section`.
- Extra fields: `printed_name` (as printed), `aka` (the name in brackets, for example dbcp), `formulation` when a ban covers one formulation only (Captafol 80% powder), `banned_on_crops` (our crop ids that a restriction names) and `restricted_scope` (a short phrase when the restriction is not crop-specific).
- 94 entries: 70 banned, 8 withdrawn, 16 restricted.

### Antibiotics added by hand (27 Nov 2026)

`banned.json` also holds streptomycin sulfate and tetracycline hydrochloride (the streptocycline mix), with status `banned`. The source is the Gazette of India draft order S.O. 5295(E), 17 December 2021, "Prohibition of Streptomycin + Tetracycline in agriculture Order, 2021" (`https://egazette.nic.in/WriteReadData/2021/231955.pdf`). It proposes no import, manufacture or formulation for agricultural use from 1 February 2022 and a complete ban on use in agriculture from 1 January 2024. A reviewer pointed us to it through Down To Earth (21 Dec 2021). We read the gazette itself: it is a draft that comes into force on final publication, we could not find a final notification, and the DPPQS consolidated list of 31.10.2026 does not include it. We still remove these rows from every card as a precaution, since the Registration Committee approved the phase-out in August 2021 and a farmer is better served by copper products and the bio options. The `aka` field in banned.json is now a list, as `functions/_lib/types.ts` expects (it was a string, so the join was matching single letters).

## hazard.json

**Source:** World Health Organization, "The WHO Recommended Classification of Pesticides by Hazard and Guidelines to Classification, 2019 edition" (published 2020; the latest edition on WHO IRIS on 27 Nov 2026), ISBN 978-92-4-000566-2, https://iris.who.int/handle/10665/332193, file 9789240005662-eng.pdf. Licence CC BY-NC-SA 3.0 IGO.

**How it is built:** `scripts/build_hazard.py` converts the PDF with `pdftotext -layout` and parses its index ("Classification of pesticide active ingredients"), which lists every common name with its class and the printed page of its table. `source.table_page` is that printed page.

- Covers every active in `registered_uses.json` (all crops) that the WHO index lists in class Ia, Ib, II, III or U: 160 of 231 actives (Ia 3, Ib 8, II 71, III 37, U 41).
- Names matched to the WHO spelling: sulfur to Sulphur, cartap hydrochloride to Cartap, thiocyclam hydrogen oxalate to Thiocyclam, copper sulfate pentahydrate to Copper sulfate, propamocarb hydrochloride to Propamocarb, ediphenphos to Edifenphos, fosetyl-al to Fosetyl-aluminium, mepiquat chloride to Mepiquat, ethofenoprox to Etofenprox, and every Bacillus thuringiensis strain to "Bacillus thuringiensis (Bt)". The WHO name used is in `who_name`.
- **Not classified: 71 actives.** 67 are not in the 2019 WHO tables at all (mostly newer chemistry such as pyraclostrobin, spiromesifen, tolfenpyrad and broflanilide, and biologicals such as Trichoderma, Pseudomonas, Beauveria, NPV and azadirachtin); 4 are listed by WHO only as fumigants or obsolete (aluminium phosphide, methyl bromide, ethylene dichloride: FM; barium carbonate: O). These are omitted rather than guessed, so a missing key means "no WHO class", not "safe".

## kb.json (crops, diseases and pests, symptoms, prevention, practices)

Every disease or pest entry lists its own `sources`, and each organic or bio option points to one of them by index. The pages were downloaded on 27 Nov 2026 and the text was read and structured from those copies only.

- **TNAU Agritech Portal, crop protection pages** (Tamil Nadu Agricultural University), one page per disease or pest, for example `https://agritech.tnau.ac.in/crop_protection/rice_diseases/rice_1.html` (rice blast). agritech.tnau.ac.in did not answer from our network (connection timeout), so we read the Internet Archive's saved copy of each page; every entry cites that archive URL in `url` and the TNAU address in `original`. Fetcher: `scripts/kb_fetch_tnau.py`.
- **AESA based IPM packages** by NIPHM and the Directorate of Plant Protection, Quarantine and Storage (DPPQS), one per crop, from `https://ppqs.gov.in/ipm-package`: rice, maize, groundnut, black gram and green gram, banana, brinjal, chillies and capsicum, cotton, mango, onion, potato and tomato (`https://ppqs.gov.in/sites/default/files/<crop>.pdf`). Used for symptoms, favourable conditions, cultural practices, bio-control options and the "looks healthy" entries (the "Principles of AESA based IPM" section).
- **DPPQS packages of practices and advisories**: paddy blast, rice brown plant hopper, pink bollworm of cotton, whitefly in cotton, and the July 2022 fall armyworm advisory (all on ppqs.gov.in).
- **ICAR-IIHR, Indian Horticulture**: "Late blight disease of tomato: a serious problem for Indian tomato farmers" (`https://epubs.icar.org.in/index.php/IndHort/article/view/164935`), because TNAU has no tomato late blight page.
- **Vikaspedia**: "Identification and management of fall armyworm" (en.vikaspedia.in), because the TNAU maize pest pages predate the pest's arrival in India.
- **Crop Protection Network** (a collaboration of US land-grant university extension specialists): "Gray leaf spot of corn" (`https://cropprotectionnetwork.org/encyclopedia/gray-leaf-spot-of-corn`). We found no Indian extension page for maize grey leaf spot, so this entry rests on that page alone.

How the entries were made (`scripts/kb_*.py`, `scripts/build_kb.py`): the page text for each problem was given to Gemini (gemini-3.1-flash-lite; gemma-4-31b-it was unavailable all afternoon) with the instruction to extract only, in plain words, and never add knowledge. `scripts/kb_review.py` then drops any organic or bio option whose doses or numbers do not appear in the page it cites, and every entry was read by hand against its pages; corrections are listed in `FIXES` in `scripts/kb_authored.py`. The look-alike pairs and the yes or no questions that split them are hand-written in `scripts/kb_authored.py`, each one using a sign that the cited pages give for that problem. Crop names in the ten languages are the standard names. `cibrc_targets` use the exact `target_norm` strings in `targets_by_crop.json`; for viral diseases they name the insect that spreads the virus (for example whitefly for leaf curl), because the sources manage these diseases by controlling that insect. `scripts/check_kb.py` validates the file against the contract.
