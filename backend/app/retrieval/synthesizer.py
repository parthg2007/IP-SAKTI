"""Context and evidence synthesis module."""
from typing import List, Tuple
from app.data.models import KnowledgeChunk, RAGEvidence
from app.rules.provenance import annotate_evidence


def build_evidence_list(results: List[Tuple[KnowledgeChunk, float]]) -> List[RAGEvidence]:
    """Converts retrieved chunk tuples into standard RAGEvidence objects."""
    evidence: List[RAGEvidence] = []
    for chunk, score in results:
        evidence.append(
            annotate_evidence(RAGEvidence(
                document_id=chunk.document_id,
                chunk_id=chunk.chunk_id,
                title=chunk.title,
                source_name=chunk.source_name,
                source_url=chunk.source_url,
                text=chunk.text,
                domain=chunk.domain,
                score=score,
                authority_tier=chunk.authority_tier,
                rag_source="RAG1",
                record_id=chunk.record_id,
                version=chunk.document_version,
                evidence_category="traditional_knowledge" if chunk.domain in ("Prior Art & Classical Literature", "AYURVEDA", "Medicinal Plants") else "unclassified",
            ))
        )
    return evidence


def synthesize_answer_context(
    query: str,
    evidence: List[RAGEvidence],
    language: str = "en"
) -> str:
    """
    Synthesizes domain answer context from retrieved evidence chunks.
    Maintains strict fidelity to domain knowledge boundaries (RAG 1 does not make
    authoritative legal or regulatory decisions).
    """
    if not evidence:
        if language == "hi":
            return "दिए गए प्रश्न के संबंध में RAG 1 आयुर्वेद/बौद्धिक संपदा ज्ञानकोष में प्रासंगिक संदर्भ नहीं मिला।"
        return "No direct domain knowledge evidence was retrieved in RAG 1 for this query."

    # Highlight key insights from top evidence
    primary = evidence[0]
    points = []
    for idx, ev in enumerate(evidence[:4], 1):
        points.append(f"[{idx}] {ev.title} ({ev.source_name}): {ev.text}")

    evidence_summary = "\n\n".join(points)

    if language == "hi":
        answer = (
            f"RAG 1 ज्ञानकोष संदर्भ:\n"
            f"मुख्य विषय: {primary.title} (स्रोत: {primary.source_name})\n\n"
            f"संबंधित प्रमाण:\n{evidence_summary}\n\n"
            f"नोट: RAG 1 केवल पारंपरिक ज्ञान एवं बौद्धिक संपदा अवधारणात्मक संदर्भ प्रदान करता है, "
            f"अंतिम विधिक/नियामक निर्णय हेतु RAG 2 (विधिक प्रमाण) का उपयोग करें।"
        )
    else:
        answer = (
            f"RAG 1 Domain Knowledge Summary:\n"
            f"Topic: {primary.title} (Source: {primary.source_name})\n\n"
            f"Domain Evidence Details:\n{evidence_summary}\n\n"
            f"[RAG 1 Principle]: Explains Ayurveda & IP concepts. Does not independently establish legal conclusions."
        )

    return answer
