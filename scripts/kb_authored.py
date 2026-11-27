"""Hand-written parts of the KB: crop names, look-alikes and the yes/no questions that split them.

Every question asks about a sign that the cited source pages describe for one of the two problems
(for example blast spots are spindle-shaped with a grey centre on the TNAU blast page, brown spot
spots are round to oval on the TNAU brown spot page). Crop names are the standard names in each language.
"""

CROPS = {
 "paddy": ("Paddy", {"te": "వరి", "hi": "धान", "ta": "நெல்", "kn": "ಭತ್ತ", "mr": "भात", "bn": "ধান", "or": "ଧାନ", "gu": "ડાંગર", "pa": "ਝੋਨਾ", "ml": "നെല്ല്"}),
 "cotton": ("Cotton", {"te": "పత్తి", "hi": "कपास", "ta": "பருத்தி", "kn": "ಹತ್ತಿ", "mr": "कापूस", "bn": "তুলা", "or": "କପା", "gu": "કપાસ", "pa": "ਕਪਾਹ", "ml": "പരുത്തി"}),
 "chilli": ("Chilli", {"te": "మిరప", "hi": "मिर्च", "ta": "மிளகாய்", "kn": "ಮೆಣಸಿನಕಾಯಿ", "mr": "मिरची", "bn": "লঙ্কা", "or": "ଲଙ୍କା", "gu": "મરચાં", "pa": "ਮਿਰਚ", "ml": "മുളക്"}),
 "groundnut": ("Groundnut", {"te": "వేరుశనగ", "hi": "मूंगफली", "ta": "நிலக்கடலை", "kn": "ಶೇಂಗಾ", "mr": "भुईमूग", "bn": "চিনাবাদাম", "or": "ଚିନାବାଦାମ", "gu": "મગફળી", "pa": "ਮੂੰਗਫਲੀ", "ml": "നിലക്കടല"}),
 "maize": ("Maize", {"te": "మొక్కజొన్న", "hi": "मक्का", "ta": "மக்காச்சோளம்", "kn": "ಮೆಕ್ಕೆಜೋಳ", "mr": "मका", "bn": "ভুট্টা", "or": "ମକା", "gu": "મકાઈ", "pa": "ਮੱਕੀ", "ml": "ചോളം"}),
 "tomato": ("Tomato", {"te": "టమాట", "hi": "टमाटर", "ta": "தக்காளி", "kn": "ಟೊಮ್ಯಾಟೊ", "mr": "टोमॅटो", "bn": "টমেটো", "or": "ଟମାଟୋ", "gu": "ટામેટાં", "pa": "ਟਮਾਟਰ", "ml": "തക്കാളി"}),
 "brinjal": ("Brinjal", {"te": "వంకాయ", "hi": "बैंगन", "ta": "கத்தரி", "kn": "ಬದನೆ", "mr": "वांगी", "bn": "বেগুন", "or": "ବାଇଗଣ", "gu": "રીંગણ", "pa": "ਬੈਂਗਣ", "ml": "വഴുതന"}),
 "banana": ("Banana", {"te": "అరటి", "hi": "केला", "ta": "வாழை", "kn": "ಬಾಳೆ", "mr": "केळी", "bn": "কলা", "or": "କଦଳୀ", "gu": "કેળા", "pa": "ਕੇਲਾ", "ml": "വാഴ"}),
 "mango": ("Mango", {"te": "మామిడి", "hi": "आम", "ta": "மா", "kn": "ಮಾವು", "mr": "आंबा", "bn": "আম", "or": "ଆମ୍ବ", "gu": "કેરી", "pa": "ਅੰਬ", "ml": "മാവ്"}),
 "blackgram": ("Black gram", {"te": "మినుము", "hi": "उड़द", "ta": "உளுந்து", "kn": "ಉದ್ದು", "mr": "उडीद", "bn": "মাষকলাই", "or": "ବିରି", "gu": "અડદ", "pa": "ਮਾਂਹ", "ml": "ഉഴുന്ന്"}),
 "potato": ("Potato", {"te": "బంగాళదుంప", "hi": "आलू", "ta": "உருளைக்கிழங்கு", "kn": "ಆಲೂಗಡ್ಡೆ", "mr": "बटाटा", "bn": "আলু", "or": "ଆଳୁ", "gu": "બટાકા", "pa": "ਆਲੂ", "ml": "ഉരുളക്കിഴങ്ങ്"}),
 "onion": ("Onion", {"te": "ఉల్లి", "hi": "प्याज", "ta": "வெங்காயம்", "kn": "ಈರುಳ್ಳಿ", "mr": "कांदा", "bn": "পেঁয়াজ", "or": "ପିଆଜ", "gu": "ડુંગળી", "pa": "ਪਿਆਜ਼", "ml": "ഉള്ളി"}),
}

