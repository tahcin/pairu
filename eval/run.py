#!/usr/bin/env python3
"""Run the frozen test set through Pairu and through the bare model, and log every raw response.

For each image in eval/testset.json:

  Pairu     POST /api/diagnose with the true crop (as a farmer would pick it). If the answer is
            "ask", the follow-up questions are answered the way a farmer looking at the real leaf
            would: yes when the question's "yes" id is the true disease, otherwise no. Then
            POST /api/resolve with those answers.
  Baseline  the same model (gemini-3.1-flash-lite) gets the same image and an open question with
            no crop and no list: "What crop and disease is this? Answer with the disease name."
            Its free text is mapped to a KB id later, by eval/matcher.py, inside eval/score.py.

Every response goes to eval/runs/<timestamp>.jsonl, one line per call. Requests are throttled to
under 12 a minute, 429 and 503 are retried with backoff, and the run stops at once on a daily
quota error or when the Gemini call budget is spent. The Claude key is never read or used: the
local server is started by eval/serve_local.sh with a .dev.vars that holds only the Gemini key,
and a Pairu answer from any non-Gemini model aborts the run.

Usage:
  python3 -I eval/run.py --base http://127.0.0.1:8817 [--resume eval/runs/<file>.jsonl] [--limit N]
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
APP = HERE.parent
BASELINE_MODEL = "gemini-3.1-flash-lite"
BASELINE_PROMPT = "What crop and disease is this? Answer with the disease name."
MIN_INTERVAL_S = 5.5          # at most ~10.9 model-backed requests a minute
CALL_BUDGET = 230             # Gemini calls for the whole eval, retries included


class QuotaExhausted(Exception):
    pass


class BudgetSpent(Exception):
    pass


def ctx():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def gemini_key() -> str:
    for line in (APP / ".dev.vars").read_text().splitlines():
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"')
    sys.exit("GEMINI_API_KEY missing from .dev.vars")


def post(url: str, body: dict, headers: dict | None = None, timeout: int = 120) -> tuple[int, dict | str]:
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"content-type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, context=ctx() if url.startswith("https") else None, timeout=timeout) as r:
            raw = r.read().decode()
            code = r.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        code = e.code
    except (TimeoutError, urllib.error.URLError, ConnectionError, OSError) as e:
        return 0, f"network error: {e}"   # retried like a 503; the call still counts
    try:
        return code, json.loads(raw)
    except ValueError:
        return code, raw


def is_daily_quota(text: str) -> bool:
    t = text.lower()
    return "perday" in t or "per day" in t or "requests_per_day" in t


class Runner:
    def __init__(self, base: str, out: Path, budget: int):
        self.base = base.rstrip("/")
        self.out = out
        self.calls = 0
        self.budget = budget
        self.last = 0.0
        self.key = gemini_key()

    def wait_turn(self):
        gap = time.time() - self.last
        if gap < MIN_INTERVAL_S:
            time.sleep(MIN_INTERVAL_S - gap)
        self.last = time.time()

    def spend(self, n: int):
        if self.calls + n > self.budget:
            raise BudgetSpent(f"budget of {self.budget} Gemini calls reached")
        self.calls += n

    def log(self, rec: dict):
        rec["ts"] = dt.datetime.now(dt.timezone.utc).isoformat()
        with self.out.open("a") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    # Pairu ---------------------------------------------------------------------------------
    def diagnose(self, item: dict, b64: str) -> dict:
        for attempt in range(4):
            self.spend(1)
            self.wait_turn()
            code, body = post(f"{self.base}/api/diagnose", {"crop": item["crop"], "image": b64, "note": "", "lang": "en"})
            text = json.dumps(body) if not isinstance(body, str) else body
            if code == 200 and isinstance(body, dict):
                model = body.get("model", "")
                if body.get("cached"):
                    self.calls -= 1
                elif model and model != "gemini-3.1-flash-lite":
                    self.spend(1)   # the first model failed, so two Gemini calls were made
                if model and not model.startswith("gemini"):
                    raise SystemExit(f"Pairu answered with {model}; this eval must use Gemini only. Stopping.")
                return {"http": code, "body": body, "attempts": attempt + 1}
            # 502 means both Gemini models failed (and the disabled Claude fallback too).
            if code == 502:
                self.spend(1)
            self.log({"kind": "pairu_error", "file": item["file"], "http": code, "body": body, "attempt": attempt + 1})
            if is_daily_quota(text) and ("gemini-3.1-flash-lite" in text and "gemini-3.5-flash-lite" in text or code == 429):
                raise QuotaExhausted(text[:400])
            time.sleep(min(90, 15 * 2 ** attempt))
        return {"http": code, "body": body, "attempts": 4}

    def resolve(self, candidates: list, answers: dict) -> dict:
        code, body = post(f"{self.base}/api/resolve", {"candidates": candidates, "answers": answers})
        return {"http": code, "body": body}

    # Baseline ------------------------------------------------------------------------------
    def baseline(self, item: dict, b64: str) -> dict:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{BASELINE_MODEL}:generateContent"
        req = {"contents": [{"role": "user", "parts": [{"inline_data": {"mime_type": "image/jpeg", "data": b64}}, {"text": BASELINE_PROMPT}]}]}
        for attempt in range(4):
            self.spend(1)
            self.wait_turn()
            code, body = post(url, req, {"x-goog-api-key": self.key})
            if code == 200 and isinstance(body, dict):
                parts = (body.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
                text = "".join(p.get("text", "") for p in parts)
                return {"http": code, "text": text, "raw": body, "attempts": attempt + 1}
            t = json.dumps(body) if not isinstance(body, str) else body
            self.log({"kind": "baseline_error", "file": item["file"], "http": code, "body": body, "attempt": attempt + 1})
            if code == 429 and is_daily_quota(t):
                raise QuotaExhausted(t[:400])
            if code not in (0, 429, 500, 503, 504):
                return {"http": code, "text": None, "raw": body, "attempts": attempt + 1}
            time.sleep(min(90, 15 * 2 ** attempt))
        return {"http": code, "text": None, "raw": body, "attempts": 4}


def farmer_answers(questions: list, true_id: str | None) -> dict:
    # A farmer looking at the real leaf answers truthfully: yes only when the question's "yes"
    # side is the disease the leaf really has.
    return {q["id"]: (true_id is not None and q.get("yes") == true_id) for q in questions}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8817")
    ap.add_argument("--resume", type=Path)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--budget", type=int, default=CALL_BUDGET, help="Gemini calls allowed for this run file, all invocations together")
    a = ap.parse_args()

    ts = json.loads((HERE / "testset.json").read_text())
    if not ts.get("kb_mapped_from"):
        sys.exit("testset.json is not mapped to KB ids yet; run build_testset.py map")
    (HERE / "runs").mkdir(exist_ok=True)
    out = a.resume or HERE / "runs" / f"{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}.jsonl"
    done_p, done_b = set(), set()
    prior_calls = 0
    if out.exists():
        for line in out.read_text().splitlines():
            r = json.loads(line)
            # Count calls from the records themselves, so a crashed invocation is still counted.
            k = r.get("kind")
            if k == "pairu":
                body = r["diagnose"].get("body") if isinstance(r["diagnose"].get("body"), dict) else {}
                if r["diagnose"].get("http") == 200 and not body.get("cached"):
                    prior_calls += 2 if body.get("model") not in (None, "gemini-3.1-flash-lite") else 1
            elif k == "pairu_error":
                prior_calls += 2 if r.get("http") == 502 else 1
            elif k in ("baseline", "baseline_error"):
                prior_calls += 1
            elif k == "uncounted_calls":
                prior_calls += r["n"]
            if r.get("kind") == "pairu":
                done_p.add(r["file"])
            if r.get("kind") == "baseline" and r.get("http") == 200:
                done_b.add(r["file"])
    run = Runner(a.base, out, a.budget - prior_calls)
    print(f"Gemini calls already spent in this run file: {prior_calls}; allowed now: {run.budget}")
    if not out.exists():
        run.log({"kind": "meta", "testset_kb": ts["kb_mapped_from"], "base": a.base, "baseline_model": BASELINE_MODEL,
                 "baseline_prompt": BASELINE_PROMPT, "n_items": len(ts["items"])})
    items = ts["items"][: a.limit] if a.limit else ts["items"]
    stopped = None
    try:
        for i, it in enumerate(items):
            b64 = base64.b64encode((HERE / "images" / it["file"]).read_bytes()).decode()
            if it["file"] not in done_p:
                d = run.diagnose(it, b64)
                rec = {"kind": "pairu", "file": it["file"], "crop": it["crop"], "true_id": it["kb_id"], "diagnose": d}
                body = d.get("body") if isinstance(d.get("body"), dict) else {}
                if body.get("status") == "ask" and body.get("questions"):
                    ans = farmer_answers(body["questions"], it["kb_id"])
                    rec["answers"] = ans
                    rec["resolve"] = run.resolve(body["candidates"], ans)
                run.log(rec)
            if it["file"] not in done_b:
                b = run.baseline(it, b64)
                run.log({"kind": "baseline", "file": it["file"], "crop": it["crop"], "true_id": it["kb_id"],
                         "model": BASELINE_MODEL, "http": b["http"], "text": b["text"], "attempts": b["attempts"],
                         "usage": (b["raw"] or {}).get("usageMetadata") if isinstance(b["raw"], dict) else None})
            print(f"[{i + 1}/{len(items)}] {it['file']} calls={run.calls}", flush=True)
    except QuotaExhausted as e:
        stopped = f"daily quota reached: {e}"
    except BudgetSpent as e:
        stopped = str(e)
    run.log({"kind": "end", "gemini_calls_this_invocation": run.calls, "stopped": stopped})
    print(f"run file: {out}\nGemini calls this invocation: {run.calls}\nstopped: {stopped}")


if __name__ == "__main__":
    main()
