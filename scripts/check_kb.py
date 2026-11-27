"""Check data/kb.json against docs/CONTRACT.md. Prints problems; exits 1 if any."""
import json, os, sys

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CROP_IDS = "paddy cotton chilli groundnut maize tomato brinjal banana mango blackgram potato onion".split()
KINDS = {"fungal", "bacterial", "viral", "pest", "nutrient", "abiotic"}
LANGS = {"te", "hi", "ta", "kn", "mr", "bn", "or", "gu", "pa", "ml"}

def main():
    kb = json.load(open(os.path.join(APP, "data", "kb.json")))
    tb = json.load(open(os.path.join(APP, "data", "targets_by_crop.json")))
    targets = {c: {t["target_norm"] for t in v} for c, v in tb.items()}
    errs, warns = [], []
    ids = [d["id"] for d in kb["diseases"]]
    if len(ids) != len(set(ids)):
        errs.append("duplicate disease ids")
    byid = {d["id"]: d for d in kb["diseases"]}
    for c in kb["crops"]:
        if c["id"] not in CROP_IDS: errs.append(f"unknown crop {c['id']}")
        if set(c["names"]) - LANGS: errs.append(f"{c['id']}: bad name langs")
        for i in c["diseases"]:
            if i not in byid: errs.append(f"{c['id']} lists missing {i}")
            elif byid[i]["crop"] != c["id"]: errs.append(f"{i} crop mismatch")
        if f"{c['id']}_healthy" not in c["diseases"]: errs.append(f"{c['id']} has no healthy entry")
    crops = {c["id"] for c in kb["crops"]}
    text = json.dumps(kb, ensure_ascii=False)
    if "—" in text: errs.append("em dash found")
    no_match = []
    for d in kb["diseases"]:
        i = d["id"]
        if d["crop"] not in crops: errs.append(f"{i}: crop not in crops")
        if d["kind"] not in KINDS: errs.append(f"{i}: bad kind")
        if set(d["names"]) - LANGS: errs.append(f"{i}: bad name langs")
        for k, n in (("symptoms", 3), ("photo_cues", 2), ("prevention", 2), ("practices", 2), ("sources", 1)):
            if len(d[k]) < n: errs.append(f"{i}: {k} has {len(d[k])} < {n}")
        for o in d["organic_bio"]:
            if not (0 <= o["source"] < len(d["sources"])): errs.append(f"{i}: organic_bio source index out of range")
        for s in d["sources"]:
            if not s.get("url", "").startswith("http"): errs.append(f"{i}: bad source url")
        for la in d["look_alikes"]:
            if la not in byid: errs.append(f"{i}: look-alike {la} missing")
            elif not any({q["yes"], q["no"]} == {i, la} for q in d["discriminators"]):
                errs.append(f"{i}: no discriminator for look-alike {la}")
        for q in d["discriminators"]:
            if q["yes"] not in byid or q["no"] not in byid: errs.append(f"{i}: discriminator points to missing id")
        if d["kind"] != "abiotic":
            bad = [t for t in d["cibrc_targets"] if t not in targets.get(d["crop"], set())]
            if bad: errs.append(f"{i}: cibrc targets not in targets_by_crop: {bad}")
            if not d["cibrc_targets"]: no_match.append(i)
    for e in errs: print("ERROR", e)
    print(f"{len(kb['crops'])} crops, {len(ids)} entries, {sum(1 for d in kb['diseases'] if d['kind']!='abiotic')} problems")
    print("no CIB&RC match:", ", ".join(no_match) or "none")
    sys.exit(1 if errs else 0)

if __name__ == "__main__":
    main()
