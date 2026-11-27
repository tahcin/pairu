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
 "cashew": ("Cashew", {"te": "జీడిమామిడి", "hi": "काजू", "ta": "முந்திரி", "kn": "ಗೋಡಂಬಿ", "mr": "काजू", "bn": "কাজু", "or": "କାଜୁ", "gu": "કાજુ", "pa": "ਕਾਜੂ", "ml": "കശുമാവ്"}),
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
 ("chilli_bacterial_leaf_spot", "chilli_cercospora_leaf_spot", "Are the spots small, dark brown to black and greasy, without a pale grey centre?"),
 ("chilli_thrips", "chilli_leaf_curl", "Do the leaves crinkle and curl upwards, with tiny thin straw-yellow insects on the young leaves?"),
 ("chilli_leaf_curl", "chilli_thrips", "Are the leaves small and curled towards the middle vein, with the plant stunted and its stem joints close together?"),
 ("groundnut_early_leaf_spot", "groundnut_late_leaf_spot", "Are the spots brown on the upper side of the leaf, with only a light brown colour underneath?"),
 ("groundnut_late_leaf_spot", "groundnut_early_leaf_spot", "Are the spots dark brown to black and rough on the underside of the leaf?"),
 ("groundnut_rust", "groundnut_late_leaf_spot", "Are there small raised bumps (pustules), mostly on the underside of the leaves, rather than flat spots?"),
 ("maize_turcicum_blight", "maize_maydis_blight", "Are the spots long and spindle or cigar shaped, greyish green to tan, starting on the lower leaves?"),
 ("maize_maydis_blight", "maize_turcicum_blight", "Are the spots small and diamond shaped at first, then a little longer, tan with a buff to brown border?"),
 ("maize_grey_leaf_spot", "maize_maydis_blight", "Are the spots narrow and rectangular, stopped by the veins on both sides, tan turning grey?"),
 ("maize_common_rust", "maize_turcicum_blight", "Are there small raised brown bumps (pustules) on both sides of the leaf?"),
 ("paddy_gall_midge", "paddy_stem_borer", "Is the central shoot turned into a hollow, silvery white tube like an onion leaf?"),
 ("chilli_yellow_mite", "chilli_thrips", "Do the leaves curl downwards like an upturned boat, with the edges rolled down and long leaf stalks?"),
 ("chilli_yellow_mite", "chilli_leaf_curl", "Do the leaves curl downwards with the edges rolled down, rather than small leaves bunched on a stunted plant?"),
 ("chilli_black_thrips", "chilli_thrips", "Are the flowers damaged, with brown streaks on the petals and flowers dropping, and is the underside of the leaves reddish brown?"),
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
 ("blackgram_cercospora_leaf_spot", "blackgram_rust", "Are the spots flat, with a pale brown centre and a reddish brown border, and no raised bumps?"),
 ("blackgram_rust", "blackgram_cercospora_leaf_spot", "Are there raised reddish brown pustules on the underside that leave powder when rubbed?"),
 ("potato_early_blight", "potato_late_blight", "Do the brown spots have rings inside them like a target, starting on the older leaves?"),
 ("potato_late_blight", "potato_early_blight", "Are there dark water-soaked patches that spread fast, with white growth on the underside in damp weather?"),
 ("potato_black_scurf", "potato_common_scab", "Are there black specks or crusts on the tuber skin, rather than rough corky pits?"),
 ("potato_common_scab", "potato_black_scurf", "Are there rough, corky, raised or pitted patches on the tuber skin?"),
 ("onion_purple_blotch", "onion_stemphylium_blight", "Do the spots have a purple centre with a yellow edge?"),
 ("onion_stemphylium_blight", "onion_purple_blotch", "Are the spots yellow to orange and long like a spindle, with a pinkish edge rather than a purple centre?"),
 ("onion_downy_mildew", "onion_purple_blotch", "Do the leaves turn pale green with a white cotton-like growth on them, without dark spots?"),
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
 "potato": "potato", "onion": "onion", "cashew": "cashewnut"}
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
 "maize_fall_armyworm": {"set": {"favourable_conditions": ""},
   "drop_bio": ["Dipel"]},
 "mango_powdery_mildew": {"set": {"prevention": [
   "Use resistant or tolerant varieties where you can.",
   "Give the orchard proper irrigation and drainage, as the AESA mango package advises for all its diseases.",
   "Watch the trees closely at flowering time, because rain or mist with cool nights then helps the disease spread."]}},
 "blackgram_rust": {"drop": [("symptoms", "pale brown center"), ("symptoms", "small, round spots"),
   ("photo_cues", "pale brown spot centers"), ("photo_cues", "reddish brown spot margins")]},
 "blackgram_cercospora_leaf_spot": {"drop": [("prevention", "bower")]},
 "blackgram_powdery_mildew": {"drop": [("prevention", "bower")], "drop_bio": ["Trichoderma"]},
 "brinjal_bacterial_wilt": {"drop_bio": ["Trichoderma"]},
 "blackgram_yellow_mosaic": {"drop_bio": ["Trichoderma"],
   "add": {"organic_bio": [{"text": "Yellow sticky traps at 4 to 5 per acre, 15 cm above the crop, to watch and catch the whiteflies that spread the virus", "page": 1},
                           {"text": "Neem oil at 5 ml per litre of water against the whitefly", "page": 1}],
           "practices": ["Pull out plants that show yellow patches early and destroy them, so whiteflies cannot carry the virus from them."]}},
 "chilli_leaf_curl": {"drop": [("prevention", "trisodium")]},
 "chilli_black_thrips": {"drop_bio": ["Sea weed"]},
 "paddy_blast": {"drop_bio": ["5-10 g/ha of seed"], "drop": [("practices", "crop rotation")]},
 "paddy_brown_spot": {"set": {"pathogen": "Bipolaris oryzae (Cochliobolus miyabeanus); older name Helminthosporium oryzae"}},
 "mango_hopper": {"drop": [("prevention", "smoke")]},
 "groundnut_bud_necrosis": {"drop": [("practices", "castor in a 3 to 6")],
   "add": {"practices": ["Grow one row of castor for every 3 to 6 rows of groundnut, which helps reduce the thrips that spread the virus."]}},
}

