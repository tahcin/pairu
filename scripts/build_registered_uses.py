"""Build data/registered_uses.json from the CIB&RC "Major Uses of Pesticides"
PDFs (registered under the Insecticides Act, 1968; lists as on 30.09.2026).

Steps:
  1. scripts/fetch_sources.sh downloads the PDFs into scripts/raw/
  2. scripts/extract_tables.py caches every table row with its page number
  3. this script turns the rows into records (see docs/CONTRACT.md)

Run with: scripts/.venv/bin/python -I scripts/build_registered_uses.py

How rows are read:
  * A row whose only filled cell is the first one is a product heading
    ("Tricyclazole 75% WP"); the rows under it are its uses.
  * Crop sits in the first cell and the disease or pest in the cells to its
    left of the dose area; the dose cells (x position 200pt or more) are read
    left to right as a.i. dose, formulation dose, water and waiting period.
  * A row with no crop inherits the crop (and target) of the row above, the
    way the printed table is meant to be read.
  * A row that starts a page with no crop and no target is the rest of a row
    split across the page break, so its text is appended to that row.
  * Rows whose dose cells cannot be placed cleanly are left out and counted.

One record is written per (crop, target) pair: when the printed target cell
lists several pests ("Jassids, Whitefly"), target_raw keeps the whole cell and
target_norm holds one pest each, so the app can join on a single name.
"""
import json
import os
import re
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
TABLES = os.path.join(HERE, "raw", "tables")
DATA = os.path.join(os.path.dirname(HERE), "data")

FILES = {
    "fungicides": ("fungicide", "Fungicide MUP  as on 30.09.2026.pdf"),
    "insecticides": ("insecticide", "MUP (insecticide)  30.09.2026.pdf"),
    "bio_fungicides": ("bio-fungicide", "3. bio fungicides MUP as on 30.09.2026.pdf"),
    "bio_insecticides": ("bio-insecticide", "MUP (bio insecticide) 30.09.2026.pdf"),
}

VALUE_X = 200  # dose columns start to the right of this x position (pt)

# ---------------------------------------------------------------- crops
CROP_RULES = [
    ("paddy", r"\brice\b|\bpaddy\b"),
    ("cotton", r"\bcotton\b"),
    ("chilli", r"\bchill?ies\b|\bchill?i\b|\bchilly\b"),
    ("groundnut", r"\bground\s*nut\b|\bpeanut\b"),
    ("maize", r"\bmaize\b|\bcorn\b"),
    ("tomato", r"\btomato(es)?\b"),
    ("brinjal", r"\bbrinjal\b|\beggplant\b|\begg plant\b"),
    ("banana", r"\bbanana\b"),
    ("mango", r"\bmango(es)?\b"),
    ("blackgram", r"\bblack\s*gram\b|\burd\s*bean\b|\burdbean\b|\burd\b|\burad\b"),
    ("potato", r"(?<!sweet )\bpotato(es)?\b"),
    ("onion", r"\bonions?\b"),
]


def crop_ids(crop_raw):
    s = crop_raw.lower()
    if re.search(r"stored|godown|warehouse|bran|flour|milled|processed|seed grains", s):
        return []
    s = re.sub(r"sweet\s+potato", "", s)
    s = re.sub(r"rice\s*bean", "", s)
    return [cid for cid, pat in CROP_RULES if re.search(pat, s)]


