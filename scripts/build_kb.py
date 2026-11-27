"""Build data/kb.json from the reviewed extracts (scripts/kb_reviewed/<id>.json),
the plan (scripts/kb_plan.json) and the hand-written parts (scripts/kb_authored.py).

Usage: python3 -I scripts/build_kb.py   (writes data/kb.json with every crop that has entries)
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from kb_authored import CROPS, PAIRS, HEALTHY, FIXES, NAMES  # noqa: E402

APP = os.path.dirname(HERE)
REV = os.path.join(HERE, "kb_reviewed")
TN = {}
for f in ("index.json", "index2.json"):
    p = os.path.join(HERE, "raw", "kb", "tnau", f)
    if os.path.exists(p):
        TN.update(json.load(open(p)))

AESA = {
 "rice": "rice.pdf", "maize": "maize.pdf", "groundnut": "groundnut.pdf", "blackgram_greengram": "blackgram_greengram%20%281%29.pdf",
 "banana": "banana.pdf", "brinjal": "brinjal.pdf", "chillies_capsicum": "chillies_capsicum.pdf", "cotton": "cotton.pdf",
 "mango": "mango.pdf", "onion": "onion.pdf", "potato": "potato.pdf", "tomato": "tomato.pdf",
}
AESA_NAME = {"rice": "Rice", "maize": "Maize", "groundnut": "Groundnut", "blackgram_greengram": "Black gram and green gram",
 "banana": "Banana", "brinjal": "Brinjal", "chillies_capsicum": "Chillies and capsicum", "cotton": "Cotton", "mango": "Mango",
 "onion": "Onion", "potato": "Potato", "tomato": "Tomato"}
EXTRA = {
 "ppqs_paddy_blast": ("DPPQS (Ministry of Agriculture): Package of practices for management of paddy blast", "https://ppqs.gov.in/sites/default/files/pop_for_management_of_paddy_blast.pdf"),
 "ppqs_rice_bph": ("DPPQS (Ministry of Agriculture): Package of practices for management of rice brown plant hopper", "https://ppqs.gov.in/sites/default/files/pop_for_managment_of_rice_bph.pdf"),
 "ppqs_cotton_pbw": ("DPPQS (Ministry of Agriculture): Package of practices for pink bollworm of cotton", "https://ppqs.gov.in/sites/default/files/pop_for_pbw_of_cotton.pdf"),
 "ppqs_cotton_whitefly": ("DPPQS (Ministry of Agriculture): Package of practices for management of whitefly in cotton", "https://ppqs.gov.in/sites/default/files/pop_for_management_of_white_fly_in_cotton.pdf"),
 "ppqs_faw": ("DPPQS (Ministry of Agriculture): Advisory on fall armyworm on maize, July 2022", "https://ppqs.gov.in/sites/default/files/faw_advisory0001.pdf"),
 "vikaspedia_faw": ("Vikaspedia: Identification and management of fall armyworm", "https://en.vikaspedia.in/viewcontent/agriculture/crop-production/integrated-pest-managment/ipm-for-cerels/identification-and-management-of-fall-armyworm?lgn=en"),
 "iihr_tomato_lb": ("ICAR-IIHR, Indian Horticulture: Late blight disease of tomato, a serious problem for Indian tomato farmers", "https://epubs.icar.org.in/index.php/IndHort/article/view/164935"),
 "cpn_gls": ("Crop Protection Network (US land-grant universities): Gray leaf spot of corn", "https://cropprotectionnetwork.org/encyclopedia/gray-leaf-spot-of-corn"),
}

PRINCIPLES = {"banana", "blackgram_greengram", "chillies_capsicum", "brinjal", "maize", "potato", "mango", "onion", "tomato"}

def source_for(f, crop_name):
    if f.startswith("aesa:"):
        k = f[5:]
        return {"title": f"NIPHM and DPPQS: AESA based IPM package, {AESA_NAME[k]}", "url": "https://ppqs.gov.in/sites/default/files/" + AESA[k]}
    if f.startswith("extra:"):
        t, u = EXTRA[f[6:]]
        return {"title": t, "url": u}
    html = f[:-4] + ".html"
    m = TN[html]
    first = open(os.path.join(HERE, "raw", "kb", "text", f)).read().split("\n")[2].strip(" :")
    return {"title": f"TNAU Agritech Portal: {crop_name}, {first}", "url": m["archive"], "original": m["original"]}

from kb_authored import TE_URLS as TE  # noqa: E402

def te_source(key):
    from urllib.parse import unquote
    u = TE[key]
    title = unquote(u.split("/")[-1].split("?")[0]).replace("-", " ")
    return {"title": f"Vikaspedia Telugu: {title}", "url": u}

def clean(s):
    s = re.sub(r"(\d) ?x ?108\b", r"\1 x 10^8", s)
    s = re.sub(r"@ ?108 cfu", "@ 10^8 cfu", s)
    s = s.replace("—", ", ").replace("–", "-").replace(" ,", ",").strip()
    return re.sub(r"\s+", " ", s)

def main():
    plan = {d["id"]: d for d in json.load(open(os.path.join(HERE, "kb_plan.json")))["diseases"]}
    look, disc = {}, {}
    for n, (a, b, q) in enumerate(PAIRS):
        look.setdefault(a, []).append(b)
        look.setdefault(b, []).append(a)
        item = {"id": f"q_{a}_{b}"[:60], "question": q, "yes": a, "no": b}
        disc.setdefault(a, []).append(item)
        disc.setdefault(b, []).append(item)
    crops, diseases = [], []
    for cid, (cname, cnames) in CROPS.items():
        ids = [i for i, d in plan.items() if d["crop"] == cid and os.path.exists(os.path.join(REV, i + ".json"))]
        if not ids:
            continue
        for i in ids:
            d, r = plan[i], json.load(open(os.path.join(REV, i + ".json")))
            fx = FIXES.get(i, {})
            for sub in fx.get("drop_bio", []):
                r["organic_bio"] = [o for o in r["organic_bio"] if sub not in o["text"]]
            for k, sub in fx.get("drop", []):
                r[k] = [x for x in r[k] if sub not in x]
            for k, v in fx.get("set", {}).items():
                r[k] = v
            for k, v in fx.get("add", {}).items():
                r[k] = r[k] + v
            if fx.get("set", {}).get("_used_pages") is not None:
                r["_used_pages"] = fx["set"]["_used_pages"]
            nm = NAMES.get(i)
            r["names"] = nm[0] if nm else {}
            srcs = [source_for(f, cname) for f in d["text_files"]]
            used = sorted({o["page"] for o in r.get("organic_bio", [])} | set(r.get("_used_pages", range(len(srcs)))))
            # keep only sources the entry actually draws on, and renumber organic_bio refs
            remap = {old: new for new, old in enumerate(used)}
            have = {f[:-5] for f in os.listdir(REV)}
            la = [x for x in dict.fromkeys(look.get(i, [])) if x in have]
            dq, seen = [], set()
            for q in disc.get(i, []):
                if q["id"] not in seen and q["yes"] in have and q["no"] in have:
                    seen.add(q["id"]); dq.append(q)
            diseases.append({
                "id": i, "crop": cid, "name_en": d["name_en"], "names": r.get("names", {}), "kind": d["kind"],
                "pathogen": clean(r.get("pathogen", "")),
                "symptoms": [clean(x) for x in r["symptoms"]],
                "photo_cues": [clean(x) for x in r["photo_cues"]],
                "look_alikes": la, "discriminators": dq,
                "favourable_conditions": clean(r.get("favourable_conditions", "")),
                "prevention": [clean(x) for x in r["prevention"]],
                "practices": [clean(x) for x in r["practices"]],
                "organic_bio": [{"text": clean(o["text"]), "source": remap[o["page"]]} for o in r.get("organic_bio", [])],
                "cibrc_targets": d["cibrc_targets"],
                "sources": [srcs[k] for k in used] + ([te_source(nm[1])] if nm else []),
            })
        h = HEALTHY[cid]
        hid = f"{cid}_healthy"
        diseases.append({"id": hid, "crop": cid, "name_en": "Healthy", "names": {}, "kind": "abiotic", "pathogen": "",
            "symptoms": h["symptoms"], "photo_cues": h["photo_cues"], "look_alikes": [], "discriminators": [],
            "favourable_conditions": "", "prevention": h["prevention"], "practices": h["practices"], "organic_bio": [],
            "cibrc_targets": [], "sources": [source_for(f"aesa:{h['aesa']}", cname)] + ([] if h["aesa"] in PRINCIPLES else [source_for("aesa:tomato", cname)])})
        crops.append({"id": cid, "name_en": cname, "names": cnames, "diseases": ids + [hid]})
    out = {"version": 1, "crops": crops, "diseases": diseases}
    json.dump(out, open(os.path.join(APP, "data", "kb.json"), "w"), indent=1, ensure_ascii=False)
    print(len(crops), "crops", len(diseases), "entries")

if __name__ == "__main__":
    main()