# Farmers' Telugu names for problems, only where a Vikaspedia Telugu page uses the name for that
# problem (page key -> scripts/raw/kb/vikaspedia_te/urls.txt). build_kb.py adds the page to sources.
NAMES = {
 "paddy_blast": ({"te": "అగ్గి తెగులు"}, "p24"),
 "paddy_blb": ({"te": "బ్యాక్టీరియా ఎండాకు తెగులు"}, "p12"),
 "paddy_sheath_blight": ({"te": "పాముపొడ తెగులు"}, "p12"),
 "paddy_bph": ({"te": "సుడిదోమ"}, "p24"),
 "paddy_stem_borer": ({"te": "కాండం తొలిచే పురుగు"}, "p24"),
 "paddy_brown_spot": ({"te": "గోధుమ మచ్చ తెగులు"}, "p1"),
 "cotton_bacterial_blight": ({"te": "నల్లమచ్చ తెగులు"}, "p31"),
 "cotton_grey_mildew": ({"te": "బూజు తెగులు"}, "p19"),
 "cotton_whitefly": ({"te": "తెల్లదోమ"}, "p19"),
 "cotton_jassid": ({"te": "పచ్చదోమ"}, "p19"),
 "cotton_pink_bollworm": ({"te": "గులాబి రంగు పురుగు"}, "p19"),
 "groundnut_early_leaf_spot": ({"te": "టిక్కా ఆకుమచ్చ"}, "p15"),
 "groundnut_late_leaf_spot": ({"te": "టిక్కా ఆకుమచ్చ"}, "p15"),
 "groundnut_rust": ({"te": "తుప్పు తెగులు"}, "p15"),
 "maize_fall_armyworm": ({"te": "కత్తెర పురుగు"}, "p3"),
 "tomato_early_blight": ({"te": "ఆకుమాడు తెగులు"}, "p21"),
 "brinjal_shoot_fruit_borer": ({"te": "కొమ్మ మరియు కాయ తొలుచు పురుగు"}, "p6"),
 "brinjal_little_leaf": ({"te": "వెర్రి తెగులు"}, "p18"),
 "brinjal_epilachna": ({"te": "అక్షింతల పురుగు"}, "p18"),
 "mango_hopper": ({"te": "తేనెమంచు పురుగు"}, "p25"),
 "blackgram_yellow_mosaic": ({"te": "పల్లాకు తెగులు"}, "p20"),
 "blackgram_powdery_mildew": ({"te": "బూడిద తెగులు"}, "p20"),
 "blackgram_rust": ({"te": "తుప్పు తెగులు"}, "p20"),
 "blackgram_pod_borer": ({"te": "మారుకా మచ్చల పురుగు"}, "p20"),
}

# Vikaspedia Telugu pages read on 27 Nov 2026 (rendered in a browser; the site is a JavaScript app).
TE_URLS = {'p7': 'https://te.vikaspedia.in/viewcontent/agriculture/పంట-సాగు-మరియు-యాజమాన్య-పద్ధతులు/పంటల-సాగు/పత్తిలో-రసంపీల్చే-పురుగుల-యాజమాన్యం-గుర్తింపు-నివారణ-చర్యలు?lgn=te',
 'p1': 'https://te.vikaspedia.in/viewcontent/agriculture/c35c4dc2fc35c38c3ec2f-c2ac02c1ac3ec02c17c02-1/c2ac02c1fc32-c35c3ec30c40c17c3e-c35c4dc2fc35c38c3ec2f-c2ac02c1ac3ec02c17c02/c2ac2ac4dc2ac41-c27c3ec28c4dc2fc3ec32c41/ఎల్-నినో-ప్రభావం-వరి-పంటలో-పురుగులు-తెగుళ్ల-సమగ్ర-యాజమాన్యం?lgn=te',
 'p11': 'https://te.vikaspedia.in/viewcontent/agriculture/పంట-సాగు-మరియు-యాజమాన్య-పద్ధతులు/పంటల-సాగు/వరి-సాగులో-చీడపీడల-నివారణ-మరియు-యాజమాన్య-పద్ధతులు?lgn=te',
 'p12': 'https://te.vikaspedia.in/viewcontent/agriculture/పంట-సాగు-మరియు-యాజమాన్య-పద్ధతులు/పంటల-సాగు/వానాకాలం-వరిలో-తొలిదశ-చీడపీడలు-యాజమాన్య-చర్యలు?lgn=te',
 'p24': 'https://te.vikaspedia.in/viewcontent/agriculture/crop-production/c35c30c3f-c35c30c3f-c32c4b-c30c3ec15c3ec32c41/వరిలో-చీడపీడల-నివారణ?lgn=te',
 'p32': 'https://te.vikaspedia.in/viewcontent/agriculture/best-practices/c2fc41c35-c30c24c41c32-c36c3fc15c4dc37c23c3e-c2ac3ec20c4dc2f-c2ac4dc30c23c3ec33c3fc15/c35c3fc35c3fc27-c2ac02c1fc32c32c4b-c09c24c4dc24c2e-c2fc3ec1cc2ec3ec28c4dc2f-c2ac26c4dc27c24c41c32c41-1/వరి?lgn=te',
 'p19': 'https://te.vikaspedia.in/viewcontent/agriculture/c1cc3fc32c4dc32c3ec32-c35c3ec30c3f-c38c2ec3ec1ac3ec30c02/c06c02c27c4dc30c2ac4dc30c26c47c36c4d-c32c4b-c35c4dc2fc35c38c3ec2f-c2ac02c1fc32c41/c2ac02c1fc32c41/ప్రత్తి?lgn=te',
 'p28': 'https://te.vikaspedia.in/viewcontent/agriculture/తరచుగా-అడుగు-ప్రశ్నలు/ప్రత్తి?lgn=te',
 'p31': 'https://te.vikaspedia.in/viewcontent/agriculture/best-practices/c2fc41c35-c30c24c41c32-c36c3fc15c4dc37c23c3e-c2ac3ec20c4dc2f-c2ac4dc30c23c3ec33c3fc15/c35c3fc35c3fc27-c2ac02c1fc32c32c4b-c09c24c4dc24c2e-c2fc3ec1cc2ec3ec28c4dc2f-c2ac26c4dc27c24c41c32c41-1/ప్రత్తి?lgn=te',
 'p20': 'https://te.vikaspedia.in/viewcontent/agriculture/c1cc3fc32c4dc32c3ec32-c35c3ec30c3f-c38c2ec3ec1ac3ec30c02/c06c02c27c4dc30c2ac4dc30c26c47c36c4d-c32c4b-c35c4dc2fc35c38c3ec2f-c2ac02c1fc32c41/c2ac02c1fc32c41/మినుము?lgn=te',
 'p18': 'https://te.vikaspedia.in/viewcontent/agriculture/c35c4dc2fc35c38c3ec2f-c2ac02c1ac3ec02c17c02-1/c2ac02c1fc32-c35c3ec30c40c17c3e-c35c4dc2fc35c38c3ec2f-c2ac02c1ac3ec02c17c02/c07c24c30-c35c3fc37c2fc3ec32c41/వంగలో-అశంచే-చిడపిడలు-–-వాటి-సస్యరక్షణ?lgn=te',
 'p6': 'https://te.vikaspedia.in/viewcontent/agriculture/పంట-సాగు-మరియు-యాజమాన్య-పద్ధతులు/పంటల-సాగు/వంగ-సాగులో-కొమ్మ-మరియు-కాయ-తొలుచు-పురుగు-యాజమాన్యం?lgn=te',
 'p3': 'https://te.vikaspedia.in/viewcontent/agriculture/పంట-సాగు-మరియు-యాజమాన్య-పద్ధతులు/పంటల-సాగు/మొక్కజొన్నలో-కత్తెర-పురుగు-నివారణ-మరియు-సమగ్ర-యాజమాన్యం?lgn=te',
 'p15': 'https://te.vikaspedia.in/viewcontent/agriculture/పంట-సాగు-మరియు-యాజమాన్య-పద్ధతులు/పంటల-సాగు/వేరుశనగ-సాగులో-సమగ్ర-సస్యరక్షణ-మరియు-యాజమాన్య-పద్ధతులు?lgn=te',
 'p22': 'https://te.vikaspedia.in/viewcontent/agriculture/best-practices/c2fc41c35-c30c24c41c32-c36c3fc15c4dc37c23c3e-c2ac3ec20c4dc2f-c2ac4dc30c23c3ec33c3fc15/c35c3fc35c3fc27-c2ac02c1fc32c32c4b-c09c24c4dc24c2e-c2fc3ec1cc2ec3ec28c4dc2f-c2ac26c4dc27c24c41c32c41-1/వేరుశనగ-ఆశించే-పురుగులు-మరియు-సస్యరక్షణ-చర్యలు?lgn=te',
 'p25': 'https://te.vikaspedia.in/viewcontent/agriculture/పంట-సాగు-మరియు-యాజమాన్య-పద్ధతులు/పంటల-సాగు/మామిడిలో-దిగుబడిని-తగ్గించే-ప్రధానమైన-పురుగులు-వాటి-యాజమాన్యం?lgn=te',
 'p21': 'https://te.vikaspedia.in/viewcontent/agriculture/c1cc3fc32c4dc32c3ec32-c35c3ec30c3f-c38c2ec3ec1ac3ec30c02/c06c02c27c4dc30c2ac4dc30c26c47c36c4d-c32c4b-c35c4dc2fc35c38c3ec2f-c2ac02c1fc32c41/c09c26c4dc2fc3ec28-c35c3ec28-c2ac02c1fc32c41/టమాట?lgn=te',
 'p14': 'https://te.vikaspedia.in/viewcontent/agriculture/ముఖ్యమైన-అంశాలు/కూరగాయల-పంటల్లో-వైరస్-తెగుళ్లు-సమగ్ర-యాజమాన్య-పద్ధతులు?lgn=te'}

