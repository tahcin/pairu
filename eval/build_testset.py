#!/usr/bin/env python3
"""Build the frozen Pairu accuracy test set.

Two public, openly licensed sources:

* PlantVillage (Mohanty et al. 2016), CC BY-SA 3.0, lab photos of single leaves on a plain
  background: tomato, potato and maize (corn) classes, healthy included. Files are listed with
  the GitHub API (`gh api`) and downloaded from raw.githubusercontent.com.
* Rice Leaf Disease Image Samples (Sethy et al. 2020, Mendeley Data fwcj7stb8r), CC BY 4.0,
  field photos of paddy leaves: bacterial blight, blast, brown spot and tungro. The archive is
  public and downloads without a login; we check its SHA-256 against the value Mendeley lists.

Commands
  select  pick the images with a fixed seed, download them to eval/images/ and write
          eval/testset.json. Refuses to overwrite an existing testset.json unless --force.
  map     fill kb_id / in_list in testset.json from data/kb.json (only the label mapping
          changes, never which images are in the set).
  fetch   re-download every image listed in testset.json and verify its SHA-256.

Everything is deterministic: listings are sorted before sampling with SEED.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
APP = HERE.parent
IMAGES = HERE / "images"
RAW = HERE / "raw"
TESTSET = HERE / "testset.json"
KB = APP / "data" / "kb.json"

SEED = 20261127
PER_CLASS_IN = 5    # classes we expect the KB to hold
PER_CLASS_OUT = 3   # classes we expect to fall outside the KB (tests the refusal path)

PV_REPO = "spMohanty/PlantVillage-Dataset"
PV_LICENSE = "CC BY-SA 3.0 (PlantVillage, Mohanty et al. 2016; https://huggingface.co/datasets/mohanty/PlantVillage)"
RICE_URL = "https://data.mendeley.com/public-files/datasets/fwcj7stb8r/files/fd8717c4-0d65-4c80-a76c-3b61cb68e80d/file_downloaded"
RICE_PAGE = "https://data.mendeley.com/datasets/fwcj7stb8r"
RICE_SHA256 = "b2d5fbef5a8ef6adefa04a83be7ee5150091f412d40162ecdf9fd2b1b5e24aaf"
RICE_LICENSE = "CC BY 4.0 (Sethy et al. 2020, Rice Leaf Disease Image Samples, Mendeley Data, doi 10.17632/fwcj7stb8r)"
RICE_ROOT = "Rice Leaf Disease Images"

# (source, class folder as printed by the dataset, crop id, intended KB disease id, expected in KB)
# The intended id is only a proposal; `map` keeps it only if data/kb.json really holds it.
CLASSES = [
    ("plantvillage", "Tomato___Bacterial_spot", "tomato", "tomato_bacterial_spot", True),
    ("plantvillage", "Tomato___Early_blight", "tomato", "tomato_early_blight", True),
    ("plantvillage", "Tomato___Late_blight", "tomato", "tomato_late_blight", True),
    ("plantvillage", "Tomato___Septoria_leaf_spot", "tomato", "tomato_septoria_leaf_spot", True),
    ("plantvillage", "Tomato___Tomato_Yellow_Leaf_Curl_Virus", "tomato", "tomato_leaf_curl", True),
    ("plantvillage", "Tomato___healthy", "tomato", "tomato_healthy", True),
    ("plantvillage", "Tomato___Leaf_Mold", "tomato", "tomato_leaf_mold", False),
    ("plantvillage", "Tomato___Spider_mites Two-spotted_spider_mite", "tomato", "tomato_spider_mite", False),
    ("plantvillage", "Tomato___Target_Spot", "tomato", "tomato_target_spot", False),
    ("plantvillage", "Tomato___Tomato_mosaic_virus", "tomato", "tomato_mosaic_virus", False),
    ("plantvillage", "Potato___Early_blight", "potato", "potato_early_blight", True),
    ("plantvillage", "Potato___Late_blight", "potato", "potato_late_blight", True),
    ("plantvillage", "Potato___healthy", "potato", "potato_healthy", True),
    ("plantvillage", "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot", "maize", "maize_grey_leaf_spot", True),
    ("plantvillage", "Corn_(maize)___Common_rust_", "maize", "maize_common_rust", True),
    ("plantvillage", "Corn_(maize)___Northern_Leaf_Blight", "maize", "maize_turcicum_blight", True),
    ("plantvillage", "Corn_(maize)___healthy", "maize", "maize_healthy", True),
    ("sethy_rice", "Bacterialblight", "paddy", "paddy_blb", True),
    ("sethy_rice", "Blast", "paddy", "paddy_blast", True),
    ("sethy_rice", "Brownspot", "paddy", "paddy_brown_spot", True),
    ("sethy_rice", "Tungro", "paddy", "paddy_tungro", False),
]


def ssl_ctx():
    import ssl
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "pairu-eval/1.0"})
    with urllib.request.urlopen(req, context=ssl_ctx(), timeout=120) as r:
        return r.read()


def sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def pv_list(cls: str) -> list[str]:
    out = subprocess.run(
        ["gh", "api", f"repos/{PV_REPO}/git/trees/master:raw/color/{cls}", "--jq", ".tree[].path"],
        check=True, capture_output=True, text=True,
    ).stdout
    return sorted(p for p in out.splitlines() if p.strip())


def pv_url(cls: str, name: str) -> str:
    return f"https://raw.githubusercontent.com/{PV_REPO}/master/raw/color/{urllib.parse.quote(cls)}/{urllib.parse.quote(name)}"


_LEAF_MAP: dict | None = None


def pv_leaf_key(cls: str, name: str) -> str:
    """Several PlantVillage photos show the same physical leaf. The dataset's own
    leaf_grouping/leaf-map.json maps a file stem to "<class>:::<leaf number>"; we keep one photo
    per leaf. Classes it does not cover (maize, tomato mosaic) fall back to buckets of ten
    consecutive photo numbers, so two picks are never neighbouring shots."""
    global _LEAF_MAP
    if _LEAF_MAP is None:
        RAW.mkdir(parents=True, exist_ok=True)
        lm = RAW / "leaf-map.json"
        if not lm.exists():
            lm.write_bytes(http_get(f"https://raw.githubusercontent.com/{PV_REPO}/master/leaf_grouping/leaf-map.json"))
        _LEAF_MAP = json.loads(lm.read_text())
    stem = re.sub(r"\.[A-Za-z]+$", "", name.split("___", 1)[-1]).strip().lower()
    for v in _LEAF_MAP.get(stem, []):
        if v.split(":::")[0] == cls:
            return v
    m = re.match(r"(.*?)(\d+)\D*$", stem)
    return f"{m.group(1)}#{int(m.group(2)) // 10}" if m else stem


def rice_archive() -> Path:
    RAW.mkdir(parents=True, exist_ok=True)
    arc = RAW / "rice.7z"
    if not arc.exists() or hashlib.sha256(arc.read_bytes()).hexdigest() != RICE_SHA256:
        print("downloading rice archive (179 MB)...", file=sys.stderr)
        arc.write_bytes(http_get(RICE_URL))
    if hashlib.sha256(arc.read_bytes()).hexdigest() != RICE_SHA256:
        sys.exit("rice archive SHA-256 does not match the value Mendeley lists")
    dest = RAW / "rice"
    if not (dest / RICE_ROOT).exists():
        dest.mkdir(exist_ok=True)
        subprocess.run(["bsdtar", "-xf", str(arc), "-C", str(dest)], check=True)
    return dest / RICE_ROOT


def ahash_variants(path: Path) -> list[int]:
    # Sethy's set holds flipped and rotated copies of the same photo; compare against those too.
    from PIL import Image
    im = Image.open(path).convert("L")
    out = []
    for t in (None, Image.Transpose.FLIP_LEFT_RIGHT, Image.Transpose.FLIP_TOP_BOTTOM, Image.Transpose.ROTATE_90,
              Image.Transpose.ROTATE_180, Image.Transpose.ROTATE_270):
        j = im if t is None else im.transpose(t)
        px = list(j.resize((8, 8)).getdata())
        avg = sum(px) / 64
        out.append(sum(1 << i for i, p in enumerate(px) if p > avg))
    return out


def near_dup(h: list[int], kept: list[list[int]], thr: int = 10) -> bool:
    return any(bin(a ^ b[0]).count("1") <= thr for a in h for b in kept)


def select(force: bool) -> None:
    if TESTSET.exists() and not force:
        sys.exit("eval/testset.json exists and is frozen; pass --force only if you mean to rebuild it")
    rng = random.Random(SEED)
    IMAGES.mkdir(parents=True, exist_ok=True)
    rice_dir = None
    items = []
    for source, cls, crop, kb_guess, expect_in in CLASSES:
        n = PER_CLASS_IN if expect_in else PER_CLASS_OUT
        if source == "plantvillage":
            names = pv_list(cls)
            # one photo per physical leaf
            by_leaf: dict[str, list[str]] = {}
            for nm in names:
                by_leaf.setdefault(pv_leaf_key(cls, nm), []).append(nm)
            leaves = sorted(by_leaf)
            rng.shuffle(leaves)
            picks = [sorted(by_leaf[k])[0] for k in leaves[:n]]
            for nm in picks:
                url = pv_url(cls, nm)
                data = http_get(url)
                fn = f"pv_{crop}_{len(items):03d}.jpg"
                (IMAGES / fn).write_bytes(data)
                items.append(dict(file=fn, source="PlantVillage", source_url=url, license=PV_LICENSE,
                                  setting="lab", crop=crop, true_label=cls, dataset_file=nm,
                                  sha256=sha256(data), kb_guess=kb_guess))
        else:
            if rice_dir is None:
                rice_dir = rice_archive()
            names = sorted(os.listdir(rice_dir / cls))
            # spread picks across the photo groups (BLAST1, BLAST2, ...) and drop near-duplicates
            groups: dict[str, list[str]] = {}
            for nm in names:
                groups.setdefault(re.sub(r"_?\d+\.[A-Za-z]+$", "", nm), []).append(nm)
            order = sorted(groups)
            rng.shuffle(order)
            for g in order:
                rng.shuffle(groups[g])
            kept_hash: list[list[int]] = []
            picks = []
            gi = 0
            while len(picks) < n and any(groups[g] for g in order):
                g = order[gi % len(order)]
                gi += 1
                while groups[g]:
                    nm = groups[g].pop()
                    h = ahash_variants(rice_dir / cls / nm)
                    if near_dup(h, kept_hash):
                        continue
                    kept_hash.append([h[0]])
                    picks.append(nm)
                    break
            for nm in picks:
                data = (rice_dir / cls / nm).read_bytes()
                fn = f"rice_{crop}_{len(items):03d}.jpg"
                (IMAGES / fn).write_bytes(data)
                items.append(dict(file=fn, source="Sethy et al. rice leaf disease (Mendeley Data)",
                                  source_url=f"{RICE_PAGE} (archive 'Rice Leaf Disease Images.7z', file '{RICE_ROOT}/{cls}/{nm}')",
                                  license=RICE_LICENSE, setting="field", crop=crop, true_label=cls,
                                  dataset_file=f"{RICE_ROOT}/{cls}/{nm}", sha256=sha256(data), kb_guess=kb_guess))
        print(f"{cls}: {n}", file=sys.stderr)
    manifest = {
        "version": 1,
        "seed": SEED,
        "per_class": {"expected_in_kb": PER_CLASS_IN, "expected_out_of_kb": PER_CLASS_OUT},
        "sources": [
            {"name": "PlantVillage", "url": f"https://github.com/{PV_REPO}", "license": PV_LICENSE, "setting": "lab, single leaf on plain background"},
            {"name": "Rice Leaf Disease Image Samples", "url": RICE_PAGE, "license": RICE_LICENSE, "archive_sha256": RICE_SHA256, "setting": "field photos, 300 x 300 px"},
        ],
        "kb_mapped_from": None,
        "items": items,
    }
    TESTSET.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {TESTSET} with {len(items)} images", file=sys.stderr)


def map_kb() -> None:
    m = json.loads(TESTSET.read_text())
    kb = json.loads(KB.read_text())
    if kb.get("_fixture"):
        sys.exit("data/kb.json is a fixture; wait for the real KB")
    ids = {d["id"] for d in kb["diseases"]} | {f"{c['id']}_healthy" for c in kb["crops"]}
    for it in m["items"]:
        guess = it["kb_guess"]
        it["kb_id"] = guess if guess in ids else None
        it["in_list"] = it["kb_id"] is not None
    m["kb_mapped_from"] = {"file": "data/kb.json", "sha256": sha256(KB.read_bytes()), "n_diseases": len(kb["diseases"])}
    TESTSET.write_text(json.dumps(m, indent=1, ensure_ascii=False) + "\n")
    out = sorted({(it["true_label"], it["kb_id"] or "out-of-list") for it in m["items"]})
    for lab, kid in out:
        print(f"{lab:55s} -> {kid}")


def fetch() -> None:
    m = json.loads(TESTSET.read_text())
    IMAGES.mkdir(parents=True, exist_ok=True)
    rice_dir = None
    bad = 0
    for it in m["items"]:
        p = IMAGES / it["file"]
        if p.exists() and sha256(p.read_bytes()) == it["sha256"]:
            continue
        if it["source"] == "PlantVillage":
            data = http_get(it["source_url"])
        else:
            rice_dir = rice_dir or rice_archive()
            data = (rice_dir.parent / it["dataset_file"]).read_bytes()
        if sha256(data) != it["sha256"]:
            print(f"hash mismatch: {it['file']}", file=sys.stderr)
            bad += 1
        p.write_bytes(data)
    print(f"{len(m['items'])} images checked, {bad} mismatched", file=sys.stderr)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["select", "map", "fetch"])
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    {"select": lambda: select(a.force), "map": map_kb, "fetch": fetch}[a.cmd]()
