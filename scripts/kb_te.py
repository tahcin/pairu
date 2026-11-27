"""Make data/kb_te.json: Telugu text for every farmer-facing field of data/kb.json.

Step 1 (draft): Sarvam translate (sarvam-translate:v1), cached in scripts/raw/kb/te_draft.json.
Step 2 (review): Claude (claude-sonnet-5-5), one call per crop, fixes meaning errors, uses plain
coastal Andhra village Telugu and applies data/glossary_te.json. Cached per crop in
scripts/raw/kb/te_review/<crop>.json, so a rerun only calls for crops not yet reviewed.
Usage: scripts/.venv/bin/python -I scripts/kb_te.py [draft|review|write]
"""
import json, os, re, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
RAW = os.path.join(HERE, "raw", "kb")
DRAFT = os.path.join(RAW, "te_draft.json")
REVDIR = os.path.join(RAW, "te_review")
os.makedirs(REVDIR, exist_ok=True)
FIELDS = ["symptoms", "prevention", "practices"]
MAX_CLAUDE_CALLS = 20

def env(k):
    for line in open(os.path.join(APP, ".dev.vars")):
        if line.startswith(k + "="):
            return line.split("=", 1)[1].strip().strip('"')

def load_kb():
    return json.load(open(os.path.join(APP, "data", "kb.json")))

def units(kb):
    """Every farmer-facing English string, keyed by a stable path."""
    out = {}
    qs = {}
    for d in kb["diseases"]:
        i = d["id"]
        for f in FIELDS:
            for n, s in enumerate(d[f]):
                out[f"{i}|{f}|{n}"] = s
        if d["favourable_conditions"]:
            out[f"{i}|favourable_conditions|0"] = d["favourable_conditions"]
        for n, o in enumerate(d["organic_bio"]):
            out[f"{i}|organic_bio|{n}"] = o["text"]
        for n, a in enumerate(d.get("avoid", [])):
            out[f"{i}|avoid|{n}"] = a["text"]
        if d.get("etl"):
            out[f"{i}|etl|0"] = d["etl"]["text"]
        for q in d["discriminators"]:
            qs[q["id"]] = (d["crop"], q["question"])
    for qid, (crop, q) in qs.items():
        out[f"Q|{crop}|{qid}"] = q
    return out

def sarvam(text, key):
    body = json.dumps({"input": text, "source_language_code": "en-IN", "target_language_code": "te-IN",
                       "model": "sarvam-translate:v1"}).encode()
    req = urllib.request.Request("https://api.sarvam.ai/translate", data=body,
                                 headers={"content-type": "application/json", "api-subscription-key": key})
    return json.load(urllib.request.urlopen(req, timeout=60))["translated_text"]

def draft():
    kb = load_kb()
    u = units(kb)
    cache = json.load(open(DRAFT)) if os.path.exists(DRAFT) else {}
    todo = sorted({s for s in u.values() if s not in cache})
    key = env("SARVAM_API_KEY")
    print(len(todo), "strings to translate")
    group, size = [], 0
    def flush(g):
        if not g:
            return
        try:
            res = sarvam("\n".join(g), key).split("\n")
            res = [r for r in res if r.strip()]
        except Exception as e:
            print("chunk failed", e); res = []
        if len(res) != len(g):
            for s in g:
                for t in range(3):
                    try:
                        cache[s] = sarvam(s, key); break
                    except Exception as e:
                        print("retry", e); time.sleep(3)
        else:
            for s, t in zip(g, res):
                cache[s] = t.strip()
        json.dump(cache, open(DRAFT, "w"), ensure_ascii=False, indent=0)
    for s in todo:
        if size + len(s) > 900 and group:
            flush(group); group, size = [], 0
        group.append(s); size += len(s) + 1
    flush(group)
    print("draft cache", len(cache))