# (a, b, question): yes means a, no means b. Each pair also makes a and b look-alikes of each other.
PAIRS = [
 ("paddy_blast", "paddy_brown_spot", "Are the spots shaped like a spindle or an eye, pointed at both ends, with an ash-grey centre?"),
 ("paddy_brown_spot", "paddy_blast", "Are the spots small and round or oval, brown like sesame seeds, rather than long and pointed?"),
 ("paddy_blb", "paddy_brown_spot", "Does the yellowing start at the leaf tip and run down the leaf edges in a wavy band, without separate spots?"),
 ("paddy_bph", "paddy_stem_borer", "When you part the plants at the base, do you see many small brown insects near the water line?"),
 ("paddy_stem_borer", "paddy_bph", "Does the dried central shoot or white empty earhead pull out easily when you tug it?"),
 ("paddy_sheath_blight", "paddy_blast", "Are the spots on the leaf sheath near the water line, oval and greenish grey with a brown edge?"),
 ("cotton_bacterial_blight", "cotton_alternaria_leaf_spot", "Are the spots angular, held in by the leaf veins, first water-soaked and then turning black?"),
 ("cotton_alternaria_leaf_spot", "cotton_bacterial_blight", "Are the spots round and brown with rings inside them, like a target?"),
 ("cotton_grey_mildew", "cotton_bacterial_blight", "Is there a white or grey powdery growth on the underside of the spots?"),
 ("cotton_whitefly", "cotton_jassid", "When you shake the plant, do tiny white flies rise from the underside of the leaves, and are the leaves sticky or black with soot?"),
 ("cotton_jassid", "cotton_whitefly", "Do the leaf edges turn yellow and then red or bronze and curl downwards, with small pale green wedge-shaped insects under the leaves?"),
 ("chilli_cercospora_leaf_spot", "chilli_bacterial_leaf_spot", "Are the spots round with a light grey or white centre and a dark brown ring, like a frog's eye?"),
 ("chilli_bacterial_leaf_spot", "chilli_cercospora_leaf_spot", "Are the spots small, dark and water-soaked or raised and scabby, without a pale centre?"),
 ("chilli_thrips", "chilli_leaf_curl", "Do the leaves crinkle and curl upwards, with tiny thin straw-yellow insects on the young leaves?"),
 ("chilli_leaf_curl", "chilli_thrips", "Are the leaves small and curled towards the middle vein, with the plant stunted and its stem joints close together?"),
 ("groundnut_early_leaf_spot", "groundnut_late_leaf_spot", "Are the spots brown on the upper side of the leaf, with only a light brown colour underneath?"),
 ("groundnut_late_leaf_spot", "groundnut_early_leaf_spot", "Are the spots dark brown to black and rough on the underside of the leaf?"),
 ("groundnut_rust", "groundnut_late_leaf_spot", "Are there small raised bumps (pustules), mostly on the underside of the leaves, rather than flat spots?"),
 ("maize_turcicum_blight", "maize_maydis_blight", "Are the spots long and spindle or cigar shaped, greyish green to tan, starting on the lower leaves?"),
 ("maize_maydis_blight", "maize_turcicum_blight", "Are the spots small and diamond shaped at first, then a little longer, tan with a buff to brown border?"),
 ("maize_grey_leaf_spot", "maize_maydis_blight", "Are the spots narrow and rectangular, stopped by the veins on both sides, tan turning grey?"),
 ("maize_common_rust", "maize_turcicum_blight", "Are there small raised brown bumps (pustules) on both sides of the leaf?"),
 ("tomato_early_blight", "tomato_late_blight", "Do the brown spots have rings inside them like a target, mostly on the older lower leaves?"),
 ("tomato_late_blight", "tomato_early_blight", "Are there dark water-soaked patches that spread fast, with white fuzz on the underside in damp weather?"),
 ("tomato_septoria_leaf_spot", "tomato_early_blight", "Are there many small round spots with a grey centre and dark edge, without rings inside?"),
 ("tomato_bacterial_spot", "tomato_septoria_leaf_spot", "Are the spots small and brown with a yellow ring around them, and do green fruits have raised scabby spots?"),
 ("banana_panama_wilt", "banana_bunchy_top", "Do the older leaves turn yellow from the edges and hang down around the stem, and is the inside of the stem reddish brown when cut?"),
 ("banana_bunchy_top", "banana_panama_wilt", "Are the new leaves narrow, stiff and bunched at the top, with dark green streaks along the veins?"),
 ("mango_powdery_mildew", "mango_sooty_mould", "Is the coating white and powdery, on the flowers, young fruits and young leaves?"),
 ("mango_sooty_mould", "mango_powdery_mildew", "Is the coating black like soot, and does it peel off the leaf when you rub it?"),
 ("blackgram_yellow_mosaic", "blackgram_leaf_crinkle", "Are there bright yellow and green patches mixed on the leaves?"),
 ("blackgram_leaf_crinkle", "blackgram_yellow_mosaic", "Are the leaves larger than normal, thick, crinkled and puckered, without yellow patches?"),
 ("blackgram_cercospora_leaf_spot", "blackgram_rust", "Are the spots flat and round with a grey centre and a reddish brown edge?"),
 ("blackgram_rust", "blackgram_cercospora_leaf_spot", "Are there raised reddish brown pustules on the underside that leave powder when rubbed?"),
 ("potato_early_blight", "potato_late_blight", "Do the brown spots have rings inside them like a target, starting on the older leaves?"),
 ("potato_late_blight", "potato_early_blight", "Are there dark water-soaked patches that spread fast, with white growth on the underside in damp weather?"),
 ("potato_black_scurf", "potato_common_scab", "Are there black specks or crusts on the tuber skin, rather than rough corky pits?"),
 ("potato_common_scab", "potato_black_scurf", "Are there rough, corky, raised or pitted patches on the tuber skin?"),
 ("onion_purple_blotch", "onion_stemphylium_blight", "Do the spots have a purple centre with a yellow edge?"),
 ("onion_stemphylium_blight", "onion_purple_blotch", "Are the spots small, yellow to orange and long, mostly on one side of the leaf, without a purple centre?"),
 ("onion_downy_mildew", "onion_purple_blotch", "Are there pale, oval patches with a violet or grey furry growth in the morning dew?"),
]