# ---------------------------------------------------------------- actives
ACTIVE_FIXES = {
    "chlorpyriphos": "chlorpyrifos",
    "chlorpyriphos-methyl": "chlorpyrifos-methyl",
    "dimethoate": "dimethoate",
    "quinalphos": "quinalphos",
    "carbendazime": "carbendazim",
    "mancozab": "mancozeb",
    "imidachloprid": "imidacloprid",
    "thiamethoxum": "thiamethoxam",
    "lambdacyhalothrin": "lambda-cyhalothrin",
    "lambda cyhalothrin": "lambda-cyhalothrin",
    "lamda cyhalothrin": "lambda-cyhalothrin",
    "lamda-cyhalothrin": "lambda-cyhalothrin",
    "alphacypermethrin": "alpha-cypermethrin",
    "alpha cypermethrin": "alpha-cypermethrin",
    "betacyfluthrin": "beta-cyfluthrin",
    "beta cyfluthrin": "beta-cyfluthrin",
    "zeta cypermethrin": "zeta-cypermethrin",
    "emamectin benzoate": "emamectin benzoate",
    "thiophanate methyl": "thiophanate-methyl",
    "kresoxim methyl": "kresoxim-methyl",
    "metalaxyl m": "metalaxyl-m",
    "copper oxy chloride": "copper oxychloride",
    "copperoxychloride": "copper oxychloride",
    "sulphur": "sulfur",
    "wettable sulphur": "sulfur",
    "fipronill": "fipronil",
    "propiconazol": "propiconazole",
    "hexaconazol": "hexaconazole",
    "tebuconazol": "tebuconazole",
    "difenconazole": "difenoconazole",
    "azoxystrobine": "azoxystrobin",
    "ametoctradine": "ametoctradin",
    "metalaxy l": "metalaxyl",
    "thaimethoxam": "thiamethoxam",
    "pyrifluinazon": "pyrifluquinazon",
    "fosetylaluminium": "fosetyl-al",
    "fosetyl aluminium": "fosetyl-al",
    "metalaxylm": "metalaxyl-m",
    "thiophanatemethyl": "thiophanate-methyl",
    "cartap hydrofipronil ide": "cartap hydrochloride",  # printed typo on p.60
    "kitazin": "iprobenfos",  # Kitazin is the IBP (iprobenfos) trade name used in the list
    "flubendamide": "flubendiamide",
    "flumite": "flufenzine",  # label reads "Flumite 20 % SC / Flufenzine 20 % SC"
    "bacillus thuringiensis var. krustaki": "bacillus thuringiensis var. kurstaki",
    "copper sulphate": "copper sulfate",
    "copper sulphate pentahydrate": "copper sulfate pentahydrate",
    "streptomycin sulphate": "streptomycin sulfate",
    "nuclear polyhedrosis virus of helicoverpa armigera": "npv of helicoverpa armigera",
    "nuclear polyhedrosis virus of spodoptera litura": "npv of spodoptera litura",
}


def clean_active(name):
    n = name.strip().lower()
    n = re.sub(r"\s+", " ", n)
    n = n.strip(" ,;:.-*")
    n = re.sub(r"\s*\(.*$", "", n)  # drop trailing brackets (strain notes)
    n = n.strip(" ,;:.-")
    return ACTIVE_FIXES.get(n, n)


def actives_from_label(label):
    text = re.sub(r"\s+", " ", label)
    text = re.sub(r"\(Verticillium\)\s*", "", text)
    # "Neem oil based EC containing, Azadirachtin 0.030%" -> after "containing"
    m = re.search(r"containing,?\s*(.*)$", text, re.I)
    if m:
        text = m.group(1)
    out = []
    for part in re.split(r"\+", text):
        part = part.strip()
        if not part:
            continue
        # the name ends where the first concentration or bracket starts
        m = re.match(r"([A-Za-z][A-Za-z\s\-\.,']*?)\s*(?:\d|\(|\[|$)", part)
        if not m:
            continue
        name = m.group(1)
        name = re.split(r",\s*(?:serotype|strain|potency|cfu|accession)", name, flags=re.I)[0]
        # bio products: keep species name, drop "var. x" only for Bt? keep as printed
        name = clean_active(name)
        if name and name not in out and len(name) > 2:
            out.append(name)
    return out


# ---------------------------------------------------------------- text helpers
SHORT_WORDS = {"a", "of", "on", "to", "in", "or", "at", "by", "as", "is", "an", "up", "sp", "pv", "f"}