# Exact sentences rewritten wherever they appear. Burning straw, stubble or crop waste in the field is
# what TNAU wrote years ago; current advice is to remove it or plough it in (see SOURCES.md).
REWRITE = {
 "Burn straw and stubble after harvest to remove the pathogen.": "After harvest, remove the straw and stubble from the field or plough them into the soil, instead of burning them.",
 "Deep plough the field in summer and burn the stubble.": "Plough deep in summer and remove the stubble or plough it in.",
 "Remove and burn all leftover plant parts from the field after harvest.": "After harvest, remove all leftover plant parts from the field or plough them in deep.",
 "Remove and burn all weeds and old plant parts from the field.": "Remove all weeds and old plant parts from the field.",
 "Collect and burn all old crop parts left in the field.": "Collect old crop parts left in the field and take them away or bury them.",
}

# Products or practices a cited page says to avoid. "actives" lets the app flag matching products.
PYRETHROIDS = ["cypermethrin", "alpha-cypermethrin", "beta-cypermethrin", "zeta-cypermethrin", "deltamethrin", "fenvalerate", "esfenvalerate",
               "lambda-cyhalothrin", "gamma-cyhalothrin", "bifenthrin", "fenpropathrin", "permethrin", "cyfluthrin", "beta-cyfluthrin",
               "fluvalinate", "tau-fluvalinate", "fluvalinate"]
AVOID = {
 "paddy_bph": [
   {"text": "Do not spray synthetic pyrethroids, methyl parathion, fenthion or quinalphos for hoppers: they make the hoppers come back in bigger numbers.",
    "file": "crop_prot_crop_insectpest_20_cereals_paddy.txt", "actives": PYRETHROIDS + ["methyl parathion", "fenthion", "quinalphos"]},
   {"text": "Do not mix two insecticides in one tank, and do not use the same insecticide again and again.", "file": "extra:ppqs_rice_bph", "actives": []},
   {"text": "Do not burn an infested crop: it drives the hoppers into nearby fields.", "file": "extra:ppqs_rice_bph", "actives": []}],
 "cotton_whitefly": [
   {"text": "Avoid synthetic pyrethroids such as cypermethrin, deltamethrin and fenvalerate, and also acephate and acetamiprid, because they make whitefly come back worse.",
    "file": "extra:ppqs_cotton_whitefly", "actives": PYRETHROIDS + ["acephate", "acetamiprid"]}],
 "cotton_jassid": [
   {"text": "Avoid pyrethroids against sucking pests: they lead to a resurgence of these pests.", "file": "aesa:cotton", "actives": PYRETHROIDS}],
}

# recommended_actives overrides after reading the package text (kb_recommended.py output is noisy).
REC_SET = {
 "paddy_bph": ["ethiprole", "imidacloprid", "clothianidin", "dinotefuran", "flonicamid", "pymetrozine", "thiamethoxam", "triflumezopyrim", "buprofezin"],
}
REC_DROP = {
 "cotton_whitefly": ["acephate", "acetamiprid", "cypermethrin"],
 "cotton_jassid": [],
 "groundnut_early_leaf_spot": ["imidacloprid"], "groundnut_late_leaf_spot": ["imidacloprid"], "groundnut_rust": ["imidacloprid"],
 "chilli_thrips": ["hexythiazox", "propargite", "fenpyroximate", "chlorfenapyr", "spiromesifen", "carbofuran", "indoxacarb", "flubendiamide", "ethion"],
 "paddy_blast": ["pseudomonas fluorescens"],
 "cotton_pink_bollworm": ["cypermethrin"],
 "mango_hopper": ["deltamethrin"],
}
BIO_ACTIVES = {"pseudomonas fluorescens", "metarhizium anisopliae", "verticillium lecanii", "beauveria bassiana", "trichoderma viride",
               "trichoderma harzianum", "bacillus thuringiensis", "azadirachtin"}

