#!/usr/bin/env python3
"""Pairu v2 with the live model order: gemini-3.5-flash-lite for both looks, nothing else.

Runs the current code and knowledge base through the local server (eval/serve_local.sh), started
from a throwaway copy whose functions/_lib/models.ts lists only gemini-3.5-flash-lite, so there is
no fallback to 3.1, Gemma or Claude. Images: the held-out odd half of the in-list test set (the
half the 0.9 threshold was not chosen on), then the out-of-list images while the budget lasts.
Farmer questions are answered from the true label as before (best case).

Stops at once on any quota error (HTTP 429 from the model, or a failed second look), and before a
call would pass the --budget cap. Usage: python3 -I eval/run_live35.py [--budget 75]
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from run import post  # noqa: E402

MODEL = "gemini-3.5-flash-lite"
SPACING_S = 31  # /api/diagnose allows 20 requests per 10 minutes per address


def odd(f: str) -> bool:
    return int(hashlib.md5(f.encode()).hexdigest(), 16) % 2 == 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8817")
    ap.add_argument("--budget", type=int, default=75)
    a = ap.parse_args()
    items = json.loads((HERE / "testset.json").read_text())["items"]
    order = [it for it in items if it["in_list"] and odd(it["file"])] + [it for it in items if not it["in_list"]]
    out = HERE / "runs" / f"live35-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}.jsonl"

    def log(rec):
        rec["ts"] = dt.datetime.now(dt.timezone.utc).isoformat()
        with out.open("a") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    log({"kind": "meta", "model_order": [MODEL], "n_planned": len(order), "budget": a.budget})
    calls, stopped = 0, None
    for i, it in enumerate(order):
        if calls + 2 > a.budget:
            stopped = f"budget: {calls} calls used, the next image could need 2"
            break
        t0 = time.time()
        img = base64.b64encode((HERE / "images" / it["file"]).read_bytes()).decode()
        code, body = post(f"{a.base}/api/diagnose", {"crop": it["crop"], "image": img, "note": "", "lang": "en"})
        if code == 429 and isinstance(body, dict) and body.get("error") == "rate_limited":
            time.sleep(body.get("retry_after_sec", 60) + 2)
            code, body = post(f"{a.base}/api/diagnose", {"crop": it["crop"], "image": img, "note": "", "lang": "en"})
        rec = {"kind": "pairu_v2_live35", "file": it["file"], "crop": it["crop"], "true_id": it["kb_id"] or it["kb_guess"],
               "in_list": it["in_list"], "http": code, "body": body}
        if code != 200 or not isinstance(body, dict):
            calls += 1
            rec["calls"] = 1
            log(rec)
            stopped = f"HTTP {code} on {it['file']}: {json.dumps(body)[:300]}"
            break
        n = 0 if body.get("cached") else 1 + (1 if body.get("stage") == 2 or body.get("verify_failed") else 0)
        calls += n
        rec["calls"] = n
        models = {body.get("model"), body.get("verify_model")} - {None, "cache"}
        if models - {MODEL}:
            log(rec)
            sys.exit(f"unexpected model {models}; stopping")
        if body.get("verify_failed"):
            log(rec)
            stopped = f"second look failed on {it['file']} (likely quota)"
            break
        st = body["status"]
        final = body["candidates"][0]["id"] if st == "decided" else None
        if st == "ask":
            ans = {q["id"]: q.get("yes") == rec["true_id"] for q in body["questions"]}
            c2, r2 = post(f"{a.base}/api/resolve", {"candidates": body["candidates"], "answers": ans, "check": body.get("check")})
            rec.update(farmer_answers=ans, resolve=r2, asked=True)
            final = r2.get("id") if c2 == 200 and r2.get("status") == "decided" else None
        rec.update(status="decided" if final else "unsure", final=final)
        log(rec)
        print(f"[{i + 1}/{len(order)}] {it['file']} {rec['status']} {final} (true {rec['true_id']}) calls={calls}", flush=True)
        wait = SPACING_S - (time.time() - t0)
        if wait > 0:
            time.sleep(wait)
    log({"kind": "end", "gemini_calls": calls, "stopped": stopped})
    print(f"run file: {out}\nGemini calls: {calls}\nstopped: {stopped}")


if __name__ == "__main__":
    main()
