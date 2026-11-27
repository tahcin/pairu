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
        n = len(d["sources"])
        for a in d.get("avoid", []):
            if not (0 <= a["source"] < n) or not a["text"]: errs.append(f"{i}: bad avoid item")
        for r in d.get("recommended_actives", []):
            if not (0 <= r["source"] < n) or not r["active"]: errs.append(f"{i}: bad recommended_actives item")
        if not d["names"].get("te"): errs.append(f"{i}: no Telugu name")
        ns = d.get("names_source", {})
        if set(ns) - set(d["names"]) or any(v not in ("vikaspedia", "descriptive") for v in ns.values()):
            errs.append(f"{i}: bad names_source")
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
    te_path = os.path.join(APP, "data", "kb_te.json")
    if os.path.exists(te_path):
        te = json.load(open(te_path))
        miss = 0
        for d in kb["diseases"]:
            t = te.get("diseases", {}).get(d["id"], {})
            for k in ("symptoms", "prevention", "practices"):
                if len(t.get(k, [])) != len(d[k]): miss += 1; errs.append(f"{d['id']}: kb_te {k} has {len(t.get(k, []))} of {len(d[k])}")
            if len(t.get("organic_bio", [])) != len(d["organic_bio"]): errs.append(f"{d['id']}: kb_te organic_bio count")
            if len(t.get("avoid", [])) != len(d.get("avoid", [])): errs.append(f"{d['id']}: kb_te avoid count")
            if d["favourable_conditions"] and not t.get("favourable_conditions"): errs.append(f"{d['id']}: kb_te favourable_conditions missing")
        for d in kb["diseases"]:
            for q in d["discriminators"]:
                if q["id"] not in te.get("questions", {}): errs.append(f"kb_te: question {q['id']} missing")
        if "\u2014" in json.dumps(te, ensure_ascii=False): errs.append("em dash in kb_te.json")
    for e in sorted(set(errs)): print("ERROR", e)
    print(f"{len(kb['crops'])} crops, {len(ids)} entries, {sum(1 for d in kb['diseases'] if d['kind']!='abiotic')} problems")
    print("no CIB&RC match:", ", ".join(no_match) or "none")
    sys.exit(1 if errs else 0)

if __name__ == "__main__":
    main()