SYSTEM = """You are a plant-protection extension officer from coastal Andhra Pradesh who writes advice for small farmers in Telugu.
You will get JSON: items with an English source text "en" and a machine-translated Telugu draft "te".
Return corrected Telugu for every item.

Rules:
- The English is the meaning to keep. Fix every meaning error in the draft: wrong words, word-by-word translation, missing parts, added facts. Add nothing that the English does not say.
- Write plain spoken village Telugu as used in coastal Andhra (Srikakulam to Krishna), short clear sentences a farmer with little schooling understands when read aloud. Avoid bookish Sanskrit words and passive voice.
- Use the glossary terms exactly, every time the idea appears.
- Keep product, chemical and bio-agent names in English letters (for example Pseudomonas fluorescens, Trichoderma viride, NSKE, Azadirachtin), and keep every number, dose and unit exactly as in English (you may write units in Telugu: గ్రాములు, మి.లీ., లీటరు, కిలో, ఎకరానికి, హెక్టారుకు).
- No em dashes.
Return only JSON of the form {"items": {"<key>": "<corrected Telugu>", ...}} with exactly the same keys."""

JUDGE_FIXES = """Corrections a Telugu-reading plant pathologist made to earlier drafts; follow them where the same English appears:
- "These spots grow into oval or round shapes that look like sesame seeds" -> "ఈ మచ్చలు పెద్దవై గుండ్రంగా లేదా కోలగా, నువ్వు గింజల్లా కనిపిస్తాయి" (never ఎగువ or దీర్ఘవృత్తాకార for oval).
- "Infected seeds may show black or brown spots covered in a velvety growth" -> "తెగులు సోకిన గింజలపై నల్లని లేదా గోధుమ రంగు మచ్చలు, వాటిపై మెత్తటి బూజు కనిపిస్తుంది".
- "Remove weeds and other plants that can host the fungus" -> "ఈ తెగులు శిలీంధ్రం ఆశ్రయించే కలుపు మొక్కలను తీసివేయండి" (host is never ఆతిథ్యం).
- "Ensure the field is well irrigated to prevent water stress" -> "పొలంలో నీరు ఎండిపోకుండా చూసుకోండి".
- "Pseudomonas fluorescens @ 10g/kg of seed followed by seedling dip ..." -> "Pseudomonas fluorescens: కిలో విత్తనానికి 10 గ్రాములు కలిపి విత్తన శుద్ధి చేయండి. నాటే ముందు నారు వేర్లను దాని ద్రావణంలో ముంచండి (హెక్టారుకు 2.5 కిలోలు 100 లీటర్ల నీటిలో)."
- bullseye pattern of rings -> "మచ్చల్లో గురి గుర్తులా ఒకదాని లోపల ఒకటి వలయాలు కనిపిస్తాయి" (never బుల్లసై).
- spots wrap around the stem near the soil (girdle) -> "నేల దగ్గర కాండం చుట్టూ మచ్చ ఏర్పడవచ్చు".
- "to stop the spread of spores" -> "తెగులు ఇంకా వ్యాపించకుండా" (never బీజాంశాలు).
- Early blight is ఆకుమాడు తెగులు, never ప్రారంభ తెగులు."""

def review():
    import anthropic
    kb = load_kb()
    u = units(kb)
    cache = json.load(open(DRAFT))
    glossary = json.load(open(os.path.join(APP, "data", "glossary_te.json")))["terms"]
    client = anthropic.Anthropic(api_key=env("ANTHROPIC_API_KEY"))
    calls_file = os.path.join(REVDIR, "_calls.json")
    calls = json.load(open(calls_file)) if os.path.exists(calls_file) else []
    crop_of = {d["id"]: d["crop"] for d in kb["diseases"]}
    for c in kb["crops"]:
        out = os.path.join(REVDIR, c["id"] + ".json")
        if os.path.exists(out):
            continue
        if len(calls) >= MAX_CLAUDE_CALLS:
            print("call cap reached"); break
        items = {k: {"en": v, "te": cache.get(v, "")} for k, v in u.items()
                 if (k.startswith("Q|") and k.split("|")[1] == c["id"]) or (not k.startswith("Q|") and crop_of[k.split("|")[0]] == c["id"])}
        names = {d["id"]: d["names"].get("te", "") for d in kb["diseases"] if d["crop"] == c["id"]}
        user = (f"Crop: {c['name_en']} ({c['names']['te']}).\nProblem names used in this crop: {json.dumps(names, ensure_ascii=False)}\n\n"
                f"Glossary:\n{json.dumps(glossary, ensure_ascii=False, indent=0)}\n\n{JUDGE_FIXES}\n\n"
                f"Items:\n{json.dumps(items, ensure_ascii=False, indent=0)}")
        t0 = time.time()
        with client.beta.messages.stream(
            model="claude-sonnet-5-5", max_tokens=64000, system=SYSTEM,
            output_config={"effort": "medium"},
            betas=["server-side-fallback-2026-07-01"], fallbacks="default",
            messages=[{"role": "user", "content": user}],
        ) as stream:
            msg = stream.get_final_message()
        calls.append({"crop": c["id"], "in": msg.usage.input_tokens, "out": msg.usage.output_tokens, "stop": msg.stop_reason, "secs": round(time.time() - t0)})
        json.dump(calls, open(calls_file, "w"), indent=1)
        if msg.stop_reason == "refusal":
            print(c["id"], "refused"); continue
        text = "".join(b.text for b in msg.content if b.type == "text")
        m = re.search(r"\{.*\}", text, re.S)
        res = json.loads(m.group(0))["items"]
        missing = [k for k in items if k not in res]
        print(c["id"], len(items), "items,", len(missing), "missing,", calls[-1])
        json.dump({"items": res, "missing": missing}, open(out, "w"), ensure_ascii=False, indent=0)

