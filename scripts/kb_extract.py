"""Structure fetched source text into KB fields with an LLM that may only extract.

Input: scripts/kb_plan.json (disease id -> crop, name, kind, source text files).
Output: scripts/raw/kb/extract/<id>.json (one per disease), reviewed by hand before
build_kb.py copies them into data/kb.json.
The model is told to use only the given page text. Every output is then checked
by a person against that text; anything the text does not say is removed.
"""
import json, os, re, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
TEXT = os.path.join(HERE, "raw", "kb", "text")
OUT = os.path.join(HERE, "raw", "kb", "extract")
os.makedirs(OUT, exist_ok=True)

def key():
    for line in open(os.path.join(APP, ".dev.vars")):
        if line.startswith("GEMINI_API_KEY"):
            return line.split("=", 1)[1].strip().strip('"')

PROMPT = """You are extracting facts from agricultural extension pages for a farmer help app.
Use ONLY the page text below. Do not add anything from your own knowledge. If the text does not
say something, leave that field empty. Rewrite in plain, warm, simple English a farmer understands
(short everyday words, no Latin except in "pathogen", no em dashes, no semicolons).

Crop: {crop}. Problem: {name}.

Return JSON only, with these keys:
- "pathogen": scientific name(s) of the cause exactly as the text gives them, or "".
- "symptoms": 3 to 6 short sentences describing what the farmer sees on the plant, in plain words.
- "photo_cues": 3 to 6 short phrases (2 to 6 words each) naming what a camera would see on a leaf, fruit, stem or plant (colour, shape, texture, pattern, insect stage). Only from the text.
- "favourable_conditions": one sentence on weather or field conditions that favour it, from the text, or "".
- "prevention": 2 to 5 short sentences: cultural steps that stop it before it starts (seed, variety, spacing, sanitation, water, rotation, traps). No chemical names.
- "practices": 2 to 5 short sentences: what the farmer should do in the field this week once it is seen (remove and destroy affected parts, drain water, traps, field hygiene, monitoring). No chemical pesticide names.
- "organic_bio": list of options that use a biological agent or botanical (for example Pseudomonas, Trichoderma, Bacillus, Beauveria, NPV, neem seed kernel extract, neem oil, parasitoids, pheromone traps) WITH the dose or rate exactly as the text gives it. Each item: {{"text": "...", "page": <index of the page it came from>}}. Empty list if the text has none.
- "chemicals_in_text": list of chemical pesticide names mentioned in the text (only names, for cross-checking).

{pages}
"""

AESA = os.path.join(HERE, "raw", "kb", "aesa")

def aesa_window(name, kw, after=28, cap=9000):
    """Lines of an AESA IPM package around each mention of the problem (skipping the contents pages)."""
    lines = open(os.path.join(AESA, name + ".txt")).read().split("\n")
    rx = re.compile(kw, re.I)
    keep = set()
    for i, l in enumerate(lines):
        if rx.search(l) and "....." not in l:
            keep.update(range(i, min(len(lines), i + after)))
    out, last = [], -2
    for i in sorted(keep):
        if i != last + 1:
            out.append("...")
        out.append(re.sub(r" {3,}", "  |  ", lines[i].strip()))
        last = i
    return "\n".join(l for l in out if l.strip())[:cap]

def call(model, prompt, k):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}}
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"x-goog-api-key": k, "Content-Type": "application/json"})
    r = json.load(urllib.request.urlopen(req, timeout=180))
    parts = r["candidates"][0]["content"]["parts"]
    txt = "".join(p.get("text", "") for p in parts if not p.get("thought"))
    m = re.search(r"\{.*\}", txt, re.S)
    return json.loads(m.group(0))

def main():
    plan = json.load(open(os.path.join(HERE, "kb_plan.json")))
    only = set(sys.argv[1:])
    k = key()
    lite_budget = int(os.environ.get("LITE_BUDGET", "0"))
    for d in plan["diseases"]:
        if only and d["id"] not in only:
            continue
        out = os.path.join(OUT, d["id"] + ".json")
        if os.path.exists(out) or not d.get("text_files"):
            continue
        pages = ""
        for i, f in enumerate(d["text_files"]):
            if f.startswith("extra:"):
                t = open(os.path.join(HERE, "raw", "kb", "extra", f[6:] + ".txt")).read()
            elif f.startswith("aesa:"):
                t = aesa_window(f[5:], d["aesa_kw"])
            else:
                t = open(os.path.join(TEXT, f)).read()
                t = re.sub(r"Content Validator.*", "", t, flags=re.S)
            pages += f"\n=== PAGE {i} ===\n{t[:9000]}\n"
        prompt = PROMPT.format(crop=d["crop"], name=d["name_en"], pages=pages)
        res, used = None, None
        for attempt in range(int(os.environ.get('GEMMA_TRIES', '2'))):
            try:
                res, used = call("gemma-4-31b-it", prompt, k), "gemma-4-31b-it"
                break
            except Exception as e:
                print(d["id"], "gemma retry", attempt, str(e)[:80], flush=True)
                time.sleep(3)
        if res is None and lite_budget > 0:
            try:
                res, used = call("gemini-3.1-flash-lite", prompt, k), "gemini-3.1-flash-lite"
                lite_budget -= 1
            except Exception as e:
                print(d["id"], "lite failed", str(e)[:80], flush=True)
                time.sleep(int(os.environ.get("FAIL_SLEEP", "2")))
        if res is None:
            continue
        res["_model"] = used
        res["_files"] = d["text_files"]
        json.dump(res, open(out, "w"), indent=1, ensure_ascii=False)
        print("ok", d["id"], used, flush=True)
        time.sleep(2)

if __name__ == "__main__":
    main()
