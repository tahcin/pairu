"""Fetch TNAU Agritech Portal crop protection pages for the KB.

agritech.tnau.ac.in does not answer from this network (TCP timeout), so we read
the Internet Archive's stored copies of the same pages. Each saved file keeps
the original URL and the archive timestamp in scripts/raw/kb/index.json.
Usage: python3 scripts/kb_fetch_tnau.py <cdx_listing.txt>
"""
import json, os, re, sys, time, urllib.request

RAW = os.path.join(os.path.dirname(__file__), "raw", "kb", "tnau")
os.makedirs(RAW, exist_ok=True)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
KEEP = re.compile(r"(rice|paddy|cotton|chilli|groundnut|ground%20nut|maize|tomato|brinjal|banana|mango|black_?gram|blackgram|greenblack|potato|onion)", re.I)
SKIP = re.compile(r"(\?|/$|sweet|nematod|biomarker|images|thump|chickpea|cowpea|greengram|redgram|soybean|gourd)", re.I)

idx_path = os.path.join(RAW, os.environ.get("IDX", "index.json"))
index = json.load(open(idx_path)) if os.path.exists(idx_path) else {}
seen = {}
for line in open(sys.argv[1]):
    parts = line.split()
    if len(parts) < 2:
        continue
    orig, ts = parts[0].replace(":80/", "/").replace("://www.", "://"), parts[1]
    if not KEEP.search(orig) or SKIP.search(orig):
        continue
    seen[orig] = ts
for orig, ts in sorted(seen.items(), reverse=bool(os.environ.get("REV"))):
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", orig.split("crop_protection/")[1])
    path = os.path.join(RAW, name)
    if os.path.exists(path):
        continue
    url = f"https://web.archive.org/web/{ts}id_/{orig}"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            data = urllib.request.urlopen(req, timeout=60).read()
            open(path, "wb").write(data)
            index[name] = {"original": orig.replace("http://", "https://"), "archive": f"https://web.archive.org/web/{ts}/{orig}"}
            print("ok", name, len(data))
            break
        except Exception as e:
            print("retry", name, e)
            time.sleep(5)
    time.sleep(1)
    json.dump(index, open(idx_path, "w"), indent=1)
json.dump(index, open(idx_path, "w"), indent=1)