# "Looks healthy" entries. Prevention and practices follow the "Principles of AESA based IPM"
# section that opens every NIPHM and DPPQS AESA package (grow a healthy crop, observe the field
# weekly, conserve natural enemies, act directly when needed).
_H_PREV = [
 "Choose a variety that resists or tolerates the main pests and diseases, and use healthy seed or planting material.",
 "Treat seed or planting material before sowing, preferably with a bio-pesticide.",
 "Keep proper spacing, give organic manure and fertiliser by soil test, and avoid too much nitrogen, which makes the crop soft and easy for pests and diseases to attack.",
 "Water the crop properly and rotate crops from season to season.",
]
_H_PRAC = [
 "Walk through the field at least once a week and look at the soil, water, plants, pests and the friendly insects that eat pests.",
 "Look after the friendly insects and spiders by avoiding broad-spectrum chemical sprays.",
 "Act early when you see trouble, for example by collecting egg masses or removing infested plants.",
]
_H_SYM = [
 "Leaves are evenly green for the variety, with no spots, streaks, rings or powdery coating.",
 "Leaf edges and tips are not curling, yellowing, drying or burnt.",
 "There are no insects, eggs, webbing, holes or bore marks on the leaves, stems or fruits.",
]
_H_CUES = ["evenly green leaf", "no spots or lesions", "no curling or yellowing", "no insects or holes"]
_AESA_FOR = {"paddy": "rice", "cotton": "cotton", "chilli": "chillies_capsicum", "groundnut": "groundnut", "maize": "maize",
 "tomato": "tomato", "brinjal": "brinjal", "banana": "banana", "mango": "mango", "blackgram": "blackgram_greengram",
 "potato": "potato", "onion": "onion"}