# Telugu farmer names. "src" is a Vikaspedia page key (TE_URLS) or "descriptive" when no page we read
# gives the name: then it is the plain descriptive name a coastal Andhra farmer would use, mostly as
# suggested by the agriculture reviewer (judge2-agri.md), and marked names_source "descriptive".
TE = {
 "paddy_blast": ("అగ్గి తెగులు", "p24"), "paddy_brown_spot": ("గోధుమ రంగు ఆకుమచ్చ తెగులు", "descriptive"),
 "paddy_blb": ("బ్యాక్టీరియా ఎండాకు తెగులు", "p12"), "paddy_sheath_blight": ("పాముపొడ తెగులు", "p12"),
 "paddy_bph": ("సుడిదోమ", "p24"), "paddy_stem_borer": ("కాండం తొలిచే పురుగు", "p24"),
 "paddy_leaf_folder": ("ఆకుముడత పురుగు", "p11"), "paddy_gall_midge": ("ఉల్లికోడు", "p24"), "paddy_false_smut": ("మానిపండు తెగులు", "p32"),
 "cotton_bacterial_blight": ("నల్లమచ్చ తెగులు", "p31"), "cotton_alternaria_leaf_spot": ("ఆల్టర్నేరియా ఆకుమచ్చ తెగులు", "descriptive"),
 "cotton_grey_mildew": ("బూడిద రంగు బూజు తెగులు", "descriptive"), "cotton_pink_bollworm": ("గులాబీ రంగు కాయతొలుచు పురుగు", "descriptive"),
 "cotton_whitefly": ("తెల్లదోమ", "p19"), "cotton_jassid": ("పచ్చదోమ", "p19"),
 "chilli_fruit_rot_dieback": ("కాయకుళ్ళు, కొమ్మ ఎండు తెగులు", "descriptive"), "chilli_powdery_mildew": ("బూడిద తెగులు", "p20"),
 "chilli_leaf_curl": ("ఆకుముడత (జెమిని వైరస్) తెగులు", "descriptive"), "chilli_cercospora_leaf_spot": ("కప్పకన్ను ఆకుమచ్చ తెగులు", "descriptive"),
 "chilli_bacterial_leaf_spot": ("బాక్టీరియా ఆకుమచ్చ తెగులు", "descriptive"), "chilli_thrips": ("తామర పురుగు (పై ముడత)", "descriptive"),
 "chilli_black_thrips": ("నల్ల తామర పురుగు", "descriptive"), "chilli_yellow_mite": ("పసుపు నల్లి (కింది ముడత)", "descriptive"),
 "groundnut_early_leaf_spot": ("టిక్కా ఆకుమచ్చ (ముందు వచ్చే)", "p15"), "groundnut_late_leaf_spot": ("టిక్కా ఆకుమచ్చ (ఆలస్యంగా వచ్చే)", "p15"),
 "groundnut_rust": ("తుప్పు తెగులు", "p15"), "groundnut_bud_necrosis": ("మొవ్వు కుళ్ళు తెగులు", "descriptive"),
 "groundnut_leaf_miner": ("ఆకుముడత పురుగు", "descriptive"),
 "maize_common_rust": ("తుప్పు తెగులు", "descriptive"), "maize_turcicum_blight": ("ఆకు ఎండు తెగులు (టర్సికం)", "descriptive"),
 "maize_maydis_blight": ("ఆకు ఎండు తెగులు (మేడిస్)", "descriptive"), "maize_grey_leaf_spot": ("బూడిద రంగు ఆకుమచ్చ తెగులు", "descriptive"),
 "maize_downy_mildew": ("బూజు తెగులు", "descriptive"), "maize_fall_armyworm": ("కత్తెర పురుగు", "p3"),
 "tomato_early_blight": ("ఆకుమాడు తెగులు", "p21"), "tomato_late_blight": ("ఆలస్యపు ఆకుమాడు తెగులు", "descriptive"),
 "tomato_leaf_curl": ("ఆకుముడత తెగులు", "p14"), "tomato_septoria_leaf_spot": ("సెప్టోరియా ఆకుమచ్చ తెగులు", "descriptive"),
 "tomato_bacterial_spot": ("బాక్టీరియా ఆకుమచ్చ తెగులు", "descriptive"), "tomato_fruit_borer": ("శనగ పచ్చ పురుగు (కాయ తొలుచు పురుగు)", "p21"),
 "brinjal_shoot_fruit_borer": ("కొమ్మ మరియు కాయ తొలుచు పురుగు", "p6"), "brinjal_little_leaf": ("వెర్రి తెగులు", "p18"),
 "brinjal_phomopsis_blight": ("కాయకుళ్ళు తెగులు (ఫోమోప్సిస్)", "descriptive"), "brinjal_bacterial_wilt": ("బాక్టీరియా ఎండు తెగులు", "p18"),
 "brinjal_epilachna": ("అక్షింతల పురుగు", "p18"),
 "banana_panama_wilt": ("పనామా ఎండు తెగులు", "descriptive"), "banana_sigatoka": ("సిగటోకా ఆకుమచ్చ తెగులు", "descriptive"),
 "banana_bunchy_top": ("కుచ్చు తెగులు (బంచీ టాప్)", "descriptive"), "banana_anthracnose": ("కాయ కుళ్ళు (ఆంత్రాక్నోస్)", "descriptive"),
 "banana_rhizome_weevil": ("దుంప ముక్కు పురుగు", "descriptive"),
 "mango_powdery_mildew": ("బూడిద తెగులు", "descriptive"), "mango_anthracnose": ("ఆంత్రాక్నోస్ (నల్ల మచ్చ తెగులు)", "descriptive"),
 "mango_hopper": ("తేనెమంచు పురుగు", "p25"), "mango_fruit_fly": ("పండు ఈగ", "descriptive"), "mango_sooty_mould": ("మసి తెగులు", "p7"),
 "blackgram_yellow_mosaic": ("పల్లాకు తెగులు", "p20"), "blackgram_powdery_mildew": ("బూడిద తెగులు", "p20"),
 "blackgram_cercospora_leaf_spot": ("సెర్కోస్పోరా ఆకుమచ్చ తెగులు", "descriptive"), "blackgram_leaf_crinkle": ("ఆకు ముడత తెగులు", "descriptive"),
 "blackgram_rust": ("తుప్పు తెగులు", "p20"), "blackgram_pod_borer": ("మారుకా మచ్చల పురుగు", "p20"),
 "potato_early_blight": ("ఆకుమాడు తెగులు", "p21"), "potato_late_blight": ("ఆలస్యపు ఆకుమాడు తెగులు", "descriptive"),
 "potato_black_scurf": ("నల్ల మచ్చ తెగులు (బ్లాక్ స్కర్ఫ్)", "descriptive"), "potato_bacterial_wilt": ("బాక్టీరియా ఎండు తెగులు", "p18"),
 "potato_common_scab": ("గజ్జి తెగులు", "descriptive"),
 "onion_purple_blotch": ("ఊదా మచ్చ తెగులు", "descriptive"), "onion_stemphylium_blight": ("ఆకు ఎండు తెగులు (స్టెంఫీలియం)", "descriptive"),
 "onion_downy_mildew": ("బూజు తెగులు", "descriptive"), "onion_thrips": ("తామర పురుగు", "p22"), "onion_basal_rot": ("అడుగు కుళ్ళు తెగులు", "descriptive"),
}

