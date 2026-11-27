"""Build data/banned.json from the CIB&RC "List of pesticides which are banned,
refused registration and restricted in use" (updated on 31.10.2026).

Source page: https://ppqs.gov.in/divisions/cib-rc/registered-products
File: scripts/raw/banned.pdf (downloaded by scripts/fetch_sources.sh)

Sections I (banned, banned for use but made for export, withdrawn) and II
(refused registration) are numbered lists and are parsed from the PDF text.
Section III (restricted use) is a free-text table, so each restriction is
transcribed below by hand from pages 4 to 6, with the crops it names mapped to
our crop ids where they are ours. The parsed sections are checked against the
counts printed in the PDF so a layout change fails loudly.

Run with: scripts/.venv/bin/python -I scripts/build_banned.py
"""
import json
import os
import re

import pdfplumber

HERE = os.path.dirname(os.path.abspath(__file__))
PDF = os.path.join(HERE, "raw", "banned.pdf")
OUT = os.path.join(os.path.dirname(HERE), "data", "banned.json")
FILE = "list_of_pesticides_which_are_banned_refused_registration_and_restricted_in_use (31.10.26).pdf"
URL = ("https://ppqs.gov.in/sites/default/files/list_of_pesticides_which_are_banned_refused_registration_"
       "and_restricted_in_use%20%2831.10.26%29.pdf")

# spelling used in registered_uses.json / WHO, so the app can join on it
NAME_FIXES = {
    "dichlorovos": "dichlorvos",
    "chlorpyriphos": "chlorpyrifos",
    "chlorofenvinphos": "chlorfenvinphos",
    "benzene hexachloride": "benzene hexachloride (bhc)",
    "lindane": "lindane",
    "nicotin sulfate": "nicotine sulfate",
    "toxaphene": "toxaphene",
    "methyl parathion": "parathion-methyl",
    "ethyl parathion": "parathion",
    "thiodemeton / disulfoton": "disulfoton",
    "2,4, 5-t": "2,4,5-t",
    "aluminum phosphide": "aluminium phosphide",
}

SECTIONS = [
    # (regex that starts the section, status, note, expected count)
    (r"^Pesticides Banned for manufacture, import and use", "banned",
     "Banned for manufacture, import and use in India.", 50, "I.A"),
    (r"^Pesticide / Pesticide formulations banned for use but continued", "banned",
     "Banned for use in India; manufacture allowed only for export.", 5, "I.B"),
    (r"^Pesticides Withdrawn", "withdrawn",
     "Withdrawn under S.O. 915(E) dated 15th June 2006 until complete data is generated and accepted "
     "by the Registration Committee.", 8, "I.C"),
    (r"^II\. PESTICIDES REFUSED REGISTRATION", "banned",
     "Refused registration in India (never registered for use).", 18, "II"),
]

# Section III, transcribed from pages 4 to 6 of the PDF.
RESTRICTED = [
    ("aluminium phosphide", 4,
     "Pest control operations only by Government bodies or pest control operators under expert supervision, "
     "except Aluminium Phosphide 15% 12 g tablet and 6% tablet. Tube packs of 10 and 20 tablets of 3 g each "
     "are banned completely.", [], None),
    ("captafol", 4,
     "Use as foliar spray is banned; may be used only as a seed dresser. Captafol 80% powder for dry seed "
     "treatment is made only for export.", [], "foliar spray"),
    ("carbofuran", 4,
     "All formulations except Carbofuran 3% Encapsulated Granule (CG) are stopped from use "
     "(S.O. 4294(E) dated 3rd October 2023).", [], "all formulations except 3% CG"),
    ("chlorpyrifos", 4,
     "Banned for use in Ber, Citrus and Tobacco (S.O. 4294(E) dated 3rd October 2023).", [], None),
    ("cypermethrin", 4,
     "Cypermethrin 3% Smoke Generator only through pest control operators, not for the general public.",
     [], None),
    ("dazomet", 4, "Not permitted on Tea (S.O. 3006(E) dated 31st Dec 2008).", [], None),
    ("ddt", 5,
     "Use in agriculture is withdrawn; public health use restricted (S.O. 295(E) dated 8th March 2006, "
     "S.O. 378(E) dated 26th May 1989).", [], "agriculture"),
    ("dimethoate", 5,
     "Banned for use in fruits and vegetables that are consumed as raw food items "
     "(S.O. 4294(E) dated 3rd October 2023).", [], "fruits and vegetables eaten raw"),
    ("fenitrothion", 5,
     "Banned in agriculture except for locust control in scheduled desert area and public health "
     "(S.O. 706(E) dated 3rd May 2007).", [], "agriculture"),
    ("malathion", 5,
     "Banned for use on Sorghum, Pea, Soybean, Castor, Sunflower, Bhindi, Brinjal, Cauliflower, Radish, "
     "Turnip, Tomato, Apple, Mango and Grape (S.O. 4294(E) dated 3rd October 2023).",
     ["brinjal", "tomato", "mango"], None),
    ("mancozeb", 5,
     "Banned for use on Guava, Jowar and Tapioca (S.O. 4294(E) dated 3rd October 2023).", [], None),
    ("methyl bromide", 5,
     "Only by Government bodies or pest control operators under expert supervision.", [], None),
    ("monocrotophos", 6,
     "Banned for use on vegetables (S.O. 1482(E) dated 10th Oct 2005). Monocrotophos 36% SL is being "
     "discontinued: no new registrations, and its certificates stand cancelled after the one-year window "
     "from S.O. 4294(E) dated 3rd October 2023, with sale allowed only to clear existing stock.",
     ["chilli", "tomato", "brinjal", "potato", "onion"], "vegetables"),
    ("oxyfluorfen", 6,
     "Banned for use on Potato and Groundnut (S.O. 4294(E) dated 3rd October 2023).",
     ["potato", "groundnut"], None),
    ("quinalphos", 6,
     "Banned for use on Jute, Cardamom and Sorghum (S.O. 4294(E) dated 3rd October 2023).", [], None),
    ("trifluralin", 6,
     "All uses except in wheat prohibited from 8th August 2018; label must warn it is toxic to aquatic "
     "organisms (S.O. 3951(E) dated 8th August 2018).", [], "all crops except wheat"),
]


