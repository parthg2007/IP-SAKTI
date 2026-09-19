"""Validated, explicitly reloaded JSON rules. Corpus text is never modified."""
from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from string import Formatter
from threading import RLock

from pydantic import TypeAdapter, ValidationError

from app.config import settings
from app.rules.models import EvidenceFreshness, Presentation, RuleDefinition, RuleSet, RuleSourceRef, VerificationItem

logger = logging.getLogger(__name__)
_lock = RLock()
_loaded: RuleSet | None = None
_loaded_path: Path | None = None
_TEMPLATE_FIELDS = {"jurisdiction", "intent", "node_count", "edge_count", "paths", "citation_count", "check_count"}


class RuleConfigurationError(ValueError):
    """Invalid or unavailable rule data must not silently disable checks."""


def _validate_templates(presentation: Presentation) -> None:
    for step in presentation.primary_steps + presentation.fallback_steps:
        for text in (step.title, step.summary, step.details or ""):
            for _, field, spec, conversion in Formatter().parse(text):
                if field is not None and (field not in _TEMPLATE_FIELDS or spec or conversion):
                    raise ValueError(f"Unsupported presentation placeholder: {field}")


def load_rule_set(path: Path, *, corpus_root: Path | None = None) -> RuleSet:
    """Read one complete snapshot; source hashes describe freshness, not currency."""
    path = path.resolve()
    root = (corpus_root or settings.BASE_DIR).resolve()
    try:
        files = sorted(path.glob("*.json"))
        if not files:
            raise ValueError(f"No JSON rule files in {path}")
        contents = {file.name: file.read_bytes() for file in files}
        documents = {name: json.loads(raw) for name, raw in contents.items()}
        presentation = Presentation.model_validate(documents.pop("reasoning_presentation.json"))
        source_list = TypeAdapter(list[RuleSourceRef]).validate_python(documents.pop("sources.json"))
        reviews = TypeAdapter(list[VerificationItem]).validate_python(documents.pop("verification_items.json"))
        rules = [rule for name in sorted(documents) for rule in TypeAdapter(list[RuleDefinition]).validate_python(documents[name])]
        sources = {source.source_id: source for source in source_list}
        if len(sources) != len(source_list):
            raise ValueError("Duplicate source IDs")
        if len({item.id for item in reviews}) != len(reviews):
            raise ValueError("Duplicate verification-item IDs")
        versions: dict[str, list[RuleDefinition]] = {}
        for rule in rules:
            previous = versions.setdefault(rule.id, [])
            for other in previous:
                if rule.version == other.version:
                    raise ValueError(f"Duplicate rule version: {rule.id}/{rule.version}")
                if rule.effective_from and other.effective_from:
                    if ((not rule.effective_to or other.effective_from <= rule.effective_to)
                            and (not other.effective_to or rule.effective_from <= other.effective_to)):
                        raise ValueError(f"Overlapping rule intervals: {rule.id}")
                else:
                    raise ValueError(f"Cannot order multiple versions with unknown dates: {rule.id}")
            previous.append(rule)
        for refs in [presentation.source_refs] + [rule.source_refs for rule in rules] + [item.source_refs for item in reviews]:
            if any(ref not in sources for ref in refs):
                raise ValueError(f"Unresolved source reference: {refs}")
        _validate_templates(presentation)

        corpus_versions: dict[str, str] = {}
        corpus_records: dict[str, set[str]] = {}
        stale = False
        for source in source_list:
            if source.corpus_file:
                corpus_path = (root / source.corpus_file).resolve()
                if not corpus_path.is_relative_to(root):
                    raise ValueError("Corpus path must stay within the corpus root")
                if not source.corpus_sha256 or not source.record_ids:
                    raise ValueError(f"Corpus source requires a hash and record IDs: {source.source_id}")
                if source.corpus_file not in corpus_versions:
                    raw = corpus_path.read_bytes()
                    corpus_versions[source.corpus_file] = hashlib.sha256(raw).hexdigest()
                    corpus_records[source.corpus_file] = {json.loads(line)["record_id"] for line in raw.decode("utf-8").splitlines() if line.strip()}
                stale |= corpus_versions[source.corpus_file] != source.corpus_sha256
                if not set(source.record_ids).issubset(corpus_records[source.corpus_file]):
                    raise ValueError(f"Missing corpus record for {source.source_id}")
            elif source.verification_status == "verified" or source.source_url is None:
                raise ValueError(f"Unbacked source requires an unverified candidate URL: {source.source_id}")
        digest = hashlib.sha256()
        for name, raw in contents.items():
            digest.update(name.encode("utf-8") + b"\0" + raw + b"\0")
        result = RuleSet(
            rules=sorted(rules, key=lambda rule: (rule.priority, rule.id, rule.version)), sources=sources,
            presentation=presentation, verification_items=reviews, ruleset_hash=digest.hexdigest(),
            evidence_freshness=EvidenceFreshness(
                status="stale" if stale else "snapshot_only", corpus_versions=corpus_versions,
                note="Corpus changed from the cited snapshot; human verification required." if stale else "Checked against the accessible local corpus snapshot; current law has not been verified.",
            ),
        )
        if stale:
            logger.warning("Rule source corpus differs from pinned snapshot: %s", path)
        logger.info("Loaded %d rules from %s (snapshot %s)", len(rules), path, result.ruleset_hash[:12])
        return result
    except (OSError, ValueError, KeyError, TypeError, ValidationError) as exc:
        logger.exception("Cannot load rule configuration from %s", path)
        raise RuleConfigurationError(f"Cannot load rule configuration from {path}: {exc}") from exc


def get_rule_set() -> RuleSet:
    """Lazily load for direct callers; return copies to protect the shared snapshot."""
    global _loaded, _loaded_path
    path = settings.RULES_DIR.resolve()
    with _lock:
        if _loaded is None or _loaded_path != path:
            _loaded = load_rule_set(path)
            _loaded_path = path
        return _loaded.model_copy(deep=True)


def reload_rule_set() -> RuleSet:
    """Validate before replacing the active snapshot; errors propagate to caller."""
    global _loaded, _loaded_path
    path = settings.RULES_DIR.resolve()
    with _lock:
        replacement = load_rule_set(path)
        _loaded, _loaded_path = replacement, path
        return replacement.model_copy(deep=True)
