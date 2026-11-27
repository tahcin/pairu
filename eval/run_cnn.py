#!/usr/bin/env python3
"""A PlantVillage CNN baseline, run locally on CPU, on both frozen sets. No model API calls.

Model: neghani/plantvillage-mobilenetv2 at tag v1.0 (commit 3841549), Apache-2.0, a MobileNetV2
fine-tuned on PlantVillage colour images only (38 classes); later tags also train on PlantDoc, so
they are not used here, because PlantDoc is our field test. The weights are downloaded to
eval/models/ (gitignored) together with the model's splits.json, which lists the exact files it
was trained on, so we can say which of our lab photos it saw in training.

Scoring rules, written before the run:
  * The farmer picks the crop in Pairu, so the CNN gets the same help: its 38 scores are limited to
    the true crop's classes and renormalised. Its strict, unrestricted top-1 is logged as well.
  * The model card recommends treating a top probability under 0.5 as "not sure"; we do the same,
    and count it as a refusal.
  * Rice is not in PlantVillage, so the CNN cannot answer for paddy photos; they are reported
    as "no class", not scored.

Usage: eval/.venv/bin/python -I eval/run_cnn.py   (writes eval/runs/cnn-<timestamp>.jsonl)
"""
from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from build_testset import CLASSES as PV_CLASSES  # noqa: E402

MODEL_DIR = HERE / "models" / "plantvillage-mobilenetv2-v1.0"
MODEL_ID = "neghani/plantvillage-mobilenetv2@v1.0 (3841549854f08c2a944f6baa44cdd8b3d62d469d)"
ABSTAIN_BELOW = 0.5
CROP_PREFIX = {"tomato": "Tomato___", "potato": "Potato___", "maize": "Corn_(maize)___"}

# PlantVillage label -> our id (KB id, or the out-of-list id used in testset.json)
PV_TO_ID = {cls: kb for src, cls, crop, kb, _ in PV_CLASSES if src == "plantvillage"}


def main():
    import torch
    from PIL import Image
    from transformers import AutoImageProcessor, AutoModelForImageClassification

    proc = AutoImageProcessor.from_pretrained(MODEL_DIR)
    model = AutoModelForImageClassification.from_pretrained(MODEL_DIR).eval()
    labels = [model.config.id2label[i] for i in range(model.config.num_labels)]
    splits = json.loads((MODEL_DIR / "splits.json").read_text())["splits"]
    seen = {}
    for split, rows in splits.items():
        for path, _ in rows:
            seen[path] = split

    out = HERE / "runs" / f"cnn-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}.jsonl"
    with out.open("w") as f:
        f.write(json.dumps({"kind": "meta", "model": MODEL_ID, "abstain_below": ABSTAIN_BELOW, "device": "cpu",
                            "torch": torch.__version__}) + "\n")
        for set_name, manifest, img_dir in (("lab_and_rice", "testset.json", "images"), ("field", "fieldset.json", "images_field")):
            items = json.loads((HERE / manifest).read_text())["items"]
            for it in items:
                true_id = it.get("kb_id") or it.get("kb_guess")
                rec = {"kind": "cnn", "set": set_name, "file": it["file"], "crop": it["crop"], "true_id": true_id,
                       "in_list": it.get("in_list", True)}
                if it["crop"] not in CROP_PREFIX:
                    rec.update(status="no_class", final=None)
                    f.write(json.dumps(rec) + "\n")
                    continue
                im = Image.open(HERE / img_dir / it["file"]).convert("RGB")
                with torch.no_grad():
                    p = torch.softmax(model(**proc(images=im, return_tensors="pt")).logits[0], -1).tolist()
                top = sorted(range(len(p)), key=lambda i: -p[i])[:3]
                rec["strict_top3"] = [(labels[i], round(p[i], 4)) for i in top]
                rec["strict_id"] = PV_TO_ID.get(labels[top[0]], "other_crop:" + labels[top[0]])
                idx = [i for i, lab in enumerate(labels) if lab.startswith(CROP_PREFIX[it["crop"]])]
                tot = sum(p[i] for i in idx)
                best = max(idx, key=lambda i: p[i])
                prob = p[best] / tot if tot else 0.0
                rec["crop_top"] = (labels[best], round(prob, 4))
                if prob < ABSTAIN_BELOW:
                    rec.update(status="unsure", final=None)
                else:
                    rec.update(status="decided", final=PV_TO_ID.get(labels[best]))
                if it.get("source") == "PlantVillage":
                    rec["cnn_training_split"] = seen.get(f"{it['true_label']}/{it['dataset_file']}", "not_listed")
                f.write(json.dumps(rec) + "\n")
    print(out)


if __name__ == "__main__":
    main()