def leftovers():
    """One more Claude call for strings added after their crop was reviewed (for example the ETL lines)."""
    kb = load_kb()
    u = units(kb)
    reviewed = {}
    for f in os.listdir(REVDIR):
        if f.endswith(".json") and (not f.startswith("_") or f.startswith("_leftovers")):
            reviewed.update(json.load(open(os.path.join(REVDIR, f)))["items"])
    left = {k: v for k, v in u.items() if k not in reviewed}
    print(len(left), "strings not yet reviewed")
    if not left:
        return
    import anthropic
    cache = json.load(open(DRAFT))
    glossary = json.load(open(os.path.join(APP, "data", "glossary_te.json")))["terms"]
    calls_file = os.path.join(REVDIR, "_calls.json")
    calls = json.load(open(calls_file))
    if len(calls) >= MAX_CLAUDE_CALLS:
        print("call cap reached"); return
    items = {k: {"en": v, "te": cache.get(v, "")} for k, v in left.items()}
    client = anthropic.Anthropic(api_key=env("ANTHROPIC_API_KEY"))
    user = "Where the draft \"te\" is empty (the Sarvam quota ran out), translate the English yourself under the same rules.\n\n" + f"Glossary:\n{json.dumps(glossary, ensure_ascii=False, indent=0)}\n\n{JUDGE_FIXES}\n\nItems:\n{json.dumps(items, ensure_ascii=False, indent=0)}"
    t0 = time.time()
    with client.beta.messages.stream(model="claude-sonnet-5-5", max_tokens=64000, system=SYSTEM, output_config={"effort": "medium"},
                                     betas=["server-side-fallback-2026-07-01"], fallbacks="default",
                                     messages=[{"role": "user", "content": user}]) as stream:
        msg = stream.get_final_message()
    calls.append({"crop": "_leftovers", "in": msg.usage.input_tokens, "out": msg.usage.output_tokens, "stop": msg.stop_reason, "secs": round(time.time() - t0)})
    json.dump(calls, open(calls_file, "w"), indent=1)
    text = "".join(b.text for b in msg.content if b.type == "text")
    res = json.loads(re.search(r"\{.*\}", text, re.S).group(0))["items"]
    n = len([f for f in os.listdir(REVDIR) if f.startswith("_leftovers")])
    json.dump({"items": res, "missing": [k for k in items if k not in res]}, open(os.path.join(REVDIR, f"_leftovers{n}.json"), "w"), ensure_ascii=False, indent=0)
    print("leftovers reviewed", len(res))