def join_lines(cell):
    if cell is None:
        return ""
    lines = [l.strip() for l in cell.split("\n") if l.strip()]
    out = ""
    for l in lines:
        if not out:
            out = l
        elif out.endswith(("-", "–", "+", "/", "(")) or l.startswith(("-", "–", "+", "/", ")")):
            out += l
        elif re.match(r"[a-z]{1,2}\b", l) and re.search(r"[a-z]$", out) \
                and l.split()[0].strip(",.)") not in SHORT_WORDS:
            out += l  # a word broken across lines, e.g. "Stemphyliu" + "m"
        else:
            out += " " + l
    return re.sub(r"\s+", " ", out).strip()


def no_dash(s):
    # house style forbids em dashes in our text; the PDFs use en dashes in
    # ranges, which are kept. Em dashes (rare) become hyphens.
    return s.replace("\u2014", "-")


TARGET_FIXES = [
    (r"\bdowney\b", "downy"),
    (r"\bmildews\b", "mildew"),
    (r"\bleafspots?\b", "leaf spot"),
    (r"\bleaf\s*spots\b", "leaf spot"),
    (r"\bleaf\s*hoppers?\b", "leafhopper"),
    (r"\bjassid\b", "jassids"),
    (r"\bwhite\s*fl(y|ies)(\s+fly)?\b", "whitefly"),
    (r"\bthrip\b", "thrips"),
    (r"\baphid\b", "aphids"),
    (r"\bmite\b", "mites"),
    (r"\bfruitrot\b", "fruit rot"),
    (r"\bdie-?\s*back\b", "dieback"),
    (r"\bbollworms\b", "bollworm"),
    (r"\bborers\b", "borer"),
    (r"\bstem\s*borer\b", "stem borer"),
    (r"\bplant\s*hoppers?\b", "plant hopper"),
    (r"\bhoppers\b", "hopper"),
    (r"\bwhite\s*back(ed)?\s*plant hopper\b", "white backed plant hopper"),
    (r"\bbakane\b", "bakanae"),
    (r"\bbight\b", "blight"),
    (r"\bb light\b", "blight"),
    (r"\bantracnose\b", "anthracnose"),
    (r"\bdiscolouration\b", "discoloration"),
    (r"\bdamping-\s*off\b", "damping off"),
    (r"\broot[-\s]knot\s+nematodes?\b", "root knot nematode"),
    (r"\bnematodes\b", "nematode"),
    (r"\bmildew\s+of\s+\w+$", "mildew"),
    (r"\bwilt\s+of\s+\w+$", "wilt"),
    (r"\bblast\s+of\s+\w+$", "blast"),
    (r"\btikka\s+leaf\s*spot\b", "tikka leaf spot"),
    (r"\bdirty\s+panicles\b", "dirty panicle"),
]
CROP_WORDS = r"(rice|paddy|tomato|chilli|chillies|mango|brinjal|cotton|groundnut|maize|potato|onion|banana)"
MODIFIERS = {"early", "late", "leaf", "neck", "panicle", "node", "collar", "root", "stem", "pod", "fruit",
             "white", "green", "black", "yellow", "red", "downy", "powdery", "brown", "sheath", "foot"}


def norm_target(t):
    s = t.lower()
    s = re.sub(r"\([^)]*\)?", " ", s)  # drop scientific names in brackets
    s = re.sub(r"\[[^\]]*\]", " ", s)
    s = s.replace("’", "'").replace('"', " ").replace(")", " ").replace("(", " ")
    s = re.sub(r"^(and|pests?|diseases?|insects?)\s*:?\s+", "", s.strip())
    s = re.sub(r"\s+", " ", s).strip(" ,;:.&-*/")
    s = re.sub(r"\s+(disease|diseases|pest|pests|complex)$", "", s)
    for pat, rep in TARGET_FIXES:
        s = re.sub(pat, rep, s)
    m = re.match(CROP_WORDS + r"\s+(.+)$", s)
    if m and len(m.group(2)) > 3:
        s = m.group(2)
    s = re.sub(r"\s+", " ", s).strip(" ,;:.&-*/")
    return s


