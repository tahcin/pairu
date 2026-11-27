#!/usr/bin/env python3
"""Lab vs field: Pairu v2, the PlantVillage CNN and the bare model, added to eval/results.json.

Usage: python3 -I eval/score_field.py eval/runs/cnn-<ts>.jsonl eval/runs/field-<ts>.jsonl
(run after eval/score.py and eval/score_v2.py; keeps everything they wrote)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def pct(a, b):
    return round(100 * a / b, 1) if b else None


def row(where, system, n, right, wrong, note=""):
    if n is None:
        return {"photos": where, "system": system, "n": "-", "right": "-", "answered_and_wrong": "-", "refused": "-", "note": note}
    return {"photos": where, "system": system, "n": n, "right": f"{right} ({pct(right, n)}%)",
            "answered_and_wrong": f"{wrong} ({pct(wrong, n)}%)", "refused": n - right - wrong, "note": note}


def main(cnn_file: Path, field_file: Path):
    res = json.loads((HERE / "results.json").read_text())
    ts = {it["file"]: it for it in json.loads((HERE / "testset.json").read_text())["items"]}
    v2rows = {r["file"]: r for r in res["v2"]["rows"]}
    cnn = [json.loads(l) for l in cnn_file.read_text().splitlines()]
    cnn_meta = cnn[0]
    cnn = {(r["set"], r["file"]): r for r in cnn[1:]}
    field = [json.loads(l) for l in field_file.read_text().splitlines()]
    pairu_field = {r["file"]: r for r in field if r.get("kind") == "pairu_v2" and r.get("http") == 200}
    field_calls = sum(r.get("calls", 0) for r in field if r.get("kind") in ("pairu_v2", "error"))
    field_items = json.loads((HERE / "fieldset.json").read_text())["items"]

    lab = [f for f, r in v2rows.items() if r["in_list"] and ts[f]["setting"] == "lab"]
    rice = [f for f, r in v2rows.items() if r["in_list"] and ts[f]["setting"] == "field"]

    def v2(files):
        return len(files), sum(v2rows[f]["v2_final"] == v2rows[f]["true_id"] for f in files), \
            sum(v2rows[f]["v2_status"] == "decided" and v2rows[f]["v2_final"] != v2rows[f]["true_id"] for f in files)

    def bare(files):
        return len(files), sum(v2rows[f]["b_id"] == v2rows[f]["true_id"] for f in files), \
            sum(v2rows[f]["b_id"] not in ("refused", None) and v2rows[f]["b_id"] != v2rows[f]["true_id"] for f in files)

    def cnn_score(set_name, files, key="final"):
        rs = [cnn[(set_name, f)] for f in files]
        return len(rs), sum(r["status"] == "decided" and r[key] == r["true_id"] for r in rs), \
            sum(r["status"] == "decided" and r[key] != r["true_id"] for r in rs)

    pd_files = [it["file"] for it in field_items if it["file"] in pairu_field]
    pd_n = len(pd_files)
    pd_right = sum(pairu_field[f]["final"] == pairu_field[f]["true_id"] for f in pd_files)
    pd_wrong = sum(pairu_field[f]["status"] == "decided" and pairu_field[f]["final"] != pairu_field[f]["true_id"] for f in pd_files)
    pd_asked = sum(bool(pairu_field[f].get("asked")) for f in pd_files)
    cnn_pd = cnn_score("field", [it["file"] for it in field_items])
    cnn_pd_on_pairu_subset = cnn_score("field", pd_files)

    table = [
        row("Lab: PlantVillage, tomato, potato, maize", "Pairu v2", *v2(lab)),
        row("Lab: PlantVillage, tomato, potato, maize", "PlantVillage CNN", *cnn_score("lab_and_rice", lab),
            "the CNN was trained on most of these exact photos (see cnn.lab_photos_in_cnn_training)"),
        row("Lab: PlantVillage, tomato, potato, maize", "Bare model", *bare(lab)),
        row("Field: rice, Sethy et al.", "Pairu v2", *v2(rice)),
        row("Field: rice, Sethy et al.", "PlantVillage CNN", None, None, None, "no rice classes in PlantVillage, so it cannot answer"),
        row("Field: rice, Sethy et al.", "Bare model", *bare(rice)),
        row("Field: PlantDoc, tomato, potato, maize", "Pairu v2", pd_n, pd_right, pd_wrong,
            f"farmer asked on {pd_asked}" + ("" if pd_n == len(field_items) else f"; {len(field_items) - pd_n} photos not run")),
        row("Field: PlantDoc, tomato, potato, maize", "PlantVillage CNN", *cnn_pd),
        row("Field: PlantDoc, tomato, potato, maize", "Bare model", None, None, None, "not run, to stay within the Gemini budget"),
    ]

    split_counts = {}
    lab_rows = [cnn[("lab_and_rice", f)] for f in lab]
    for r in lab_rows:
        k = r.get("cnn_training_split", "not_listed")
        d = split_counts.setdefault(k, {"n": 0, "right": 0})
        d["n"] += 1
        d["right"] += r["final"] == r["true_id"]
    out_lab = [r for (s, f), r in cnn.items() if s == "lab_and_rice" and not r["in_list"] and r["status"] != "no_class"]
    strict_pd = sum(r["strict_id"] == r["true_id"] for (s, f), r in cnn.items() if s == "field")

    res["lab_vs_field"] = {
        "summary": (
            f"On lab photos the PlantVillage CNN was right on {cnn_score('lab_and_rice', lab)[1]} of {len(lab)}, but it had been trained on most of those exact photos. "
            f"On {len(field_items)} PlantDoc field photos it was right on {cnn_pd[1]} and wrong on {cnn_pd[2]}; Pairu v2 was right on {pd_right} of {pd_n} and wrong on {pd_wrong}. "
            "The CNN has no rice classes at all."
        ),
        "table": table,
        "method": {
            "field_set": "eval/fieldset.json: 44 PlantDoc photos (Singh et al. 2020, CC BY 4.0), 4 for each of 11 classes Pairu holds, from PlantDoc's test split, seed 20261127, frozen before any model run. PlantDoc photos are real field and web photos, and some of its labels are known to be noisy.",
            "pairu_v2": f"The same code as the live app through the local server, Gemini only (first look gemini-3.1-flash-lite, second look gemini-3.5-flash-lite, each with the other as fallback), {field_calls} Gemini calls. Questions left for the farmer were answered from the true label (best case).",
            "cnn": f"{cnn_meta['model']}, Apache-2.0, MobileNetV2 fine-tuned on PlantVillage only, run on CPU. Its scores were limited to the true crop's classes (the farmer picks the crop in Pairu too) and it says not sure below 0.5, as its model card recommends.",
            "bare_model": "gemini-3.1-flash-lite with an open question, from the v1 run; not run on PlantDoc.",
        },
    }
    res["cnn"] = {
        "model": cnn_meta["model"],
        "lab_photos_in_cnn_training": {k: v for k, v in sorted(split_counts.items())},
        "lab_out_of_list_named_true_disease": f"{sum(r['final'] == r['true_id'] for r in out_lab)} of {len(out_lab)} (PlantVillage has these classes; Pairu's list does not)",
        "plantdoc_without_crop_hint_right": f"{strict_pd} of {len(field_items)}",
        "plantdoc_same_photos_pairu_ran": {"n": cnn_pd_on_pairu_subset[0], "right": cnn_pd_on_pairu_subset[1], "wrong": cnn_pd_on_pairu_subset[2]},
        "run_file": cnn_file.name,
    }
    res["pairu_v2_plantdoc_rows"] = [{"file": f, "true_id": pairu_field[f]["true_id"], "status": pairu_field[f]["status"], "final": pairu_field[f]["final"],
                                      "stage": pairu_field[f]["body"].get("stage"), "asked": bool(pairu_field[f].get("asked")),
                                      "cnn": cnn[("field", f)]["final"]} for f in pd_files]
    res["field_run_file"] = field_file.name
    keys = ["v2", "lab_vs_field", "cnn"]
    res = {**{k: res[k] for k in keys}, **{k: v for k, v in res.items() if k not in keys}}
    (HERE / "results.json").write_text(json.dumps(res, indent=1, ensure_ascii=False) + "\n")
    print(res["lab_vs_field"]["summary"])
    for t in table:
        print(t)
    print(json.dumps(res["cnn"], indent=1))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
