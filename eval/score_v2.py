#!/usr/bin/env python3
"""Score diagnosis v2 next to v1 and the bare model, and add it to eval/results.json.

The 0.9 threshold was chosen by looking at v1's first-look confidences on the "even" half of the
test set (md5 of the file name, last bit 0). The "odd" half was not used to choose anything, so it
is the fair held-out number; all 95 images are reported too.

Usage: python3 -I eval/score_v2.py eval/runs/v2-<timestamp>.jsonl
(run eval/score.py on the v1 run file first; this keeps everything it wrote)
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def half(f: str) -> str:
    return "odd" if int(hashlib.md5(f.encode()).hexdigest(), 16) % 2 else "even"


def pct(a, b):
    return round(100 * a / b, 1) if b else None


def block(rows, system, right, answered, asked=None):
    n = len(rows)
    r = sum(1 for x in rows if answered(x) and right(x))
    a = sum(1 for x in rows if answered(x))
    out = {"system": system, "n": n, "right": r, "right_pct": pct(r, n), "answered_and_wrong": a - r,
           "answered_and_wrong_pct": pct(a - r, n), "refused": n - a, "refused_pct": pct(n - a, n)}
    out["farmer_had_to_answer"] = sum(1 for x in rows if asked(x)) if asked else "-"
    return out


def main(v2_file: Path):
    res = json.loads((HERE / "results.json").read_text())
    v1 = {r["file"]: r for r in res["rows"]}
    v2 = {}
    calls = 0
    for line in v2_file.read_text().splitlines():
        r = json.loads(line)
        if r.get("kind") == "v2":
            v2[r["file"]] = r
        if r.get("kind") == "end":
            calls += r.get("second_look_calls", 0)
    rows = []
    for f, a in v1.items():
        b = v2.get(f)
        if not b:
            continue
        rows.append({**a, "half": half(f), "v2_status": b["status"], "v2_final": b.get("final"),
                     "v2_answered": b["status"] == "decided", "v2_asked": bool(b.get("asked")),
                     "v2_verified": bool(b.get("verified")), "v2_stage": b.get("stage"), "v2_route": b["route"]})

    systems = [
        ("Pairu v1 (first look, decide at 0.75)", lambda x: x["p_final"] == x["true_id"], lambda x: x["p_answered"], lambda x: x["p_asked"]),
        ("Pairu v2 (decide alone at 0.9, else second look)", lambda x: x["v2_final"] == x["true_id"], lambda x: x["v2_answered"], lambda x: x["v2_asked"]),
        ("Bare model, open question", lambda x: x["b_id"] == x["true_id"], lambda x: x["b_answered"], None),
    ]

    def table(sub):
        return [block(sub, s, rt, an, ak) for s, rt, an, ak in systems]

    inl = [r for r in rows if r["in_list"]]
    out = [r for r in rows if not r["in_list"]]
    odd = [r for r in inl if r["half"] == "odd"]
    sick = [r for r in inl if not r["true_id"].endswith("_healthy")]
    v2res = {
        "summary": None,
        "held_out_half_in_list": table(odd),
        "all_in_list": table(inl),
        "all_in_list_diseased_only": table(sick),
        "out_of_list": [
            {"system": "Pairu v1", "n": len(out), "refused": sum(not r["p_answered"] for r in out), "named_a_wrong_disease": sum(r["p_answered"] for r in out)},
            {"system": "Pairu v2", "n": len(out), "refused": sum(not r["v2_answered"] for r in out), "named_a_wrong_disease": sum(r["v2_answered"] for r in out)},
            {"system": "Bare model", "n": len(out), "refused": sum(not r["b_answered"] for r in out),
             "named_the_true_disease": sum(r["b_id"] == r["true_id"] for r in out), "named_a_wrong_disease": sum(r["b_answered"] and r["b_id"] != r["true_id"] for r in out)},
        ],
        "v2_steps_all_95": {
            "decided_by_first_look_alone": sum(r["v2_route"] == "decided" for r in rows),
            "sent_to_second_look": sum(r["v2_route"] == "verify" for r in rows),
            "second_look_decided_verified": sum(r["v2_verified"] for r in rows),
            "farmer_asked_after_second_look": sum(r["v2_asked"] for r in rows),
            "unsure": sum(r["v2_status"] == "unsure" for r in rows),
            "errors": sum(r["v2_status"] == "error" for r in rows),
            "verified_and_right_in_list": sum(r["v2_verified"] and r["v2_final"] == r["true_id"] for r in inl),
            "verified_and_wrong_in_list": sum(r["v2_verified"] and r["v2_final"] != r["true_id"] for r in inl),
        },
        "method": {
            "threshold": "0.9 was chosen on the even half (md5 of the file name is even) from v1 first-look confidences; the odd half was held out and is the fair number.",
            "replay": "The first look is not repeated: v2 replays the first-look answers saved in the v1 run and calls only the second look (gemini-3.5-flash-lite, gemini-3.1-flash-lite as fallback, no Claude) through an eval-only path of the same code.",
            "farmer": "Questions left for the farmer were answered by a script from the true label, the best case; a real farmer can misread a leaf.",
            "second_look_calls": calls,
            "run_file": v2_file.name,
            "kb_note": "The second look used the knowledge base at commit 7113bef (83 entries); the first looks were made with the 78-entry version. The tomato, potato and maize lists are the same in both; paddy gained three pests.",
        },
        "rows": [{k: r[k] for k in ("file", "half", "true_id", "in_list", "p_final", "v2_route", "v2_status", "v2_final", "v2_verified", "v2_asked", "b_id")} for r in rows],
    }
    h = {t["system"]: t for t in v2res["held_out_half_in_list"]}
    a = {t["system"]: t for t in v2res["all_in_list"]}
    k1, k2, kb = (s[0] for s in systems)
    v2res["summary"] = (
        f"On the held-out half ({h[k2]['n']} photos of diseases Pairu holds), v2 was right on {h[k2]['right']} and wrong while answering on {h[k2]['answered_and_wrong']}, "
        f"against {h[k1]['right']} and {h[k1]['answered_and_wrong']} for v1 and {h[kb]['right']} and {h[kb]['answered_and_wrong']} for the bare model. "
        f"On all {a[k2]['n']}: v2 {a[k2]['right']} right and {a[k2]['answered_and_wrong']} wrong, v1 {a[k1]['right']} and {a[k1]['answered_and_wrong']}, bare model {a[kb]['right']} and {a[kb]['answered_and_wrong']}."
    )
    res["v2"] = v2res
    res = {"v2": v2res, **{k: v for k, v in res.items() if k != "v2"}}
    (HERE / "results.json").write_text(json.dumps(res, indent=1, ensure_ascii=False) + "\n")
    print(v2res["summary"])
    for k in ("held_out_half_in_list", "all_in_list", "all_in_list_diseased_only", "out_of_list"):
        print(k)
        for t in v2res[k]:
            print("  ", t)
    print(json.dumps(v2res["v2_steps_all_95"], indent=1), "calls", calls)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
