"""Pure evaluation with an explicit temporal policy and inspectable match traces."""
from __future__ import annotations

from datetime import date

from app.rules.models import (
    All, AnyOf, ConditionTrace, ContainsAny, Equals, Not, RuleCondition,
    RuleContext, RuleEvaluation, RuleMatch, RuleSelection, RuleSet,
)


def evaluate_condition(condition: RuleCondition, context: RuleContext) -> ConditionTrace:
    if isinstance(condition, (All, AnyOf)):
        children = [evaluate_condition(child, context) for child in condition.conditions]
        matched = all(child.matched for child in children) if isinstance(condition, All) else any(child.matched for child in children)
        return ConditionTrace(op=condition.op, matched=matched, children=children)
    if isinstance(condition, Not):
        child = evaluate_condition(condition.condition, context)
        return ConditionTrace(op=condition.op, matched=not child.matched, children=[child])
    value = getattr(context, condition.field)
    if isinstance(condition, Equals):
        matched = value == condition.value
        return ConditionTrace(op=condition.op, field=condition.field, matched=matched, matched_values=[condition.value] if matched else [])
    if isinstance(condition, ContainsAny):
        # Strings use legacy case-insensitive substring matching; lists use exact membership.
        matched_values = [term for term in condition.values if (term.lower() in value.lower() if isinstance(value, str) else term in value)]
        return ConditionTrace(op=condition.op, field=condition.field, matched=bool(matched_values), matched_values=matched_values)
    raise TypeError(f"Unsupported condition: {type(condition).__name__}")


def select_rules(rule_set: RuleSet, jurisdiction: str, as_of: date) -> RuleSelection:
    """Select recorded intervals inclusively. Undated rules are unresolved, not active."""
    if type(as_of) is not date:
        raise TypeError("as_of must be an explicit date")
    candidates = [rule for rule in rule_set.rules if rule.jurisdiction == jurisdiction]
    active = [rule for rule in candidates if rule.effective_from and rule.effective_from <= as_of and (not rule.effective_to or as_of <= rule.effective_to)]
    return RuleSelection(as_of=as_of, mode="strict", rules=active, unresolved=[rule for rule in candidates if not rule.effective_from])


def select_legacy_rules(rule_set: RuleSet, jurisdiction: str) -> RuleSelection:
    """Explicit compatibility policy; never implies rules are currently in force."""
    candidates = [rule for rule in rule_set.rules if rule.jurisdiction == jurisdiction]
    if len({rule.id for rule in candidates}) != len(candidates):
        raise ValueError("Legacy selection is ambiguous across versions; supply an explicit as_of date")
    return RuleSelection(as_of=None, mode="legacy_compatibility", rules=candidates, unresolved=[rule for rule in candidates if not rule.effective_from])


def evaluate_rules(context: RuleContext, selection: RuleSelection, rule_set: RuleSet) -> RuleEvaluation:
    matches = []
    for rule in sorted(selection.rules, key=lambda item: (item.priority, item.id, item.version)):
        if rule.jurisdiction != context.jurisdiction:
            continue
        trace = evaluate_condition(rule.condition, context)
        if not trace.matched:
            continue
        sources = [rule_set.sources[ref] for ref in rule.source_refs]
        retrieved = [source.source_id for source in sources if source.source_id in context.retrieved_source_ids]
        temporal = "in_recorded_interval" if selection.mode == "strict" else "unresolved"
        ready = (selection.mode == "strict" and rule.verification_status == "verified"
                 and all(source.verification_status == "verified" for source in sources)
                 and rule_set.evidence_freshness.status == "snapshot_only" and len(retrieved) == len(sources))
        notes = []
        if rule.verification_status != "verified":
            notes.append(rule.review_note)
        if temporal == "unresolved":
            notes.append("Temporal applicability is unresolved; this is a legacy compatibility match.")
        if len(retrieved) != len(sources):
            notes.append("The query did not retrieve all referenced source records; a keyword match is not evidence of applicability.")
        if any(source.verification_status != "verified" for source in sources):
            notes.append("Referenced source interpretation and currency require human verification.")
        if rule_set.evidence_freshness.status == "stale":
            notes.append(rule_set.evidence_freshness.note)
        matches.append(RuleMatch(
            rule_id=rule.id, version=rule.version, topic=rule.topic, conclusion=rule.conclusion_template,
            condition_trace=trace, citations=sources, retrieved_source_ids=retrieved,
            evidence_freshness=rule_set.evidence_freshness, verification_status=rule.verification_status,
            temporal_status=temporal, determination_ready=ready, human_verification_items=notes,
        ))
    return RuleEvaluation(mode=selection.mode, as_of=selection.as_of, ruleset_hash=rule_set.ruleset_hash,
                          matches=matches, unresolved_rule_ids=[rule.id for rule in selection.unresolved],
                          evidence_freshness=rule_set.evidence_freshness)
