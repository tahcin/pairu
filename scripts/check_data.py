"""Check data/registered_uses.json, banned.json, hazard.json and
targets_by_crop.json against docs/CONTRACT.md, print counts, and spot-check
random rows against the PDF page text cached by extract_tables.py.

Run with: scripts/.venv/bin/python -I scripts/check_data.py [n_spot_checks]
Exits non-zero on a schema error.
"""
import json
import os
import random
import re
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")
TABLES = os.path.join(HERE, "raw", "tables")
CROPS = {"paddy", "cotton", "chilli", "groundnut", "maize", "tomato", "brinjal", "banana", "mango",
         "blackgram", "potato", "onion"}
TYPES = {"fungicide", "insecticide", "bio-fungicide", "bio-insecticide", "herbicide"}
FILE_KEYS = {
    "Fungicide MUP  as on 30.09.2026.pdf": "fungicides",
    "MUP (insecticide)  30.09.2026.pdf": "insecticides",
    "3. bio fungicides MUP as on 30.09.2026.pdf": "bio_fungicides",
    "MUP (bio insecticide) 30.09.2026.pdf": "bio_insecticides",
}
errors = []


def err(msg):
    errors.append(msg)


def check_uses(uses):
    req = {"crop_id": (str, type(None)), "crop_raw": str, "target_raw": str, "target_norm": str,
           "active_ingredients": list, "product_label": str, "pesticide_type": str, "dose_ai_g_ha": str,
           "dose_formulation_raw": str, "water_l_ha": str, "waiting_period_days": (int, type(None)),
           "waiting_period_raw": str, "source": dict}
    for i, r in enumerate(uses):
        for k, t in req.items():
            if k not in r or not isinstance(r[k], t):
                err(f"registered_uses[{i}].{k} missing or wrong type")
        if r.get("crop_id") is not None and r["crop_id"] not in CROPS:
            err(f"registered_uses[{i}] bad crop_id {r['crop_id']}")
        if r.get("pesticide_type") not in TYPES:
            err(f"registered_uses[{i}] bad type")
        if not r.get("active_ingredients"):
            err(f"registered_uses[{i}] no actives")
        s = r.get("source", {})
        if not isinstance(s.get("file"), str) or not isinstance(s.get("page"), int):
            err(f"registered_uses[{i}] bad source")
        if r.get("waiting_period_days") is not None and str(r["waiting_period_days"]) not in \
                re.sub(r"^0+(?=\d)", "", r["waiting_period_raw"]):
            err(f"registered_uses[{i}] waiting period int does not match raw")
        if r.get("target_norm") != r.get("target_norm", "").lower().strip():
            err(f"registered_uses[{i}] target_norm not normalised")
        for v in r.values():
            if isinstance(v, str) and "\u2014" in v:
                err(f"registered_uses[{i}] has an em dash")


def check_banned(banned):
    for i, b in enumerate(banned):
        if not isinstance(b.get("active"), str) or b["active"] != b["active"].lower():
            err(f"banned[{i}] active")
        if b.get("status") not in ("banned", "restricted", "withdrawn"):
            err(f"banned[{i}] status")
        if not isinstance(b.get("note"), str) or not isinstance(b.get("source"), dict):
            err(f"banned[{i}] note/source")
        for c in b.get("banned_on_crops", []):
            if c not in CROPS:
                err(f"banned[{i}] crop {c}")


def check_hazard(hazard, uses):
    actives = {a for r in uses for a in r["active_ingredients"]}
    for k, v in hazard.items():
        if v.get("who_class") not in ("Ia", "Ib", "II", "III", "U"):
            err(f"hazard[{k}] class")
        if k not in actives:
            err(f"hazard[{k}] not used in registered_uses")
        if not isinstance(v.get("source"), dict):
            err(f"hazard[{k}] source")


def squash(s):
    return re.sub(r"\s+", "", s)


def spot_check(uses, n):
    pages = {}
    for fname, key in FILE_KEYS.items():
        path = os.path.join(TABLES, key + ".json")
        if os.path.exists(path):
            pages[fname] = json.load(open(path))
    ours = [r for r in uses if r["crop_id"]]
    random.seed()
    ok = 0
    for r in random.sample(ours, n):
        pg = pages[r["source"]["file"]][r["source"]["page"] - 1]["text"]
        text = squash(pg)
        fields = [r["dose_ai_g_ha"], r["dose_formulation_raw"], r["water_l_ha"], r["waiting_period_raw"]]
        # multi-line cells come out interleaved with their neighbours in the
        # page text, so check that every token of each field is on the page
        found = [squash(f) in text or all(tok in text for tok in re.split(r"\s+", f) if tok) for f in fields if f]
        crop_ok = squash(r["crop_raw"]).lower()[:5] in text.lower()
        good = all(found) and crop_ok
        ok += good
        print(f"  {'OK ' if good else 'CHK'} p{r['source']['page']:>3} {r['crop_id']:<9} {r['product_label'][:38]:<38} "
              f"| {r['target_norm'][:24]:<24} | {r['dose_ai_g_ha'][:14]} | {r['dose_formulation_raw'][:14]} | "
              f"{r['water_l_ha'][:10]} | {r['waiting_period_raw'][:8]}")
    print(f"  {ok}/{n} rows: every token of every dose field and the crop found on the cited page")


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    uses = json.load(open(os.path.join(DATA, "registered_uses.json")))
    banned = json.load(open(os.path.join(DATA, "banned.json")))
    hazard = json.load(open(os.path.join(DATA, "hazard.json")))
    tbc = json.load(open(os.path.join(DATA, "targets_by_crop.json")))
    check_uses(uses)
    check_banned(banned)
    check_hazard(hazard, uses)
    if set(tbc) != {r["crop_id"] for r in uses if r["crop_id"]}:
        err("targets_by_crop crops differ from registered_uses")

    ours = [r for r in uses if r["crop_id"]]
    print(f"registered_uses: {len(uses)} records, {len(ours)} for our 12 crops")
    print("  by crop:", dict(sorted(Counter(r["crop_id"] for r in ours).items())))
    print("  by type:", dict(Counter(r["pesticide_type"] for r in ours)))
    print("  crop x type:")
    ct = Counter((r["crop_id"], r["pesticide_type"]) for r in ours)
    for c in sorted(CROPS):
        print(f"    {c:<10}", {t: ct[(c, t)] for t in ["fungicide", "insecticide", "bio-fungicide", "bio-insecticide"]})
    print(f"banned: {len(banned)} entries", dict(Counter(b['status'] for b in banned)))
    print(f"hazard: {len(hazard)} actives", dict(Counter(v['who_class'] for v in hazard.values())))
    print(f"targets_by_crop: { {c: len(v) for c, v in tbc.items()} }")
    print("spot checks:")
    spot_check(uses, n)
    if errors:
        print(f"{len(errors)} SCHEMA ERRORS")
        for e in errors[:30]:
            print("  ", e)
        sys.exit(1)
    print("schema OK")


if __name__ == "__main__":
    main()
