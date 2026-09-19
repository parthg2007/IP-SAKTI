"""Engine mechanics use synthetic dates; they do not establish legal validity."""
import json
import shutil
from datetime import date
from pathlib import Path

import pytest
from pydantic import TypeAdapter, ValidationError

from app.config import settings
from app.rules.evaluator import evaluate_condition, evaluate_rules, select_legacy_rules, select_rules
from app.rules.loader import RuleConfigurationError, get_rule_set, load_rule_set, reload_rule_set
from app.rules.models import RuleCondition, RuleContext, RuleDefinition


@pytest.fixture
def rules_dir(tmp_path):
    destination = tmp_path / "rules"
    shutil.copytree(settings.BASE_DIR / "data" / "rules", destination)
    return destination


def rewrite(path, change):
    value = json.loads(path.read_text(encoding="utf-8"))
    change(value)
    path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")


def condition(data):
    return TypeAdapter(RuleCondition).validate_python(data)


def test_nested_conditions_trace_all_branches_and_case_semantics():
    tree = condition({"op": "all", "conditions": [
        {"op": "contains_any", "field": "query", "values": ["plant", "mixture"]},
        {"op": "not", "condition": {"op": "eq", "field": "jurisdiction", "value": "OTHER"}},
        {"op": "any", "conditions": [
            {"op": "contains_any", "field": "citation_ids", "values": ["SRC"]},
            {"op": "contains_any", "field": "graph_node_ids", "values": ["node"]},
        ]},
    ]})
    context = RuleContext(query="PLANT mixture", jurisdiction="TEST", citation_ids=["SRC"])
    trace = evaluate_condition(tree, context)
    assert trace.matched
    assert trace.children[0].matched_values == ["plant", "mixture"]
    assert [child.matched for child in trace.children[2].children] == [True, False]
    assert evaluate_condition(tree, context) == trace


@pytest.mark.parametrize("data", [
    {"op": "python", "field": "query", "value": "anything"},
    {"op": "eq", "field": "__dict__", "value": "anything"},
    {"op": "contains_any", "field": "query", "values": [""]},
    {"op": "all", "conditions": []},
    {"op": "eq", "field": "query", "value": "x", "extra": True},
])
def test_unknown_or_invalid_conditions_rejected(data):
    with pytest.raises(ValidationError):
        condition(data)


def test_missing_list_is_not_a_match_and_equality_is_case_sensitive():
    context = RuleContext(query="Hello", jurisdiction="TEST")
    assert not evaluate_condition(condition({"op": "contains_any", "field": "citation_ids", "values": ["SRC"]}), context).matched
    assert not evaluate_condition(condition({"op": "eq", "field": "query", "value": "hello"}), context).matched


def test_recorded_date_boundaries_gap_and_unknown_dates():
    rules = load_rule_set(settings.RULES_DIR)
    # Synthetic interval solely to exercise date selection, not a legal date claim.
    dated = RuleDefinition.model_validate({**rules.rules[0].model_dump(), "id": "synthetic", "jurisdiction": "TEST",
        "effective_from": "2090-01-02", "effective_to": "2090-01-04"})
    sample = rules.model_copy(update={"rules": [dated]})
    for day, count in [(1, 0), (2, 1), (4, 1), (5, 0)]:
        assert len(select_rules(sample, "TEST", date(2090, 1, day)).rules) == count
    assert select_rules(sample, "OTHER", date(2090, 1, 3)).rules == []
    current = select_rules(rules, "INDIA", date(2090, 1, 3))
    assert current.rules == []
    assert len(current.unresolved) == 3
    with pytest.raises(TypeError):
        select_rules(sample, "TEST", "2090-01-03")


@pytest.mark.parametrize("mutation", [
    lambda rules: rules.append(rules[0].copy()),
    lambda rules: rules[0].update(source_refs=["missing"]),
    lambda rules: rules[0].update(effective_from="2090-01-04", effective_to="2090-01-02"),
    lambda rules: rules[0].update(verification_status="verified"),
])
def test_invalid_rule_files_fail_loudly(rules_dir, mutation, caplog):
    rewrite(rules_dir / "legacy_india.json", mutation)
    with pytest.raises(RuleConfigurationError):
        load_rule_set(rules_dir)
    assert "Cannot load rule configuration" in caplog.text


