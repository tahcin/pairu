#!/usr/bin/env python3
"""Score a run file into eval/results.json (shown on the app's /evidence page).

Definitions (the same for Pairu and the baseline):
  in-list image     its true disease (or healthy) is one Pairu holds for that crop
  answered          the system named a disease or healthy (Pairu: final status "decided")
  refused           Pairu said "unsure" (or stayed unsure after the questions); the baseline said
                    it could not tell. A refusal is not counted as an error.
  top-1 accuracy    correct answers / all in-list images (refusals count as not correct)
  accuracy when answered   correct / answered
  wrong-confident   answered but wrong, divided by all in-list images: the dangerous case,
                    because the farmer would act on a wrong answer
For the baseline, an answer that names no disease we can match ("unmatched") counts as answered
and wrong; every such answer is listed in results.json so a reader can check the call.

Usage: python3 -I eval/score.py eval/runs/<file>.jsonl
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import matcher  # noqa: E402

KB = json.loads((HERE.parent / "data" / "kb.json").read_text())


def pct(a: int, b: int):
    return round(100 * a / b, 1) if b else None


def pairu_outcome(rec: dict) -> dict:
    body = rec["diagnose"].get("body")
    if rec["diagnose"].get("http") != 200 or not isinstance(body, dict):
        return {"ok": False}
    cands = body.get("candidates") or []
    first = cands[0]["id"] if cands else None
    status = body.get("status")
    final, final_status = None, "unsure"
    if status == "decided":
        final, final_status = first, "decided"
    elif status == "ask" and rec.get("resolve", {}).get("http") == 200:
        r = rec["resolve"]["body"]
        if r.get("status") == "decided" and r.get("id"):
            final, final_status = r["id"], "decided"
    return {"ok": True, "first": first, "status": status, "final": final, "final_status": final_status,
            "asked": status == "ask", "model": body.get("model"), "image_quality": body.get("image_quality"),
            "top_conf": cands[0]["confidence"] if cands else None}


def summarise(rows: list[dict], key_final: str, key_answered: str) -> dict:
    n = len(rows)
    answered = [r for r in rows if r[key_answered]]
    correct = [r for r in answered if r[key_final] == r["true_id"]]
    return {
        "n": n,
        "top1_accuracy_pct": pct(len(correct), n),
        "correct": len(correct),
        "answered": len(answered),
        "accuracy_when_answered_pct": pct(len(correct), len(answered)),
        "refused": n - len(answered),
        "refusal_rate_pct": pct(n - len(answered), n),
        "wrong_confident": len(answered) - len(correct),
        "wrong_confident_rate_pct": pct(len(answered) - len(correct), n),
    }


def main(run_file: Path):
    ts = {it["file"]: it for it in json.loads((HERE / "testset.json").read_text())["items"]}
    pairu, base, meta, ends, calls = {}, {}, None, [], 0
    for line in run_file.read_text().splitlines():
        r = json.loads(line)
        k = r.get("kind")
        if k == "pairu":
            pairu[r["file"]] = r
        elif k == "baseline" and r.get("http") == 200:
            base[r["file"]] = r
        elif k == "meta":
            meta = r
        elif k == "end":
            ends.append(r)
        # Gemini calls, counted from the records the same way eval/run.py counts them on resume.
        if k == "pairu":
            b = r["diagnose"].get("body") if isinstance(r["diagnose"].get("body"), dict) else {}
            if r["diagnose"].get("http") == 200 and not b.get("cached"):
                calls += 2 if b.get("model") not in (None, "gemini-3.1-flash-lite") else 1
        elif k == "pairu_error":
            calls += 2 if r.get("http") == 502 else 1
        elif k in ("baseline", "baseline_error"):
            calls += 1
        elif k == "uncounted_calls":
            calls += r["n"]

    rows, unmatched = [], []
    for f, it in ts.items():
        if f not in pairu or f not in base:
            continue
        po = pairu_outcome(pairu[f])
        if not po["ok"]:
            continue
        bm = matcher.match(base[f]["text"], it["crop"], KB)
        if bm["id"] == "unmatched":
            unmatched.append({"file": f, "true_label": it["true_label"], "answer": (base[f]["text"] or "").strip()[:200]})
        true_id = it["kb_id"] or it["kb_guess"]
        rows.append({
            "file": f, "crop": it["crop"], "true_label": it["true_label"], "true_id": true_id, "in_list": it["in_list"],
            "setting": it["setting"],
            "p_first": po["first"], "p_status": po["status"], "p_final": po["final"],
            "p_answered": po["final_status"] == "decided", "p_asked": po["asked"], "p_model": po["model"],
            "p_quality": po["image_quality"],
            "b_id": bm["id"], "b_how": bm["how"], "b_answered": bm["id"] not in ("refused", None),
            "b_crop_named": bm.get("crops_named", []), "b_text": (base[f]["text"] or "").strip()[:300],
        })

    inl = [r for r in rows if r["in_list"]]
    out = [r for r in rows if not r["in_list"]]
    res: dict = {}
    res["summary"] = (
        f"On {len(inl)} held-out labelled leaf photos of diseases Pairu holds, Pairu named the right disease "
        f"{pct(sum(r['p_answered'] and r['p_final'] == r['true_id'] for r in inl), len(inl))}% of the time and was confidently wrong "
        f"{pct(sum(r['p_answered'] and r['p_final'] != r['true_id'] for r in inl), len(inl))}% of the time. The same model asked an open question "
        f"was right {pct(sum(r['b_answered'] and r['b_id'] == r['true_id'] for r in inl), len(inl))}% of the time and confidently wrong "
        f"{pct(sum(r['b_answered'] and r['b_id'] != r['true_id'] for r in inl), len(inl))}% of the time."
    )
    res["headline"] = [
        {"system": "Pairu (closed list, follow-up questions, refuses when unsure)", **summarise(inl, "p_final", "p_answered")},
        {"system": "Bare model, open question (gemini-3.1-flash-lite)", **summarise(inl, "b_id", "b_answered")},
    ]
    sick = [r for r in inl if not r["true_id"].endswith("_healthy")]
    res["diseased_leaves_only"] = {
        "note": "The open question asks which disease the leaf has, so it nudges the bare model to name one even on a healthy leaf. These rows leave out the 15 healthy leaves to show the comparison without that effect.",
        "rows": [
            {"system": "Pairu", **summarise(sick, "p_final", "p_answered")},
            {"system": "Bare model", **summarise(sick, "b_id", "b_answered")},
        ],
    }
    for setting in ("lab", "field"):
        sub = [r for r in inl if r["setting"] == setting]
        res[f"by_photo_type_{setting}"] = [
            {"system": "Pairu", **summarise(sub, "p_final", "p_answered")},
            {"system": "Bare model", **summarise(sub, "b_id", "b_answered")},
        ]
    first_ok = sum(r["p_first"] == r["true_id"] for r in inl)
    asked = [r for r in inl if r["p_asked"]]
    res["pairu_steps"] = {
        "first_guess_top1_accuracy_pct": pct(first_ok, len(inl)),
        "first_guess_correct": first_ok,
        "decided_without_questions": sum(r["p_status"] == "decided" for r in inl),
        "asked_follow_up_questions": len(asked),
        "questions_used_pct": pct(len(asked), len(inl)),
        "questions_fixed_a_wrong_first_guess": sum(r["p_first"] != r["true_id"] and r["p_final"] == r["true_id"] for r in asked),
        "questions_broke_a_right_first_guess": sum(r["p_first"] == r["true_id"] and r["p_answered"] and r["p_final"] != r["true_id"] for r in asked),
        "asked_and_still_unsure": sum(not r["p_answered"] for r in asked),
        "unsure_at_once": sum(r["p_status"] == "unsure" for r in inl),
        "unsure_because_photo_flagged": sum(r["p_status"] == "unsure" and r["p_quality"] not in (None, "ok") for r in inl),
        "answered_by_model": {m: sum(r["p_model"] == m for r in rows) for m in sorted({str(r["p_model"]) for r in rows})},
        "note": "Follow-up questions were answered automatically from the true label, the way a farmer looking at the real leaf would answer (yes only when the question's yes side is the true disease).",
    }
    res["out_of_list"] = {
        "note": "Diseases in the test set that Pairu does not hold. The right behaviour for Pairu is to say it is unsure; naming any listed disease is a wrong answer. The bare model gets credit if it names the true disease.",
        "n": len(out),
        "pairu_refused": sum(not r["p_answered"] for r in out),
        "pairu_named_a_wrong_disease": sum(r["p_answered"] for r in out),
        "baseline_named_true_disease": sum(r["b_id"] == r["true_id"] for r in out),
        "baseline_answered_wrong": sum(r["b_answered"] and r["b_id"] != r["true_id"] for r in out),
        "baseline_refused": sum(not r["b_answered"] for r in out),
    }
    classes = defaultdict(list)
    for r in rows:
        classes[(r["true_label"], r["true_id"] if r["in_list"] else "out-of-list")].append(r)
    res["per_class"] = []
    for (lab, tid), rs in sorted(classes.items(), key=lambda x: (x[1][0]["crop"], x[0][0])):
        inl_c = rs[0]["in_list"]
        res["per_class"].append({
            "dataset_class": lab, "kb_id": tid, "n": len(rs),
            "pairu_correct": sum(r["p_answered"] and r["p_final"] == r["true_id"] for r in rs) if inl_c else "-",
            "pairu_unsure": sum(not r["p_answered"] for r in rs),
            "pairu_wrong": sum(r["p_answered"] and r["p_final"] != r["true_id"] for r in rs),
            "baseline_correct": sum(r["b_answered"] and r["b_id"] == r["true_id"] for r in rs),
            "baseline_refused": sum(not r["b_answered"] for r in rs),
            "baseline_wrong": sum(r["b_answered"] and r["b_id"] != r["true_id"] for r in rs),
        })
    res["baseline_crop_named_correctly_pct"] = pct(sum(r["crop"] in r["b_crop_named"] for r in rows), len(rows))
    res["baseline_unmatched_answers"] = unmatched
    res["method"] = {
        "test_set": "eval/testset.json, frozen before any model run (seed 20261127), images from PlantVillage (CC BY-SA 3.0, lab photos) and Sethy et al. rice leaf disease samples (CC BY 4.0, field photos)",
        "pairu": "POST /api/diagnose with the true crop and no spoken note, then /api/resolve for follow-up questions; Gemini only, the Claude fallback was disabled",
        "baseline": f"{meta['baseline_model'] if meta else 'gemini-3.1-flash-lite'}, same image, prompt: \"{meta['baseline_prompt'] if meta else ''}\", no crop and no list; the free text is mapped to a disease by eval/matcher.py, matching only diseases of the true crop (lenient to the baseline)",
        "gemini_calls": calls,
        "note_on_models": "When gemini-3.1-flash-lite failed or took longer than 12 seconds, the app fell back to gemini-3.5-flash-lite, as it does for farmers; answered_by_model under pairu_steps shows how often. The 12 second timeout was added to the app while the run was in progress (commit 16c196c); the prompt and decision thresholds did not change.",
        "stopped_early": [e["stopped"] for e in ends if e.get("stopped")],
        "images_scored": len(rows),
        "images_in_test_set": len(ts),
        "run_file": run_file.name,
        "kb": json.loads((HERE / "testset.json").read_text())["kb_mapped_from"],
    }
    res["limits"] = [
        "Most images are PlantVillage lab photos of one leaf on a plain background, which are much easier than photos taken in a field; the rice images are real field photos and are reported separately.",
        f"The test set is small ({len(rows)} images, about five per disease), so each percentage has a wide margin of error; per-class numbers are counts, not rates.",
        "PlantVillage is public and widely used, so the model may have seen these images in training.",
        "The open question asks for a disease, which nudges the bare model to name one on healthy leaves; diseased_leaves_only shows the comparison without the healthy leaves.",
        "Pairu was told the true crop (the farmer picks it from tiles); the baseline was not, but it was scored only on the disease, against the true crop's diseases.",
        "Follow-up questions were answered by a script from the true label, which is the best case for the questions; a real farmer can misread a leaf.",
    ]
    res["rows"] = [{k: v for k, v in r.items() if k not in ("b_crop_named", "b_text")} for r in rows]  # full answers are in the run file
    (HERE / "results.json").write_text(json.dumps(res, indent=1, ensure_ascii=False) + "\n")
    print(res["summary"])
    print(json.dumps(res["headline"], indent=1))
    print(json.dumps(res["diseased_leaves_only"], indent=1))
    print("calls", calls)
    print(json.dumps(res["out_of_list"], indent=1))
    print("unmatched:", len(unmatched))


if __name__ == "__main__":
    main(Path(sys.argv[1]))
