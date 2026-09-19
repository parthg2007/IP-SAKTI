"""Language detection and technical term normalization module."""
import re
from typing import Dict, List, Tuple

# Devanagari Unicode range
DEVANAGARI_RANGE = re.compile(r"[\u0900-\u097F]")

# Common Hinglish markers
HINGLISH_PATTERNS = [
    r"\bkya\b", r"\bhai\b", r"\bkaise\b", r"\bke\b", r"\bliye\b", r"\bmein\b",
    r"\bkarein\b", r"\bhota\b", r"\bhoti\b", r"\bbatao\b", r"\bsamjhao\b",
    r"\bpurva\s+kala\b", r"\bjaiv\s+vividhta\b", r"\badhikar\b"
]

# Canonical domain concepts and their multilingual/transliterated equivalents
TERM_NORMALIZATION_MAP: Dict[str, Dict[str, any]] = {
    "PRIOR_ART": {
        "canonical": "Prior Art & Classical Literature",
        "keywords": [
            "prior art", "prior-art", "priorart", "पूर्व कला", "purva kala", "purvakala",
            "पूर्व ज्ञान", "purva gyan"
        ],
        "domain": "Prior Art & Classical Literature"
    },
    "TRADITIONAL_KNOWLEDGE": {
        "canonical": "Traditional Knowledge (TK)",
        "keywords": [
            "traditional knowledge", "tk", "पारंपरिक ज्ञान", "paramparik gyan",
            "paramparik vigyan", "traditional ayurvedic knowledge"
        ],
        "domain": "Prior Art & Classical Literature"
    },
    "TKDL": {
        "canonical": "Traditional Knowledge Digital Library (TKDL)",
        "keywords": [
            "tkdl", "traditional knowledge digital library", "टीकेडीएल",
            "digitized classical texts", "tkrc", "ayurveda volumes", "unani volumes",
            "siddha volumes", "sowa rigpa", "yoga texts"
        ],
        "domain": "Prior Art & Classical Literature"
    },
    "PATENT_TK_BAR_3P": {
        "canonical": "Section 3(p) Traditional Knowledge Patent Bar",
        "keywords": [
            "section 3(p)", "sec 3(p)", "3(p)", "section 3p", "धारा 3(p)", "धारा ३(पी)",
            "patent bar", "traditional knowledge unpatentable", "aggregation of properties"
        ],
        "domain": "Patents & IPR Procedures"
    },
    "PATENT_ADMIXTURE_3E": {
        "canonical": "Section 3(e) Mere Admixture and Synergism",
        "keywords": [
            "section 3(e)", "sec 3(e)", "3(e)", "section 3e", "धारा 3(e)", "admixture",
            "synergism", "synergy requirement", "mere admixture"
        ],
        "domain": "Patents & IPR Procedures"
    },
    "STARTUP_EXPEDITED_PATENT": {
        "canonical": "Startup Expedited Patent Examination & Form 27",
        "keywords": [
            "form 18a", "form 27", "expedited examination", "ayush startup", "startup patent",
            "working of patent", "dpiit startup"
        ],
        "domain": "Patents & IPR Procedures"
    },
    "NBA_APPROVAL_6_1": {
        "canonical": "Section 6(1) Biological Diversity Act NBA Approval",
        "keywords": [
            "section 6(1)", "sec 6(1)", "6(1)", "section 6", "धारा 6(1)",
            "nba approval", "national biodiversity authority approval",
            "biological resource ipr approval"
        ],
        "domain": "Statutory Law"
    },
    "NTC_EXEMPTION_40": {
        "canonical": "Section 40 Normally Traded Commodities (NTC) Exemption",
        "keywords": [
            "section 40", "sec 40", "ntc", "normally traded commodities", "धारा 40",
            "commodity exemption", "domestic consumption"
        ],
        "domain": "Statutory Law"
    },
    "AUTHORITATIVE_BOOKS_SCHEDULE1": {
        "canonical": "First Schedule Authoritative Books of Ayurveda",
        "keywords": [
            "first schedule", "authoritative books", "charaka samhita", "sushruta samhita",
            "ashtanga hridaya", "54 canonical treatises", "ayurvedic formulary"
        ],
        "domain": "Statutory Law"
    },
    "MISLEADING_ADS_SECTION3": {
        "canonical": "Prohibition of Misleading Advertisements",
        "keywords": [
            "misleading advertisement", "section 3 drugs and magic remedies",
            "54 conditions", "prohibited disease advertisement"
        ],
        "domain": "Statutory Law"
    },
    "NBA_ABS_FORMS": {
        "verification_id": "abs-legacy",
        "verification_status": "needs_human_verification",
        "verification_note": "Matching aliases only; see data/rules/verification_items.json for the source audit. No current rate is established.",
        "canonical": "Access and Benefit Sharing (ABS) & NBA Forms I, II, III, IV",
        "keywords": [
            "form i", "form ii", "form iii", "form iv", "form 1", "form 2", "form 3", "form 4",
            "nba form", "access and benefit sharing", "abs", "लाभ साझाकरण",
            "benefit sharing fee", "gross sales turnover", "0.1% to 0.5%"
        ],
        "domain": "Access & Benefit Sharing (ABS)"
    },
    "BMC_PBR": {
        "canonical": "Biodiversity Management Committee (BMC) & People's Biodiversity Register",
        "keywords": [
            "bmc", "pbr", "peoples biodiversity register", "people's biodiversity register",
            "biodiversity management committee", "local vaids"
        ],
        "domain": "Access & Benefit Sharing (ABS)"
    },
    "BOTANICAL_TURMERIC": {
        "canonical": "Turmeric Curcuma Longa Haridra",
        "keywords": [
            "turmeric", "curcuma longa", "curcumin", "हल्दी", "haldi", "haridra", "हरिद्रा"
        ],
        "domain": "Prior Art & Classical Literature"
    },
    "BOTANICAL_ASHWAGANDHA": {
        "canonical": "Ashwagandha Withania Somnifera",
        "keywords": [
            "ashwagandha", "withania somnifera", "अश्वगंधा", "asgandh", "winter cherry"
        ],
        "domain": "Prior Art & Classical Literature"
    },
    "BOTANICAL_NEEM": {
        "canonical": "Neem Azadirachta Indica Nimba",
        "keywords": [
            "neem", "azadirachta indica", "nimba", "नीम", "निम्ब"
        ],
        "domain": "Prior Art & Classical Literature"
    },
    "BOTANICAL_TULSI": {
        "canonical": "Tulsi Holy Basil Ocimum Sanctum",
        "keywords": [
            "tulsi", "ocimum sanctum", "holy basil", "तुलसी"
        ],
        "domain": "Prior Art & Classical Literature"
    },
    "CLASSICAL_TRIPHALA": {
        "canonical": "Triphala Formulation Haritaki Bibhitaki Amalaki",
        "keywords": [
            "triphala", "त्रिफला", "haritaki", "bibhitaki", "amalaki"
        ],
        "domain": "Prior Art & Classical Literature"
    },
    "FSSAI_AYURVEDA_AAHARA": {
        "canonical": "FSSAI Food Safety and Standards (Ayurveda Aahara) Regulations",
        "keywords": [
            "ayurveda aahara", "aahara", "आहार", "fssai", "ayurvedic food", "आयुर्वेद आहार"
        ],
        "domain": "Statutory Law"
    }
}