# "Should I spray yet?": the Economic Threshold Level as the cited page states it, in plain words.
# AESA and DPPQS first; the TNAU page for that pest where neither gives one. Left out when no page gives one.
ETL = {
 "paddy_bph": ("Spray only when you count 5 to 10 hoppers per hill, or 2 per hill where brown plant hopper comes every year.", "extra:ppqs_rice_bph"),
 "paddy_stem_borer": ("In the nursery, 1 egg mass per square metre. From tillering, 2 egg masses per square metre, or 10% dead hearts, or 1 moth per square metre, or 25 moths per trap in a week.", "aesa:rice"),
 "paddy_leaf_folder": ("2 fully damaged leaves with a caterpillar inside per hill.", "aesa:rice"),
 "paddy_gall_midge": ("1 gall per square metre, or 10% silver shoots.", "aesa:rice"),
 "paddy_blast": ("Leaf blast: 3 to 5 spots per leaf. Neck blast: 2 to 5 plants with infected necks per square metre.", "aesa:rice"),
 "paddy_brown_spot": ("2 to 3 spots per leaf and 2 to 3 infected plants per square metre.", "aesa:rice"),
 "paddy_sheath_blight": ("Spots 5 to 6 mm long and 2 to 3 infected plants per square metre.", "aesa:rice"),
 "paddy_blb": ("2 to 3 infected leaves per square metre (in the nursery, 2 to 3 wilting plants per square metre).", "aesa:rice"),
 "cotton_jassid": ("More than 2 leafhoppers per leaf, with a few lower leaves crinkled and curled and their edges turning yellow.", "aesa:cotton"),
 "cotton_whitefly": ("6 adult whiteflies per leaf in the upper part of the plant before 10 in the morning, or more than 10 in the middle of the plant on more than half the plants. A smoky cloud of flies rises when you shake the plant gently.", "extra:ppqs_cotton_whitefly"),
 "cotton_pink_bollworm": ("10% damaged (rosette) flowers, or 10% damaged green bolls (2 out of 20 bolls with white or pink larvae or exit holes), or 8 moths per pheromone trap per night for 3 nights in a row.", "extra:ppqs_cotton_pbw"),
 "groundnut_leaf_miner": ("2 to 3 caterpillars per plant.", "aesa:groundnut"),
 "groundnut_bud_necrosis": ("For the thrips that spread this virus: 5 adult thrips per terminal bud.", "aesa:groundnut"),
 "maize_fall_armyworm": ("From seedling to mid-whorl stage, act when about 10% of plants are damaged (for example 2 out of 20 plants checked on a W-shaped walk). After mid-whorl, the same level does not call for a spray.", "extra:vikaspedia_faw"),
 "maize_downy_mildew": ("10% of plants affected.", "aesa:maize"),
 "maize_turcicum_blight": ("10% of plants affected by leaf blight.", "aesa:maize"),
 "maize_maydis_blight": ("10% of plants affected by leaf blight.", "aesa:maize"),
 "tomato_fruit_borer": ("10% fruit damage.", "tomato_tomato_1.txt"),
 "blackgram_pod_borer": ("3 caterpillars per plant.", "greenblack_crop_prot_crop_insect_pul_bla_and_20green_2.txt"),
}
REC_SET["maize_fall_armyworm"] = ["emamectin benzoate", "spinosad", "chlorantraniliprole"]

# Pink bollworm (round 3): ICAR-CICR "Strategies and advisory for cotton pest and disease management 2024-25"
# names profenofos, emamectin benzoate, indoxacarb or chlorpyrifos 20 EC (single product) at 60 to 120 days, and pyrethroids
# only after 120 days. Indoxacarb is not registered for pink bollworm in the CIB&RC list, so it is left out.
REC_FILE = {"cotton_pink_bollworm": "extra:cicr_2024"}
REC_SET["cotton_pink_bollworm"] = ["emamectin benzoate", "profenofos"]
AVOID["cotton_pink_bollworm"] = [
 {"text": "Do not spray pyrethroids before 120 days after sowing, and never spray insecticide mixtures, to prevent whitefly and aphid outbreaks. Pyrethroids are kept for pink bollworm after 120 days.",
  "file": "extra:cicr_2024", "actives": PYRETHROIDS}]
FIXES_ADD_PRACTICES = {"cotton_pink_bollworm": ["Put up pheromone traps at 5 per hectare from 45 days after sowing to watch the moths.",
                                                "From 60 days, pluck 20 green bolls per acre from different plants and split them open to look for larvae."]}

REWRITE.update({
 "Plant groundnut with pearl millet or sorghum in a 1 to 3 ratio.": "Grow 1 row of pearl millet or sorghum for every 3 rows of groundnut.",
 "You may see a silvery white tube called a silver shoot.": "Instead of a new leaf, the centre of the tiller comes out as a pale, hollow tube like an onion leaf (silver shoot).",
})

