# Pairu accuracy test

This folder holds a small, frozen and reproducible test of how often Pairu names the right disease from a leaf photo, compared with the same vision model asked an open question. The results are in `results.json`, which the app shows on its `/evidence` page.

## What is compared

- **Pairu.** The photo goes to `POST /api/diagnose` with the true crop (in the app the farmer picks it from picture tiles) and no spoken note. The model may only choose from the diseases Pairu holds for that crop, plus healthy and unknown, and code decides: it answers only when the top choice is at least 0.75 and 0.25 ahead of the next; when the top two are look-alikes it asks yes/no questions; otherwise it says it is unsure. When Pairu asked, a script answered the way a farmer looking at the real leaf would (yes only when the question's yes side is the true disease) and sent the answers to `POST /api/resolve`.
- **Bare model.** The same model, `gemini-3.1-flash-lite`, gets the same image and the prompt "What crop and disease is this? Answer with the disease name." with no crop and no list. Its free text is mapped to a disease by `matcher.py` (the first bold phrase naming a disease, otherwise the earliest disease name in the text, with standard synonyms and pathogen names), matching only the diseases of the true crop, which is lenient to the bare model. Answers the matcher cannot place are listed in `results.json` under `baseline_unmatched_answers` and count as wrong.

A refusal ("unsure", or the bare model saying it cannot tell) is not counted as an error. "Wrong-confident" means the system gave an answer and it was wrong, which is the dangerous case because a farmer would spray for it.

## Test set

`testset.json` lists 95 images, chosen with a fixed seed (20261127) before any model was run, with each file's source, licence, dataset label and SHA-256.

| Source | Licence | Photos | Classes |
|---|---|---|---|
| [PlantVillage](https://github.com/spMohanty/PlantVillage-Dataset) (Mohanty et al. 2016) | CC BY-SA 3.0 | lab photos, one leaf on a plain background | tomato (10 classes), potato (3), maize (4), healthy included |
| [Rice Leaf Disease Image Samples](https://data.mendeley.com/datasets/fwcj7stb8r) (Sethy et al. 2020, Mendeley Data) | CC BY 4.0 | field photos, 300 x 300 px | bacterial blight, blast, brown spot, tungro |

Diseases Pairu holds get 5 images each (16 classes, 80 images). Five classes Pairu does not hold (tomato leaf mould, spider mites, target spot and mosaic virus, and rice tungro) get 3 images each (15 images); there the right behaviour for Pairu is to say it is unsure, and they are reported separately rather than dropped. PlantVillage picks take one photo per physical leaf using the dataset's own leaf map; rice picks are spread across the photo groups and near-duplicates (including flipped and rotated copies) are skipped.

## Reproduce

```bash
python3 -I eval/build_testset.py fetch      # downloads the images and checks every SHA-256
eval/serve_local.sh /tmp/pairu-eval          # local API with Gemini only (port 8817)
python3 -I eval/run.py                       # writes eval/runs/<timestamp>.jsonl, every raw response
python3 -I eval/score.py eval/runs/<file>.jsonl   # writes eval/results.json
```

The run used a local copy of the same Pages Functions and the same `data/kb.json` as the live app, with a `.dev.vars` that holds only the Gemini key, so the paid Claude fallback could not be used. Requests were throttled to under 12 a minute and the whole run was capped at 230 Gemini calls. While the run was in progress the app gained a 12 second timeout per model (commit 16c196c), so later images could fall back to the second Gemini model sooner; the prompt and the decision thresholds did not change. One runner crash (a network timeout) was resumed from the same run file.

## Results

Run on 27 November 2026 (run file `runs/20261127-173944.jsonl`, 211 Gemini calls in all). The 80 in-list images are the headline; the 15 out-of-list images are reported on their own below.

| On 80 photos of diseases Pairu holds | Pairu | Bare model |
|---|---|---|
| Named the right disease (top-1, refusals count as not right) | 57 (71.2%) | 38 (47.5%) |
| Gave an answer | 73 | 80 |
| Right when it gave an answer | 78.1% | 47.5% |
| Said it was unsure | 7 (8.8%) | 0 |
| Answered but wrong (the dangerous case) | 16 (20.0%) | 42 (52.5%) |

The open question asks which disease the leaf has, which nudges the bare model to name a disease even on a healthy leaf, and it did so on all 15 healthy leaves. Leaving the healthy leaves out, on the 65 diseased leaves Pairu was right 43 times (66.2%) and wrong while answering 16 times (24.6%), and the bare model was right 38 times (58.5%) and wrong 27 times (41.5%). So most of Pairu's gain in accuracy comes from healthy leaves, and the gain on diseased leaves is smaller (and, at this sample size, not far outside the noise); the clearer gain is fewer confident wrong answers.

How Pairu got there: its first guess from the closed list was right on 56 of 80 images. It decided at once on 65, asked follow-up questions on 8 and was unsure at once on 7. The questions turned a wrong first guess into the right answer 3 times and never turned a right first guess wrong, but on 2 images the true disease was not among the two candidates being asked about, so the answers could not help and Pairu still answered wrongly. 12 of the 95 Pairu answers came from the fallback model gemini-3.5-flash-lite (when the first model failed or ran past 12 seconds), as they would for a farmer.

By photo type: on the 65 lab photos Pairu was right on 46 (70.8%) against 29 (44.6%); on the 15 rice field photos it was right on 11 (73.3%) against 9 (60.0%), and wrong while answering on 2 against 6.

Out of list (15 photos of tomato leaf mould, spider mites, target spot, mosaic virus and rice tungro, which Pairu does not hold): Pairu said it was unsure on only 2 and named a listed disease on 13, so the refusal path does not yet catch most diseases outside its list. The bare model named the true disease once and was wrong on the other 14.

Weak spots worth knowing: tomato bacterial spot (Pairu 0 of 5, mostly called early blight), potato late blight (2 of 5, called early blight), tomato septoria leaf spot (1 of 5) and maize grey leaf spot (2 of 5). The full per-class table and every row are in `results.json`.

The bare model's answers that name no disease in our matcher (14, all listed in `results.json`) were read by hand: each names a different disease or pest (for example curly top virus, powdery mildew, maize streak virus, rice leaf scald), so counting them as wrong is fair. The matcher's rules were fixed after looking at the first two answers only (bold answer first, plurals), before the rest of the run.

## Diagnosis v2: decide alone only at 0.9, otherwise a second look

What changed. In v1 the first look answered on its own at a confidence of 0.75 or more, and its confidence was about 0.85 for right and wrong answers alike. In v2 the first look answers on its own only at 0.9 or more. Between 0.4 and 0.9 a second look runs (`functions/_lib/verify.ts`): the model sees the same photo again and answers yes, no or cannot tell to questions taken from the knowledge base, namely the questions that tell the candidate diseases apart and one "do you see this sign?" question per candidate (the top two candidates plus the top one's look-alikes, at most four, plus healthy if the first look offered it). Code then decides: a disease survives only if its own sign is seen and no answer rules it out. One survivor is the answer, marked "Checked twice"; questions the photo could not settle go to the farmer; if nothing survives, Pairu says it is not sure. The second look uses gemini-3.5-flash-lite with gemini-3.1-flash-lite as fallback, never Claude. Below 0.4, Pairu says it is not sure.

**The 0.9 threshold was chosen on half of the test set.** We split the images by the MD5 hash of the file name; the threshold was picked by looking at v1's first-look confidences on the even half only. The odd half was not used to choose anything, so its numbers are the fair, held-out ones. Numbers on all images are shown as well but include the half the threshold was tuned on.

How it was run. The first look was not repeated: `run_v2.py` replays the first-look answers saved in the v1 run and calls only the second look, through an eval-only path (`/api/verify`, which answers 404 unless the local eval server sets `EVAL_DEBUG=1`) that runs the same code the app runs. 68 images went to the second look, using 68 Gemini calls and no Claude. Questions left for the farmer were answered by a script from the true label, **which is the best case**: a real farmer can misread a leaf. The second look used the knowledge base at commit 7113bef (83 entries); the first looks were made with the earlier 78-entry version, whose tomato, potato and maize lists are the same (paddy later gained three pests).

| Photos of diseases Pairu holds | v1 | v2 | Bare model |
|---|---|---|---|
| Held-out half (n=37): right | 27 (73.0%) | 28 (75.7%) | 19 (51.4%) |
| Held-out half: answered and wrong | 9 (24.3%) | 5 (13.5%) | 18 (48.6%) |
| Held-out half: refused (not sure) | 1 | 4 | 0 |
| Held-out half: farmer had to answer questions | 4 | 6 | not asked |
| All 80: right | 57 (71.2%) | 58 (72.5%) | 38 (47.5%) |
| All 80: answered and wrong | 16 (20.0%) | 12 (15.0%) | 42 (52.5%) |
| All 80: refused | 7 | 10 | 0 |
| All 80: farmer had to answer questions | 8 | 15 | not asked |
| Diseased leaves only (n=65): right / answered and wrong | 43 / 16 | 44 / 12 | 38 / 27 |
| Out of list (n=15): refused / named a wrong listed disease | 2 / 13 | 3 / 12 | 0 / 14 (named the true disease once) |

What this shows, honestly. v2 gives about the same number of right answers as v1 and fewer confident wrong ones (5 against 9 on the held-out half, 12 against 16 on all 80), at the price of a few more refusals and of asking the farmer more often (15 times against 8). The first look on its own at 0.9 or more was right on all 23 in-list photos where it reached that level. The second look is the weak part: of the 37 in-list answers it marked as checked twice, 25 were right and 12 were wrong (for example it turned three tomato early blight photos that v1 had right into late blight). So the app shows "Checked twice" as a fact about what was done, but treats such an answer as a best guess rather than as sure. Out-of-list diseases are still mostly named as something on the list. With 37 held-out photos, a difference of one to four images is within the noise.

Reproduce: start `eval/serve_local.sh`, then `python3 -I eval/run_v2.py`, then `python3 -I eval/score.py eval/runs/20261127-173944.jsonl && python3 -I eval/score_v2.py eval/runs/v2-20261127-183716.jsonl`. `results.json` keeps the v1 numbers and adds a `v2` block.

## Limits

- Most images are PlantVillage lab photos of a single leaf on a plain background, which are far easier than a phone photo taken in a field. The rice images are real field photos and are reported separately.
- The set is small (95 images, about five per disease), so every percentage carries a wide margin of error.
- PlantVillage is public and widely used, so the model may have seen these images during training.
- The open question presumes a disease, which hurts the bare model on healthy leaves; the diseased-only comparison above removes that effect.
- Pairu was told the true crop; the bare model was not, but it was scored only on the disease.
- Follow-up questions were answered by a script from the true label, the best case for the questions; a real farmer can misread a leaf.
