#!/usr/bin/env python3
"""Score the live-model-order run (gemini-3.5-flash-lite only) and add it to eval/results.json
as "live_model_order_3_5_flash_lite_first", next to the earlier numbers, which are not changed.

Usage: python3 -I eval/score_live35.py eval/runs/live35-<ts>.jsonl
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def pct(a, b):
    return round(100 * a / b, 1) if b else None


def block(rows, system):
    n = len(rows)
    right = sum(r["final"] == r["true_id"] for r in rows)
    wrong = sum(r["status"] == "decided" and r["final"] != r["true_id"] for r in rows)
    return {"system": system, "n": n, "right": right, "right_pct": pct(right, n), "answered_and_wrong": wrong,
            "answered_and_wrong_pct": pct(wrong, n), "refused": n - right - wrong, "refused_pct": pct(n - right - wrong, n),
            "farmer_had_to_answer": sum(bool(r.get("asked")) for r in rows)}


def main(run_file: Path):
    recs = [json.loads(l) for l in run_file.read_text().splitlines()]
    rows = [r for r in recs if r.get("kind") == "pairu_v2_live35" and r.get("http") == 200 and "status" in r]
    end = next((r for r in recs if r.get("kind") == "end"), {})
    inl = [r for r in rows if r["in_list"]]
    sick = [r for r in inl if not r["true_id"].endswith("_healthy")]
    out = [r for r in rows if not r["in_list"]]
    res = json.loads((HERE / "results.json").read_text())
    ref = {t["system"]: t for t in res["v2"]["held_out_half_in_list"]}
    v2_31 = next(v for k, v in ref.items() if k.startswith("Pairu v2"))
    bare = next(v for k, v in ref.items() if k.startswith("Bare"))
    stage = {"first_look_alone": sum(r["body"].get("stage") == 1 and r["status"] == "decided" and not r.get("asked") for r in inl),
             "second_look": sum(r["body"].get("stage") == 2 for r in inl),
             "verified": sum(bool(r["body"].get("verified")) for r in inl)}
    blk = {
        "summary": None,
        "held_out_half_in_list": [
            block(inl, "Pairu v2, live order (gemini-3.5-flash-lite for both looks)"),
            {**{k: v2_31[k] for k in v2_31}, "system": "Pairu v2, earlier run (first look mostly gemini-3.1-flash-lite, second look gemini-3.5-flash-lite)"},
            {**{k: bare[k] for k in bare}, "system": "Bare model, open question (gemini-3.1-flash-lite)"},
        ],
        "held_out_half_diseased_only": [block(sick, "Pairu v2, live order")],
        "out_of_list": {"n": len(out), "refused": sum(r["status"] != "decided" for r in out), "named_a_wrong_disease": sum(r["status"] == "decided" for r in out),
                        "note": "Pairu does not hold these diseases, so refusing is the right answer." if out else "not run: the call budget ran out first"},
        "steps": stage,
        "method": {
            "what": "Current code and knowledge base (commit 53dffdf, 90 entries, cashew added) through the local server, with the model list cut to gemini-3.5-flash-lite only for both looks: no fallback to 3.1, Gemma or Claude. Held-out odd half of the in-list set, then out-of-list images while the budget lasted. Farmer questions answered from the true label (best case).",
            "gemini_calls": end.get("gemini_calls"),
            "stopped": end.get("stopped"),
            "run_file": run_file.name,
            "comparison_note": "The earlier rows are copied from the v2 block for comparison and were not re-run; they used a different first-look model.",
        },
    }
    a = blk["held_out_half_in_list"][0]
    blk["summary"] = (f"With the live model order (gemini-3.5-flash-lite for both looks), on {a['n']} held-out photos of diseases Pairu holds, "
                      f"Pairu was right on {a['right']} ({a['right_pct']}%), answered wrongly on {a['answered_and_wrong']} ({a['answered_and_wrong_pct']}%) "
                      f"and said it was not sure on {a['refused']}; the farmer was asked on {a['farmer_had_to_answer']}.")
    res["live_model_order_3_5_flash_lite_first"] = blk
    keys = ["live_model_order_3_5_flash_lite_first", "v2", "lab_vs_field", "cnn"]
    res = {**{k: res[k] for k in keys if k in res}, **{k: v for k, v in res.items() if k not in keys}}
    (HERE / "results.json").write_text(json.dumps(res, indent=1, ensure_ascii=False) + "\n")
    print(blk["summary"])
    for t in blk["held_out_half_in_list"] + blk["held_out_half_diseased_only"]:
        print(t)
    print(blk["out_of_list"], blk["steps"], blk["method"]["gemini_calls"], blk["method"]["stopped"])


if __name__ == "__main__":
    main(Path(sys.argv[1]))