FIXES.update({
 "cashew_tea_mosquito_bug": {"set": {
   "symptoms": ["Young and adult bugs suck sap from tender leaves, young shoots, flower clusters, young nuts and apples.",
     "A gummy, resin-like liquid oozes from the feeding marks.",
     "The feeding spots turn pinkish brown within a day and black in 2 to 3 days, forming black scabs.",
     "Tender leaves crinkle, and shoots show long black streaks and may die back.",
     "Attacked flower clusters turn black and die, young nuts drop, and badly hit trees look scorched."],
   "photo_cues": ["black streaks on tender shoots", "pinkish brown to black feeding spots", "blackened flower clusters", "gum drops on feeding marks", "reddish brown ant-like bug with black head"],
   "prevention": ["Remove other plants the bug lives on, such as neem, guava, cocoa, drumstick and cotton, from in and around the plantation.",
     "Pull out self-sown neem seedlings in and around the cashew garden.",
     "Do not grow cotton or other host crops between cashew trees.",
     "When the bug breaks out, manage it together with neighbouring farmers, because one farmer alone cannot control it."],
   "practices": ["Check five twigs per tree and count the young and adult bugs, mostly in the early morning when they feed.",
     "Watch new flushes and flower clusters closely from flushing to fruit set."]}},
 "cashew_thrips": {"set": {
   "symptoms": ["Young and adult thrips live in groups on the underside of leaves and suck sap from leaves, flower clusters, apples and nuts.",
     "Leaves turn pale brown and crinkle, with a rough upper surface.",
     "Scabs and corky layers form on flower stalks, apples and nuts.",
     "Flowers and young fruits drop and nuts are misshapen; in bad cases leaves fall and trees stop growing."],
   "photo_cues": ["pale brown crinkled leaves", "corky scab on nuts and apples", "scabby flower stalks", "tiny insects under leaves", "greenish yellow nymphs with red bands"],
   "favourable_conditions": "Foliage thrips build up in the dry season from December to a peak in April and May, and fall in the rains; flushes after the monsoon are attacked most."}},
 "cashew_stem_root_borer": {"set": {
   "prevention": ["Remove dead trees and trees with advanced attack at least once every 6 months.",
     "Do not wound trunks with sickles or other tools, because wounds attract the beetle to lay eggs.",
     "Keep the plantation clean and look closely at trees older than two years."],
   "practices": ["Look for gum and powdery waste coming out of small holes at the base of the trunk.",
     "Chisel out the damaged bark at a live hole and remove the grubs.",
     "After removing the grubs, swab the trunk up to 1 metre high with neem oil (50 ml neem oil in 1 litre water with 0.5 ml teepol or 5 g soap)."],
   "organic_bio": [{"text": "Neem oil swab on the trunk up to 1 metre after removing grubs: 50 ml neem oil + 1 litre water + 0.5 ml teepol or 5 g soap", "page": 0}]}},
 "cashew_dieback": {"drop": [("prevention", "Keep the disease out of new farms")],
   "add": {"prevention": ["Take every care not to bring the disease into newly planted gardens."]}},
})
PAIRS += [
 ("cashew_tea_mosquito_bug", "cashew_inflorescence_blight", "Do you see black streaks or black spots on tender shoots and leaves too, or small reddish brown bugs, and not only on the flower clusters?"),
 ("cashew_inflorescence_blight", "cashew_anthracnose", "Are the spots mostly on the flower stalks, starting small and water-soaked and then turning pinkish brown and scabby?"),
 ("cashew_dieback", "cashew_anthracnose", "Is there a white or pink growth or silky threads on the dying branches?"),
]
TE.update({
 "cashew_tea_mosquito_bug": ("టీ దోమ", "descriptive"),
 "cashew_stem_root_borer": ("కాండం, వేరు తొలిచే పురుగు", "descriptive"),
 "cashew_thrips": ("తామర పురుగు", "descriptive"),
 "cashew_anthracnose": ("ఆంత్రాక్నోస్ (ఆకుమచ్చ తెగులు)", "descriptive"),
 "cashew_inflorescence_blight": ("పూత ఎండు తెగులు", "descriptive"),
 "cashew_dieback": ("కొమ్మ ఎండు తెగులు (పింక్ తెగులు)", "descriptive"),
})

