"""Turn saved TNAU pages into plain text files (scripts/raw/kb/text/) and list each page's heading."""
import html, json, os, re, sys

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw", "kb", "tnau")
OUT = os.path.join(os.path.dirname(RAW), "text")
os.makedirs(OUT, exist_ok=True)

def to_text(h):
    h = re.sub(r"(?is)<(script|style).*?</\1>", "", h)
    h = re.sub(r"(?is)<!--.*?-->", "", h)
    t = re.sub(r"(?s)<[^>]+>", "\n", h)
    t = html.unescape(t)
    t = re.sub(r"[ \t\r\xa0]+", " ", t)
    t = re.sub(r"\n\s*\n+", "\n", t)
    lines = [l.strip() for l in t.split("\n")]
    drop = {"Home", "|", "About Us", "Success Stories", "Farmers Association", "Farmers' Innovation", "Publications", "Contact", "Contact Us", ":"}
    lines = [l for l in lines if l and l not in drop]
    return "\n".join(lines)

summary = {}
for name in sorted(os.listdir(RAW)):
    if not name.endswith(".html"):
        continue
    raw = open(os.path.join(RAW, name), "rb").read().decode("utf-8", "ignore")
    t = to_text(raw)
    open(os.path.join(OUT, name[:-5] + ".txt"), "w").write(t)
    ls = t.split("\n")
    summary[name] = " / ".join(ls[1:4])[:160]
for k, v in summary.items():
    print(k, "::", v)