def clean_name(raw):
    name = re.sub(r"\(\s*(S\.O|ad-Interim|banned for).*$", "", raw, flags=re.I).strip()
    name = name.rstrip("*").strip()
    extra = None
    m = re.search(r"\(([^)]*)\)\s*$", name)
    if m and not re.search(r"S\.O", m.group(1)):
        extra = m.group(1)
    base = re.sub(r"\s*\([^)]*\)\s*$", "", name).strip().lower()
    base = NAME_FIXES.get(base, base)
    formulation = None
    m2 = re.match(r"^(.*?)\s+(\d[\d.]*\s*%.*)$", base)
    if m2:  # "captafol 80% powder": the ban is on that formulation only
        base, formulation = m2.group(1), m2.group(2)
    if base.startswith("toxaphene"):
        base = "toxaphene"
    return base, name, extra, formulation


def main():
    with pdfplumber.open(PDF) as pdf:
        pages = [(i + 1, p.extract_text() or "") for i, p in enumerate(pdf.pages)]

    entries = []
    sec = None
    current = None
    counts = {}
    for pno, text in pages:
        if pno > 3:
            break
        for line in text.split("\n"):
            line = line.strip()
            hit = next((s for s in SECTIONS if re.search(s[0], line)), None)
            if hit:
                sec, current = hit, None
                counts[hit[0]] = 0
                continue
            if sec is None or not line or re.fullmatch(r"[A-C]\.", line) or line.startswith("*") \
                    or line.startswith("S. No."):
                continue
            m = re.match(r"^(\d+)\.?\s+(.+)$", line)
            if m and int(m.group(1)) == counts[sec[0]] + 1:
                current = {"raw": m.group(2), "sec": sec, "page": pno, "num": int(m.group(1))}
                entries.append(current)
                counts[sec[0]] += 1
            elif current is not None:
                current["raw"] += " " + line

    for pat, _, _, expected, _ in SECTIONS:
        got = counts.get(pat)
        if got != expected:
            raise SystemExit(f"section {pat!r}: parsed {got} items, PDF lists {expected}")

    out, seen = [], {}
    for e in entries:
        active, printed, extra, formulation = clean_name(e["raw"])
        status, note = e["sec"][1], e["sec"][2]
        order = re.search(r"(S\.\s?O\.?\s?\d+\s?\(E\)[^)]*)", e["raw"])
        full_note = note + (f" Order: {order.group(1).strip()}." if order else "")
        if "insecticidal purpose only" in e["raw"].lower():
            full_note = "Banned for insecticidal purposes only; other uses continue under existing rules. " \
                        + (f"Order: {order.group(1).strip()}." if order else "")
        if "endosulfan" in active:
            full_note = note + " Order of the Supreme Court of India in WP (Civil) No. 213 of 2011."
        if active in seen:
            seen[active]["note"] += " Also: " + full_note
            continue
        rec = {
            "active": active,
            "status": status,
            "note": full_note,
            "printed_name": printed,
            "source": {"file": FILE, "url": URL, "page": e["page"], "section": e["sec"][4]},
        }
        if extra:
            rec["aka"] = [extra.lower()]  # a list, as types.ts expects
        if formulation:
            rec["formulation"] = formulation
        seen[active] = rec
        out.append(rec)

    for active, page, note, crops, scope in RESTRICTED:
        rec = {
            "active": active,
            "status": "restricted",
            "note": note,
            "source": {"file": FILE, "url": URL, "page": page, "section": "III"},
            "banned_on_crops": crops,
        }
        if scope:
            rec["restricted_scope"] = scope
        if active in seen:
            # e.g. captafol is both banned (80% powder) and restricted; keep both rows
            pass
        out.append(rec)

    # Orders that are not in the consolidated DPPQS list, added by hand (see data/SOURCES.md).
    for active, aka in (("streptomycin sulfate", ["streptomycin", "streptomycin sulphate", "streptocycline"]),
                        ("tetracycline hydrochloride", ["tetracycline", "tetracyclin hydrochloride"])):
        out.append({
            "active": active,
            "aka": aka,
            "status": "banned",
            "note": ("Streptomycin + Tetracycline for agriculture: draft order S.O. 5295(E) of 17.12.2021 "
                     "(Prohibition of Streptomycin + Tetracycline in agriculture Order, 2021) proposes no import, "
                     "manufacture or formulation for agricultural use from 01.02.2022 and a complete ban on use in "
                     "agriculture from 01.01.2024. We found no final notification, and the DPPQS consolidated list "
                     "of 31.10.2026 does not list it; Pairu treats it as banned as a precaution, because the "
                     "Registration Committee approved the phase-out in August 2021."),
            "source": {"file": "egazette 231955.pdf", "url": "https://egazette.nic.in/WriteReadData/2021/231955.pdf",
                       "page": 2, "section": "S.O. 5295(E), draft order, 17.12.2021"},
        })

    for r in out:
        for k in ("note",):
            r[k] = r[k].replace("\u2014", "-")
    json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1)
    from collections import Counter
    print(len(out), Counter(r["status"] for r in out))


if __name__ == "__main__":
    main()
