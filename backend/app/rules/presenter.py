"""Render trace text from data after deterministic evaluation, without an LLM."""
from __future__ import annotations

from typing import Any

from app.rules.models import (
    AgenticReasoningResponse, ClaimAudit, EvidenceGroups, ReasoningAudit,
    RuleContext, RuleEvaluation, RuleSet, StepTemplate,
)


def render_trace(context: RuleContext, evaluation: RuleEvaluation, rule_set: RuleSet,
                 subgraph: dict[str, Any], evidence_groups: EvidenceGroups,
                 citation_count: int) -> AgenticReasoningResponse:
    presentation = rule_set.presentation
    primary = context.jurisdiction == presentation.primary_jurisdiction
    intent = presentation.default_intent if primary else presentation.fallback_intent
    if primary:
        for option in presentation.intent_options:
            if any(keyword in context.query.lower() for keyword in option.keywords):
                intent = option.label
                break
    values = {
        "jurisdiction": context.jurisdiction, "intent": intent,
        "node_count": len(subgraph["nodes"]), "edge_count": len(subgraph["edges"]),
        "paths": "; ".join(subgraph["reasoning_paths"]) or presentation.path_fallback,
        "citation_count": citation_count, "check_count": len(evaluation.matches),
    }
    steps = [StepTemplate(**{key: value.format_map(values) if isinstance(value, str) else value
                             for key, value in step.model_dump().items()})
             for step in (presentation.primary_steps if primary else presentation.fallback_steps)]
    reviews = [item for item in rule_set.verification_items if primary and (
        set(item.record_ids).intersection(context.citation_ids)
        or set(item.graph_node_ids).intersection(context.graph_node_ids)
        or any(term in context.query.lower() for term in item.query_terms)
    )]
    refs = presentation.source_refs if primary else []
    audit = ReasoningAudit(
        evaluation=evaluation,
        presentation=ClaimAudit(citations=[rule_set.sources[ref] for ref in refs],
                                evidence_freshness=rule_set.evidence_freshness,
                                verification_status="needs_human_verification",
                                human_verification_items=["Trace and checklist preserve legacy keyword behavior; verify every legal interpretation and its applicability."] if primary else []),
        evidence_groups=evidence_groups, verification_items=reviews,
        scope_note=presentation.scope_note, disclaimer=presentation.disclaimer,
    )
    return AgenticReasoningResponse(intent=intent, subgraph=subgraph, reasoning_steps=steps,
                                   statutory_checks=[match.conclusion for match in evaluation.matches],
                                   action_plan=presentation.action_plan if primary else [], audit=audit)
