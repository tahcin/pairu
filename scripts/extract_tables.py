"""Extract every table row (with page numbers and cell x positions) from the
CIB&RC Major Uses of Pesticides PDFs into scripts/raw/tables/<name>.json.

Run with: scripts/.venv/bin/python -I scripts/extract_tables.py
pdfplumber is slow on these files, so pages are processed in parallel and the
output is cached; build_registered_uses.py reads the cache.
"""
import json
import os
import sys
from multiprocessing import Pool

import pdfplumber

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
OUT = os.path.join(RAW, "tables")
FILES = ["fungicides", "insecticides", "bio_fungicides", "bio_insecticides", "herbicides"]


def page_rows(args):
    name, pno = args
    with pdfplumber.open(os.path.join(RAW, name + ".pdf")) as pdf:
        page = pdf.pages[pno - 1]
        text = page.extract_text() or ""
        rows = []
        for table in page.find_tables():
            data = table.extract()
            for r_obj, r_txt in zip(table.rows, data):
                xs = [c[0] if c else None for c in r_obj.cells]
                rows.append({"cells": r_txt, "x0": xs, "top": r_obj.bbox[1]})
        return {"page": pno, "text": text, "rows": rows}


def main():
    os.makedirs(OUT, exist_ok=True)
    names = sys.argv[1:] or FILES
    for name in names:
        dest = os.path.join(OUT, name + ".json")
        if os.path.exists(dest):
            print("cached", dest)
            continue
        with pdfplumber.open(os.path.join(RAW, name + ".pdf")) as pdf:
            n = len(pdf.pages)
        with Pool(8) as pool:
            pages = pool.map(page_rows, [(name, i) for i in range(1, n + 1)])
        json.dump(pages, open(dest, "w"), ensure_ascii=False)
        print(name, n, "pages,", sum(len(p["rows"]) for p in pages), "rows")


if __name__ == "__main__":
    main()
