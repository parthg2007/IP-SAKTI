"""Citation-first legal evidence formatter and context synthesizer for RAG 2."""
import logging
from typing import List, Tuple, Optional
from app.rag2.models import LegalEvidenceChunk, LegalCitation
from app.data.models import RAGEvidence
from app.rules.provenance import annotate_evidence

logger = logging.getLogger(__name__)


def build_legal_citations(hits: List[Tuple[LegalEvidenceChunk, float]]) -> Tuple[List[RAGEvidence], List[LegalCitation]]:
    """Builds standard RAGEvidence and granular LegalCitation models with verified provenance."""
    rag_evidences: List[RAGEvidence] = []
    legal_citations: List[LegalCitation] = []

    for chunk, score in hits:
        # Standard RAGEvidence for orchestrator fusion
        rag_evidences.append(
            annotate_evidence(RAGEvidence(
                document_id=chunk.document_id,
                chunk_id=chunk.chunk_id,
                title=f"{chunk.document_title}" + (f" - Section {chunk.section}" if chunk.section else ""),
                source_name=f"Official Gazette / {chunk.document_title}",
                source_url=chunk.source_url,
                text=chunk.text[:500] + ("..." if len(chunk.text) > 500 else ""),
                domain=chunk.domain,
                score=round(score, 4),
                authority_tier=chunk.authority_tier,
                rag_source="RAG2",
                record_id=chunk.record_id,
                version=chunk.version,
                effective_from=chunk.effective_from,
                effective_to=chunk.effective_to,
                evidence_category="legal_regulatory",
            ))
        )

        # Precise LegalCitation
        legal_citations.append(
            LegalCitation(
                document_id=chunk.document_id,
                title=chunk.document_title,
                section=chunk.section,
                rule=chunk.rule,
                article=chunk.article,
                source_name=chunk.document_title,
                source_url=chunk.source_url,
                version=chunk.version,
                chunk_id=chunk.chunk_id,
                effective_from=chunk.effective_from,
                authority_tier=chunk.authority_tier,
                relevance_score=round(score, 4),
                jurisdiction=chunk.jurisdiction
            )
        )

    return rag_evidences, legal_citations


def synthesize_legal_answer_context(
    query: str,
    citations: List[LegalCitation],
    chunks: List[LegalEvidenceChunk],
    language: str = "en"
) -> str:
    """Synthesizes an authoritative statutory answer context with strict provenance citations."""
    if not citations:
        return "No authoritative statutory provisions found matching the specified legal query."

    lines = [f"### Authoritative Statutory & Regulatory Evidence (RAG 2)\n"]

    for idx, (cit, chunk) in enumerate(zip(citations, chunks), 1):
        ref_header = f"[{idx}] {cit.title}"
        if cit.section:
            ref_header += f" — Section {cit.section}"
        elif cit.rule:
            ref_header += f" — Rule {cit.rule}"
        elif cit.article:
            ref_header += f" — Article {cit.article}"

        lines.append(f"**{ref_header}**")
        lines.append(f"- **Authority Tier**: {cit.authority_tier} (Jurisdiction: {cit.jurisdiction})")
        if cit.source_url:
            lines.append(f"- **Official Source**: [{cit.title}]({cit.source_url})")
        if cit.effective_from:
            lines.append(f"- **Effective Version**: {cit.version} (In force since {cit.effective_from})")

        # Excerpt
        clean_text = " ".join(chunk.text[:400].split())
        lines.append(f"- **Statutory Text**: \"{clean_text}...\"\n")

    return "\n".join(lines)
