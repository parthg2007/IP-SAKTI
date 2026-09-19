"""Historical software behavior, not assertions of legal correctness.

Captured from bb8f710 before the Phase 1 refactor. Do not regenerate these
fixtures from the replacement implementation.
"""
import json
from pathlib import Path

import pytest

from app.core.agentic_reasoner import agentic_reasoner
from app.core.knowledge_graph import knowledge_graph
from app.data.models import RAGEvidence


BASELINE = json.loads(
    (Path(__file__).parent / "fixtures" / "agentic_reasoner_legacy.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize("case", BASELINE["cases"], ids=lambda case: case["name"])
def test_legacy_reasoner_output(case):
    request = {**case["input"], "citations": [RAGEvidence(**c) for c in case["input"]["citations"]]}
    output = agentic_reasoner.analyze_and_reason(**request)
    assert {key: output[key] for key in case["expected"]} == case["expected"]


def test_legacy_abs_graph():
    assert knowledge_graph.extract_relevant_subgraph(
        "NBA ABS benefit sharing", [], max_nodes=30
    ) == BASELINE["abs_graph"]
