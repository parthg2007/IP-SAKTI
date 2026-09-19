"""Multi-RAG Orchestrator Service for query routing, multi-RAG execution, and evidence fusion."""
import asyncio
import logging
from typing import List, Dict, Any, Optional

from app.orchestrator.registry import rag_registry
from app.orchestrator.router import query_router
from app.core.llm import groq_llm

from app.data.models import (
    MultiRAGQueryRequest,
    MultiRAGQueryResponse,
    RAGEvidence,
    RAGRouteDecision
)
from app.core.language import detect_language, translate_indic_query
from app.core.bhashini import SUPPORTED_LANGUAGES, bhashini
from app.core.knowledge_graph import knowledge_graph
from app.core.agentic_reasoner import agentic_reasoner

logger = logging.getLogger(__name__)


class KnowledgeServiceUnavailable(RuntimeError):
    """No selected knowledge service could complete the query."""


class MultiRAGOrchestratorService:
    """
    Coordinates query execution across connected RAG units (e.g. RAG 1 and RAG 2).
    Implements the IP-SAKTI integration pipeline:
      Query -> Router -> [RAG 1 Context + RAG 2 Legal Evidence] -> Fusion -> Verified Response
    """

    async def execute_query(self, request: MultiRAGQueryRequest) -> MultiRAGQueryResponse:
        original_query = request.query.strip()
        lang = request.language or detect_language(original_query)
        lang = lang if lang in SUPPORTED_LANGUAGES else "en"

        # Multilingual Translation Pipeline: translate non-English queries for English knowledge base
        retrieval_query = original_query
        translated_in = False
        if lang != "en":
            # Tier 1: Try BHASHINI if configured
            if bhashini.enabled:
                retrieval_query, translated_in = await bhashini.translate(original_query, lang, "en")
            # Tier 2: Try Groq fast translation if available
            if not translated_in and groq_llm.is_enabled:
                retrieval_query = await groq_llm.translate_query_to_english(original_query, lang)
                if retrieval_query != original_query:
                    translated_in = True
            # Tier 3: Local Indic Lexicon & concept translation fallback
            if not translated_in:
                retrieval_query, translated_in = translate_indic_query(original_query)

        # 1. Route using normalized English query
        route_input = retrieval_query if translated_in else original_query
        if request.target_rags and len(request.target_rags) > 0:
            route_decision = RAGRouteDecision(
                target_rags=request.target_rags, primary_rag=request.target_rags[0], intent="user_specified_target",
                confidence=1.0, explanation="User explicitly specified target RAG units."
            )
        else:
            route_decision = query_router.route(route_input)
            if request.jurisdiction == "INTERNATIONAL":
                route_decision = RAGRouteDecision(
                    target_rags=["rag2_legal_regulatory"], primary_rag="rag2_legal_regulatory",
                    intent="international_legal_context", confidence=1.0,
                    explanation="International context is available in the legal treaty corpus; the domain corpus covers India."
                )

        # 2. Gather evidence across target RAG units
        tasks = []
        target_connectors = []
        for rag_id in route_decision.target_rags:
            connector = rag_registry.get(rag_id)
            if connector:
                target_connectors.append(connector)
                tasks.append(connector.query(
                    query=retrieval_query,
                    filters={"top_k": request.top_k_per_rag or 4, "jurisdiction": request.jurisdiction, "language": lang}
                ))
            else:
                logger.warning("Target RAG '%s' requested but not registered in registry.", rag_id)

        if not tasks:
            raise KnowledgeServiceUnavailable("No selected knowledge services are available.")

        results = await asyncio.gather(*tasks, return_exceptions=True)
        domain_context = None
        legal_evidence_context = None
        all_citations: List[RAGEvidence] = []
        domain_evidence_keys = set()
        legal_evidence_keys = set()
        responded_rags: List[str] = []
        retrieval_scores: List[float] = []

        for connector, res in zip(target_connectors, results):
            if isinstance(res, Exception):
                logger.error("Error querying RAG '%s': %s", connector.rag_id, res)
                continue
            ans_context, ev_list, score = res
            # Preserve connector identity and keep patent prior art distinct from TK.
            category = {"authoritative_legal": "legal_regulatory", "prior_art": "patent_prior_art"}.get(connector.role)
            if category:
                ev_list = [evidence.model_copy(update={"evidence_category": category}) for evidence in ev_list]
            responded_rags.append(connector.rag_id)
            retrieval_scores.append(float(score or 0.0))
            all_citations.extend(ev_list)
            keys = {(ev.rag_source, ev.document_id, ev.chunk_id) for ev in ev_list}
            if connector.role == "authoritative_legal":
                legal_evidence_context = "\n\n".join(filter(None, [legal_evidence_context, ans_context]))
                legal_evidence_keys.update(keys)
            else:
                domain_context = "\n\n".join(filter(None, [domain_context, ans_context]))
                domain_evidence_keys.update(keys)

        if not responded_rags:
            raise KnowledgeServiceUnavailable("The knowledge services could not complete the query.")

        # Label evidence deterministically so the LLM can cite [S1], [S2], ...
        deduped_citations: List[RAGEvidence] = []
        seen_chunks = set()
        for cit in all_citations:
            key = (cit.rag_source, cit.document_id, cit.chunk_id)
            if key not in seen_chunks:
                seen_chunks.add(key)
                deduped_citations.append(cit)
        deduped_citations.sort(key=lambda c: (0 if c.authority_tier in ("statutory_authority", "TIER_1_AUTHORITATIVE") else 1, -(c.score or 0.0)))

        def mark_context(context: Optional[str], citations: List[RAGEvidence]) -> Optional[str]:
            if not context:
                return None
            labels = []
            global_index = {(c.rag_source, c.document_id, c.chunk_id): idx for idx, c in enumerate(deduped_citations, 1)}
            for cit in citations:
                idx = global_index[(cit.rag_source, cit.document_id, cit.chunk_id)]
                labels.append(f"[S{idx}] {cit.title} | Source: {cit.source_name} | URL: {cit.source_url or 'not provided'} | Evidence: {(cit.text or '').strip()}")
            return "\n\n".join(labels) if labels else context

        domain_cits = [c for c in deduped_citations if (c.rag_source, c.document_id, c.chunk_id) in domain_evidence_keys]
        legal_cits = [c for c in deduped_citations if (c.rag_source, c.document_id, c.chunk_id) in legal_evidence_keys]
        labeled_domain = mark_context(domain_context, domain_cits)
        labeled_legal = mark_context(legal_evidence_context, legal_cits)

        # 3. Generate answer: Groq directly generates in the target language (or English if en)
        synthesized_answer = await groq_llm.generate_answer(
            query=retrieval_query, domain_context=labeled_domain, legal_context=labeled_legal,
            jurisdiction=request.jurisdiction, language=lang,
        )

        translated_out = False
        if bhashini.enabled and lang != "en" and not groq_llm.is_enabled:
            synthesized_answer, translated_out = await bhashini.translate(synthesized_answer, "en", lang)

        # 4. Deterministic user-facing confidence based on evidence quality + routing.
        evidence_scores = [float(c.score or 0.0) for c in deduped_citations[:6]]
        top_score = max(evidence_scores, default=0.0)
        mean_top = sum(evidence_scores[:3]) / len(evidence_scores[:3]) if evidence_scores else 0.0
        evidence_quality = (0.65 * top_score) + (0.35 * mean_top)
        confidence_score = max(0.0, min(1.0, 0.65 * evidence_quality + 0.35 * route_decision.confidence))
        if not deduped_citations:
            confidence_score = 0.42 if route_decision.intent not in ("authoritative_legal_statute", "international_legal_context") else 0.28
        level = "high" if confidence_score >= 0.75 else "moderate" if confidence_score >= 0.55 else "low"
        legal_intent = route_decision.intent in ("authoritative_legal_statute", "international_legal_context") or legal_evidence_context is not None
        escalation_recommended = (confidence_score < 0.55) or (legal_intent and confidence_score < 0.72)
        basis = (
            f"Routing confidence {route_decision.confidence:.0%}; strongest retrieved evidence {top_score:.0%}; "
            f"{len(deduped_citations)} cited evidence item(s)."
        )
        if lang != "en" and (translated_in or translated_out):
            basis += f" Multilingual translation applied for {lang}."

        # 5. Add a compact deterministic source list to the answer itself.
        if deduped_citations:
            source_lines = ["\n### Sources"]
            for idx, cit in enumerate(deduped_citations[:6], 1):
                target = f" — {cit.source_url}" if cit.source_url else ""
                source_lines.append(f"[S{idx}] {cit.title} — {cit.source_name}{target}")
            synthesized_answer = synthesized_answer.rstrip() + "\n" + "\n".join(source_lines)

        legal_disclaimer = (
            "For research and understanding. This answer uses the available source corpus and is not legal advice. "
            "Verify current requirements with a qualified professional in the relevant jurisdiction."
        )

        # 6. Extract Relational Knowledge Graph and Agentic Reasoning trace
        subgraph = knowledge_graph.extract_relevant_subgraph(retrieval_query, deduped_citations, jurisdiction=request.jurisdiction)
        agentic_trace = agentic_reasoner.analyze_and_reason(
            query=original_query,
            citations=deduped_citations,
            jurisdiction=request.jurisdiction,
            route_intent=route_decision.intent
        )

        return MultiRAGQueryResponse(
            query=original_query, language=lang, jurisdiction=request.jurisdiction, route_decision=route_decision,
            synthesized_answer=synthesized_answer, domain_context=domain_context, legal_evidence_context=legal_evidence_context,
            citations=deduped_citations, connected_rags_responded=responded_rags, legal_disclaimer=legal_disclaimer,
            confidence={"score": round(confidence_score, 3), "level": level, "basis": basis, "escalation_recommended": escalation_recommended},
            graph=subgraph, agentic_reasoning=agentic_trace
        )



orchestrator_service = MultiRAGOrchestratorService()
