#!/usr/bin/env python3
"""Pairu v2 on the frozen PlantDoc field set (eval/fieldset.json), through the local server.

Same code as the live app (first look, second look between 0.4 and 0.9), started by
eval/serve_local.sh with Gemini only. When Pairu asks the farmer, the questions are answered from
the true label as in the other runs (best case) and /api/resolve settles it with the second-look
answers. The app limits /api/diagnose to 20 requests per 10 minutes per address, so requests are
spaced 31 seconds apart. At most --budget Gemini calls, counted from the models each answer names.

Usage: python3 -I eval/run_field.py [--base http://127.0.0.1:8817] [--resume FILE]
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
from run import post  # noqa: E402

SPACING_S = 31


def calls_for(body: dict) -> int:
    n = 2 if body.get("model") not in (None, "gemini-3.1-flash-lite") else 1
    if body.get("cached"):
        return 0
    if body.get("stage") == 2 or body.get("verify_failed"):
        n += 1 if body.get("verify_model") in ("gemini-3.5-flash-lite", "cache") else 2
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8817")
    ap.add_argument("--resume", type=Path)
    ap.add_argument("--budget", type=int, default=90)
    a = ap.parse_args()
    items = json.loads((HERE / "fieldset.json").read_text())["items"]
    out = a.resume or HERE / "runs" / f"field-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}.jsonl"
    done, calls = set(), 0
    if out.exists():
        for line in out.read_text().splitlines():
            r = json.loads(line)
            if r.get("kind") == "pairu_v2":
                done.add(r["file"])
            calls += r.get("calls", 0)

    def log(rec):
        rec["ts"] = dt.datetime.now(dt.timezone.utc).isoformat()
        with out.open("a") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    stopped = None
    for i, it in enumerate(items):
        if it["file"] in done:
            continue
        if calls + 4 > a.budget:
            stopped = f"budget of {a.budget} Gemini calls nearly spent"
            break
        img = base64.b64encode((HERE / "images_field" / it["file"]).read_bytes()).decode()
        body, code = None, 0
        for attempt in range(4):
            t0 = time.time()
            code, body = post(f"{a.base}/api/diagnose", {"crop": it["crop"], "image": img, "note": "", "lang": "en"})
            if code == 200:
                break
            text = json.dumps(body)
            n = 0 if code == 429 and "rate_limited" in text else 2
            calls += n
            log({"kind": "error", "file": it["file"], "http": code, "body": body, "calls": n})
            if "PerDay" in text:
                stopped = "daily quota"
                break
            time.sleep(body.get("retry_after_sec", 30) + 2 if isinstance(body, dict) and code == 429 else 20 * (attempt + 1))
        if stopped:
            break
        rec = {"kind": "pairu_v2", "file": it["file"], "crop": it["crop"], "true_id": it["kb_id"], "http": code, "body": body}
        if code == 200:
            rec["calls"] = calls_for(body)
            calls += rec["calls"]
            if any(str(m).startswith("claude") for m in (body.get("model"), body.get("verify_model"))):
                sys.exit("a Claude answer appeared; this eval must use Gemini only")
            st = body["status"]
            final = body["candidates"][0]["id"] if st == "decided" else None
            if st == "ask":
                ans = {q["id"]: q.get("yes") == it["kb_id"] for q in body["questions"]}
                c2, r2 = post(f"{a.base}/api/resolve", {"candidates": body["candidates"], "answers": ans, "check": body.get("check")})
                rec.update(farmer_answers=ans, resolve=r2, asked=True)
                final = r2.get("id") if c2 == 200 and r2.get("status") == "decided" else None
            rec.update(status="decided" if final else "unsure", final=final)
        log(rec)
        print(f"[{i + 1}/{len(items)}] {it['file']} {rec.get('status')} {rec.get('final')} (true {it['kb_id']}) calls={calls}", flush=True)
        wait = SPACING_S - (time.time() - t0)
        if wait > 0:
            time.sleep(wait)
    log({"kind": "end", "gemini_calls": calls, "stopped": stopped})
    print(f"run file: {out}\nGemini calls: {calls}\nstopped: {stopped}")


if __name__ == "__main__":
    main()
