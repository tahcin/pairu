"""The KB's disease list and where each entry's text comes from.

For each problem: id, crop, English name, kind, a regex that finds its TNAU page by heading
(restricted to file-name prefixes for that crop), the AESA IPM package for the crop and a
regex for the lines that mention it there, and the CIB&RC target_norm values it maps to.
Writes scripts/kb_plan.json for kb_extract.py and build_kb.py.
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
TEXT = os.path.join(HERE, "raw", "kb", "text")

# brinjal cercospora leaf spot was dropped: neither source gives any non-chemical practice for it.
# groundnut stem rot was dropped: the TNAU stem rot page repeats the rust symptoms and the AESA package has no description.
# id, crop, name_en, kind, tnau file prefix regex, tnau heading regex, aesa file, aesa keyword regex, cibrc targets
D = [
 # paddy
 ("paddy_blast", "paddy", "Blast", "fungal", r"rice_diseases", r"^Blast", "rice", r"\bblast\b", ["blast", "leaf blast", "neck blast", "panicle blast"]),
 ("paddy_brown_spot", "paddy", "Brown spot", "fungal", r"rice_diseases", r"^Brown Spot", "rice", r"brown spot", ["brown spot", "brown leaf spot"]),
 ("paddy_blb", "paddy", "Bacterial leaf blight", "bacterial", r"rice_diseases", r"^Bacterial leaf blight", "rice", r"bacterial (leaf )?blight|\bBLB\b", ["bacterial leaf blight"]),
 ("paddy_sheath_blight", "paddy", "Sheath blight", "fungal", r"rice_diseases", r"^Sheath Blight", "rice", r"sheath blight", ["sheath blight"]),
 ("paddy_bph", "paddy", "Brown plant hopper", "pest", r"rice_crop", r"(?i)brown plant ?(leaf)?hopper", "rice", r"brown plant ?hopper|\bBPH\b|hopper ?burn", ["brown plant hopper", "plant hopper"]),
 ("paddy_leaf_folder", "paddy", "Leaf folder", "pest", r"rice_crop", r"(?i)^leaf folder", "rice", r"leaf ?folder|Cnaphalocrocis", ["leaf folder", "leaf roller"]),
 ("paddy_gall_midge", "paddy", "Gall midge", "pest", r"rice_crop", r"(?i)^gall midge", "rice", r"gall midge|Orseolia|silver shoot", ["gall midge"]),
 ("paddy_false_smut", "paddy", "False smut", "fungal", r"rice_diseases", r"(?i)^fl?a?se smut", "rice", r"false smut|Ustilaginoidea", ["false smut"]),
 ("paddy_stem_borer", "paddy", "Yellow stem borer", "pest", r"rice_crop", r"stem ?borer", "rice", r"stem borer|dead ?heart|white ?ear", ["stem borer", "yellow stem borer"]),
 # cotton
 ("cotton_bacterial_blight", "cotton", "Bacterial blight (black arm)", "bacterial", r"cotton_diseases", r"^Bacterial blight", "cotton", r"bacterial blight|black ?arm|angular leaf spot", ["bacterial blight", "bacterial leaf blight", "angular leaf spot", "angular leaf spot or black arm"]),
 ("cotton_alternaria_leaf_spot", "cotton", "Alternaria leaf spot", "fungal", r"cotton_diseases", r"^Alterneria", "cotton", r"alternaria", ["alternaria leaf spot", "alternaria leaf blight", "alternaria leaf", "leaf spot"]),
 ("cotton_grey_mildew", "cotton", "Grey mildew", "fungal", r"cotton_diseases", r"^Grey", "cotton", r"grey mildew|areolate", ["grey mildew"]),
 ("cotton_pink_bollworm", "cotton", "Pink bollworm", "pest", r"cotton_crop", r"^Pink bollworm", "cotton", r"pink boll ?worm|Pectinophora", ["pink bollworm", "pink boll worm", "pectinophora gossypiella", "boll worms", "bollworm", "boll worm"]),
 ("cotton_whitefly", "cotton", "Whitefly", "pest", r"cotton_crop", r"^Whitefly", "cotton", r"white ?fly|Bemisia", ["whitefly"]),
 ("cotton_jassid", "cotton", "Leafhopper (jassid)", "pest", r"cotton_crop", r"(?i)^leaf ?hopper", "cotton", r"leaf ?hopper|jassid|Amrasca", ["jassids", "leafhopper"]),
 # chilli
 ("chilli_fruit_rot_dieback", "chilli", "Fruit rot and dieback (anthracnose)", "fungal", r"chilli_diseases", r"^Fruit Rot and Die Back", "chillies_capsicum", r"die-?back|anthracnose|fruit rot", ["anthracnose", "fruit rot", "dieback", "anthracnose fruit rot"]),
 ("chilli_powdery_mildew", "chilli", "Powdery mildew", "fungal", r"chilli_diseases", r"^Powdery mildew", "chillies_capsicum", r"powdery mildew", ["powdery mildew"]),
 ("chilli_leaf_curl", "chilli", "Leaf curl virus", "viral", r"chilli_diseases", r"^Viral diseases", "chillies_capsicum", r"leaf curl|mosaic complex", ["whitefly"]),
 ("chilli_cercospora_leaf_spot", "chilli", "Cercospora leaf spot", "fungal", r"chilli_diseases", r"^Cercospora", "chillies_capsicum", r"cercospora", ["cercospora leaf spot", "leaf spot"]),
 ("chilli_bacterial_leaf_spot", "chilli", "Bacterial leaf spot", "bacterial", r"chilli_diseases", r"^Bacterial leaf spot", "chillies_capsicum", r"bacterial leaf spot", ["bacterial leaf spot"]),
 ("chilli_black_thrips", "chilli", "Black thrips (Thrips parvispinus)", "pest", r"^$", r"^$", "chillies_capsicum", r"parvispinus", ["thrips", "black thrips"]),
 ("chilli_yellow_mite", "chilli", "Yellow mite (broad mite)", "pest", r"crop_prot_crop_insect-veg_chillies_pest", r"(?i)thrips", "chillies_capsicum", r"yellow ?mite|broad ?mite|chilli mite|Polyphagotarsonemus", ["yellow mites", "mites", "white mites"]),
 ("chilli_thrips", "chilli", "Thrips", "pest", r"crop_prot_crop_insect-veg_chillies_pest|chilli_chilli", r"thrips", "chillies_capsicum", r"thrips|Scirtothrips", ["thrips"]),
 # groundnut
 ("groundnut_early_leaf_spot", "groundnut", "Early leaf spot (tikka)", "fungal", r"groundnut_diseases", r"^Early leaf spot", "groundnut", r"early leaf spot|tikka|leaf spot", ["early leaf spot", "tikka leaf spot", "tikka", "leaf spot"]),
 ("groundnut_late_leaf_spot", "groundnut", "Late leaf spot (tikka)", "fungal", r"groundnut_diseases", r"^Late leaf spot", "groundnut", r"late leaf spot|tikka|leaf spot", ["late leaf spot", "lateleafspot", "tikka leaf spot", "tikka", "leaf spot"]),
 ("groundnut_rust", "groundnut", "Rust", "fungal", r"groundnut_diseases", r"^Rust", "groundnut", r"\brust\b", ["rust"]),
 ("groundnut_bud_necrosis", "groundnut", "Bud necrosis virus", "viral", r"groundnut_diseases", r"^Bud necrosis", "groundnut", r"bud necrosis|PBNV|thrips", ["thrips"]),
 ("groundnut_leaf_miner", "groundnut", "Leaf miner", "pest", r"groundnut_crop", r"leaf ?miner", "groundnut", r"leaf ?miner|Aproaerema", ["leaf miner", "leaf minor"]),
 # maize
 ("maize_common_rust", "maize", "Common rust", "fungal", r"maize_disease", r"(Common )?[Rr]ust", "maize", r"\brust\b", ["common rust", "rust"]),
 ("maize_turcicum_blight", "maize", "Northern leaf blight (turcicum)", "fungal", r"maize_disease", r"[Tt]urcicum|Northern", "maize", r"turcicum|\bTLB\b|northern", ["turcicum leaf blight", "turcicum blight", "tercicum leaf blight", "leaf blight", "northern corn leaf blight southern corn leaf blight", "n s orthern leaf blight"]),
 ("maize_maydis_blight", "maize", "Southern leaf blight (maydis)", "fungal", r"maize_disease", r"[Mm]aydis|Southern", "maize", r"maydis|\bMLB\b|southern", ["maydis leaf blight", "leaf blight", "northern corn leaf blight southern corn leaf blight"]),
 ("maize_grey_leaf_spot", "maize", "Grey leaf spot", "fungal", r"maize_disease", r"[Gg]r[ae]y leaf spot|Cercospora", "maize", r"gr[ae]y leaf spot|Cercospora zeae", []),
 ("maize_downy_mildew", "maize", "Downy mildew", "fungal", r"maize_disease", r"[Dd]owny", "maize", r"downy mildew", ["downy mildew", "sorghum downy mildew", "browny stripe downy mildew", "phillippine downy mildew", "sugarcane downy mildew"]),
 ("maize_fall_armyworm", "maize", "Fall armyworm", "pest", r"maize_crop", r"[Ff]all", "maize", r"fall army ?worm|frugiperda", ["fall armyworm", "fall army worm", "spodoptera frugiperda"]),
 # tomato
 ("tomato_early_blight", "tomato", "Early blight", "fungal", r"tomato_diseases", r"^Early Blight", "tomato", r"early blight|Alternaria", ["early blight", "alternaria blight", "alternaria leaf spot"]),
 ("tomato_late_blight", "tomato", "Late blight", "fungal", r"tomato_diseases", r"^Late", "tomato", r"late blight|Phytophthora", ["late blight"]),
 ("tomato_leaf_curl", "tomato", "Leaf curl virus", "viral", r"tomato_diseases", r"^Leaf curl", "tomato", r"leaf curl", ["whitefly"]),
 ("tomato_septoria_leaf_spot", "tomato", "Septoria leaf spot", "fungal", r"tomato_diseases", r"^Septoria", "tomato", r"septoria", ["septoria leaf spot", "septoria leaf blight"]),
 ("tomato_bacterial_spot", "tomato", "Bacterial spot", "bacterial", r"tomato_diseases", r"^Bacterial Leaf Spot", "tomato", r"bacterial leaf spot|bacterial spot", ["bacterial leaf spot"]),
 ("tomato_fruit_borer", "tomato", "Fruit borer", "pest", r"tomato_tomato", r"^Fruit Borer", "tomato", r"fruit borer|gram pod borer|Helicoverpa", ["fruit borer", "helicoverpa armigera"]),
 # brinjal
 ("brinjal_shoot_fruit_borer", "brinjal", "Shoot and fruit borer", "pest", r"brinjal_brinjal", r"^Shoot and fruit borer", "brinjal", r"shoot and fruit borer|Leucinodes", ["shoot and fruit borer", "fruit borer", "shoot borer"]),
 ("brinjal_little_leaf", "brinjal", "Little leaf", "bacterial", r"brinjal_brinjal", r"(?i)^brown leaf hopper", "brinjal", r"little leaf|phytoplasma", ["jassids", "leafhopper"]),
 ("brinjal_phomopsis_blight", "brinjal", "Phomopsis blight and fruit rot", "fungal", r"brinjal_phdiseases", r"Phomopsis", "brinjal", r"phomopsis", ["fruit rot", "blight"]),
 ("brinjal_bacterial_wilt", "brinjal", "Bacterial wilt", "bacterial", r"brinjal_diseases", r"^Bacterial Wilt", "brinjal", r"bacterial wilt|Ralstonia|solanacearum", ["bacterial wilt"]),
 ("brinjal_epilachna", "brinjal", "Epilachna beetle (hadda beetle)", "pest", r"brinjal_brinjal", r"^Hadda", "brinjal", r"epilachna|hadda|spotted beetle", ["epilachna grub", "beetles"]),
 # banana
 ("banana_panama_wilt", "banana", "Panama wilt (Fusarium wilt)", "fungal", r"banana_diseases", r"^Panama", "banana", r"panama|fusarium wilt", ["panama wilt"]),
 ("banana_sigatoka", "banana", "Sigatoka leaf spot", "fungal", r"banana_diseases", r"sigatoka", "banana", r"sigatoka|Mycosphaerella", ["sigatoka leaf spot", "sigatoka", "yellow sigatoka", "leaf spot"]),
 ("banana_bunchy_top", "banana", "Bunchy top virus", "viral", r"banana_diseases", r"^Bunchy Top", "banana", r"bunchy top|aphid", ["aphids"]),
 ("banana_anthracnose", "banana", "Anthracnose", "fungal", r"banana_diseases", r"^Anthracnose", "banana", r"anthracnose", ["fruit rot"]),
 ("banana_rhizome_weevil", "banana", "Rhizome weevil", "pest", r"banana_pest", r"^Rhizome weevil", "banana", r"rhizome weevil|corm weevil|Cosmopolites", ["rhizome weevil"]),
 # mango
 ("mango_powdery_mildew", "mango", "Powdery mildew", "fungal", r"^mango_[0-9]|mango_mango", r"^Powdery", "mango", r"powdery mildew", ["powdery mildew"]),
 ("mango_anthracnose", "mango", "Anthracnose", "fungal", r"^mango_[0-9]|mango_mango", r"^Anthracnose", "mango", r"anthracnose", ["anthracnose"]),
 ("mango_hopper", "mango", "Mango hopper", "pest", r"mango_mango|^mango_[0-9]", r"hopper", "mango", r"hopper", ["hopper"]),
 ("mango_fruit_fly", "mango", "Fruit fly", "pest", r"mango_mango|^mango_[0-9]", r"[Ff]ruit fly", "mango", r"fruit fl(y|ies)|Bactrocera", []),
 ("mango_sooty_mould", "mango", "Sooty mould", "fungal", r"^mango_[0-9]|mango_mango", r"[Ss]ooty", "mango", r"sooty mou?ld", []),
 # blackgram
 ("blackgram_yellow_mosaic", "blackgram", "Yellow mosaic virus", "viral", r"black_gram_disease", r"^Yellow Mosaic", "blackgram_greengram", r"yellow mosaic|\bYMV\b|whitefly", ["whitefly"]),
 ("blackgram_powdery_mildew", "blackgram", "Powdery mildew", "fungal", r"black_gram_disease", r"^Powdery", "blackgram_greengram", r"powdery mildew", ["powdery mildew"]),
 ("blackgram_cercospora_leaf_spot", "blackgram", "Cercospora leaf spot", "fungal", r"black_gram_disease", r"^Cercospora", "blackgram_greengram", r"cercospora", ["cercospora leaf spot", "leaf spot"]),
 ("blackgram_leaf_crinkle", "blackgram", "Leaf crinkle virus", "viral", r"black_gram_disease", r"^Leaf Crinkle", "blackgram_greengram", r"leaf crinkle", []),
 ("blackgram_rust", "blackgram", "Rust", "fungal", r"black_gram_disease", r"^Rust", "blackgram_greengram", r"\brust\b", ["rust"]),
 ("blackgram_pod_borer", "blackgram", "Spotted pod borer (Maruca)", "pest", r"greenblack", r"^Spotted pod borer", "blackgram_greengram", r"spotted pod borer|Maruca", ["spotted pod borer", "maruca vitrata", "maruca spp", "pod borer", "black gram pod borer"]),
 # potato
 ("potato_early_blight", "potato", "Early blight", "fungal", r"crop_prot_crop_20diseases_veg_potato_|potato_", r"^Early blight", "potato", r"early blight|Alternaria", ["early blight"]),
 ("potato_late_blight", "potato", "Late blight", "fungal", r"crop_prot_crop_20diseases_veg_potato_|potato_", r"^Late blight", "potato", r"late blight|Phytophthora", ["late blight"]),
 ("potato_black_scurf", "potato", "Black scurf", "fungal", r"crop_prot_crop_20diseases_veg_potato_", r"^Black scurf", "potato", r"black scurf|Rhizoctonia", ["black scurf", "black scruf", "black scruff"]),
 ("potato_bacterial_wilt", "potato", "Bacterial wilt (brown rot)", "bacterial", r"crop_prot_crop_20diseases_veg_potato_", r"[Bb]acterial wilt|[Bb]rown rot", "potato", r"bacterial wilt|brown rot|Ralstonia", ["bacterial brown wilt or ring or the bangle disease of potato"]),
 ("potato_common_scab", "potato", "Common scab", "bacterial", r"crop_prot_crop_20diseases_veg_potato_", r"^Common scab", "potato", r"common scab|Streptomyces", ["scab"]),
 # cashew (13th crop, added for Srikakulam)
 ("cashew_tea_mosquito_bug", "cashew", "Tea mosquito bug", "pest", r"^$", r"^$", "cashewnut", r"mosquito bug|Helopeltis", ["tea mosquito bug"]),
 ("cashew_stem_root_borer", "cashew", "Stem and root borer", "pest", r"^$", r"^$", "cashewnut", r"stem and root borer|Plocaederus|CSRB", []),
 ("cashew_thrips", "cashew", "Thrips (flower and foliage)", "pest", r"^$", r"^$", "cashewnut", r"thrips|Rhynchothrips|Selenothrips|Scirtothrips", ["thrips"]),
 ("cashew_anthracnose", "cashew", "Anthracnose", "fungal", r"crop_prot_crop_20diseases_plantation_cashew", r".", "cashewnut", r"anthracnose", []),
 ("cashew_inflorescence_blight", "cashew", "Inflorescence blight", "fungal", r"crop_prot_crop_20diseases_plantation_cashew", r".", "cashewnut", r"inflorescence blight", []),
 ("cashew_dieback", "cashew", "Die-back (pink disease)", "fungal", r"crop_prot_crop_20diseases_plantation_cashew", r".", "cashewnut", r"die.?back|pink disease|Corticium", []),
 # onion
 ("onion_purple_blotch", "onion", "Purple blotch", "fungal", r"onion_diseases", r"^Purple", "onion", r"purple blotch|Alternaria porri", ["purple blotch", "downy mildew purple blotch"]),
 ("onion_stemphylium_blight", "onion", "Stemphylium leaf blight", "fungal", r"onion_diseases", r"Stemphylium", "onion", r"stemphylium", ["stemphylium blight", "stemphylium leaf blight", "stemphylum blight", "stemphylium"]),
 ("onion_downy_mildew", "onion", "Downy mildew", "fungal", r"onion_diseases", r"^Downy", "onion", r"downy mildew|Peronospora", ["downy mildew", "downy mildew purple blotch"]),
 ("onion_thrips", "onion", "Onion thrips", "pest", r"onion_onion|crop_prot_crop_insect-veg_onion_pest", r"[Tt]hrips", "onion", r"thrips", ["thrips"]),
 ("onion_basal_rot", "onion", "Basal rot", "fungal", r"onion_diseases", r"[Bb]asal", "onion", r"basal rot", []),
]

# extra pages (scripts/raw/kb/extra) where TNAU has no page or a better one exists
EXTRA = {
 "paddy_blast": ["extra:ppqs_paddy_blast"],
 "paddy_bph": ["extra:ppqs_rice_bph"],
 "cotton_pink_bollworm": ["extra:ppqs_cotton_pbw"],
 "cotton_whitefly": ["extra:ppqs_cotton_whitefly"],
 "maize_grey_leaf_spot": ["extra:cpn_gls"],
 "maize_fall_armyworm": ["extra:vikaspedia_faw", "extra:ppqs_faw"],
 "tomato_late_blight": ["extra:iihr_tomato_lb"],
 "paddy_gall_midge": ["extra:ppqs_paddy_gall_midge"],
 "paddy_false_smut": ["extra:ppqs_paddy_false_smut"],
 "chilli_black_thrips": ["extra:ppqs_thrips_parvispinus_core", "extra:ppqs_thrips_parvispinus_adhoc"],
}

def heading(path):
    ls = open(path).read().split("\n")
    return ls[1:4]

def main():
    files = sorted(os.listdir(TEXT))
    plan = {"diseases": []}
    for (i, crop, name, kind, pref, hrx, aesa, akw, targets) in D:
        hits = []
        for f in files:
            if not re.search(pref, f):
                continue
            hs = heading(os.path.join(TEXT, f))
            if any(re.search(hrx, h.strip()) for h in hs[1:3]):
                hits.append(f)
        # prefer non-duplicate pages (blackgram has two copies of several pages)
        if crop == "blackgram" and len(hits) > 1:
            hits = hits[1:]
        hits = hits[:2]
        extra = EXTRA.get(i, [])
        plan["diseases"].append({"id": i, "crop": crop, "name_en": name, "kind": kind,
            "tnau_files": hits, "text_files": hits + extra + [f"aesa:{aesa}"], "aesa": aesa, "aesa_kw": akw, "cibrc_targets": targets})
        print(f"{i:34s} {hits}")
    json.dump(plan, open(os.path.join(HERE, "kb_plan.json"), "w"), indent=1, ensure_ascii=False)

if __name__ == "__main__":
    main()
