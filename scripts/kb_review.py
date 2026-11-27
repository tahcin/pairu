"""Check model extracts against the page text they came from, then save to scripts/kb_reviewed/.

Automatic checks (a person then reads every reviewed file):
- organic_bio items must name a biological agent or botanical, and every number in the item
  (dose, rate, interval) must appear in the page it cites; otherwise the item is dropped.
- pages whose text is empty for this problem are not cited.
Hand edits live in kb_reviewed/<id>.json; rerunning only fills ids that are not reviewed yet,
unless --force is given.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from kb_extract import aesa_window, TEXT  # noqa: E402

EXT = os.path.join(HERE, "raw", "kb", "extract")
REV = os.path.join(HERE, "kb_reviewed")
os.makedirs(REV, exist_ok=True)
BIO = re.compile(r"pseudomonas|trichoderma|bacillus|beauveria|metarhizium|verticillium|lecanicillium|npv|neem|azadirachtin|"
                 r"trichogramma|chrysoperla|pheromone|parasitoid|\bbt\b|b\. ?t\.|garlic|botanical|nsk|cake|bio-?agent|"
                 r"ampelomyces|extract|cow ?dung|\bfym\b|manure|nomuraea|predator|light trap|sticky trap|yellow trap|fish oil rosin|tobacco decoction|ash", re.I)

def page_text(f, plan_d):
    if f.startswith("extra:"):
        return open(os.path.join(HERE, "raw", "kb", "extra", f[6:] + ".txt")).read()
    if f.startswith("aesa:"):
        return aesa_window(f[5:], plan_d["aesa_kw"])
    return open(os.path.join(TEXT, f)).read()

def norm_num(s):
    return s.replace(",", "")

def main():
    force = "--force" in sys.argv
    plan = {d["id"]: d for d in json.load(open(os.path.join(HERE, "kb_plan.json")))["diseases"]}
    for fn in sorted(os.listdir(EXT)):
        i = fn[:-5]
        out = os.path.join(REV, fn)
        if os.path.exists(out) and not force:
            continue
        r = json.load(open(os.path.join(EXT, fn)))
        d = plan[i]
        pages = [page_text(f, d) for f in d["text_files"]]
        keep = []
        for o in r.get("organic_bio", []):
            p = o.get("page")
            if not isinstance(p, int) or p >= len(pages):
                print(i, "DROP bad page", o); continue
            if not BIO.search(o["text"]):
                print(i, "DROP not bio", o["text"]); continue
            nums = re.findall(r"\d+(?:\.\d+)?", o["text"])
            src = norm_num(pages[p])
            miss = [n for n in nums if n not in src]
            if miss:
                print(i, "DROP numbers not in page", miss, o["text"]); continue
            keep.append(o)
        r["organic_bio"] = keep
        r["_used_pages"] = [k for k, t in enumerate(pages) if len(t.strip()) > 200]
        json.dump(r, open(out, "w"), indent=1, ensure_ascii=False)

if __name__ == "__main__":
    main()
