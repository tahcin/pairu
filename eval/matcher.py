"""Deterministic mapping from the bare model's free-text answer to a disease id.

The baseline is never told the crop, but we score it leniently: its answer is matched only
against the diseases of the true crop (KB diseases plus the dataset classes we do not hold), so
naming "late blight" on a tomato leaf counts as tomato late blight even if it called the plant a
potato. Crop naming is recorded separately.

Rules, in order:
  1. Lowercase, normalise spelling (grey/gray, mould/mold, hyphens).
  2. Find every synonym of every candidate id in the text. The match that starts earliest wins
     (the model names its main answer first); ties go to the longer synonym.
  3. No disease match: "healthy" style wording maps to <crop>_healthy; refusal wording
     ("cannot determine", "not sure") maps to "refused"; anything else is "unmatched" and logged.

Synonyms below were written before the model run, from the dataset class names, the KB names
and the standard pathogen names. Any later addition is listed in eval/README.md with the reason.
"""
from __future__ import annotations

import re

# Hand-written synonyms for the dataset classes (keyed by the KB id we map each class to, or the
# out-of-list id we use for it). Pathogen names count as naming the disease.
SYNONYMS: dict[str, list[str]] = {
    "tomato_bacterial_spot": ["bacterial spot", "bacterial leaf spot", "xanthomonas"],
    "tomato_early_blight": ["early blight", "alternaria"],
    "tomato_late_blight": ["late blight", "phytophthora"],
    "tomato_septoria_leaf_spot": ["septoria"],
    "tomato_leaf_curl": ["yellow leaf curl", "leaf curl", "tylcv", "begomovirus"],
    "tomato_leaf_mold": ["leaf mold", "fulvia", "passalora", "cladosporium fulvum"],
    "tomato_spider_mite": ["spider mite", "tetranychus", "two spotted mite", "mite"],
    "tomato_target_spot": ["target spot", "corynespora"],
    "tomato_mosaic_virus": ["mosaic", "tomv", "tmv"],
    "potato_early_blight": ["early blight", "alternaria"],
    "potato_late_blight": ["late blight", "phytophthora"],
    "maize_grey_leaf_spot": ["grey leaf spot", "cercospora"],
    "maize_common_rust": ["common rust", "puccinia sorghi", "rust"],
    "maize_turcicum_blight": ["northern leaf blight", "northern corn leaf blight", "turcicum", "exserohilum", "nclb"],
    "maize_maydis_blight": ["southern leaf blight", "southern corn leaf blight", "maydis", "bipolaris maydis"],
    "paddy_blb": ["bacterial leaf blight", "bacterial blight", "blb", "xanthomonas oryzae"],
    "paddy_blast": ["blast", "pyricularia", "magnaporthe"],
    "paddy_brown_spot": ["brown spot", "bipolaris oryzae", "cochliobolus miyabeanus", "helminthosporium"],
    "paddy_tungro": ["tungro"],
    "paddy_sheath_blight": ["sheath blight", "rhizoctonia"],
    # Named diseases outside the test classes, listed so a lenient short synonym (like "rust")
    # never gives credit for a different disease (like southern rust).
    "maize_southern_rust": ["southern rust", "puccinia polysora"],
    "paddy_leaf_smut": ["leaf smut", "entyloma"],
    "paddy_bacterial_leaf_streak": ["bacterial leaf streak"],
    "paddy_narrow_brown_spot": ["narrow brown spot", "narrow brown leaf spot", "cercospora janseana"],
    "tomato_bacterial_speck": ["bacterial speck", "pseudomonas syringae"],
    "potato_bacterial_wilt": ["bacterial wilt", "ralstonia"],
}

HEALTHY = [r"\bhealthy\b", r"\bno (visible )?(signs of )?disease\b", r"\bdisease[- ]free\b", r"\bno disease\b"]
REFUSAL = [r"can ?not (determine|identify|tell)", r"can't (determine|identify|tell)", r"\bunable to\b", r"\bnot sure\b",
           r"\bunclear\b", r"\bimpossible to\b", r"\bdifficult to (determine|say|tell)\b"]

CROP_WORDS = {
    "tomato": [r"\btomato"], "potato": [r"\bpotato"], "maize": [r"\bmaize\b", r"\bcorn\b"],
    "paddy": [r"\brice\b", r"\bpaddy\b"],
}


def norm(t: str) -> str:
    t = t.lower().replace("grey", "gray").replace("mould", "mold").replace("-", " ").replace("_", " ")
    t = t.replace("gray", "grey")
    return re.sub(r"\s+", " ", t)


def kb_synonyms(kb: dict, crop: str) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for d in kb["diseases"]:
        if d["crop"] != crop or d["id"].endswith("_healthy"):
            continue
        names = {norm(d["name_en"])}
        for part in re.split(r"[()/,]", d["name_en"]):
            part = norm(part).strip()
            if len(part) > 3:
                names.add(part)
        out[d["id"]] = sorted(names | {norm(s) for s in SYNONYMS.get(d["id"], [])})
    return out


def candidates_for(kb: dict, crop: str) -> dict[str, list[str]]:
    c = kb_synonyms(kb, crop)
    for i, syns in SYNONYMS.items():
        if i.startswith(crop + "_") and i not in c:
            c[i] = [norm(s) for s in syns]
    return c


def match(text: str | None, crop: str, kb: dict) -> dict:
    if not text:
        return {"id": None, "how": "no_text"}
    t = norm(text)
    best = None
    for did, syns in candidates_for(kb, crop).items():
        for s in syns:
            m = re.search(r"(?<![a-z])" + re.escape(s) + r"(?![a-z])", t)
            if m and (best is None or (m.start(), -len(s)) < (best[0], -len(best[2]))):
                best = (m.start(), did, s)
    crops_named = [c for c, pats in CROP_WORDS.items() if any(re.search(p, t) for p in pats)]
    if best:
        return {"id": best[1], "how": f"synonym:{best[2]}", "crops_named": crops_named}
    if any(re.search(p, t) for p in HEALTHY):
        return {"id": f"{crop}_healthy", "how": "healthy", "crops_named": crops_named}
    if any(re.search(p, t) for p in REFUSAL):
        return {"id": "refused", "how": "refusal", "crops_named": crops_named}
    return {"id": "unmatched", "how": "unmatched", "crops_named": crops_named}
