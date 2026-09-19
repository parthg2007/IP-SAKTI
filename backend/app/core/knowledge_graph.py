"""Relational Knowledge Graph module for Ayurveda IP, Statutes, and Regulatory Processes."""
import re
from typing import Dict, List, Any, Optional, Set


# Canonical nodes in the IP-SAKTI Relational Knowledge Graph
GRAPH_NODES = {
    # 1. Biological Resources & Formulations
    "bio_turmeric": {
        "id": "bio_turmeric",
        "label": "Turmeric (Curcuma longa / Haridra)",
        "category": "Biological Resource",
        "keywords": ["turmeric", "haldi", "haridra", "curcuma longa", "curcumin"],
        "description": "Rhizome extensively documented in Charaka and Sushruta Samhita for anti-inflammatory, wound healing, and metabolic actions."
    },
    "bio_ashwagandha": {
        "id": "bio_ashwagandha",
        "label": "Ashwagandha (Withania somnifera)",
        "category": "Biological Resource",
        "keywords": ["ashwagandha", "withania somnifera", "asgandh", "withanolides"],
        "description": "Rasayana herb documented for adaptogenic and restorative actions; subject to NBA biological resource access regulations."
    },
    "bio_neem": {
        "id": "bio_neem",
        "label": "Neem (Azadirachta indica / Nimba)",
        "category": "Biological Resource",
        "keywords": ["neem", "nimba", "azadirachta indica"],
        "description": "Medicinal tree famous in landmark EPO patent revocations; classic prior-art paradigm under TKDL."
    },
    "bio_tulsi": {
        "id": "bio_tulsi",
        "label": "Tulsi (Ocimum sanctum)",
        "category": "Biological Resource",
        "keywords": ["tulsi", "ocimum sanctum", "holy basil"],
        "description": "Sacred medicinal plant indexed in classical treatises; subject to ABS agreements for commercial exploitation."
    },
    "form_polyherbal": {
        "id": "form_polyherbal",
        "label": "Polyherbal / Classical Formulation",
        "category": "Formulation",
        "keywords": ["formulation", "polyherbal", "admixture", "triphala", "chyawanprash", "kwath", "churna", "taila"],
        "description": "Ayurvedic combination formulation combining two or more herbal extracts or raw biological substances."
    },

    # 2. Prior Art & Classical Treatises
    "source_tkdl": {
        "id": "source_tkdl",
        "label": "Traditional Knowledge Digital Library (TKDL)",
        "category": "Prior Art Repository",
        "keywords": ["tkdl", "traditional knowledge digital library", "prior art", "classical text"],
        "description": "Database containing over 450,000 digitized formulations translated into 5 international languages for patent examiner searches."
    },
    "source_samhitas": {
        "id": "source_samhitas",
        "label": "First Schedule Classical Treatises",
        "category": "Prior Art Repository",
        "keywords": ["charaka", "sushruta", "vagbhata", "ashtanga hridaya", "first schedule", "54 books"],
        "description": "54 authoritative Ayurvedic treatises listed under the First Schedule of the Drugs & Cosmetics Act, 1940."
    },

    # 3. Statutory Law & Sections
    "law_patents_act": {
        "id": "law_patents_act",
        "label": "The Patents Act, 1970",
        "category": "Statute",
        "keywords": ["patents act", "patent", "indian patent office", "ipo"],
        "description": "Primary Indian legislation governing patent grant, patentability bars, and disclosure mandates."
    },
    "sec_3p": {
        "id": "sec_3p",
        "label": "Section 3(p) — Traditional Knowledge Bar",
        "category": "Statutory Bar",
        "keywords": ["section 3(p)", "sec 3(p)", "3(p)", "traditional knowledge bar"],
        "description": "Inventions that in effect are traditional knowledge or an aggregation or duplication of known properties are non-patentable."
    },
    "sec_3e": {
        "id": "sec_3e",
        "label": "Section 3(e) — Mere Admixture Bar",
        "category": "Statutory Bar",
        "keywords": ["section 3(e)", "sec 3(e)", "3(e)", "admixture", "synergism", "synergy"],
        "description": "Mere admixtures resulting only in aggregation of properties of components are unpatentable; synergistic efficacy must be proved."
    },
    "sec_10_4": {
        "id": "sec_10_4",
        "label": "Section 10(4)(d) — Source & Origin Disclosure",
        "category": "Statutory Mandate",
        "keywords": ["section 10(4)", "10(4)", "source of biological material", "geographical origin"],
        "description": "Mandatory specification of biological material source and geographical origin in patent specifications."
    },
    "law_bda": {
        "id": "law_bda",
        "label": "Biological Diversity Act, 2002",
        "category": "Statute",
        "keywords": ["biological diversity act", "bda", "biodiversity act", "biological resource"],
        "description": "Governs conservation, sustainable use, and fair equitable benefit sharing from Indian biological resources."
    },
    "sec_6_bda": {
        "id": "sec_6_bda",
        "label": "Section 6(1) BDA — Mandatory NBA Approval",
        "category": "Statutory Mandate",
        "keywords": ["section 6(1)", "section 6", "6(1)", "nba approval", "national biodiversity authority"],
        "description": "Mandatory prior approval from NBA before applying for any intellectual property right inside or outside India based on Indian biological resources."
    },
    "sec_40_bda": {
        "id": "sec_40_bda",
        "label": "Section 40 BDA — NTC Exemption",
        "category": "Statutory Exemption",
        "keywords": ["section 40", "ntc", "normally traded commodities"],
        "description": "Exemption for items notified as normally traded as commodities; applies to domestic trade, NOT to patenting."
    },
    "reg_drugs_cosmetics": {
        "id": "reg_drugs_cosmetics",
        "label": "Drugs & Cosmetics Act (Rule 158B)",
        "category": "Regulatory Framework",
        "keywords": ["rule 158b", "form 25d", "ayush license", "drugs and cosmetics"],
        "description": "Prescribes manufacturing licensing conditions, safety documentation, and trial criteria for Ayurvedic medicines."
    },
    "reg_fssai_aahara": {
        "id": "reg_fssai_aahara",
        "label": "FSSAI Ayurveda Aahara Regulations, 2022",
        "category": "Regulatory Framework",
        "keywords": ["ayurveda aahara", "fssai", "food supplement", "dietary"],
        "description": "Regulatory pathway for food prepared in accordance with classical Ayurvedic treatises; prohibits therapeutic claims."
    },

    # 4. Authorities & Compliance Actions
    "auth_nba": {
        "id": "auth_nba",
        "label": "National Biodiversity Authority (NBA)",
        "category": "Regulatory Authority",
        "keywords": ["national biodiversity authority", "nba", "chennai"],
        "description": "Apex statutory body responsible for approving IPR applications and Access and Benefit Sharing (ABS) agreements."
    },
    "auth_ipo": {
        "id": "auth_ipo",
        "label": "Indian Patent Office (IPO / CGPDTM)",
        "category": "Regulatory Authority",
        "keywords": ["indian patent office", "ipo", "cgpdtm", "patent examiner"],
        "description": "Grants patents and verifies compliance with Sections 3(p), 3(e), and NBA clearance under Section 10(4)."
    },
    "filing_form_3": {
        "id": "filing_form_3",
        "label": "NBA Form III (IPR Approval)",
        "category": "Compliance Filing",
        "keywords": ["form iii", "form 3", "form-iii", "nba form 3"],
        "description": "Statutory application to NBA for permission to apply for or obtain a patent based on biological resources."
    },
    "filing_abs_agreement": {
        "id": "filing_abs_agreement",
        "label": "Access & Benefit Sharing (ABS) Agreement",
        "category": "Compliance Filing",
        "keywords": ["abs", "benefit sharing", "access and benefit sharing", "turnover fee"],
        "description": "Statutory royalty levy of 0.1% to 0.5% on gross ex-factory sales turnover paid to the NBA / BMC."
    },
    "filing_form_18a": {
        "id": "filing_form_18a",
        "label": "Form 18A — Expedited Examination",
        "category": "Compliance Filing",
        "keywords": ["form 18a", "expedited examination", "ayush startup", "startup fast-track"],
        "description": "Fast-track examination procedure available to DPIIT-recognized AYUSH startups at the Indian Patent Office."
    }
}