def test_overlapping_versions_rejected_but_adjacent_intervals_allowed(rules_dir):
    def duplicate(data):
        data[0].update(effective_from="2090-01-01", effective_to="2090-01-02")
        data.append({**data[0], "version": "synthetic-next", "effective_from": "2090-01-02", "effective_to": None})
    rewrite(rules_dir / "legacy_india.json", duplicate)
    with pytest.raises(RuleConfigurationError, match="Overlapping"):
        load_rule_set(rules_dir)
    rewrite(rules_dir / "legacy_india.json", lambda data: data[-1].update(effective_from="2090-01-03"))
    rules = load_rule_set(rules_dir)
    assert len(select_rules(rules, "INDIA", date(2090, 1, 3)).rules) == 1
    with pytest.raises(ValueError, match="ambiguous"):
        select_legacy_rules(rules, "INDIA")


def test_no_rules_for_other_jurisdiction_and_legacy_matches_are_not_decisions():
    rules = load_rule_set(settings.RULES_DIR)
    context = RuleContext(query="patent formulation", jurisdiction="INDIA")
    result = evaluate_rules(context, select_legacy_rules(rules, "INDIA"), rules)
    assert len(result.matches) == 3
    assert all(not match.determination_ready for match in result.matches)
    assert all(match.temporal_status == "unresolved" for match in result.matches)
    assert all(match.citations and match.human_verification_items for match in result.matches)
    assert all(match.retrieved_source_ids == [] for match in result.matches)
    assert result == evaluate_rules(context, select_legacy_rules(rules, "INDIA"), rules)
    assert evaluate_rules(context, select_legacy_rules(rules, "INTERNATIONAL"), rules).matches == []


def test_exact_retrieved_record_identity_not_just_related_text():
    rules = load_rule_set(settings.RULES_DIR)
    context = RuleContext(query="hello", jurisdiction="INDIA", citation_ids=["RAG2-03458"])
    result = evaluate_rules(context, select_legacy_rules(rules, "INDIA"), rules)
    assert result.matches[0].retrieved_source_ids == ["patents-tk"]
    assert not result.matches[0].determination_ready


def test_data_edit_requires_explicit_reload_and_changes_output(rules_dir, monkeypatch):
    monkeypatch.setattr(settings, "RULES_DIR", rules_dir)
    before = reload_rule_set()
    rewrite(rules_dir / "legacy_india.json", lambda data: data[0]["conclusion_template"].update(finding="Edited fixture finding"))
    assert get_rule_set() == before
    after = reload_rule_set()
    assert after.ruleset_hash != before.ruleset_hash
    context = RuleContext(query="hello", jurisdiction="INDIA")
    assert evaluate_rules(context, select_legacy_rules(after, "INDIA"), after).matches[0].conclusion.finding == "Edited fixture finding"
    # Callers cannot mutate the cached snapshot via its nested lists.
    get_rule_set().rules.clear()
    assert len(get_rule_set().rules) == 3
    rewrite(rules_dir / "legacy_india.json", lambda data: data[0].update(source_refs=["missing"]))
    with pytest.raises(RuleConfigurationError):
        reload_rule_set()
    assert get_rule_set() == after


def test_malformed_json_and_unsafe_presentation_fail(rules_dir):
    rewrite(rules_dir / "reasoning_presentation.json", lambda data: data["primary_steps"][0].update(summary="{jurisdiction.__class__}"))
    with pytest.raises(RuleConfigurationError, match="placeholder"):
        load_rule_set(rules_dir)
    (rules_dir / "sources.json").write_text("{broken", encoding="utf-8")
    with pytest.raises(RuleConfigurationError):
        load_rule_set(rules_dir)


def test_changed_corpus_is_stale_and_missing_records_fail(rules_dir, tmp_path):
    corpus_root = tmp_path / "corpus"
    corpus_root.mkdir()
    for filename in ("rag1_ayurveda_ip_knowledge.jsonl", "rag2_legal_regulatory_evidence.jsonl"):
        shutil.copyfile(settings.BASE_DIR / filename, corpus_root / filename)
    target = corpus_root / "rag1_ayurveda_ip_knowledge.jsonl"
    with target.open("a", encoding="utf-8") as handle:
        handle.write("\n")
    assert load_rule_set(rules_dir, corpus_root=corpus_root).evidence_freshness.status == "stale"
    target.write_text("", encoding="utf-8")
    with pytest.raises(RuleConfigurationError, match="Missing corpus record"):
        load_rule_set(rules_dir, corpus_root=corpus_root)


def test_unresolved_source_and_corpus_path_escape_rejected(rules_dir):
    rewrite(rules_dir / "sources.json", lambda data: data[0].update(corpus_file="../outside.jsonl"))
    with pytest.raises(RuleConfigurationError, match="Corpus path"):
        load_rule_set(rules_dir)


def test_rule_order_is_stable_if_file_order_changes(rules_dir):
    before = load_rule_set(rules_dir)
    rewrite(rules_dir / "legacy_india.json", lambda data: data.reverse())
    after = load_rule_set(rules_dir)
    assert after.rules == before.rules