def split_targets(raw):
    """Split a printed target cell into single pests or diseases."""
    raw = re.sub(r"(shoot|fruit)\s*(&|and)\s*(shoot|fruit)\s+borer", "shoot and fruit borer", raw, flags=re.I)
    # protect separators inside brackets
    depth, buf, parts = 0, "", []
    for ch in raw:
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth = max(0, depth - 1)
        if ch in ",;/" and depth == 0:
            parts.append(buf)
            buf = ""
        else:
            buf += ch
    parts.append(buf)
    out = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if re.search(r"shoot and fruit borer", p, re.I) and not re.search(r"(&|\band\b).*shoot and fruit|shoot and fruit borer.*(&|\band\b)", p, re.I):
            out.append(p)
            continue
        p2 = re.sub(r"shoot and fruit borer", "shoot_and_fruit_borer", p, flags=re.I)
        bits = [b for b in re.split(r"\s*&\s*|\s+and\s+", p2) if b.strip()]
        bits = [b.replace("shoot_and_fruit_borer", "shoot and fruit borer") for b in bits]
        if len(bits) > 1:
            last_words = norm_target(bits[-1]).split()
            fixed = []
            for b in bits[:-1]:
                nb = norm_target(b)
                # "early & late blight" -> "early blight", "late blight"
                if len(nb.split()) == 1 and nb in MODIFIERS and len(last_words) >= 2:
                    fixed.append(nb + " " + " ".join(last_words[1:]))
                else:
                    fixed.append(b)
            out.extend(fixed + [bits[-1]])
        else:
            out.append(p)
    res = []
    for p in out:
        n = norm_target(p)
        if re.search(r"[a-z]\d|\d[a-z]", n):
            continue  # garbled glyphs in the PDF text layer, e.g. "38igut"
        if n and n not in res and not re.fullmatch(r"[\d\s.,%-]*", n) and len(n) > 2:
            res.append(n)
    return res


def wp_int(raw):
    m = re.fullmatch(r"\s*0*(\d+)\s*(?:days?)?\s*\.?\s*", raw or "", re.I)
    return int(m.group(1)) if m else None


# ---------------------------------------------------------------- row parsing
HEADING = re.compile(
    r"^(\d+\.\s|agricultural use|approved uses|combination product|major uses|crop$|name of|common name|"
    r"insecticides|fungicides single|fungicides combination)", re.I)
STOP = re.compile(r"public health|household insecticides|locust", re.I)


def is_header_row(cells):
    for c in cells:
        if not c:
            continue
        t = re.sub(r"\s+", " ", c).strip().lower()
        if len(t) < 45 and re.match(r"(crop|name of|common name|a\.\s?i|formulat|dosage|dose|dilution|waiting|pest organism)", t):
            return True
    return False


PRODUCT_PAT = re.compile(r"\d\s*%|\d\s*g\s*/\s*l\b|\d\s*%?\s*w/[wv]", re.I)


def is_product_row(cells):
    """A product heading: one filled cell holding the label."""
    filled = [c for c in cells if c not in (None, "") and c.strip()]
    if len(filled) != 1:
        return False
    only = filled[0].strip()
    if cells[0] and cells[0].strip():
        empties = sum(1 for c in cells[1:] if c == "")
        if only.startswith("(") and not PRODUCT_PAT.search(only):
            return False
        return empties <= 1 or bool(PRODUCT_PAT.search(only))
    # label drawn in the second column of a split grid
    return bool(PRODUCT_PAT.search(only)) and len(only) > 8


def product_text(cells):
    return next(c for c in cells if c not in (None, "") and c.strip())


def split_row(row):
    """Return crop text, target text, list of value strings (left to right)."""
    cells, xs = row["cells"], row["x0"]
    crop = cells[0] if cells and cells[0] not in (None,) else None
    target_parts, values = [], []
    for c, x in list(zip(cells, xs))[1:]:
        if c is None or x is None:
            continue
        if x < VALUE_X:
            if c.strip():
                target_parts.append(c)
        else:
            values.append((x, c))
    return crop, " ".join(target_parts), values