# "Do this first": the single most important first step, taken from the entry's own cited pages.
# Never a chemical product. Kinds: cultural | rogue | bio | chemical | next_season.
FIRST = {
 "paddy_blast": ("Count first: look for 3 to 5 spindle-shaped spots per leaf. Hold back extra urea until the disease is under control.", "cultural", "aesa:rice"),
 "paddy_brown_spot": ("Make sure the field does not dry out, and feed the crop well; for the next crop, use disease-free seed treated with Pseudomonas fluorescens.", "cultural", "rice_diseases_rice_2.txt"),
 "paddy_blb": ("Do not let water flow from this field into healthy fields, and hold back extra nitrogen. Count first: act at 2 to 3 infected leaves per square metre.", "cultural", "rice_diseases_rice_3.txt"),
 "paddy_sheath_blight": ("Let the field dry between waterings instead of keeping it flooded, and hold back extra nitrogen.", "cultural", "rice_diseases_rice_6.txt"),
 "paddy_bph": ("Count first: tap the base of 10 hills and count the hoppers. Spray only at 5 to 10 per hill. If many, drain the field for 3 to 4 days.", "cultural", "extra:ppqs_rice_bph"),
 "paddy_leaf_folder": ("Count first: act only at 2 fully damaged leaves with a caterpillar per hill. Keep bunds clean and hold back extra nitrogen.", "cultural", "aesa:rice"),
 "paddy_gall_midge": ("Count first: act at 10% silver shoots. Drain the field for 5 to 7 days.", "cultural", "rice_crop_prot_crop_insectpest_20_cereals_paddy_m2.txt"),
 "paddy_false_smut": ("Remove and destroy plants with smut balls before harvest so the fungus does not fall into the soil; next season, plant early and use clean seed.", "cultural", "rice_diseases_rice_7.txt"),
 "paddy_stem_borer": ("Count first: 1 egg mass per square metre or 10% dead hearts. Collect and destroy egg masses and pull out dead hearts.", "cultural", "aesa:rice"),
 "cotton_bacterial_blight": ("Pull out and destroy badly affected plants and crop waste; for the next crop, use acid-delinted seed.", "cultural", "cotton_diseases_cotton_d9.txt"),
 "cotton_alternaria_leaf_spot": ("Remove and destroy infected leaves and crop waste, and avoid dense planting.", "cultural", "aesa:cotton"),
 "cotton_grey_mildew": ("Remove and destroy infected leaves, and hold back extra nitrogen.", "cultural", "cotton_diseases_cotton_d4.txt"),
 "cotton_pink_bollworm": ("Count first: split 20 green bolls per acre and check pheromone traps. Act only at 10% damaged bolls or flowers, or 8 moths per trap for 3 nights. Pluck and destroy rosette flowers.", "cultural", "extra:cicr_2024"),
 "cotton_whitefly": ("Count first: 6 adults per leaf in the upper canopy before 10 am. Put up yellow sticky traps and remove weeds that host the whitefly.", "cultural", "extra:ppqs_cotton_whitefly"),
 "cotton_jassid": ("Count first: act at more than 2 leafhoppers per leaf with lower leaves curling. Neem seed kernel extract (NSKE) 5% is the first spray to try.", "bio", "aesa:cotton"),
 "chilli_fruit_rot_dieback": ("Cut off and destroy dying twigs and rotten fruits, and keep water from standing in the field.", "cultural", "chilli_diseases_2.txt"),
 "chilli_powdery_mildew": ("Remove and destroy badly affected leaves; next season, plant a tolerant variety at the right time.", "cultural", "chilli_diseases_3.txt"),
 "chilli_leaf_curl": ("Pull out and destroy curled plants as soon as you see them, and control whiteflies so the virus does not spread.", "rogue", "chilli_diseases_7.txt"),
 "chilli_cercospora_leaf_spot": ("Remove and destroy spotted leaves; for the next crop, save seed only from healthy fruits.", "cultural", "chilli_diseases_5.txt"),
 "chilli_bacterial_leaf_spot": ("Remove and destroy spotted leaves; for the next crop, use seed from healthy plants.", "cultural", "chilli_diseases_4.txt"),
 "chilli_black_thrips": ("Put up blue sticky traps and check the flowers and the underside of leaves. Pull out and destroy badly infested plants and remove weeds.", "cultural", "extra:ppqs_thrips_parvispinus_core"),
 "chilli_yellow_mite": ("Check young leaves for downward curling. Neem seed powder extract 4% is the first spray to try while the attack is low.", "bio", "aesa:chillies_capsicum"),
 "chilli_thrips": ("Count first: check five top leaves per plant for thrips. Put up blue or yellow sticky traps at 4 to 5 per acre.", "cultural", "crop_prot_crop_insect-veg_chillies_pest_disease.txt"),
 "groundnut_early_leaf_spot": ("Remove and destroy spotted leaves; next season, rotate groundnut with cereals and choose a tolerant variety.", "cultural", "groundnut_diseases_groundnut_d1.txt"),
 "groundnut_late_leaf_spot": ("Remove volunteer groundnut plants and crop waste; next season, grow 1 row of pearl millet or sorghum for every 3 rows of groundnut.", "cultural", "groundnut_diseases_groundnut_d2.txt"),
 "groundnut_rust": ("Check every week; next season, grow a rust-resistant variety and rotate the crop.", "cultural", "groundnut_diseases_groundnut_d3.txt"),
 "groundnut_bud_necrosis": ("Pull out and destroy infected plants up to 6 weeks after sowing. The virus is spread by thrips; next season sow early with close spacing.", "rogue", "groundnut_diseases_groundnut_d5.txt"),
 "groundnut_leaf_miner": ("Count first: act at 2 to 3 caterpillars per plant. Set up light traps for the moths.", "cultural", "aesa:groundnut"),
 "maize_common_rust": ("Remove the weed Oxalis, which carries the rust, from in and around the field; next season, grow a resistant hybrid.", "cultural", "maize_disease_new_maize_4.txt"),
 "maize_turcicum_blight": ("Count first: act at 10% of plants with leaf blight. Pull out and destroy badly affected plants.", "cultural", "aesa:maize"),
 "maize_maydis_blight": ("Count first: act at 10% of plants with leaf blight. Pull out and destroy badly affected plants.", "cultural", "aesa:maize"),
 "maize_grey_leaf_spot": ("Look at the lower leaves first; after harvest, plough in old maize residue and do not plant maize again in the same field next season.", "next_season", "extra:cpn_gls"),
 "maize_downy_mildew": ("Pull out and destroy plants with downy mildew as soon as you see them, and do not plant maize next to sorghum.", "rogue", "maize_disease_maize_1.txt"),
 "maize_fall_armyworm": ("Count first: walk the field in a W pattern; act at 10% damaged plants up to mid-whorl. Put sand mixed with lime or ash into the whorl.", "cultural", "extra:vikaspedia_faw"),
 "tomato_early_blight": ("Remove and destroy the lower spotted leaves and old crop waste; next season, rotate the crop and move the nursery.", "cultural", "tomato_diseases_2.txt"),
 "tomato_late_blight": ("Remove and destroy infected leaves and fruits at once, stake the plants for air flow and avoid watering over the leaves.", "cultural", "extra:iihr_tomato_lb"),
 "tomato_leaf_curl": ("Pull out and destroy curled plants early, and control whiteflies with yellow sticky traps; next season, raise seedlings under fine net.", "rogue", "tomato_diseases_8.txt"),
 "tomato_septoria_leaf_spot": ("Remove and destroy the lower spotted leaves and keep the field clean.", "cultural", "tomato_diseases_4.txt"),
 "tomato_bacterial_spot": ("Remove and destroy spotted leaves and fruits; next season, use disease-free seed and seedlings and rotate the crop.", "cultural", "tomato_diseases_6.txt"),
 "tomato_fruit_borer": ("Count first: act at 10% fruit damage. Pick and destroy bored fruits and big caterpillars, and set up pheromone traps.", "cultural", "tomato_tomato_1.txt"),
 "brinjal_shoot_fruit_borer": ("Cut off and destroy wilted shoots and bored fruits every week, and set up pheromone traps.", "cultural", "brinjal_brinjal_1.txt"),
 "brinjal_little_leaf": ("Pull out and destroy plants with little leaves at once; the disease is spread by leafhoppers.", "rogue", "brinjal_brinjal_6.txt"),
 "brinjal_phomopsis_blight": ("Remove and destroy spotted fruits and leaves; for the next crop, save seed from healthy fruits and treat it with hot water.", "cultural", "brinjal_phdiseases_2.txt"),
 "brinjal_bacterial_wilt": ("Pull out and destroy wilted plants now; next season, grow a resistant variety and rotate brinjal with crops such as maize or rice.", "next_season", "brinjal_diseases_1.txt"),
 "brinjal_epilachna": ("Shake the plants and collect and destroy the beetles, grubs and egg masses.", "cultural", "brinjal_brinjal_4.txt"),
 "banana_panama_wilt": ("Remove and destroy wilted plants; for the next planting, use healthy suckers and a resistant variety and rotate with paddy or sugarcane.", "next_season", "banana_diseases_crop_prot_crop_20diseases_fruits_banana_7.txt"),
 "banana_sigatoka": ("Cut off and destroy spotted leaves, and keep the field drained and free of weeds.", "cultural", "banana_diseases_crop_prot_crop_20diseases_fruits_banana_8.txt"),
 "banana_bunchy_top": ("Uproot and destroy infected banana plants at once, chop and bury them, and plant only virus-free suckers.", "rogue", "banana_diseases_crop_prot_crop_20diseases_fruits_banana_3.txt"),
 "banana_anthracnose": ("Remove the male bud once all hands have opened, and handle bunches without bruising.", "cultural", "banana_diseases_crop_prot_crop_20diseases_fruiits_banana_1.txt"),
 "banana_rhizome_weevil": ("Remove and destroy infested plants and old pseudostems, and plant only healthy, trimmed suckers.", "cultural", "banana_pest_banana_1.txt"),
 "mango_powdery_mildew": ("Watch the flower clusters closely at flowering, especially after rain or mist with cool nights.", "cultural", "aesa:mango"),
 "mango_anthracnose": ("Collect and destroy diseased leaves, twigs and fruits, and bag fruits 15 days before harvest.", "cultural", "aesa:mango"),
 "mango_hopper": ("Put up yellow sticky traps, and prune dense branches so light enters the tree.", "cultural", "aesa:mango"),
 "mango_fruit_fly": ("Pick up every fallen fruit and bury it in a pit, and set up pheromone traps at 4 to 5 per acre.", "cultural", "aesa:mango"),
 "mango_sooty_mould": ("Control the hoppers and other sucking insects that leave the sticky liquid, and prune covered branches.", "cultural", "mango_7.txt"),
 "blackgram_yellow_mosaic": ("Pull out plants with yellow patches early and destroy them, and put up yellow sticky traps for the whitefly that spreads the virus.", "rogue", "aesa:blackgram_greengram"),
 "blackgram_powdery_mildew": ("Neem seed kernel extract (NSKE) 5% is the first spray to try when white powder first appears.", "bio", "black_gram_disease_powdery_mildew.txt"),
 "blackgram_cercospora_leaf_spot": ("Remove and destroy spotted leaves; next season, sow early as soon as the monsoon starts.", "cultural", "aesa:blackgram_greengram"),
 "blackgram_leaf_crinkle": ("Pull out and destroy crinkled plants; for the next crop, use seed from healthy plants only.", "rogue", "black_gram_disease_leaf_crinkle.txt"),
 "blackgram_rust": ("Remove volunteer plants and crop waste; next season, use healthy seed.", "cultural", "black_gram_disease_rust.txt"),
 "blackgram_pod_borer": ("Count first: act at 3 caterpillars per plant. Set up pheromone traps at 4 to 5 per acre.", "cultural", "greenblack_crop_prot_crop_insect_pul_bla_and_20green_2.txt"),
 "potato_early_blight": ("Remove and destroy spotted leaves; next season, use healthy seed tubers and clear old crop waste.", "cultural", "crop_prot_crop_20diseases_veg_potato_2.txt"),
 "potato_late_blight": ("Remove and destroy infected plants and tubers at once, and keep water from standing in the field.", "cultural", "crop_prot_crop_20diseases_veg_potato_1.txt"),
 "potato_black_scurf": ("For the next planting, use seed tubers free from black scurf, plant them early and shallow, and rotate the field.", "next_season", "crop_prot_crop_20diseases_veg_potato_4.txt"),
 "potato_bacterial_wilt": ("Pull out and destroy wilted plants now; next season, plant pathogen-free tubers and rotate with wheat.", "next_season", "crop_prot_crop_20diseases_veg_potato_6.txt"),
 "potato_common_scab": ("For the next planting, use scab-free seed potatoes, rotate the field and avoid alkaline fertilisers.", "next_season", "crop_prot_crop_20diseases_veg_potato_5.txt"),
 "cashew_tea_mosquito_bug": ("Check five twigs per tree in the early morning during flushing, flowering and nut set, and remove neem and other host plants near the garden.", "cultural", "aesa:cashewnut"),
 "cashew_stem_root_borer": ("Chisel out damaged bark at live holes, remove the grubs and swab the trunk with neem oil.", "bio", "aesa:cashewnut"),
 "cashew_thrips": ("Put up blue or yellow sticky traps at 4 to 5 per acre and count thrips on five twigs per tree.", "cultural", "aesa:cashewnut"),
 "cashew_anthracnose": ("Cut off and destroy affected twigs and collect fallen diseased leaves.", "cultural", "aesa:cashewnut"),
 "cashew_inflorescence_blight": ("Control the tea mosquito bug, which opens the way for this disease, and remove dried flower clusters.", "cultural", "aesa:cashewnut"),
 "cashew_dieback": ("Cut affected branches well below the infection, destroy them and paste the cut ends with cow dung.", "cultural", "aesa:cashewnut"),
 "onion_purple_blotch": ("Remove and destroy spotted leaves and keep the field drained; next season, use healthy bulbs and rotate the crop.", "cultural", "onion_diseases_7.txt"),
 "onion_stemphylium_blight": ("Collect and remove old crop parts and keep the field drained; next season, treat seed in hot water at 50 °C for 20 minutes.", "cultural", "aesa:onion"),
 "onion_downy_mildew": ("Keep the field drained and avoid frequent watering; next season, use healthy bulbs and rotate for 3 to 4 years.", "cultural", "onion_diseases_2.txt"),
 "onion_thrips": ("Count first: check five leaves per plant, and put up blue sticky traps 15 cm above the crop.", "cultural", "crop_prot_crop_insect-veg_onion_pest_disease.txt"),
 "onion_basal_rot": ("Keep the field drained; next season, rotate for 4 to 5 years and choose a resistant variety.", "next_season", "aesa:onion"),
}

