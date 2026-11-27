"""Build data/hazard.json: WHO hazard class for every active ingredient that
appears in data/registered_uses.json.

Source: The WHO Recommended Classification of Pesticides by Hazard and
Guidelines to Classification, 2019 edition (published 2020; the latest
edition on WHO IRIS when this was built), handle 10665/332193.
File: scripts/raw/who_2019.pdf, converted with `pdftotext -layout`.

The index at the back of the document ("INDEX. Classification of pesticide
active ingredients") lists every common name with its class and the page of
the table it sits in. That index is parsed here. Classes kept: Ia, Ib, II,
III, U. FM (fumigant, not classified) and O (obsolete) are skipped.

Run with: scripts/.venv/bin/python -I scripts/build_hazard.py
"""
import json
import os
import re
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
DATA = os.path.join(os.path.dirname(HERE), "data")
FILE = "9789240005662-eng.pdf"
URL = "https://iris.who.int/handle/10665/332193"

ENTRY = re.compile(r"([A-Za-z0-9][A-Za-z0-9\-\(\),'\. ]*?)\s{2,}(la|lb|Ia|Ib|II|III|U|FM|O)\s+(\d+(?:,\s*\d+)*)")
CLASS_FIX = {"la": "Ia", "lb": "Ib"}

# our name (registered_uses.json) -> WHO common name, where the WHO table
# lists the same active under another spelling or without the salt
ALIASES = {
    "sulfur": "sulphur",
    "ediphenphos": "edifenphos",
    "fosetyl-al": "fosetyl-aluminium",
    "mepiquat chloride": "mepiquat",
    "cartap hydrochloride": "cartap",
    "thiocyclam hydrogen oxalate": "thiocyclam",
    "copper sulfate pentahydrate": "copper sulfate",
    "propamocarb hydrochloride": "propamocarb",
    "chlorpyrifos-methyl": "chlorpyrifos methyl",
    "metalaxyl-m": "metalaxyl-m",
    "fenobucarb": "fenobucarb",
    "ethofenoprox": "etofenprox",
    "polyoxin d zinc salt": "polyoxins",
    "tau-fluvalinate": "tau-fluvalinate",
}
BT = "bacillus thuringiensis (bt)"


def load_index():
    txt_path = os.path.join(RAW, "who_2019.txt")
    if not os.path.exists(txt_path):
        subprocess.run(["pdftotext", "-layout", os.path.join(RAW, "who_2019.pdf"), txt_path], check=True)
    text = open(txt_path, encoding="utf-8").read()
    start = text.index("INDEX. CLASSIFICATION OF")
    table = {}
    for line in text[start:].split("\n"):
        for m in ENTRY.finditer(line):
            name = re.sub(r"\s+", " ", m.group(1)).strip(" ,").lower()
            if name.startswith("see ") or name in ("common name",):
                continue
            cls = CLASS_FIX.get(m.group(2), m.group(2))
            pages = [int(p) for p in re.split(r",\s*", m.group(3))]
            table.setdefault(name, (cls, pages))
    return table


def main():
    index = load_index()
    uses = json.load(open(os.path.join(DATA, "registered_uses.json")))
    actives = sorted({a for r in uses for a in r["active_ingredients"]})
    out, missing, unclassified = {}, [], []
    for a in actives:
        key = ALIASES.get(a, a)
        if a.startswith("bacillus thuringiensis"):
            key = BT
        hit = index.get(key)
        if hit is None:
            # the WHO index writes some names with a space instead of a hyphen
            hit = index.get(key.replace("-", " ")) or index.get(key.replace(" ", "-"))
        if hit is None:
            missing.append(a)
            continue
        cls, pages = hit
        if cls not in ("Ia", "Ib", "II", "III", "U"):
            unclassified.append(f"{a} ({cls})")
            continue
        out[a] = {
            "who_class": cls,
            "who_name": key,
            "source": {"file": FILE, "url": URL, "edition": "2019", "table_page": pages[0]},
        }
    json.dump(out, open(os.path.join(DATA, "hazard.json"), "w"), ensure_ascii=False, indent=1, sort_keys=True)
    stats = {"actives": len(actives), "classified": len(out), "not_in_who": len(missing),
             "fumigant_or_obsolete": unclassified, "missing": missing}
    json.dump(stats, open(os.path.join(RAW, "hazard_stats.json"), "w"), indent=1)
    from collections import Counter
    print(len(index), "WHO index entries;", len(actives), "actives;", len(out), "classified;",
          len(missing), "not in WHO;", unclassified)
    print(Counter(v["who_class"] for v in out.values()))
    print("missing:", missing)


if __name__ == "__main__":
    main()