def place_by_x(vals, xs, colx):
    """Put values into the 4 dose columns by nearest x position; None if unclear."""
    slots = [None] * 4
    for v, x in zip(vals, xs):
        if v == "":
            continue
        d = [abs(x - c) for c in colx]
        i = d.index(min(d))
        if d[i] > 25 or slots[i] is not None:
            return vals  # leave as is; counted as skipped later
        slots[i] = v
    return [v if v is not None else "" for v in slots]


def main():
    records = []
    skipped = Counter()
    skipped_examples = defaultdict(list)
    rows_read = Counter()
    fragments = Counter()
    fragment_examples = defaultdict(list)
    for key, (ptype, fname) in FILES.items():
        pages = json.load(open(os.path.join(TABLES, key + ".json")))
        product = None
        current = None  # dict for the last use row: crop, target, vals, page
        uses = []       # raw use rows before expansion
        stopped = False
        colx = None  # x positions of the 4 dose columns, from the last clean row
        for page in pages:
            if stopped:
                break
            first_data_on_page = True
            for row in page["rows"]:
                cells = row["cells"]
                if not any(c and c.strip() for c in cells):
                    continue
                first_txt = join_lines(cells[0]) if cells[0] else ""
                if is_product_row(cells):
                    first_txt = join_lines(product_text(cells))
                    if STOP.search(first_txt) and not re.search(r"\d\s*%", first_txt):
                        stopped = True
                        break
                    if HEADING.search(first_txt) and not re.search(r"\d\s*%|\d+\s*g/", first_txt):
                        continue
                    looks_like_target = not re.search(r"\d", first_txt) and re.search(
                        r"\b(rot|blight|mildew|wilt|spot|smut|rust|borer|hopper|caterpillar)\b", first_txt, re.I)
                    if not actives_from_label(first_txt) or not re.match(r"[A-Z(]", first_txt) or looks_like_target:
                        fragments[key] += 1  # stray wrapped text, not a new product
                        fragment_examples[key].append((page["page"], first_txt[:70]))
                        continue
                    product = first_txt.strip("() ") if first_txt.startswith("(") else first_txt
                    current = None
                    first_data_on_page = False
                    continue
                if is_header_row(cells):
                    continue
                if product is None:
                    continue
                crop, target, values = split_row(row)
                crop_t = join_lines(crop) if crop else ""
                target_t = join_lines(target)
                vals = [join_lines(v) for _, v in values]
                xs = [x for x, _ in values]
                if len(vals) == 5 and vals.count("") == 1:
                    i = vals.index("")
                    del vals[i], xs[i]
                placed = False
                explicit_empty = set()
                if len(vals) == 4:
                    colx = xs
                elif colx and 2 <= len(vals) <= 5 and any(vals):
                    before = list(vals)
                    vals = place_by_x(vals, xs, colx)
                    placed = len(vals) == 4 and vals != before
                    for v, x in zip(before, xs):
                        if v == "":
                            dd = [abs(x - c) for c in colx]
                            explicit_empty.add(dd.index(min(dd)))
                has_vals = any(v for v in vals)
                if not crop_t and not target_t and not has_vals:
                    continue
                rows_read[key] += 1
                # rest of a row split across a page break, or a wrapped line
                split_row_rest = first_data_on_page and (not target_t or re.match(r"[a-z(]", target_t)) \
                    and not target_t.startswith("(Apply")
                if current is not None and not crop_t and (split_row_rest or not has_vals):
                    if not has_vals and target_t.startswith("(") and len(target_t) > 60:
                        current["note"] = (current.get("note", "") + " " + target_t).strip()
                    else:
                        if target_t:
                            current["target"] = (current["target"] + " " + target_t).strip()
                        if has_vals and len(vals) == len(current["vals"]):
                            current["vals"] = [(a + " " + b).strip() for a, b in zip(current["vals"], vals)]
                        elif has_vals:
                            current["bad"] = True
                    first_data_on_page = False
                    continue
                if current is not None and crop_t.startswith("(") and not target_t and not has_vals:
                    current["crop"] += " " + crop_t
                    first_data_on_page = False
                    continue
                first_data_on_page = False
                prev = current
                # a cell drawn across two rows (water, waiting period) is
                # returned only on the first row; the second row shares it
                if placed and cells[0] is None and prev is not None and prev["product"] == product \
                        and len(prev["vals"]) == 4:
                    vals = [prev["vals"][i] if v == "" and i not in explicit_empty and i >= 2 else v
                            for i, v in enumerate(vals)]
                current = {
                    "product": product,
                    "crop": crop_t or (prev["crop"] if prev else ""),
                    "target": target_t or (prev["target"] if prev and not crop_t else ""),
                    "vals": vals,
                    "page": page["page"],
                    "file": fname,
                    "type": ptype,
                }
                uses.append(current)
        # expand uses into records
        for u in uses:
            vals = u["vals"]
            if u.get("bad"):
                skipped[key] += 1
                skipped_examples[key].append((u["page"], u["product"], u["crop"], vals))
                continue
            if len(vals) == 4:
                ai, form, water, wp = vals
            elif len(vals) == 1 and len(vals[0]) > 30:
                ai, form, water, wp = "", vals[0], "", ""
            elif len(vals) == 5 and vals[1] == "" and key == "bio_fungicides":
                ai, _, form, water, wp = vals
            else:
                skipped[key] += 1
                skipped_examples[key].append((u["page"], u["product"], u["crop"], vals))
                continue
            if not u["crop"] or not u["target"] or PRODUCT_PAT.search(u["crop"]) \
                    or re.search(r"\d\s*%\s*(w/[wv])?\s*\+|\d\s*%\s*(w/[wv]\s*)?[A-Z]{2,3}\b|g/l", u["target"]):
                skipped[key] += 1
                skipped_examples[key].append((u["page"], u["product"], u["crop"], vals))
                continue
            ids = crop_ids(u["crop"]) or [None]
            targets = split_targets(u["target"])
            if not targets:
                skipped[key] += 1
                skipped_examples[key].append((u["page"], u["product"], u["crop"], u["target"]))
                continue
            for cid in ids:
                for tn in targets:
                    rec = {
                        "crop_id": cid,
                        "crop_raw": no_dash(u["crop"]),
                        "target_raw": no_dash(u["target"]),
                        "target_norm": tn,
                        "active_ingredients": actives_from_label(u["product"]),
                        "product_label": no_dash(u["product"]),
                        "pesticide_type": u["type"],
                        "dose_ai_g_ha": no_dash(ai),
                        "dose_formulation_raw": no_dash(form),
                        "water_l_ha": no_dash(water),
                        "waiting_period_days": wp_int(wp),
                        "waiting_period_raw": no_dash(wp),
                        "source": {"file": u["file"], "page": u["page"]},
                    }
                    if u.get("note"):
                        rec["note_raw"] = no_dash(u["note"])
                    records.append(rec)

    os.makedirs(DATA, exist_ok=True)
    with open(os.path.join(DATA, "registered_uses.json"), "w") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)

    # targets by crop for the KB workstream
    tbc = defaultdict(Counter)
    for r in records:
        if r["crop_id"]:
            tbc[r["crop_id"]][r["target_norm"]] += 1
    out = {cid: [{"target_norm": t, "rows": n} for t, n in sorted(c.items())] for cid, c in sorted(tbc.items())}
    with open(os.path.join(DATA, "targets_by_crop.json"), "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    stats = {
        "rows_read": dict(rows_read),
        "skipped": dict(skipped),
        "stray_fragments_ignored": dict(fragments),
        "records": len(records),
        "records_our_crops": sum(1 for r in records if r["crop_id"]),
        "by_type": dict(Counter(r["pesticide_type"] for r in records if r["crop_id"])),
        "by_crop": dict(Counter(r["crop_id"] for r in records if r["crop_id"])),
    }
    with open(os.path.join(HERE, "raw", "registered_uses_stats.json"), "w") as f:
        json.dump({"stats": stats, "skipped_examples": skipped_examples, "fragments": fragment_examples}, f, ensure_ascii=False, indent=1)
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