# Round 4 additions.
AVOID_MIXTURES = {"cotton_pink_bollworm"}  # CICR: never spray insecticide mixtures; app should not rank ready-mix products first
PRACTICES_ADD = {
 "cashew_tea_mosquito_bug": [("Watch for the bug from new flushes through flowering to fruiting; the AESA package covers it at the flushing and flowering stage and again at fruiting.", "aesa:cashewnut"),
                             ("Protective sprays against the tea mosquito bug and inflorescence blight help cashew yields, but do not spray when the trees are in full bloom.", "aesa:cashewnut")],
 "tomato_late_blight": [("Do not use the same type of fungicide again and again. For strobilurin (QoI) fungicides such as azoxystrobin used alone, use no more than 1 spray in 3, at most 3 per crop and never more than 2 in a row; switch to a fungicide of a different group in between.", "extra:frac_qoi")],
 "potato_late_blight": [("Do not use the same type of fungicide again and again. For strobilurin (QoI) fungicides such as azoxystrobin used alone, use no more than 1 spray in 3, at most 3 per crop and never more than 2 in a row; switch to a fungicide of a different group in between.", "extra:frac_qoi")],
}
SAFETY = {
 "cashew_tea_mosquito_bug": ("Only one product is registered for cashew in India, and it contains beta-cyfluthrin, which WHO classes as Ib (highly hazardous). If you use it, wear gloves, a face mask, a cap and full protective clothing, never spray without them, and take advice from your nearest KVK before spraying.", ["who", "aesa:cashewnut"]),
 "cashew_thrips": ("Only one product is registered for cashew in India, and it contains beta-cyfluthrin, which WHO classes as Ib (highly hazardous). If you use it, wear gloves, a face mask, a cap and full protective clothing, never spray without them, and take advice from your nearest KVK before spraying.", ["who", "aesa:cashewnut"]),
}
