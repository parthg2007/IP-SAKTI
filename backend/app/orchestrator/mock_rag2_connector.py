"""Mock/Reference connector for RAG 2 (Authoritative Legal & Regulatory Evidence)."""
import re
from typing import List, Dict, Any, Tuple, Optional
from app.orchestrator.base_connector import BaseRAGConnector
from app.data.models import RAGEvidence
from app.rules.provenance import annotate_evidence

# Authoritative statutory corpus for RAG 2 legal conclusions
LEGAL_STATUTES = [
    {
        "document_id": "STATUTE-PATENTS-ACT-1970",
        "chunk_id": "RAG2-SEC-003P",
        "title": "Section 3(p) - The Patents Act, 1970 (Traditional Knowledge Bar)",
        "source_name": "Ministry of Law and Justice, Government of India",
        "source_url": "https://ipindia.gov.in/acts-rules-patents.htm",
        "domain": "Statutory Patent Law",
        "keywords": ["3(p)", "3p", "traditional knowledge", "patent bar", "novelty", "prior art", "ayurveda"],
        "text": (
            "Section 3(p) explicitly bars patenting of an invention which in effect is traditional knowledge "
            "or which is an aggregation or duplication of known properties of traditionally known component or components. "
            "Rule Engine Verification: Pure extract or unaltered classical preparation is strictly non-patentable. "
            "To overcome Section 3(p), the applicant must demonstrate novel synergistic efficacy, non-obvious isolation, "
            "or a novel formulation method beyond classical treatises."
        )
    },
    {
        "document_id": "STATUTE-PATENTS-ACT-1970",
        "chunk_id": "RAG2-SEC-003E",
        "verification_status": "unverified",
        "title": "Section 3(e) - The Patents Act, 1970 (Mere Admixture & Synergism)",
        "source_name": "Ministry of Law and Justice, Government of India",
        "source_url": "https://ipindia.gov.in/acts-rules-patents.htm",
        "domain": "Statutory Patent Law",
        "keywords": ["3(e)", "3e", "admixture", "synergism", "combination", "aggregation"],
        "text": (
            "Section 3(e) renders unpatentable a substance obtained by a mere admixture resulting only in the aggregation "
            "of the properties of the components thereof, or a process for producing such substance. "
            "Legal Requirement: Experimental synergism data demonstrating unexpected combined efficacy (e.g., CI < 1 or isobologram) "
            "must be presented to satisfy patent examiner guidelines."
        )
    },
    {
        "document_id": "STATUTE-BD-ACT-2002",
        "chunk_id": "RAG2-SEC-006",
        "title": "Section 6 - The Biological Diversity Act, 2002 (Mandatory NBA Approval for IPR)",
        "source_name": "National Biodiversity Authority, Government of India",
        "source_url": "https://nbaindia.nic.in/acts-and-rules",
        "domain": "Biodiversity & Regulatory Law",
        "keywords": ["section 6", "nba", "approval", "form iii", "ipr", "biological resource", "patent application"],
        "text": (
            "Section 6(1): Mandatory requirement that no person shall apply for any intellectual property right, "
            "in or outside India, for any invention based on research or information on a biological resource obtained from India "
            "without obtaining the prior approval of the National Biodiversity Authority (Form III). "
            "Penalty for Non-Compliance: Criminal liability under Section 55(1) punishable with imprisonment up to 5 years and fine."
        )
    },
    {
        "document_id": "STATUTE-BD-ACT-2002",
        "chunk_id": "RAG2-SEC-040",
        "title": "Section 40 - The Biological Diversity Act, 2002 (Normally Traded Commodities Exemption)",
        "source_name": "National Biodiversity Authority, Government of India",
        "source_url": "https://nbaindia.nic.in/acts-and-rules",
        "domain": "Biodiversity & Regulatory Law",
        "keywords": ["section 40", "ntc", "normally traded commodities", "exemption", "domestic trade"],
        "text": (
            "Section 40 empowers Central Government to exempt biological resources normally traded as commodities (NTC list). "
            "Legal Qualification: Exemption applies strictly when biological resources are traded as commodities for domestic "
            "consumption or direct trade. It does NOT exempt entities from Section 6 when applying for patents on inventions "
            "derived from such commodities."
        )
    },
    {
        "document_id": "REGULATION-ABS-2014",
        "chunk_id": "RAG2-REG-ABS-MATRIX",
        "verification_status": "needs_human_verification",
        "verification_id": "abs-legacy",
        "title": "Guidelines on Access to Biological Resources and Associated Knowledge and Benefits Sharing Regulations, 2014",
        "source_name": "National Biodiversity Authority Gazette Notification",
        "source_url": "https://nbaindia.nic.in/acts-and-rules/regulations",
        "domain": "Access and Benefit Sharing Regulations",
        "keywords": ["abs", "benefit sharing", "percentage", "gross sales", "turnover", "royalty"],
        "text": (
            "Commercial entities utilizing Indian bio-resources must pay benefit sharing to NBA/SBB calculated on ex-factory gross sales: "
            "0.1% for annual turnover up to ₹1 Crore; 0.2% for ₹1 to ₹3 Crores; 0.5% for turnover exceeding ₹3 Crores. "
            "Form I approval required prior to commercial access."
        )
    }
]


