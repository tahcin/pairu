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

### KB round 2: agriculture review (27 Nov 2026)

A plant pathologist reviewed the KB (`submission/judging/judge2-agri.md`). We checked each point against a source before changing anything.

Accepted and fixed in kb.json:
- Brinjal bacterial wilt: the generic CIB&RC target "wilt" is gone, so fungal-wilt products no longer appear, and the Trichoderma organic option was removed. The AESA brinjal package does print Trichoderma for wilt, but it means fungal wilt and Trichoderma does not act on Ralstonia.
- Black gram yellow mosaic: the Trichoderma seed treatments were removed. In their place are yellow sticky traps (4 to 5 per acre) and neem oil at 5 ml per litre against the whitefly that spreads the virus, plus roguing of early infected plants, all from the AESA black gram package.
- Chilli leaf curl: the trisodium orthophosphate seed soak was removed. TNAU prints it on the leaf curl page, but it acts on seed-borne mosaic viruses, and the begomovirus behind leaf curl is not seed-borne.
- Burning stubble and crop waste: TNAU tells farmers to burn straw and stubble. We now say remove it or plough it in, in line with the ban on residue burning. Burning small diseased plant parts is still in a few entries, and that is still standard extension advice.
- Mango hopper: the line about smoking the orchard is gone.
- Paddy brown spot pathogen is now *Bipolaris oryzae* (*Cochliobolus miyabeanus*), with the older name *Helminthosporium oryzae* kept for reference. This is a change of name only.
- Chilli thrips (*Scirtothrips dorsalis*, upward curl) no longer carries the "black thrips" target. There are new entries for black thrips (*Thrips parvispinus*: flowers, reddish-brown underside of leaves; DPPQS booklet, June 2022, and the DPPQS ad hoc strategy) and yellow mite (downward curl; TNAU and the AESA chilli package). They come with questions that split upward curl, downward curl and virus.
- New paddy entries: leaf folder, gall midge (with a question that splits it from stem borer) and false smut, from TNAU, AESA rice and the DPPQS gall midge and false smut packages.
- New field `avoid`: things the sources say not to do. For paddy brown plant hopper: synthetic pyrethroids, methyl parathion, fenthion and quinalphos cause resurgence (TNAU pests of paddy page); do not tank-mix; do not burn infested crop (DPPQS BPH package). For cotton whitefly: pyrethroids, acephate and acetamiprid (DPPQS whitefly package). For cotton jassid: pyrethroids (AESA cotton). Each item lists the actives it covers, so the app can flag those products.
- New field `recommended_actives`: the actives that the AESA package, the problem-specific DPPQS package or the problem's TNAU page names for that problem, limited to actives registered for that crop and target (`scripts/kb_recommended.py`), then read by hand (`REC_SET` and `REC_DROP` in `kb_authored.py`). For brown plant hopper the list is the DPPQS one (pymetrozine, dinotefuran, triflumezopyrim, flonicamid and others) plus buprofezin from TNAU. Bio agents are left out here because they already appear under organic options.

Where we disagree with the reviewer:
- Groundnut bud necrosis, "castor in a 3 to 6 to 1 ratio": this is not garbled. The AESA groundnut package says "Groundnut + castor in 3-6:1 ratio to reduce the thrips and PBND". We reworded it as one row of castor for every 3 to 6 rows of groundnut.
- Streptocycline: the 2021 order is a draft, not a final ban (see the banned.json section). We remove the products anyway, as a precaution.
- Dose units, seed-treatment conversion and the ordering of products are handled in the APP and DATA layers (`functions/_lib/dose.ts`), not in kb.json.

Telugu names: every entry now has a Telugu name. Where a Vikaspedia Telugu page uses the name, `names_source.te` is "vikaspedia" and the page is in `sources`. Otherwise it is "descriptive": the plain name a coastal Andhra farmer would use, mostly the ones the reviewer suggested. The reviewer's corrections were applied: brown spot is now గోధుమ రంగు ఆకుమచ్చ తెగులు, grey mildew is బూడిద రంగు బూజు తెగులు, and pink bollworm is గులాబీ రంగు కాయతొలుచు పురుగు.

`etl` ("should I spray yet?"): the Economic Threshold Level for 19 entries. It is quoted from the ETL tables in the AESA rice, cotton, groundnut and maize packages and from the DPPQS packages for brown plant hopper, cotton whitefly and pink bollworm. For tomato fruit borer and black gram pod borer it comes from the TNAU pest page, and for fall armyworm from the Vikaspedia (ICAR-IIMR) action-threshold table. The newer AESA packages (chilli, tomato, brinjal, banana, mango, onion, potato, black gram) use field-by-field AESA decisions instead of ETL tables, so entries without a source threshold have no `etl`. The fall armyworm `recommended_actives` (emamectin benzoate, spinosad, chlorantraniliprole) come from the same Vikaspedia table.