INDIC_LEXICON: Dict[str, str] = {
    r"हल्दी|haldi|haridra|हरिद्रा": "turmeric curcuma longa haridra",
    r"अश्वगंधा|ashwagandha|asgandh": "ashwagandha withania somnifera",
    r"नीम|neem|nimba|निम्ब": "neem azadirachta indica nimba",
    r"तुलसी|tulsi": "holy basil ocimum sanctum tulsi",
    r"त्रिफला|triphala": "triphala classical formulation",
    r"च्यवनप्राश|chyawanprash": "chyawanprash formulation",
    r"फॉर्मूलेशन|formulation|योग|योगों": "formulation composition extract preparation",
    r"पेटेंट|patent|पेटेंटिंग": "patent application Section 3(p) Section 3(e) prior art IPO",
    r"कैसे|kaise|प्रक्रिया|prakriya|विधि": "procedure requirements steps",
    r"कराएं|करें|karein|kare|पाएं": "file obtain register claim",
    r"पारंपरिक\s*ज्ञान|paramparik\s*gyan": "traditional knowledge TKDL prior art",
    r"पूर्व\s*कला|purva\s*kala|पूर्व\s*ज्ञान": "prior art TKDL classical literature",
    r"जैव\s*विविधता|jaiv\s*vividhta|जैविक\s*संसाधन": "biological diversity biological resources BDA NBA approval Section 6",
    r"लाभ\s*साझाकरण|labh\s*sajhakaran": "access and benefit sharing ABS Form I Form III",
    r"लाइसेंस|license|लाइसेंसिंग": "AYUSH manufacturing license Rule 158B Form 25D",
    r"खाद्य|aahara|आहार": "Ayurveda Aahara FSSAI regulations dietary food",
    r"नियम|कानून|धारा": "statutory section rules Patents Act Biological Diversity Act",
}