# Hand fixes after reading the reviewed text (key -> Telugu).
TE_OVERRIDES = {
 "Q|paddy|q_paddy_gall_midge_paddy_stem_borer": "మధ్య మొవ్వు ఉల్లికాడలా, అంటే ఉల్లి ఆకు లాంటి తెల్లని బోలు గొట్టంగా మారిందా?",
 "paddy_gall_midge|symptoms|1": "ఉల్లికాడ: కొత్త ఆకు బదులు మొవ్వు నుండి ఉల్లి ఆకు లాంటి తెల్లని, బోలు గొట్టం బయటకు వస్తుంది.",
 "paddy_gall_midge|practices|3": "ఉల్లికాడల కోసం పొలాన్ని తరచూ గమనించండి. 10 శాతం పిలకల్లో ఉల్లికాడ కనిపిస్తే చర్య తీసుకోండి.",
 "groundnut_late_leaf_spot|prevention|0": "ప్రతి 3 వరుసల వేరుశనగకు 1 వరుస సజ్జ లేదా జొన్న వేయండి.",
 "chilli_yellow_mite|symptoms|2": "దెబ్బతిన్న ఆకులు ముదురు ఆకుపచ్చ రంగుకు మారవచ్చు.",
 "cotton_pink_bollworm|practices|5": "విత్తిన 45 రోజుల నుండి హెక్టారుకు 5 లింగాకర్షక బుట్టలు పెట్టి రెక్కల పురుగుల రాకను గమనించండి.",
 "cotton_pink_bollworm|practices|6": "60 రోజుల నుండి, ఎకరానికి వేర్వేరు మొక్కల నుండి 20 పచ్చి కాయలు కోసి, చీల్చి లోపల పురుగులు ఉన్నాయేమో చూడండి.",
 "cotton_pink_bollworm|avoid|0": "విత్తిన 120 రోజుల లోపు సింథటిక్ పైరిథ్రాయిడ్ మందులు పిచికారీ చేయకండి. ఎప్పుడూ రెండు మూడు పురుగు మందులు కలిపి కొట్టకండి. ఇలా చేస్తే తెల్లదోమ, పేనుబంక బాగా పెరుగుతాయి. 120 రోజుల తర్వాతే గులాబీ రంగు కాయతొలుచు పురుగుకు పైరిథ్రాయిడ్లు వాడవచ్చు.",
 "paddy_bph|etl|0": "ఒక్కో కుదురుకు 5 నుండి 10 సుడిదోమలు కనిపించినప్పుడు మాత్రమే పిచికారీ చేయండి. ప్రతి సంవత్సరం సుడిదోమ వచ్చే ప్రాంతాల్లో కుదురుకు 2 దోమలు ఉన్నా పిచికారీ చేయండి.",
}

def write():
    kb = load_kb()
    u = units(kb)
    cache = json.load(open(DRAFT))
    reviewed = {}
    for f in os.listdir(REVDIR):
        if f.endswith(".json") and (not f.startswith("_") or f.startswith("_leftovers")):
            reviewed.update(json.load(open(os.path.join(REVDIR, f)))["items"])
    def te(k):
        s = TE_OVERRIDES.get(k) or reviewed.get(k) or cache.get(u[k], "")
        return s.replace("—", ", ").strip()
    out = {"version": 1, "lang": "te", "about": "Telugu text for data/kb.json, keyed by disease id and field index. Sarvam draft, reviewed by Claude per crop with data/glossary_te.json.",
           "crops": {c["id"]: c["names"]["te"] for c in kb["crops"]}, "diseases": {}, "questions": {}}
    n_rev = 0
    for d in kb["diseases"]:
        i = d["id"]
        e = {"name": d["names"].get("te", "")}
        for f in FIELDS:
            e[f] = [te(f"{i}|{f}|{n}") for n in range(len(d[f]))]
        e["favourable_conditions"] = te(f"{i}|favourable_conditions|0") if d["favourable_conditions"] else ""
        e["organic_bio"] = [te(f"{i}|organic_bio|{n}") for n in range(len(d["organic_bio"]))]
        e["avoid"] = [te(f"{i}|avoid|{n}") for n in range(len(d.get("avoid", [])))]
        if d.get("etl"):
            e["etl"] = te(f"{i}|etl|0")
        out["diseases"][i] = e
    for k in u:
        if k.startswith("Q|"):
            out["questions"][k.split("|")[2]] = te(k)
    n_rev = sum(1 for k in u if k in reviewed)
    out["reviewed_share"] = round(n_rev / len(u), 3)
    json.dump(out, open(os.path.join(APP, "data", "kb_te.json"), "w"), ensure_ascii=False, indent=1)
    print("kb_te.json:", len(u), "strings,", n_rev, "reviewed by Claude")

if __name__ == "__main__":
    {"draft": draft, "review": review, "leftovers": leftovers, "write": write}[sys.argv[1]]()