## kvk_ap.json (Krishi Vigyan Kendras in Andhra Pradesh)

The file lists 24 KVKs, checked on 27 Nov 2026.
- The 13 ANGRAU KVKs come from ANGRAU's own KVK page (`https://angrau.ac.in/ANGRU/KVK.aspx`), with phone, email and website.
- The 4 Dr. YSR Horticultural University KVKs come from its Extension Services page (`https://drysrhu.ap.gov.in/Extension%20Services.html`), with phone and email.
- The other 7 (RASS Karakambadi, CTRI Kalavacharla, CTRI Kandukur, Vinayashram, SVVU Lam, Yagantipalle and BCT Haripuram) come from ICAR's list of KVKs in Andhra Pradesh (`https://icar.org.in/en/node/15047`). That list gives an address and host but no phone or email, so those fields are left out. The ICAR-ATARI Zone X and kvk.icar.gov.in sites did not answer from our network.

`district` is the current AP district. Where the source prints a pre-2022 district, `district_as_printed` keeps the source's wording and a `note` explains the move. These moves are our mapping by mandal, not something the sources state.

Eight districts have no KVK of their own: Vizianagaram, Visakhapatnam, Kakinada, Dr. B.R. Ambedkar Konaseema, Eluru, Palnadu, Sri Sathya Sai and Chittoor.

## kb_te.json and glossary_te.json (Telugu text)

`kb_te.json` holds Telugu for every farmer-facing field in kb.json: symptoms, prevention, practices, favourable conditions, organic options, avoid, ETL and the yes or no questions. It has 1,224 strings, keyed by disease id and field index, with questions keyed by question id. It was made in two steps (`scripts/kb_te.py`).
- Sarvam translate (sarvam-translate:v1) wrote the first draft.
- Claude (claude-sonnet-5-5) reviewed it, one call per crop plus one call for strings added later, 13 calls in all. The review fixed meaning errors, used plain coastal Andhra village Telugu, kept product and bio-agent names in English, kept every number, and applied `glossary_te.json` the same way throughout.

The reviewer's Telugu corrections (brown spot symptoms, host, velvety growth, irrigation wording, the Pseudomonas recipe, bullseye, girdle, spores, early blight naming) were given to the review as fixed wording, and a scan confirms none of the flagged words remain. A few lines were then fixed by hand (`TE_OVERRIDES` in `scripts/kb_te.py`). No Telugu agronomist has reviewed this text yet. The UI strings the reviewer flagged (`whichCrop`, `noChemicals`, `photoTip`, crop spellings) belong to the app layer.

### KB round 3: second agriculture review (`submission/judging/judge2-agri-r2.md`)

Fixed:
- **Pink bollworm.** New source: ICAR-CICR Nagpur, "Strategies and advisory for cotton pest and disease management 2024-25" (copy on nsai.co.in). `recommended_actives` are now emamectin benzoate and profenofos, which CICR names for pink bollworm at 60 to 120 days after sowing. CICR also names chlorpyrifos 20 EC on its own, but we leave it out: in the register it mostly comes as a mix with a pyrethroid, and CICR says never to spray mixtures. Indoxacarb is not registered for pink bollworm, so it is out too.
- **Pink bollworm `avoid`.** "Strictly avoid spraying pyrethroids before 120 days of sowing or any insecticide mixtures at any time", from CICR. The reviewer said 90 to 100 days; CICR says 120, and we follow CICR. The practices now include pheromone traps at 5 per hectare from 45 days, and splitting 20 green bolls per acre (CICR).
- **Not added for pink bollworm.** Neither CICR nor DPPQS names spinetoram for pink bollworm (CICR lists it for thrips and other bollworms), so it is not in `recommended_actives`. None of the sources we read mention mating disruption (PB rope), so it is not in practices either.
- **False smut Telugu name** is now మానిపండు తెగులు, as used on the Vikaspedia Telugu rice page (వరి).
- **Gall midge.** The Telugu text now says ఉల్లికాడ instead of the coined "వెండి కొమ్ము". The Vikaspedia Telugu page describes the tube "ఉల్లికాడ లాగ".
- **Groundnut late leaf spot.** The intercrop line now reads "1 row of pearl millet or sorghum for every 3 rows of groundnut". TNAU prints "pearl millet or sorghum with groundnut (1 : 3)".
- **Chilli yellow mite.** A symptom line no longer names the mite, so the describe-symptoms tile does not give away the answer.