def translate_indic_query(query: str) -> Tuple[str, bool]:
    """
    Translates Indic or Hinglish terms in query to English keywords
    for high-recall dense vector & BM25 retrieval against English corpus.
    """
    if not query:
        return query, False

    matched_replacements = []
    lower_query = query.lower()
    for pattern, replacement in INDIC_LEXICON.items():
        if re.search(pattern, lower_query, re.IGNORECASE):
            matched_replacements.append(replacement)

    if matched_replacements:
        # Combine extracted English conceptual tokens
        english_expansion = " ".join(dict.fromkeys(matched_replacements))
        return f"{query} {english_expansion}", True

    return query, False


def detect_language(text: str) -> str:
    """
    Detect language of the query.
    Returns:
      'hi'      if query has Devanagari characters
      'hi-Latn' if query matches common Hinglish romanized markers
      'en'      otherwise (default)
    """
    if not text:
        return "en"

    # Check for Devanagari script
    devanagari_chars = DEVANAGARI_RANGE.findall(text)
    if len(devanagari_chars) >= 2:
        return "hi"

    # Check for Hinglish
    lower_text = text.lower()
    for pat in HINGLISH_PATTERNS:
        if re.search(pat, lower_text):
            return "hi-Latn"

    return "en"


def normalize_and_expand_query(query: str) -> Tuple[str, List[str], List[str]]:
    """
    Normalizes query terms, extracts recognized domain concepts, and generates expanded search tokens.

    Returns:
      (normalized_query, matched_concepts, suggested_domains)
    """
    if not query:
        return "", [], []

    lower_query = query.lower()
    matched_concepts: List[str] = []
    suggested_domains: List[str] = []
    expanded_terms: List[str] = [query]

    # Check for lexicon translations
    for pattern, replacement in INDIC_LEXICON.items():
        if re.search(pattern, lower_query, re.IGNORECASE):
            expanded_terms.append(replacement)

    for concept_id, info in TERM_NORMALIZATION_MAP.items():
        for kw in info["keywords"]:
            if kw in lower_query:
                matched_concepts.append(info["canonical"])
                domain = info.get("domain")
                if domain and domain not in suggested_domains:
                    suggested_domains.append(domain)
                expanded_terms.append(info["canonical"])
                break

    # Build enriched search query string
    enriched_query = " ".join(dict.fromkeys(expanded_terms))
    return enriched_query, matched_concepts, suggested_domains
