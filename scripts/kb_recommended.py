"""Find the chemical actives that the AESA IPM package or DPPQS package of practices names for each problem.

Candidates are the actives registered (registered_uses.json) for that crop and the entry's CIB&RC
targets. An active is kept only if its name appears in the package text next to the problem: the
lines that mention the problem and the 6 lines after each mention (AESA), or anywhere in a
problem-specific DPPQS package, or on the TNAU page for that one problem. Output: scripts/kb_recommended.json, read by build_kb.py after review.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from kb_extract import aesa_window  # noqa: E402

ALIASES = {"chlorpyrifos": ["chlorpyriphos"], "copper oxychloride": ["coc"], "lambda-cyhalothrin": ["lambda cyhalothrin", "lambdacyhalothrin"],
           "carbendazim": ["bavistin"], "thiophanate methyl": ["thiophanate-methyl"], "azadirachtin": [], "mancozeb": ["dithane"],
           "sulphur": ["sulfur", "wettable sulphur"], "propiconazole": ["tilt"], "tricyclazole": ["beam"]}

def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()

def main():
    plan = json.load(open(os.path.join(HERE, "kb_plan.json")))["diseases"]
    uses = json.load(open(os.path.join(APP, "data", "registered_uses.json")))
    out = {}
    for d in plan:
        tg = set(d["cibrc_targets"])
        banned = {b["active"] for b in json.load(open(os.path.join(APP, "data", "banned.json"))) if b["status"] != "restricted"}
        cands = sorted({a for u in uses if u["crop_id"] == d["crop"] and u["target_norm"] in tg for a in u["active_ingredients"]} - banned)
        texts = []
        for k, f in enumerate(d["text_files"]):
            if f.startswith("aesa:"):
                texts.append((k, aesa_window(f[5:], d["aesa_kw"], after=6)))
            elif f.startswith("extra:ppqs_"):
                texts.append((k, open(os.path.join(HERE, "raw", "kb", "extra", f[6:] + ".txt")).read()))
            elif not f.startswith("extra:"):
                # the TNAU page for this one problem
                t = open(os.path.join(HERE, "raw", "kb", "text", f)).read()
                texts.append((k, re.sub(r"Content Validator.*", "", t, flags=re.S)))
        found = []
        for a in cands:
            names = [a] + ALIASES.get(a, [])
            for k, t in texts:
                tn = " " + norm(t) + " "
                if any(" " + norm(n) + " " in tn for n in names):
                    found.append({"active": a, "page": k})
                    break
        out[d["id"]] = found
        print(f"{d['id']:32s} {len(cands):3d} cands -> {', '.join(x['active'] for x in found)}")
    json.dump(out, open(os.path.join(HERE, "kb_recommended.json"), "w"), indent=1)

if __name__ == "__main__":
    main()
