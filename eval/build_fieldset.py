#!/usr/bin/env python3
"""Build the frozen field-photo test set from PlantDoc.

PlantDoc (Singh et al. 2020, https://github.com/pratikkayal/PlantDoc-Dataset, CC BY 4.0) holds
real field and web photos of leaves, often several leaves, hands, soil and sky in one frame. We
take 4 photos per class for the classes Pairu holds, from PlantDoc's own test split, with a fixed
seed, before any model is run. Photos larger than 1024 px are resized to 1024 px on the long side
and saved as JPEG quality 85, the same as the app does on the phone (src/lib/image.ts); the SHA-256
of both the original and the file we send is recorded.

Commands: select (writes eval/fieldset.json, refuses to overwrite without --force), fetch
(re-downloads and checks hashes).
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import random
import subprocess
import sys
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_testset import http_get  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "fieldset.json"
IMAGES = HERE / "images_field"
REPO = "pratikkayal/PlantDoc-Dataset"
LICENSE = "CC BY 4.0 (PlantDoc, Singh et al. 2020, https://github.com/pratikkayal/PlantDoc-Dataset)"
SEED = 20261127
PER_CLASS = 4

# PlantDoc class folder -> (crop id, KB id). "Corn leaf blight" is northern corn leaf blight
# (Exserohilum turcicum) in the PlantDoc paper's mapping to PlantVillage.
CLASSES = [
    ("Tomato Early blight leaf", "tomato", "tomato_early_blight"),
    ("Tomato leaf late blight", "tomato", "tomato_late_blight"),
    ("Tomato Septoria leaf spot", "tomato", "tomato_septoria_leaf_spot"),
    ("Tomato leaf bacterial spot", "tomato", "tomato_bacterial_spot"),
    ("Tomato leaf yellow virus", "tomato", "tomato_leaf_curl"),
    ("Tomato leaf", "tomato", "tomato_healthy"),
    ("Potato leaf early blight", "potato", "potato_early_blight"),
    ("Potato leaf late blight", "potato", "potato_late_blight"),
    ("Corn rust leaf", "maize", "maize_common_rust"),
    ("Corn leaf blight", "maize", "maize_turcicum_blight"),
    ("Corn Gray leaf spot", "maize", "maize_grey_leaf_spot"),
]


def listing(split: str, cls: str) -> list[str]:
    out = subprocess.run(["gh", "api", f"repos/{REPO}/git/trees/master:{split}/{cls}", "--jq", ".tree[].path"],
                         check=True, capture_output=True, text=True).stdout
    return sorted(p for p in out.splitlines() if p.lower().endswith((".jpg", ".jpeg", ".png")))


def url(split: str, cls: str, name: str) -> str:
    return f"https://raw.githubusercontent.com/{REPO}/master/{urllib.parse.quote(split)}/{urllib.parse.quote(cls)}/{urllib.parse.quote(name)}"


def prepare(raw: bytes) -> bytes:
    from PIL import Image
    im = Image.open(io.BytesIO(raw))
    if im.format == "JPEG" and max(im.size) <= 1024 and len(raw) < 1_500_000:
        return raw
    im = im.convert("RGB")
    im.thumbnail((1024, 1024))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=85)
    return buf.getvalue()


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def select(force: bool):
    if OUT.exists() and not force:
        sys.exit("eval/fieldset.json exists and is frozen")
    rng = random.Random(SEED)
    IMAGES.mkdir(parents=True, exist_ok=True)
    items = []
    for cls, crop, kb in CLASSES:
        names = [("test", n) for n in listing("test", cls)]
        rng.shuffle(names)
        if len(names) < PER_CLASS:
            extra = [("train", n) for n in listing("train", cls)]
            rng.shuffle(extra)
            names += extra
        picked = 0
        for split, n in names:
            if picked == PER_CLASS:
                break
            try:
                raw = http_get(url(split, cls, n))
                data = prepare(raw)
            except Exception as e:  # unreadable file: skip it, and say so
                print(f"skip {cls}/{n}: {e}", file=sys.stderr)
                continue
            fn = f"pd_{crop}_{len(items):03d}.jpg"
            (IMAGES / fn).write_bytes(data)
            items.append(dict(file=fn, source="PlantDoc", split=split, source_url=url(split, cls, n), license=LICENSE,
                              setting="field", crop=crop, true_label=cls, kb_id=kb, in_list=True,
                              sha256_original=sha(raw), sha256=sha(data)))
            picked += 1
        print(f"{cls}: {picked}", file=sys.stderr)
    OUT.write_text(json.dumps({"version": 1, "seed": SEED, "per_class": PER_CLASS, "source": {"name": "PlantDoc", "url": f"https://github.com/{REPO}", "license": LICENSE},
                               "items": items}, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {OUT} with {len(items)} images", file=sys.stderr)


def fetch():
    m = json.loads(OUT.read_text())
    IMAGES.mkdir(parents=True, exist_ok=True)
    bad = 0
    for it in m["items"]:
        data = prepare(http_get(it["source_url"]))
        bad += sha(data) != it["sha256"]
        (IMAGES / it["file"]).write_bytes(data)
    print(f"{len(m['items'])} images, {bad} hash mismatches", file=sys.stderr)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["select", "fetch"])
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    select(a.force) if a.cmd == "select" else fetch()
