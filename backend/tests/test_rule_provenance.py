"""Provenance, evidence separation, and the existing HTTP response contract."""
import asyncio
import json
import re
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.core.agentic_reasoner import agentic_reasoner
from app.core.knowledge_graph import knowledge_graph
from app.core.llm import groq_llm
from app.data.ingestion import ingest_knowledge_base
from app.data.models import MultiRAGQueryRequest, RAGEvidence
from app.main import app
from app.orchestrator.http_connector import HTTPRAGConnector
from app.orchestrator.mock_rag2_connector import MockRAG2Connector
from app.orchestrator.registry import rag_registry
from app.orchestrator.service import orchestrator_service
from app.rag2.ingestion import ingest_legal_knowledge_base
from app.rag2.synthesizer import build_legal_citations
from app.retrieval.synthesizer import build_evidence_list
from app.rules.loader import get_rule_set
from app.rules.provenance import resolve_retrieved_sources


def test_abs_graph_node_and_edge_have_citations_and_review_status():
    graph = knowledge_graph.extract_relevant_subgraph("NBA ABS benefit sharing", [], max_nodes=30)
    node = next(node for node in graph["nodes"] if node["id"] == "filing_abs_agreement")
    edge = next(edge for edge in graph["edges"] if edge["source"] == "auth_nba" and edge["target"] == node["id"])
    for item in (node, edge):
        audit = item["audit"]
        assert audit["verification_status"] == "needs_human_verification"
        assert audit["evidence_freshness"]["status"] == "snapshot_only"
        assert audit["human_verification_items"]
        assert any(source["source_id"] == "abs-2014" for source in audit["citations"])
        assert all({"source_id", "title", "version", "effective_from", "source_url"} <= source.keys() for source in audit["citations"])
    node["audit"]["citations"].clear()
    assert knowledge_graph.extract_relevant_subgraph("NBA ABS", [], max_nodes=30)["nodes"] != graph["nodes"]


def test_registry_covers_corpus_abs_percentages_and_both_mirrors():
    snapshot = get_rule_set()
    review = next(item for item in snapshot.verification_items if item.id == "abs-legacy")
    records = [json.loads(line) for line in (settings.BASE_DIR / "rag2_legal_regulatory_evidence.jsonl").read_text(encoding="utf-8").splitlines()]
    percent = re.compile(r"\d(?:[\d.,\s]|to|-)*%|\bpercent\b|\bper\s+cent\b", re.I)
    rate_records = {record["record_id"] for record in records
                    if record["category"] in ("nba_abs_guidelines", "biodiversity_rules_2004")
                    and percent.search(record["text"])}
    # The excluded passage is committee composition, not a benefit-sharing rate.
    rate_records.discard("RAG2-00081")
    assert rate_records <= set(review.record_ids)
    for corpus in ("rag1_ayurveda_ip_knowledge", "rag2_legal_regulatory_evidence"):
        assert any(corpus + ".jsonl" in location for location in review.locations)
        assert any(corpus + ".csv" in location for location in review.locations)


def test_abs_annotations_survive_ingestion_and_existing_database_models():
    domain = next(chunk for chunk in ingest_knowledge_base() if chunk.record_id == "RAG1-AYUSH-0016")
    domain_evidence = build_evidence_list([(domain, 0.5)])[0]
    assert domain_evidence.record_id == domain.record_id
    assert domain_evidence.text == domain.text
    assert domain_evidence.verification_items[0].id == "abs-legacy"
    assert domain_evidence.verification_status == "needs_human_verification"
    assert domain_evidence.evidence_category == "unclassified"
    legal = next(chunk for chunk in ingest_legal_knowledge_base() if chunk.record_id == "RAG2-03416")
    legal_evidence = build_legal_citations([(legal, 0.5)])[0][0]
    assert legal_evidence.verification_items[0].id == "abs-legacy"
    assert legal_evidence.source_refs
    assert legal_evidence.version == "2014"
    assert legal_evidence.effective_from is None  # Do not certify category-wide assigned dates.
    assert legal_evidence.evidence_freshness.status == "snapshot_only"


def test_mock_abs_is_flagged_without_inventing_replacement_rates():
    evidence = asyncio.run(MockRAG2Connector().retrieve("ABS gross sales turnover"))
    abs_evidence = next(item for item in evidence if item.chunk_id == "RAG2-REG-ABS-MATRIX")
    assert abs_evidence.verification_status == "needs_human_verification"
    assert abs_evidence.verification_items[0].id == "abs-legacy"
    assert abs_evidence.evidence_freshness.status == "unknown"