HEALTHY = {c: {"symptoms": _H_SYM, "photo_cues": _H_CUES, "prevention": _H_PREV, "practices": _H_PRAC, "aesa": a}
           for c, a in _AESA_FOR.items()}

# Hand corrections after reading each reviewed extract against its source page.
# drop_bio: remove organic items containing the text; drop: (field, text) removes list items;
# set / add: replace or extend a field with wording taken from the cited pages.
FIXES = {
 "cotton_alternaria_leaf_spot": {"set": {"prevention": [
   "Avoid dense planting, and keep wider spacing so the crop stays less humid.",
   "While preparing the field, remove crop residues and plough deep to bury the leftover plant parts.",
   "Pull out and burn weeds that carry the disease.",
   "Use acid-delinted seed so the disease does not come in with the seed."]}},
 "tomato_leaf_curl": {"drop": [("prevention", "imidacloprid")]},
 "tomato_late_blight": {"drop": [("photo_cues", "concentric"), ("photo_cues", "olivaceous"), ("practices", "weather forecasts")],
   "add": {"practices": ["Improve field drainage and avoid watering over the leaves."]}},
 "groundnut_early_leaf_spot": {"drop": [("practices", "join together")]},
 "groundnut_rust": {"set": {"practices": ["Check your field every week to see if rust is spreading.",
   "If a spray is needed, a second round can be given 15 days after the first."]}},
 "maize_turcicum_blight": {
   "drop": [("practices", "10-day intervals")],
   "add": {"prevention": ["Pull out and remove plants that are badly affected."],
           "practices": ["Pull out and destroy badly affected plants as soon as you see them."]}},
 "potato_early_blight": {"drop": [("photo_cues", "fruits")]},
 "onion_thrips": {"add": {"symptoms": ["The feeding marks show as white to silvery patches and streaks, and badly fed leaves take on a silvery look and wither.",
   "Tiny black tar-like spots of thrips droppings can be seen on badly damaged leaves."]},
   "drop": [("prevention", "Flood"), ("photo_cues", "insect")],
   "add_photo": [],
   "set": {"favourable_conditions": ""}},
 "maize_grey_leaf_spot": {"set": {
   "pathogen": "Cercospora zeae-maydis",
   "symptoms": ["Spots first show up on the lower leaves, about two to three weeks before the tassels come out.",
     "The spots are long and narrow, up to about 5 cm, rectangular and light tan in colour.",
     "Later the spots turn grey.",
     "The spots are held in by the leaf veins, and many spots can join together and kill whole leaves."],
   "photo_cues": ["narrow rectangular tan spots", "spots bounded by leaf veins", "grey lesions", "joined spots killing the leaf", "spots on lower leaves"],
   "favourable_conditions": "Warm weather (around 27 to 32 degrees Celsius) with very humid air, above 90 percent for 12 hours or more, favours it, and it is worse where maize follows maize.",
   "prevention": ["Grow a resistant hybrid where one is available.",
     "Rotate maize with other crops, because the fungus survives in old maize residue.",
     "Tilling in the old residue reduces how much of the fungus survives."],
   "practices": ["Look at the lower leaves first, because the spots start there and move upwards.",
     "After harvest, plough in old maize residue and avoid planting maize again in the same field next season."],
   "organic_bio": [], "_used_pages": [0]}},
 "paddy_blast": {"drop_bio": ["5-10 g/ha of seed"], "drop": [("practices", "crop rotation")]},
}

# Farmers' names for problems, only where a cited page gives them (filled from Vikaspedia Telugu pages).
NAMES = {}