# Directed relationship edges in the Knowledge Graph
GRAPH_EDGES = [
    # Biological -> Statute / Sources
    {"source": "bio_turmeric", "target": "source_tkdl", "relation": "DOCUMENTED_IN", "label": "Recorded in TKDL prior art"},
    {"source": "bio_turmeric", "target": "law_bda", "relation": "REGULATED_BY", "label": "Governed as biological resource"},
    {"source": "bio_ashwagandha", "target": "law_bda", "relation": "REGULATED_BY", "label": "Governed as biological resource"},
    {"source": "bio_neem", "target": "source_tkdl", "relation": "DOCUMENTED_IN", "label": "Landmark TKDL prior art"},
    {"source": "bio_tulsi", "target": "law_bda", "relation": "REGULATED_BY", "label": "Governed as biological resource"},
    {"source": "form_polyherbal", "target": "sec_3e", "relation": "MUST_OVERCOME", "label": "Must prove synergistic efficacy"},
    {"source": "form_polyherbal", "target": "sec_3p", "relation": "MUST_OVERCOME", "label": "Traditional knowledge bar risk"},

    # Treatises -> Bars
    {"source": "source_tkdl", "target": "sec_3p", "relation": "TRIGGERS_BAR", "label": "Establishes Section 3(p) prior art"},
    {"source": "source_samhitas", "target": "reg_drugs_cosmetics", "relation": "ESTABLISHES_AUTHORITY", "label": "Authoritative classical texts"},
    {"source": "source_samhitas", "target": "reg_fssai_aahara", "relation": "FOUNDATION_OF", "label": "Recipe basis for Ayurveda Aahara"},

    # Patent Bars & Compliance
    {"source": "law_patents_act", "target": "sec_3p", "relation": "CONTAINS_PROVISION", "label": "Statutory exclusion"},
    {"source": "law_patents_act", "target": "sec_3e", "relation": "CONTAINS_PROVISION", "label": "Statutory exclusion"},
    {"source": "law_patents_act", "target": "sec_10_4", "relation": "MANDATES", "label": "Biological origin disclosure"},
    {"source": "sec_10_4", "target": "sec_6_bda", "relation": "CROSS_REFERENCES", "label": "Requires NBA clearance proof"},

    # BDA & NBA
    {"source": "law_bda", "target": "sec_6_bda", "relation": "MANDATES", "label": "Mandatory prior approval for IPR"},
    {"source": "law_bda", "target": "sec_40_bda", "relation": "PROVIDES_EXEMPTION", "label": "NTC trade exemption"},
    {"source": "sec_6_bda", "target": "auth_nba", "relation": "ADMINISTERED_BY", "label": "NBA evaluates and approves"},
    {"source": "sec_6_bda", "target": "filing_form_3", "relation": "REQUIRES_SUBMISSION", "label": "File Form III with fee"},
    {"source": "auth_nba", "target": "filing_abs_agreement", "relation": "EXECUTES", "label": "Levies 0.1%-0.5% gross sales ABS"},

    # Patent Office & Startups
    {"source": "filing_form_3", "target": "auth_ipo", "relation": "PREREQUISITE_FOR", "label": "Must grant approval before patent seal"},
    {"source": "auth_ipo", "target": "filing_form_18a", "relation": "PROVIDES", "label": "Expedited examination for AYUSH startups"},
]