class MockRAG2Connector(BaseRAGConnector):
    """
    Reference connector simulating RAG 2 (Legal & Regulatory Evidence).
    Provides authoritative legal statutes, section analyses, compliance requirements,
    and statutory penalty verification.
    """

    def __init__(self):
        super().__init__(
            rag_id="rag2_legal_regulatory",
            name="RAG 2: Legal & Regulatory Evidence (Reference)",
            role="authoritative_legal",
            authority_tier="statutory_authority",
            description="Authoritative legal repository covering Patents Act 1970, Biological Diversity Act 2002, and ABS Regulations.",
            connector_type="reference_mock"
        )

    async def health_check(self) -> bool:
        return True

    async def retrieve(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        top_k: int = 5
    ) -> List[RAGEvidence]:
        q_lower = query.lower()
        scored_statutes: List[Tuple[Dict[str, Any], float]] = []

        for stat in LEGAL_STATUTES:
            score = 0.0
            for kw in stat["keywords"]:
                if kw in q_lower:
                    score += 0.35
            # Word match
            for word in re.findall(r"\w+", stat["title"].lower()):
                if word in q_lower and len(word) > 3:
                    score += 0.15

            if score > 0.0:
                scored_statutes.append((stat, min(1.0, score + 0.3)))

        # Fallback to top statutes if no exact keyword match
        if not scored_statutes:
            scored_statutes = [(stat, 0.4) for stat in LEGAL_STATUTES[:top_k]]
        else:
            scored_statutes.sort(key=lambda x: x[1], reverse=True)

        evidence: List[RAGEvidence] = []
        for stat, score in scored_statutes[:top_k]:
            evidence.append(
                annotate_evidence(RAGEvidence(
                    document_id=stat["document_id"],
                    chunk_id=stat["chunk_id"],
                    title=stat["title"],
                    source_name=stat["source_name"],
                    source_url=stat["source_url"],
                    text=stat["text"],
                    domain=stat["domain"],
                    score=round(score, 4),
                    authority_tier=self.authority_tier,
                    rag_source="RAG2",
                    evidence_category="legal_regulatory",
                    verification_status=stat.get("verification_status", "needs_human_verification"),
                ))
            )
        return evidence

    async def query(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, List[RAGEvidence], float]:
        top_k = filters.get("top_k", 3) if filters else 3
        evidence = await self.retrieve(query, filters, top_k)
        top_score = evidence[0].score if evidence else 0.0

        points = []
        for idx, ev in enumerate(evidence, 1):
            points.append(f"[{idx}] {ev.title}:\n    {ev.text}")

        answer_context = (
            f"RAG 2 Authoritative Legal Assessment:\n"
            + "\n\n".join(points)
            + "\n\n[Statutory Compliance]: All biological inventions must clear NBA Section 6 approval "
            "prior to patent grant, and patent claims must affirmatively establish synergism under Section 3(e) "
            "to overcome Section 3(p) traditional knowledge exclusions."
        )

        return answer_context, evidence, top_score
