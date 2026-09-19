"""Compatibility adapter for the deterministic, data-driven reasoning trace."""
from __future__ import annotations

from datetime import date
from typing import Any

from app.core.knowledge_graph import knowledge_graph
from app.rules.evaluator import evaluate_rules, select_legacy_rules, select_rules
from app.rules.loader import get_rule_set
from app.rules.models import EvidenceGroups, RuleContext
from app.rules.presenter import render_trace


class AgenticReasoner:
    """Build context, evaluate a rule snapshot, then render the structured result."""

    def analyze_and_reason(
        self, query: str, citations: list[Any], jurisdiction: str = "INDIA",
        route_intent: str = "hybrid", *, as_of: date | None = None,
    ) -> dict[str, Any]:
        subgraph = knowledge_graph.extract_relevant_subgraph(query, citations, jurisdiction=jurisdiction)
        rule_set = get_rule_set()
        context = RuleContext(
            query=query or "", jurisdiction=jurisdiction, route_intent=route_intent,
            citation_ids=[citation.chunk_id for citation in citations if getattr(citation, "chunk_id", None)],
            graph_node_ids=[node["id"] for node in subgraph["nodes"]],
        )
        groups = EvidenceGroups().model_dump()
        for citation in citations:
            category = getattr(citation, "evidence_category", "unclassified")
            key = f"{getattr(citation, 'rag_source', '')}:{getattr(citation, 'document_id', '')}:{getattr(citation, 'chunk_id', '')}"
            if key not in groups[category]:
                groups[category].append(key)
        selection = select_rules(rule_set, jurisdiction, as_of) if as_of is not None else select_legacy_rules(rule_set, jurisdiction)
        evaluation = evaluate_rules(context, selection, rule_set)
        result = render_trace(context, evaluation, rule_set, subgraph, EvidenceGroups(**groups), len(citations))
        output = result.model_dump(mode="json")
        output["reasoning_steps"] = [step.model_dump(exclude_none=True) for step in result.reasoning_steps]
        return output


agentic_reasoner = AgenticReasoner()
