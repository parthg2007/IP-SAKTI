"""Historical software behavior, not assertions of legal correctness.

Captured from bb8f710 before the Phase 1 refactor. Do not regenerate these
fixtures from the replacement implementation.
"""
import json
from copy import deepcopy
from pathlib import Path

import pytest

from app.core.agentic_reasoner import agentic_reasoner
from app.core.knowledge_graph import knowledge_graph
from app.data.models import RAGEvidence


BASELINE = json.loads(
    (Path(__file__).parent / "fixtures" / "agentic_reasoner_legacy.json").read_text(encoding="utf-8")
)


def without_added_graph_audit(graph):
    graph = deepcopy(graph)
    for item in graph["nodes"] + graph["edges"]:
        item.pop("audit", None)
    return graph


def with_approved_safety_exceptions(expected, jurisdiction):
    """Enumerate approved text changes, never regenerate the historical fixture."""
    expected = deepcopy(expected)
    if jurisdiction == "INDIA":
        expected["statutory_checks"][0]["finding"] = (
            "Review traditional-knowledge overlap based on the accessible evidence corpus. "
            "TKDL is restricted-access and non-exhaustive; this keyword match does not establish patentability."
        )
        for check in expected["statutory_checks"]:
            if check["status"] == "EVIDENTIARY_BURDEN":
                check["mitigation"] = "Obtain appropriate comparative evidence of synergy. TODO: the legacy numerical test requires human verification; no mandatory threshold is established here."
        old_summary = expected["reasoning_steps"][2]["summary"]
        count = old_summary.split()[1]
        expected["reasoning_steps"][2]["summary"] = f"Retrieved {count} citations for separate domain and legal review."
        expected["reasoning_steps"][2]["details"] = "Retrieval does not establish legal applicability or a complete prior-art search."
        expected["reasoning_steps"][3]["details"] = "Approval timing and applicability require human verification against the cited sources."
        expected["reasoning_steps"][4]["summary"] = "Prepared a deterministic review checklist; legal interpretations require human verification."
        expected["action_plan"][0] = "Review traditional-knowledge evidence based on the accessible evidence corpus, and obtain a separate patent prior-art search. TKDL is restricted-access and non-exhaustive."
    return expected


@pytest.mark.parametrize("case", BASELINE["cases"], ids=lambda case: case["name"])
def test_legacy_reasoner_output(case):
    request = {**case["input"], "citations": [RAGEvidence(**c) for c in case["input"]["citations"]]}
    output = agentic_reasoner.analyze_and_reason(**request)
    output["subgraph"] = without_added_graph_audit(output["subgraph"])
    assert {key: output[key] for key in case["expected"]} == with_approved_safety_exceptions(case["expected"], request["jurisdiction"])


def test_legacy_abs_graph():
    assert without_added_graph_audit(knowledge_graph.extract_relevant_subgraph(
        "NBA ABS benefit sharing", [], max_nodes=30
    )) == BASELINE["abs_graph"]
