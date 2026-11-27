#!/usr/bin/env python3
"""Diagnosis v2 on the same frozen test set, without repeating the first look.

For every image, the first-look answer saved in a v1 run file (runs/20261127-173944.jsonl) is
replayed with the v2 rules from functions/api/diagnose.ts:

  * photo flagged, other crop, nothing or "unknown" on top   -> unsure
  * top confidence >= 0.9                                     -> decided (first look alone)
  * top confidence < 0.4                                      -> unsure
  * otherwise the second look runs: POST /api/verify (an eval-only path, on only when the local
    server sets EVAL_DEBUG=1) returns what /api/diagnose would return after stage 2.

When v2 asks the farmer, the remaining questions are answered truthfully from the true label, as
in v1 (yes only when the question's yes side is the true disease; for a "do you see this sign"
question, yes only when the sign belongs to the true disease), and POST /api/resolve settles it.

Every response goes to eval/runs/v2-<timestamp>.jsonl. At most --budget second-look calls.
Usage: python3 -I eval/run_v2.py --base http://127.0.0.1:8817 [--resume FILE]
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from run import post, MIN_INTERVAL_S  # noqa: E402

V1_RUN = HERE / "runs" / "20261127-173944.jsonl"
DECIDE_V2 = 0.9
VERIFY_MIN = 0.4


def v1_bodies() -> dict:
    out = {}
    for line in V1_RUN.read_text().splitlines():
        r = json.loads(line)
        if r.get("kind") == "pairu" and r["diagnose"].get("http") == 200:
            out[r["file"]] = r["diagnose"]["body"]
    return out


def first_look_route(b: dict, crop: str) -> str:
    c = b.get("candidates") or []
    other_crop = b.get("crop_detected") and b["crop_detected"] != crop and not b.get("crop_confident")
    if other_crop or b.get("image_quality") != "ok" or not c or c[0]["id"] == "unknown":
        return "unsure"
    if c[0]["confidence"] >= DECIDE_V2:
        return "decided"
    if c[0]["confidence"] < VERIFY_MIN:
        return "unsure"
    return "verify"


def farmer(questions: list, true_id: str | None) -> dict:
    return {q["id"]: (true_id is not None and q.get("yes") == true_id) for q in questions}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8817")
    ap.add_argument("--resume", type=Path)
    ap.add_argument("--budget", type=int, default=110)
    a = ap.parse_args()
    ts = json.loads((HERE / "testset.json").read_text())
    bodies = v1_bodies()
    out = a.resume or HERE / "runs" / f"v2-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}.jsonl"
    done, calls = set(), 0
    if out.exists():
        for line in out.read_text().splitlines():
            r = json.loads(line)
            if r.get("kind") == "v2":
                done.add(r["file"])
            calls += r.get("model_calls", 0)

    def log(rec):
        rec["ts"] = dt.datetime.now(dt.timezone.utc).isoformat()
        with out.open("a") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    if not out.exists():
        log({"kind": "meta", "v1_run": V1_RUN.name, "decide_v2": DECIDE_V2, "verify_min": VERIFY_MIN})
    last = 0.0
    stopped = None
    for i, it in enumerate(ts["items"]):
        f = it["file"]
        if f in done or f not in bodies:
            continue
        b = bodies[f]
        route = first_look_route(b, it["crop"])
        rec = {"kind": "v2", "file": f, "true_id": it["kb_id"], "route": route, "model_calls": 0,
               "v1_candidates": b.get("candidates")}
        if route == "decided":
            rec.update(status="decided", final=b["candidates"][0]["id"], verified=False, stage=1)
        elif route == "unsure":
            rec.update(status="unsure", final=None, verified=False, stage=1)
        else:
            if calls >= a.budget:
                stopped = f"budget of {a.budget} second-look calls reached"
                break
            img = base64.b64encode((HERE / "images" / f).read_bytes()).decode()
            body = None
            for attempt in range(4):
                gap = time.time() - last
                if gap < MIN_INTERVAL_S:
                    time.sleep(MIN_INTERVAL_S - gap)
                last = time.time()
                calls += 1
                rec["model_calls"] += 1
                code, body = post(f"{a.base}/api/verify", {"crop": it["crop"], "image": img, "candidates": b["candidates"]})
                if code == 200:
                    break
                log({"kind": "verify_error", "file": f, "http": code, "body": body, "attempt": attempt + 1})
                if "PerDay" in json.dumps(body):
                    stopped = "daily quota"
                    break
                time.sleep(15 * 2 ** attempt)
            if stopped:
                break
            rec["verify"] = body
            if code == 200 and body is None:
                # no question could be built: diagnose.ts then falls back to first-look rules,
                # which below 0.9 never decide on their own
                rec.update(status="unsure", final=None, verified=False, stage=1)
            elif not isinstance(body, dict) or code != 200:
                rec.update(status="error", final=None, verified=False, stage=2)
            else:
                rec.update(stage=2, verified=bool(body.get("verified")), first_status=body["status"])
                if body["status"] == "decided":
                    rec.update(status="decided", final=body["candidates"][0]["id"])
                elif body["status"] == "ask":
                    ans = farmer(body["questions"], it["kb_id"])
                    rec["farmer_answers"] = ans
                    c2, r2 = post(f"{a.base}/api/resolve", {"candidates": body["candidates"], "answers": ans, "check": body["check"]})
                    rec["resolve"] = r2
                    if c2 == 200 and r2.get("status") == "decided":
                        rec.update(status="decided", final=r2["id"], asked=True)
                    else:
                        rec.update(status="unsure", final=None, asked=True)
                else:
                    rec.update(status="unsure", final=None)
        log(rec)
        print(f"[{i + 1}/{len(ts['items'])}] {f} {rec['route']} -> {rec['status']} {rec.get('final')} calls={calls}", flush=True)
    log({"kind": "end", "second_look_calls": calls, "stopped": stopped})
    print(f"run file: {out}\nsecond-look calls: {calls}\nstopped: {stopped}")


if __name__ == "__main__":
    main()