def test_retrieved_source_resolution_requires_url_and_evidence_category():
    snapshot = get_rule_set()
    source = snapshot.sources["patents-tk"]
    legal = RAGEvidence(document_id="FIXTURE", chunk_id=source.record_ids[0], title=source.title,
                        source_name="Test", source_url=str(source.source_url), evidence_category="legal_regulatory")
    assert resolve_retrieved_sources([legal], snapshot) == ["patents-tk"]
    assert resolve_retrieved_sources([legal.model_copy(update={"evidence_category": "patent_prior_art"})], snapshot) == []
    assert resolve_retrieved_sources([legal.model_copy(update={"source_url": "https://example.test/"})], snapshot) == []


def test_reasoner_is_repeatable_without_llm_and_has_no_statutory_constants():
    with patch.object(groq_llm, "generate_answer", new_callable=AsyncMock, side_effect=AssertionError("Rule evaluation must not call the LLM")):
        first = agentic_reasoner.analyze_and_reason("patent formulation", [])
        second = agentic_reasoner.analyze_and_reason("patent formulation", [])
    assert first == second
    assert "based on the accessible evidence corpus" in first["audit"]["scope_note"]
    assert first["audit"]["disclaimer"].startswith("This is decision support, not legal advice")
    source = (settings.BASE_DIR / "app/core/agentic_reasoner.py").read_text(encoding="utf-8")
    assert not re.search(r"Section\s+\d|\bNBA\b|\bTKDL\b|\bFSSAI\b|\bPatents Act\b|\bForm\s+(?:III|3)|\d\s*%", source)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_existing_query_endpoint_returns_rule_audit_and_preserves_international_scope(client):
    data = client.post("/api/v1/orchestrator/query", json={"query": "NBA ABS patent formulation"}).json()
    audit = data["agentic_reasoning"]["audit"]
    assert len(audit["evaluation"]["matches"]) == 3
    assert all(not match["determination_ready"] for match in audit["evaluation"]["matches"])
    assert audit["sources"]["abs-2014"]["source_url"]
    assert any(item["id"] == "abs-legacy" for item in audit["verification_items"])
    assert audit["evidence_groups"]["patent_prior_art"] == []
    international = client.post("/api/v1/orchestrator/query", json={"query": "patent formulation", "jurisdiction": "INTERNATIONAL"}).json()
    assert international["agentic_reasoning"]["statutory_checks"] == []
    assert international["agentic_reasoning"]["action_plan"] == []
    assert international["agentic_reasoning"]["audit"]["sources"] == {}
    assert international["graph"]["nodes"] == []


def test_registered_patent_evidence_stays_out_of_tk_group():
    connector = HTTPRAGConnector("test_patent_evidence", "https://example.test", role="prior_art")
    connector.query = AsyncMock(return_value=("Prior art fixture", [RAGEvidence(
        document_id="P", chunk_id="P1", title="Patent fixture", source_name="Fixture", rag_source=connector.rag_id
    )], 0.5))
    rag_registry.register(connector)
    try:
        result = asyncio.run(orchestrator_service.execute_query(MultiRAGQueryRequest(query="prior art", target_rags=[connector.rag_id])))
        groups = result.agentic_reasoning.audit.evidence_groups
        assert groups.patent_prior_art == ["test_patent_evidence:P:P1"]
        assert groups.traditional_knowledge == []
        assert groups.legal_regulatory == []
    finally:
        rag_registry.unregister(connector.rag_id)


def test_escalation_keeps_verification_metadata(client, monkeypatch, tmp_path):
    destination = tmp_path / "cases.jsonl"
    monkeypatch.setattr(settings, "ESCALATION_STORE_PATH", destination)
    evidence = asyncio.run(MockRAG2Connector().retrieve("ABS gross sales turnover"))
    citation = next(item for item in evidence if item.chunk_id == "RAG2-REG-ABS-MATRIX")
    response = client.post("/api/v1/human/escalate", json={"query": "review", "citations": [citation.model_dump(mode="json")]})
    assert response.status_code == 200
    saved = json.loads(destination.read_text(encoding="utf-8"))["citations"][0]
    assert saved["verification_items"][0]["id"] == "abs-legacy"
    assert saved["source_refs"]
    assert saved["evidence_freshness"]["status"] == "unknown"
