"""Pydantic schemas and data models for IP-SAKTI RAG backend."""
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator
from app.rules.models import AgenticReasoningResponse, EvidenceCategory, EvidenceFreshness, RuleSourceRef, VerificationItem, VerificationStatus

# -----------------------------------------------------------------------------
# Core Knowledge Chunk Model
# -----------------------------------------------------------------------------
class KnowledgeChunk(BaseModel):
    """Canonical domain knowledge chunk as specified in README.MD."""
    chunk_id: str = Field(..., description="Unique identifier for chunk (e.g. RAG1-000001)")
    document_id: str = Field(..., description="Parent document identifier (e.g. DOC-001)")
    record_id: Optional[str] = Field(None, description="Original record ID from dataset")
    domain: str = Field(..., description="High-level domain (e.g. AYURVEDA, PATENTS, STATUTORY_LAW)")
    subdomain: Optional[str] = Field(None, description="Subdomain category (e.g. FORMULATION, PRIOR_ART)")
    topic: Optional[str] = Field(None, description="Topic or subtopic")
    jurisdiction: Optional[str] = Field("National (India)", description="Applicable jurisdiction")
    language: str = Field("en", description="Detected language code (e.g. en, hi)")
    title: str = Field(..., description="Title of the chunk or subject")
    text: str = Field(..., description="Text content of the chunk")
    source_name: str = Field(..., description="Source authority or publication")
    source_url: Optional[str] = Field(None, description="URL of source")
    authority_tier: Optional[str] = Field("auxiliary_seed", description="Authority tier (e.g. auxiliary_seed)")
    rag_role: Optional[str] = Field("domain_context", description="Role in IP-SAKTI architecture")
    formulation_category: Optional[str] = Field(None, description="Formulation category if applicable")
    document_version: Optional[str] = Field("1.0", description="Document version")
    published_at: Optional[str] = Field(None, description="Publication timestamp")
    content_hash: Optional[str] = Field(None, description="SHA256 content hash")
    note: Optional[str] = Field(None, description="Auxiliary notes/disclaimers")


# -----------------------------------------------------------------------------
# Evidence & Citation Models
# -----------------------------------------------------------------------------
class RAGEvidence(BaseModel):
    """Evidence citation item returned with queries."""
    document_id: str = Field(..., description="Document identifier")
    chunk_id: str = Field(..., description="Chunk identifier")
    title: str = Field(..., description="Document/chunk title")
    source_name: str = Field(..., description="Source name")
    source_url: Optional[str] = Field(None, description="Source URL")
    text: Optional[str] = Field(None, description="Snippet or text evidence")
    domain: Optional[str] = Field(None, description="Domain")
    score: Optional[float] = Field(None, description="Retrieval / relevance score")
    authority_tier: Optional[str] = Field(None, description="Authority level of source")
    rag_source: Optional[str] = Field("RAG1", description="RAG unit providing this evidence")
    record_id: Optional[str] = None
    version: Optional[str] = None
    effective_from: Optional[str] = None
    effective_to: Optional[str] = None
    evidence_category: EvidenceCategory = "unclassified"
    evidence_freshness: EvidenceFreshness = Field(default_factory=EvidenceFreshness)
    verification_status: VerificationStatus = "needs_human_verification"
    verification_items: List[VerificationItem] = Field(default_factory=list)
    source_refs: List[RuleSourceRef] = Field(default_factory=list)


# -----------------------------------------------------------------------------
# RAG 1 API Request / Response Models
# -----------------------------------------------------------------------------
class RAGQueryRequest(BaseModel):
    """Request payload for POST /api/v1/rag/knowledge/query."""
    query: str = Field(..., description="User question or query string", min_length=1)
    language: Optional[str] = Field(None, description="Language hint (en, hi, etc.) - detected if omitted")
    domain: Optional[str] = Field(None, description="Optional domain filter")
    jurisdiction: Optional[Literal["INDIA", "INTERNATIONAL"]] = None
    top_k: Optional[int] = Field(5, description="Number of evidence chunks to retrieve", ge=1, le=20)


class RAGQueryResponse(BaseModel):
    """Output payload for POST /api/v1/rag/knowledge/query as specified in README.MD."""
    query: str
    language: str
    answer_context: str
    evidence: List[RAGEvidence]
    retrieval_score: float
    disclaimer: str = "RAG 1 provides domain context and explains concepts. It does not independently determine legal applicability. Verify legal claims against RAG 2."


class RAGSearchRequest(BaseModel):
    """Request payload for POST /api/v1/rag/knowledge/search."""
    query: str = Field(..., description="Search terms", min_length=1)
    mode: Optional[str] = Field("hybrid", description="Search mode: hybrid, vector, or bm25")
    domain: Optional[str] = Field(None, description="Domain filter")
    top_k: Optional[int] = Field(5, description="Number of results", ge=1, le=50)


