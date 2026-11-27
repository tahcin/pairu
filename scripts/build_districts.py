"""Builds src/data/ap_districts.json: the 26 Andhra Pradesh districts with the latitude and
longitude of each district headquarters town, looked up with the Open-Meteo geocoding API
(https://open-meteo.com/en/docs/geocoding-api). Used by the spray-weather check when the
farmer does not share location. Run: python3 scripts/build_districts.py"""
import json, urllib.parse, urllib.request

# (district, headquarters town, Telugu name of the district)
DISTRICTS = [
    ("Srikakulam", "Srikakulam", "శ్రీకాకుళం"),
    ("Parvathipuram Manyam", "Parvatipuram", "పార్వతీపురం మన్యం"),
    ("Vizianagaram", "Vizianagaram", "విజయనగరం"),
    ("Visakhapatnam", "Visakhapatnam", "విశాఖపట్నం"),
    ("Alluri Sitharama Raju", "Paderu", "అల్లూరి సీతారామరాజు"),
    ("Anakapalli", "Anakapalle", "అనకాపల్లి"),
    ("Kakinada", "Kakinada", "కాకినాడ"),
    ("East Godavari", "Rajahmundry", "తూర్పు గోదావరి"),
    ("Dr. B.R. Ambedkar Konaseema", "Amalapuram", "డా. బి.ఆర్. అంబేద్కర్ కోనసీమ"),
    ("Eluru", "Eluru", "ఏలూరు"),
    ("West Godavari", "Bhimavaram", "పశ్చిమ గోదావరి"),
    ("NTR", "Vijayawada", "ఎన్టీఆర్"),
    ("Krishna", "Machilipatnam", "కృష్ణా"),
    ("Palnadu", "Narasaraopet", "పల్నాడు"),
    ("Guntur", "Guntur", "గుంటూరు"),
    ("Bapatla", "Bapatla", "బాపట్ల"),
    ("Prakasam", "Ongole", "ప్రకాశం"),
    ("Sri Potti Sriramulu Nellore", "Nellore", "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు"),
    ("Kurnool", "Kurnool", "కర్నూలు"),
    ("Nandyal", "Nandyal", "నంద్యాల"),
    ("Anantapur", "Anantapur", "అనంతపురం"),
    ("Sri Sathya Sai", "Puttaparthi", "శ్రీ సత్యసాయి"),
    ("YSR Kadapa", "Kadapa", "వైఎస్ఆర్ కడప"),
    ("Annamayya", "Rayachoti", "అన్నమయ్య"),
    ("Tirupati", "Tirupati", "తిరుపతి"),
    ("Chittoor", "Chittoor", "చిత్తూరు"),
]

out = []
for district, town, te in DISTRICTS:
    q = urllib.parse.urlencode({"name": town, "count": 10, "country": "IN", "language": "en"})
    data = json.load(urllib.request.urlopen(f"https://geocoding-api.open-meteo.com/v1/search?{q}"))
    hits = [r for r in data.get("results", []) if r.get("admin1") == "Andhra Pradesh"]
    if not hits:
        raise SystemExit(f"no Andhra Pradesh match for {town}")
    r = hits[0]
    out.append({"name": district, "te": te, "hq": town, "lat": round(r["latitude"], 3), "lon": round(r["longitude"], 3)})
    print(district, town, r["latitude"], r["longitude"], r.get("admin2"))

json.dump({"source": "Open-Meteo geocoding API, headquarters town of each district", "districts": out},
          open("src/data/ap_districts.json", "w"), ensure_ascii=False, indent=1)