class RelationalKnowledgeGraph:
    """In-memory relational knowledge graph for Ayurveda IP and regulatory pathways."""

    def __init__(self):
        self.nodes = GRAPH_NODES
        self.edges = GRAPH_EDGES

    def extract_relevant_subgraph(
        self, query: str, citations: Optional[List[Any]] = None, max_nodes: int = 8, jurisdiction: str = "INDIA"
    ) -> Dict[str, Any]:
        """
        Extracts relevant subgraph nodes, active edges, and legal reasoning paths
        based on query text and retrieved citations.
        """
        if jurisdiction != "INDIA":
            return {"nodes": [], "edges": [], "reasoning_paths": [], "total_nodes": 0, "total_edges": 0}
        combined_text = (query or "").lower()
        if citations:
            for c in citations:
                title = getattr(c, "title", "") or ""
                text = getattr(c, "text", "") or ""
                combined_text += f" {title.lower()} {text[:200].lower()}"

        matched_node_ids: Set[str] = set()

        # Step 1: Match directly from keywords
        for node_id, node in self.nodes.items():
            for kw in node.get("keywords", []):
                if kw in combined_text:
                    matched_node_ids.add(node_id)
                    break

        # Step 2: 1-hop expansion to find direct edges
        direct_node_ids = set(matched_node_ids)
        active_edges = []
        for edge in self.edges:
            src = edge["source"]
            tgt = edge["target"]
            if src in direct_node_ids or tgt in direct_node_ids:
                # Include both ends of strong edges
                matched_node_ids.add(src)
                matched_node_ids.add(tgt)
                active_edges.append(edge)

        # Cap nodes if too many
        final_node_ids = sorted(direct_node_ids)[:max_nodes]
        final_node_ids += sorted(matched_node_ids - direct_node_ids)[:max(0, max_nodes - len(final_node_ids))]
        final_nodes = [self.nodes[nid] for nid in final_node_ids if nid in self.nodes]
        final_edges = [
            e for e in active_edges
            if e["source"] in final_node_ids and e["target"] in final_node_ids
        ]

        # Step 3: Derive statutory reasoning paths
        reasoning_paths = []
        if "sec_6_bda" in final_node_ids or "auth_nba" in final_node_ids:
            reasoning_paths.append("Biological Resource ➔ Section 6(1) BDA ➔ NBA Form III Approval ➔ Indian Patent Office Grant")
        if "sec_3p" in final_node_ids or "source_tkdl" in final_node_ids:
            reasoning_paths.append("Ayurvedic Prior Art ➔ Section 3(p) TK Bar ➔ Require Novel Extraction / Synergistic Form")
        if "sec_3e" in final_node_ids or "form_polyherbal" in final_node_ids:
            reasoning_paths.append("Polyherbal Composition ➔ Section 3(e) Admixture Test ➔ Empirical Synergistic Data Proof")

        from app.rules.provenance import annotate_graph

        return annotate_graph({
            "nodes": final_nodes,
            "edges": final_edges,
            "reasoning_paths": reasoning_paths,
            "total_nodes": len(final_nodes),
            "total_edges": len(final_edges)
        })


knowledge_graph = RelationalKnowledgeGraph()