class RAGSearchHit(BaseModel):
    """Individual search result item."""
    chunk_id: str
    document_id: str
    title: str
    domain: str
    subtopic: Optional[str] = None
    text: str
    source_name: str
    source_url: Optional[str] = None
    score: float
    retrieval_method: str


class RAGSearchResponse(BaseModel):
    """Response for POST /api/v1/rag/knowledge/search."""
    query: str
    mode: str
    total_hits: int
    results: List[RAGSearchHit]


class RAGHealthResponse(BaseModel):
    """Response for GET /api/v1/rag/knowledge/health."""
    status: str
    rag_id: str = "RAG1_AYURVEDA_IP"
    total_chunks: int
    total_sources: int
    domains_indexed: List[str]
    retrievers_active: List[str]


# -----------------------------------------------------------------------------
# Multi-RAG Orchestrator Schemas
# -----------------------------------------------------------------------------
class RAGRouteDecision(BaseModel):
    """Route decision indicating which RAG services should handle the query."""
    target_rags: List[str] = Field(..., description="List of RAG IDs to query (e.g. ['rag1', 'rag2'])")
    primary_rag: str = Field(..., description="Main RAG responsible for context")
    intent: str = Field(..., description="Detected intent (conceptual, legal, hybrid)")
    confidence: float = Field(..., description="Routing confidence between 0 and 1")
    explanation: str = Field(..., description="Rationale for routing decision")


class MultiRAGQueryRequest(BaseModel):
    """Request payload for POST /api/v1/orchestrator/query."""
    query: str = Field(..., description="User query requiring single or multi-RAG context", min_length=1, max_length=4000)
    jurisdiction: Literal["INDIA", "INTERNATIONAL"] = "INDIA"
    target_rags: Optional[List[str]] = Field(None, description="Explicit RAGs to query. If omitted, router decides.")
    language: Optional[str] = Field(None, description="Language hint")
    top_k_per_rag: Optional[int] = Field(4, description="Max evidence chunks per connected RAG", ge=1, le=10)

    @field_validator("query", mode="before")
    @classmethod
    def strip_query(cls, value):
        return value.strip() if isinstance(value, str) else value


class ConfidenceAssessment(BaseModel):
    """User-facing confidence assessment derived from routing + retrieval evidence."""
    score: float = Field(..., ge=0.0, le=1.0)
    level: Literal["high", "moderate", "low"]
    basis: str
    escalation_recommended: bool = False


class HumanEscalationRequest(BaseModel):
    """Request to route a question and its evidence trail to a human IP facilitator."""
    query: str = Field(..., min_length=1, max_length=4000)
    language: str = "en"
    jurisdiction: Literal["INDIA", "INTERNATIONAL"] = "INDIA"
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    answer: Optional[str] = Field(None, max_length=64000)
    citations: List[RAGEvidence] = Field(default_factory=list, max_length=100)
    user_note: Optional[str] = Field(None, max_length=2000)


class HumanEscalationResponse(BaseModel):
    case_id: str
    status: str
    message: str
    facilitator_email: Optional[str] = None


class MultiRAGQueryResponse(BaseModel):
    """Response from Multi-RAG Orchestrator combining context across RAGs."""
    query: str
    language: str
    jurisdiction: Literal["INDIA", "INTERNATIONAL"] = "INDIA"
    route_decision: RAGRouteDecision
    synthesized_answer: str
    domain_context: Optional[str] = None
    legal_evidence_context: Optional[str] = None
    citations: List[RAGEvidence]
    confidence: ConfidenceAssessment
    connected_rags_responded: List[str]
    legal_disclaimer: str
    graph: Optional[Dict[str, Any]] = None
    agentic_reasoning: Optional[AgenticReasoningResponse] = None


class RAGRegistrationRequest(BaseModel):
    """Request to register a new external/secondary RAG service dynamically."""
    rag_id: str = Field(..., description="Unique identifier for the RAG (e.g. rag2_legal)")
    name: str = Field(..., description="Human readable name")
    role: str = Field(..., description="Role in IP-SAKTI (e.g. authoritative_legal, prior_art)")
    endpoint_url: str = Field(..., description="Base HTTP URL of the remote RAG API")
    authority_tier: Optional[str] = Field("authoritative", description="Authority tier")
    description: Optional[str] = Field(None, description="Description of RAG coverage")


class RAGInfo(BaseModel):
    """Status & metadata of a registered RAG service."""
    rag_id: str
    name: str
    role: str
    connector_type: str
    is_healthy: bool
    authority_tier: str
    description: Optional[str] = None
    endpoint_url: Optional[str] = None