Not KB items. These are left to DATA and APP, as the reviewer's own fixes say:
- **Bio row on brown spot printed with "500 liter/ha".** That figure is the register's water volume. kb.json carries no such row, and the label fix belongs in the dose layer.
- **Cyantraniliprole 18.41% SC on tomato.** The register row has 10 L water per ha and a 75-day waiting period, which points to a drone or drench use. kb.json has no application-method field; the card should say "as printed, drone or drench".
- **"Cartap Hydrofipronil ide" label typo.** It lives in registered_uses.json (DATA).
- **Onion thrips.** `recommended_actives` lists profenofos, which the TNAU onion page names. The register's waiting period for it on onion is long, so the app should drop any product whose waiting period runs past the crop's remaining days.
- **Brinjal shoot and fruit borer.** Its `recommended_actives` come from TNAU and AESA, and we checked them against both. We found no newer source to rerank them.

### Cashew (13th crop, added 27 Nov 2026)

Crop id `cashew` has six problems plus `cashew_healthy`: tea mosquito bug, stem and root borer, thrips (flower and foliage), anthracnose, inflorescence blight and die-back (pink disease).
- **Sources.** The NIPHM and DPPQS AESA based IPM package for cashewnut (`https://ppqs.gov.in/sites/default/files/cashewnut.pdf`) and the TNAU Agritech Portal cashew diseases page (Internet Archive copy). The ICAR-DCR Puttur site (cashew.icar.gov.in) showed only a default server page, so nothing comes from DCR directly.
- **CIB&RC.** The register lists a single use for cashew: Beta-cyfluthrin 8.49% + Imidacloprid 19.81% OD against "tea mosquito bug and thrips". `scripts/build_registered_uses.py` now maps "Cashew" rows to `cashew`, and `targets_by_crop.json` has `tea mosquito bug` and `thrips` for it. Stem and root borer, anthracnose, inflorescence blight and die-back have no approved chemical use, so those cards show only practices and organic options.
- **No `recommended_actives` or `etl`.** The AESA cashew package names no chemicals and gives no ETL table.
- **Telugu names** for cashew problems are descriptive.
- **Cashew Telugu.** The Sarvam account ran out of credits (HTTP 402 "No credits available") while drafting the cashew strings. Claude (claude-sonnet-5-5) therefore translated them straight from the English, under the same rules and glossary, in one call. That brings the total to 14 Claude calls for kb_te.json.

### KB round 4: third agriculture review (`submission/judging/judge2-agri-r3.md`)

- **`first_action` on all 77 problems.** Each one has text, `kind` (cultural, rogue, bio, chemical or next_season) and a source index. It is the single first step, written from the entry's own cited pages, and it never names a chemical product.
  - Virus and phytoplasma problems lead with uprooting infected plants and controlling the insect that spreads them (banana bunchy top, chilli and tomato leaf curl, black gram yellow mosaic and leaf crinkle, groundnut bud necrosis, brinjal little leaf).
  - Seed-, tuber- and soil-borne problems lead with next-planting steps: clean seed or tubers, resistant varieties and rotation. These are potato black scurf, common scab and bacterial wilt, brinjal bacterial wilt, Panama wilt, maize grey leaf spot and onion basal rot.
  - Pests with an ETL lead with "count first" and the threshold. Everything else leads with the first cultural or bio step.
  - The Telugu is in kb_te.json (`first_action`). The other nine languages are in `first_action.texts`, translated by Claude in two calls (`scripts/kb_first_action_i18n.json`); nobody has checked them yet.
- **Pink bollworm.** It now has `avoid_mixtures: true`. `recommended_actives` stay as single actives (emamectin benzoate, profenofos), and the app should not rank ready-mix products first on this card. CICR's text is "any insecticide mixtures at any time". The reviewer asks whether that means tank-mixes only. We read it as covering ready-mixes too, because the purpose (preventing whitefly and aphid outbreaks) applies to both.
- **Cashew tea mosquito bug.** We added the AESA cashew package's timing advice: watch from the flushing and flowering stage through fruiting, and protective sprays help yields but must not be applied in full bloom. We found no DCR Puttur page, so the flushing, flowering and nut-set schedule the reviewer describes is only as detailed as AESA gives it.
- **Cashew safety note.** Tea mosquito bug and thrips now carry a `safety_note`: the one registered product contains beta-cyfluthrin, which is WHO class Ib in the 2019 WHO classification (`hazard.json`). The note asks for protective clothing (from the AESA basic precautions) and KVK advice before spraying. We did not have the product label, so the note does not claim a label requirement.
- **Late blight resistance management.** Tomato and potato late blight practices now carry the FRAC QoI rule for late blight (FRAC QoI guidelines, potato and tomato, reviewed January 2024). Used alone, QoI products get at most 1 spray in 3, at most 3 per crop and never more than 2 in a row. Our Indian sources say nothing on this.
