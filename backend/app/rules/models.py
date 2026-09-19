"""Typed data contracts; no legal determinations are encoded in this module."""
from __future__ import annotations

from datetime import date
from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

VerificationStatus = Literal["verified", "unverified", "needs_human_verification"]
ContextField = Literal["query", "jurisdiction", "route_intent", "citation_ids", "graph_node_ids"]
EvidenceCategory = Literal["traditional_knowledge", "patent_prior_art", "legal_regulatory", "unclassified"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Equals(StrictModel):
    op: Literal["eq"]
    field: ContextField
    value: str


class ContainsAny(StrictModel):
    op: Literal["contains_any"]
    field: ContextField
    values: list[str] = Field(min_length=1)

    @model_validator(mode="after")
    def nonempty_terms(self) -> ContainsAny:
        if any(not value.strip() for value in self.values):
            raise ValueError("contains_any terms must not be empty")
        return self


class All(StrictModel):
    op: Literal["all"]
    conditions: list[RuleCondition] = Field(min_length=1)


class AnyOf(StrictModel):
    op: Literal["any"]
    conditions: list[RuleCondition] = Field(min_length=1)


class Not(StrictModel):
    op: Literal["not"]
    condition: RuleCondition


RuleCondition = Annotated[Union[Equals, ContainsAny, All, AnyOf, Not], Field(discriminator="op")]
for _model in (All, AnyOf, Not):
    _model.model_rebuild()


class EvidenceFreshness(StrictModel):
    status: Literal["snapshot_only", "stale", "unknown"] = "unknown"
    corpus_versions: dict[str, str] = Field(default_factory=dict)
    note: str = "Source currency has not been verified."


class RuleSourceRef(StrictModel):
    source_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    version: str | None
    effective_from: date | None
    effective_to: date | None = None
    source_url: HttpUrl | None
    corpus_file: str | None = None
    corpus_sha256: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")
    record_ids: list[str] = Field(default_factory=list)
    verification_status: VerificationStatus
    note: str = Field(min_length=1)


class Conclusion(StrictModel):
    rule: str
    status: str
    finding: str
    mitigation: str


class RuleDefinition(StrictModel):
    id: str = Field(min_length=1)
    jurisdiction: str = Field(min_length=1)
    topic: str = Field(min_length=1)
    condition: RuleCondition
    conclusion_template: Conclusion
    source_refs: list[str] = Field(min_length=1)
    effective_from: date | None
    effective_to: date | None
    version: str = Field(min_length=1)
    verification_status: VerificationStatus
    priority: int
    review_note: str

    @model_validator(mode="after")
    def valid_interval(self) -> RuleDefinition:
        if self.effective_to and (not self.effective_from or self.effective_to < self.effective_from):
            raise ValueError("effective_to requires a non-later effective_from")
        if self.verification_status == "verified" and not self.effective_from:
            raise ValueError("verified rules require a known effective_from")
        return self


class IntentOption(StrictModel):
    keywords: list[str] = Field(min_length=1)
    label: str


class StepTemplate(StrictModel):
    step: int
    title: str
    summary: str
    details: str | None = None


class Presentation(StrictModel):
    primary_jurisdiction: str
    default_intent: str
    intent_options: list[IntentOption]
    fallback_intent: str
    primary_steps: list[StepTemplate]
    fallback_steps: list[StepTemplate]
    path_fallback: str
    action_plan: list[str]
    source_refs: list[str]
    disclaimer: str
    scope_note: str


class VerificationItem(StrictModel):
    id: str
    verification_status: Literal["needs_human_verification"]
    note: str
    locations: list[str]
    source_refs: list[str]
    record_ids: list[str] = Field(default_factory=list)
    graph_node_ids: list[str] = Field(default_factory=list)
    graph_edges: list[tuple[str, str]] = Field(default_factory=list)
    query_terms: list[str] = Field(default_factory=list)


class RuleSet(StrictModel):
    rules: list[RuleDefinition]
    sources: dict[str, RuleSourceRef]
    presentation: Presentation
    verification_items: list[VerificationItem]
    ruleset_hash: str
    evidence_freshness: EvidenceFreshness


class RuleContext(StrictModel):
    query: str
    jurisdiction: str
    route_intent: str = "hybrid"
    citation_ids: list[str] = Field(default_factory=list)
    graph_node_ids: list[str] = Field(default_factory=list)


class RuleSelection(StrictModel):
    as_of: date | None
    mode: Literal["strict", "legacy_compatibility"]
    rules: list[RuleDefinition]
    unresolved: list[RuleDefinition] = Field(default_factory=list)


class ConditionTrace(StrictModel):
    op: str
    field: ContextField | None = None
    matched: bool
    matched_values: list[str] = Field(default_factory=list)
    children: list[ConditionTrace] = Field(default_factory=list)


class RuleMatch(StrictModel):
    rule_id: str
    version: str
    topic: str
    conclusion: Conclusion
    condition_trace: ConditionTrace
    citations: list[RuleSourceRef]
    retrieved_source_ids: list[str]
    evidence_freshness: EvidenceFreshness
    verification_status: VerificationStatus
    temporal_status: Literal["in_recorded_interval", "unresolved"]
    determination_ready: bool
    human_verification_items: list[str]


class RuleEvaluation(StrictModel):
    mode: Literal["strict", "legacy_compatibility"]
    as_of: date | None
    ruleset_hash: str
    matches: list[RuleMatch]
    unresolved_rule_ids: list[str]
    evidence_freshness: EvidenceFreshness


class ClaimAudit(StrictModel):
    citations: list[RuleSourceRef]
    evidence_freshness: EvidenceFreshness
    verification_status: VerificationStatus
    human_verification_items: list[str]


class EvidenceGroups(StrictModel):
    traditional_knowledge: list[str] = Field(default_factory=list)
    patent_prior_art: list[str] = Field(default_factory=list)
    legal_regulatory: list[str] = Field(default_factory=list)
    unclassified: list[str] = Field(default_factory=list)


class ReasoningAudit(StrictModel):
    evaluation: RuleEvaluation
    presentation: ClaimAudit
    evidence_groups: EvidenceGroups
    verification_items: list[VerificationItem]
    scope_note: str
    disclaimer: str


class AgenticReasoningResponse(StrictModel):
    intent: str
    subgraph: dict[str, Any]
    reasoning_steps: list[StepTemplate]
    statutory_checks: list[Conclusion]
    action_plan: list[str]
    audit: ReasoningAudit
