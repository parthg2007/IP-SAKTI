"""Sidecar verification annotations keep the checked-in corpus excerpts intact."""
from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.data.models import RAGEvidence
from app.rules.loader import get_rule_set
from app.rules.models import ClaimAudit, EvidenceFreshness, RuleSet, VerificationItem


def annotate_evidence(evidence: RAGEvidence, *, rule_set: RuleSet | None = None) -> RAGEvidence:
    snapshot = rule_set or get_rule_set()
    identities = {evidence.chunk_id, evidence.record_id}
    sources = [source for source in snapshot.sources.values() if identities.intersection(source.record_ids)]
    reviews = [item for item in snapshot.verification_items if identities.intersection(item.record_ids)]
    if not sources and not reviews:
        return evidence
    source = sources[0] if sources else None
    updates: dict[str, Any] = {
        "verification_status": "unverified" if evidence.verification_status == "unverified" else "needs_human_verification",
        "verification_items": reviews,
        "source_refs": [snapshot.sources[ref] for ref in sorted({ref for item in reviews for ref in item.source_refs} | {source.source_id for source in sources})],
        "evidence_freshness": snapshot.evidence_freshness if sources else EvidenceFreshness(
            note="Legacy mock statement; no verified current source snapshot."
        ),
    }
    if source:
        updates.update(version=source.version,
                       effective_from=source.effective_from.isoformat() if source.effective_from else None,
                       effective_to=source.effective_to.isoformat() if source.effective_to else None)
    return evidence.model_copy(update=updates)


def resolve_retrieved_sources(citations: list[RAGEvidence], snapshot: RuleSet) -> list[str]:
    """A matching ID alone cannot turn TK or a remote patent passage into legal evidence."""
    return sorted(source.source_id for source in snapshot.sources.values() if any(
        {citation.chunk_id, citation.record_id}.intersection(source.record_ids)
        and citation.source_url == str(source.source_url)
        and citation.evidence_category == source.evidence_category
        for citation in citations
    ))


def annotate_graph(graph: dict[str, Any]) -> dict[str, Any]:
    snapshot = get_rule_set()
    result = deepcopy(graph)
    for node in result["nodes"]:
        reviews = [item for item in snapshot.verification_items if node["id"] in item.graph_node_ids]
        if reviews:
            node["audit"] = _claim_audit(snapshot, reviews).model_dump(mode="json")
    for edge in result["edges"]:
        reviews = [item for item in snapshot.verification_items if (edge["source"], edge["target"]) in item.graph_edges]
        if reviews:
            edge["audit"] = _claim_audit(snapshot, reviews).model_dump(mode="json")
    return result


def _claim_audit(snapshot: RuleSet, reviews: list[VerificationItem]) -> ClaimAudit:
    refs = sorted({ref for item in reviews for ref in item.source_refs})
    return ClaimAudit(citations=[snapshot.sources[ref] for ref in refs], evidence_freshness=snapshot.evidence_freshness,
                      verification_status="needs_human_verification", human_verification_items=[item.note for item in reviews])
