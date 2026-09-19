# Phase 0 reconnaissance and proposed Phase 1 plan

## Scope and provenance

- Reviewed on: 2026-09-19 (Asia/Calcutta).
- Repository baseline: `bb8f710` on `main`; working tree was clean before reconnaissance.
- `evidence_freshness`: `repository_snapshot_bb8f710_2026-09-19`; legal currency is **not verified**.
- Evidence scope: tracked source, datasets, manifests, deployment configuration, and local tests. References below describe this checkout, not the running Render service. No production requests or legal-source refresh was performed.
- Phase 0 changes only documentation. No feature, schema, endpoint, corpus, or application-code changes are authorized in this phase.
- No `AGENTS.md` was found in the repository or its workspace ancestors. Existing context is in [backend/agent.md](../backend/agent.md), [backend/context.md](../backend/context.md), and [README.md](../README.md). The user's current phase boundaries and evidence requirements take precedence over older descriptive guidance.

Legal statements quoted or identified below are **existing repository content to audit**, not legal conclusions endorsed by this document. The ABS inventory has `verification_status: "needs_human_verification"` throughout. Finding a statute in the corpus does not validate the program's interpretation of it.

## Architecture map

### Startup, deployment, and frontend ownership

- [package.json](../package.json) runs the backend through [run-python.js](../run-python.js) and [python-runtime.js](../python-runtime.js). These choose `backend/.venv` first and set the working directory to `backend`. `npm test` runs backend tests followed by root frontend tests, stopping on failure.
- [backend/app/main.py](../backend/app/main.py) owns FastAPI lifespan, CORS, router registration, and SPA serving. Startup initializes both local RAG services and registers RAG1 plus, in priority order, remote RAG2, production local RAG2, or the reference mock.
- [backend/app/config.py](../backend/app/config.py) reads environment variables after loading `backend/.env`. Preserve this mechanism; do not introduce secrets into rule data or logs.
- [render.yaml](../render.yaml) selects the **root** [Dockerfile](../Dockerfile). Its Node build uses `frontend/`, then copies the bundle into the Python image's `frontend/dist`; it builds both local corpus indexes. Production image Python is 3.12 and Node builder is 22.
- The maintained UI is [frontend/src](../frontend/src). `backend/frontend/` is a separate, divergent source copy with its own tests and lockfile. The server prefers root `frontend/dist` and falls back to `backend/frontend/dist`; the root Docker build does not build the copied source tree. Do not mirror future UI changes into the copy automatically.
- The Render configuration provides `/var/data` and explicitly puts escalation JSONL there. Corpus databases are image/runtime-local. Future durable passport storage needs an explicit persistent path; an arbitrary new file under `backend/data` would not inherit persistence merely because a disk exists.

### Request and evidence flow

1. [frontend/src/pages/Chat.jsx](../frontend/src/pages/Chat.jsx), [hooks/useChat.js](../frontend/src/hooks/useChat.js), and [lib/api.js](../frontend/src/lib/api.js) send query, language, jurisdiction, optional connector selection, and retrieval count to `/api/v1/orchestrator/query`. Browser history lives in localStorage through [chatStorage.js](../frontend/src/lib/chatStorage.js).
2. [backend/app/orchestrator/service.py](../backend/app/orchestrator/service.py) translates input with BHASHINI, Groq, then a local Indic lexicon fallback; [router.py](../backend/app/orchestrator/router.py) chooses connectors. An international request without explicit connector overrides routes only to the international legal corpus.
3. Registered connectors run through `asyncio.gather`. [registry.py](../backend/app/orchestrator/registry.py), [base_connector.py](../backend/app/orchestrator/base_connector.py), and local/HTTP connectors expose a tuple of context, `RAGEvidence` items, and retrieval score. Failures are logged; no responding service produces a 503 through [routes.py](../backend/app/orchestrator/routes.py).
4. Evidence is deduplicated by `(rag_source, document_id, chunk_id)`, sorted by authority and score, and assigned `[S1]`, `[S2]`, etc. For fixed connector results and order this is deterministic. Every non-legal connector, including `prior_art`, currently joins `domain_context`: there are two context channels, not the requested three evidence categories.
5. [core/llm.py](../backend/app/core/llm.py) generates the answer from retrieved contexts, with an evidence-based text fallback when unavailable. The orchestrator computes a deterministic retrieval/routing confidence signal, an escalation recommendation, a source list, and a legal disclaimer.
6. **After answer generation**, the orchestrator builds the graph and calls `agentic_reasoner`. The trace therefore does not determine or constrain the existing LLM answer. It also does not prove the answer's claims were verified.
7. The top-level graph is built from the retrieval-language query; the reasoner receives the original query and builds another subgraph. Translated input can therefore produce different graph selections. `route_intent` is accepted by the reasoner but unused.

The target principle, “the LLM explains deterministic results,” is not yet the current chat architecture. Phase 1 should externalize the trace without silently rewriting the answer pipeline; Phase 2 needs a separate deterministic assessment path whose results precede any explanation.

### Retrieval, corpus, and persistence

- RAG1: [app/data/ingestion.py](../backend/app/data/ingestion.py), [core/chunking.py](../backend/app/core/chunking.py), [rag1/service.py](../backend/app/rag1/service.py), and [retrieval](../backend/app/retrieval) ingest domain records and implement BM25 plus vector retrieval and reciprocal-rank fusion. The vector implementation is scikit-learn TF-IDF/cosine similarity, not a neural embedding service.
- RAG2: [rag2/ingestion.py](../backend/app/rag2/ingestion.py), [normalizer.py](../backend/app/rag2/normalizer.py), [retrieval.py](../backend/app/rag2/retrieval.py), [service.py](../backend/app/rag2/service.py), and [synthesizer.py](../backend/app/rag2/synthesizer.py) add legal-category normalization, section reranking, legal citations, historical filtering, and conflicts.
- Existing storage already uses stdlib SQLite: [app/data/storage.py](../backend/app/data/storage.py) writes `vector.db`; [rag2/storage.py](../backend/app/rag2/storage.py) writes `vector_rag2.db`. These store corpus chunks, embeddings, and metadata, not passports or assessments. Escalations use append-only JSONL separately.
- The checked-in RAG1 JSONL contains 64 records; RAG2 contains 4,262 records in 15 categories **before ingestion/deduplication**. JSONL is preferred; CSV is the fallback. Preserve both formats when future source metadata is changed.
- All raw RAG2 records lack `effective_from`. Ingestion assigns category-wide version/date/status metadata from `DOCUMENT_METADATA_MAP`, including `CURRENT` labels and a fallback date for unknown categories. These assigned values are not independent proof of provision-level temporal validity.
- [rag2/versioning.py](../backend/app/rag2/versioning.py) filters retrieved candidates using effective dates, with an inclusive upper bound. The helper treats invalid dates as applicable; API models reject invalid dates first. This filters corpus evidence, not the reasoner's hard-coded checks, and does not reconstruct a comprehensive amendment history.
- [rag2/conflict.py](../backend/app/rag2/conflict.py) contains two hard-coded `KNOWN_TENSIONS` and their legal resolutions. It returns the first tension with enough trigger terms in the query and text excerpts. This is another statutory-logic surface outside the Phase 1 reasoner target.
- Existing databases are loaded when initialized; editing raw corpus files does not automatically invalidate them. A verified corpus update needs an explicit rebuild/version strategy.

Corpus snapshot hashes (SHA-256):

- `rag1_ayurveda_ip_knowledge.jsonl`: `dc223c21c000869b7ad2ffa08a974924f691d25d1e0dfa5b17730c3ad2c73c76`.
- `rag2_legal_regulatory_evidence.jsonl`: `27d2e979ea9ba66ee267c23b581fe43837ce4abcc6db1481a2e466df4fc5183d`.

### Existing endpoint and schema boundaries

- `/api/v1/rag/knowledge`: POST `/query`, POST `/search`, GET `/health`; Pydantic schemas in [app/data/models.py](../backend/app/data/models.py).
- `/api/v1/rag/legal`: POST `/query`, POST `/historical`, POST `/search`, GET `/documents/{document_id}`, GET `/health`; schemas in [rag2/models.py](../backend/app/rag2/models.py).
- `/api/v1/orchestrator`: POST `/query`, POST `/route` (query parameter), GET `/rags`, POST `/rags/register`.
- POST `/api/v1/human/escalate`, POST `/api/v1/voice/transcribe`, GET `/api/v1/languages`, plus system/SPA routes in `main.py`.
- `MultiRAGQueryResponse` contains contexts, citations, confidence, disclaimer, and optional `graph` / `agentic_reasoning` dictionaries. The graph and trace do not yet have dedicated Pydantic contracts.
- `RAGEvidence` includes document/chunk IDs, title, name, URL, snippet, score, authority, and RAG source, but no version, effective date, verification status, or `evidence_freshness`. `LegalCitation` has version/effective date, but [local_rag2_connector.py](../backend/app/orchestrator/local_rag2_connector.py) returns only the less detailed evidence representation. Structured conflict metadata is also not forwarded as an orchestrator field.
- There are no passport, assessment, simulation, evidence-packet, reviewer-transition, or legal-change endpoints at this baseline. Follow the existing `/api/v1` convention for later phases, explicitly reconciling it with the prompt's shorthand routes before implementation.

### Graph construction and human escalation

- [core/knowledge_graph.py](../backend/app/core/knowledge_graph.py) defines static `GRAPH_NODES` (line 7) and `GRAPH_EDGES` (line 165), then defines `RelationalKnowledgeGraph` (line 199) and instantiates its singleton at line 270. It is an in-memory keyword graph, not a graph database or corpus-derived graph.
- `extract_relevant_subgraph` (line 206) matches query plus citation titles/snippets, expands one hop, sorts node IDs deterministically, caps nodes, and filters edges. International scope returns an empty graph. Lines 253-259 generate three hard-coded legal path strings.
- Nodes, edges, and paths contain legal claims without source references, effective dates, or freshness. Updating retrieval alone cannot update this graph. The UI displays descriptions and edge labels in [AgenticReasoningCard.jsx](../frontend/src/components/AgenticReasoningCard.jsx).
- [orchestrator/human_routes.py](../backend/app/orchestrator/human_routes.py) calls [core/escalation.py](../backend/app/core/escalation.py):`create_case`. It appends a UUID/date-based case ID, UTC creation time, `queued_for_human_review` status, and the request to `ESCALATION_STORE_PATH`.
- `HumanEscalationRequest` preserves query, language, jurisdiction, confidence scalar, answer, citations, and a user note. There is no full confidence object, graph, trace, conflict set, rule/corpus version snapshot, case-read API, status transition, or reviewer audit trail yet. Low confidence recommends escalation; it does not automatically create a case.
- [EscalationModal.jsx](../frontend/src/components/EscalationModal.jsx) and [lib/api.js](../frontend/src/lib/api.js) invoke this flow. Phase 4 should extend it, not replace or discard the stored record format.

### Language and voice conventions

- [core/bhashini.py](../backend/app/core/bhashini.py) declares `en`, `hi`, `bn`, `gu`, `kn`, `ml`, `mr`, `or`, `pa`, `ta`, `te`, `ur`. Response language and retrieval translation are supported; most React labels and the trace are English literals. There is no shared UI translation catalog/library to reuse as assumed in Phase 2.
- “Classify” is a canned chat prompt in [pages/Chat.jsx](../frontend/src/pages/Chat.jsx):18-22, not a classification engine. Phase 2 can replace that shortcut with the requested form while adding a small JS/JSON string catalog aligned with the existing language codes.
- Input audio goes through [VoiceInputButton.jsx](../frontend/src/components/VoiceInputButton.jsx), [voice_routes.py](../backend/app/orchestrator/voice_routes.py), and [core/voice.py](../backend/app/core/voice.py). Browser `speechSynthesis` provides output in [ChatMessages.jsx](../frontend/src/components/ChatMessages.jsx). Preserve both paths.
- Styling uses existing CSS variables, React JSX, Tailwind/Vite, and component CSS. Python and JS/JSX are sufficient for the planned work; no new language or heavy dependency is needed.

## Hard-coded reasoner audit

All references in this section point to [core/agentic_reasoner.py](../backend/app/core/agentic_reasoner.py) at the baseline commit. `evidence_freshness` is the repository snapshot above; legal correctness is `needs_human_verification`.

- Lines 28-39: international early return, with two steps, no statutory checks, and no action plan. Preserve this branch and its exact output.
- Lines 42-48: intent labels and ordered keyword groups for prior-art, ABS, and licensing intents; includes filing/rule identifiers. Externalize these too, not just the three check bodies.
- Lines 53-60: traditional-knowledge exclusion label, finding, and mitigation. The condition ends with `or jurisdiction == "INDIA"`, so it fires for **every** India query, including greetings and questions with no evidence. Candidate corpus anchor: `RAG2-03458` (Patents Act text; see source registry below). The broad interpretation still needs review.
- Lines 63-69: admixture check matches formulation/composition/combination/polyherbal/admixture/blend/curcumin substrings, independent of evidence. Candidate anchor: `RAG2-03457`. The mitigation's combination-index threshold was found only in Python and the mock connector, not the searched JSONL/CSV corpus. Do not promote it into a verified rule.
- Lines 72-78: biological-resource/IPR approval check, filing instruction, and commodity-exemption interpretation. Candidate anchors: `RAG2-00009`, `RAG2-00035`, `RAG2-00039`; those records do not by themselves validate the combined conclusion, applicant scope, or timing.
- Lines 81-112: fixed five-step trace, including unconditional claims that evidence was cross-verified and timing prerequisites were verified. Lines 104-105 contain additional statutory references and filing guidance that must move into data for the “zero statutory constants” acceptance criterion.
- Lines 115-120: unconditional action checklist with TKDL search, filing, synergy, and biological-origin guidance. Candidate origin-text anchor: `RAG2-03468`; verify the exact subsection attribution separately. The TKDL wording conflicts with the new accessible-corpus restriction.
- The class docstring and comments also contain statutory identifiers. Remove those identifiers when extracting the logic; leave generic orchestration, formatting, and delegation in Python.
- There is **no ABS percentage calculator in this module**. Rate statements live elsewhere, as inventoried next. Moving only this module will not resolve the graph/corpus/mock rate problem.

## ABS inventory and source registry

### Meaning of the audit flags

Every numbered occurrence below is marked `verification_status: "needs_human_verification"`; `evidence_freshness: "repository_snapshot_only_current_law_not_verified"`. These are documentation flags in Phase 0, not claims that production responses already carry those fields. Do not change any rate, slab, exemption, fee, deadline, or effective date based on this inventory.

The corpus's older ABS document already contains graded sales bands. Therefore “flat range versus slabs” alone does not establish whether the current framework is correctly represented. No ABS source with a 2025 title/category version was found in the JSONL, manifest, or ingestion map. The user will confirm the applicable NBA source; no 2025 rates are inferred here.

### Application, seed, and documentation occurrences

1. [core/knowledge_graph.py](../backend/app/core/knowledge_graph.py):153, node `filing_abs_agreement.description`: contains the legacy gross-sales range. `verification_status: "needs_human_verification"`. No source reference exists on the node; compare against ABS-2014 and the user-supplied current source.
2. Same file:191, edge `auth_nba -> filing_abs_agreement`, relation `EXECUTES`: repeats the range as a levy. `verification_status: "needs_human_verification"`. This is the exact ABS relationship called out in the request.
3. [orchestrator/mock_rag2_connector.py](../backend/app/orchestrator/mock_rag2_connector.py):71-81, document `REGULATION-ABS-2014`, chunk `RAG2-REG-ABS-MATRIX`: hard-codes the older three sales bands and treats them as mandatory. `verification_status: "needs_human_verification"`. Its [stored source URL](https://nbaindia.nic.in/acts-and-rules/regulations) has not been checked. This connector is disabled in Render configuration, but enabled directly by orchestrator unit tests.
4. [core/language.py](../backend/app/core/language.py):104: the legacy range is a normalization alias. `verification_status: "needs_human_verification"`. It is a matching token, not a calculator; removing it could change retrieval behavior.
5. [rag1_ayurveda_ip_knowledge.jsonl](../backend/rag1_ayurveda_ip_knowledge.jsonl):16 and its [CSV mirror](../backend/rag1_ayurveda_ip_knowledge.csv):17, record `RAG1-AYUSH-0016`, title “Monetary Benefit Sharing Percentage on Gross Sales”: repeats the range in a domain-context seed. `verification_status: "needs_human_verification"`. Its generic NBA URL and `auxiliary_seed` authority do not establish a current legal conclusion.
6. [backend/context.md](../backend/context.md):308 repeats the legacy range as an ABS feature. `verification_status: "needs_human_verification"`. This is documentation, not executable logic.

### Source-corpus occurrences

Locations below are in [RAG2 JSONL](../backend/rag2_legal_regulatory_evidence.jsonl) and its [CSV mirror](../backend/rag2_legal_regulatory_evidence.csv). JSONL line numbers equal the numeric part of the record ID; CSV ranges are physical lines, because records contain embedded newlines. All entries retain the `needs_human_verification` status above. Values are identified to make the audit reviewable, not proposed as current rules.

- `RAG2-00080`, JSONL 80; CSV 1644-1662: benefits earmarking percentage, in source BD-RULES-2004.
- `RAG2-03385`, JSONL 3385; CSV 89860-89869: Hindi/OCR sales-band figures (the legacy 0.1%, 0.2%, 0.5% entries), source ABS-2014.
- `RAG2-03414`, JSONL 3414; CSV 90298-90311: trader/manufacturer purchase-price ranges, source ABS-2014.
- `RAG2-03415`, JSONL 3415; CSV 90312-90325: minimum purchase-price and high-economic-value/upfront sharing percentages, source ABS-2014.
- `RAG2-03416`, JSONL 3416; CSV 90326-90343: English sale-price option and graded annual ex-factory sales bands, source ABS-2014. This is the direct corpus anchor for the range repeated in code and the seed.
- `RAG2-03418`, JSONL 3418; CSV 90360-90374: research-result transfer sharing range, source ABS-2014.
- `RAG2-03419`, JSONL 3419; CSV 90375-90388, and `RAG2-03420`, JSONL 3420; CSV 90389-90404: IPR commercialization, assignment/license-fee, and royalty ranges, source ABS-2014. These are distinct from the gross-sales option and must not be collapsed into one universal ABS percentage.
- `RAG2-03422`, JSONL 3422; CSV 90419-90433: third-party resource/knowledge transfer sharing range, source ABS-2014.
- `RAG2-03424`, JSONL 3424; CSV 90448-90462; `RAG2-03425`, JSONL 3425; CSV 90463-90476; `RAG2-03426`, JSONL 3426; CSV 90477-90491: distribution/administrative-retention percentages, source ABS-2014.

Search also found a committee-composition percentage in `RAG2-00081` (CSV 1663-1685), which is **not** a benefit-sharing rate, and stray percent glyphs in corrupted OCR/page headers. Those should not become rate rules. Inspection used numeric percent patterns plus “percent” / “per cent” and reviewed biodiversity/ABS categories; OCR quality prevents a claim of exhaustive legal-document extraction. No separate frontend ABS rate literal was found. Generated databases can reproduce these source statements and need rebuilding if verified source data changes later.

Related currency surfaces without rate literals: [rag2/normalizer.py](../backend/app/rag2/normalizer.py):35-36 expands ABS into the older guidelines; [rag2/ingestion.py](../backend/app/rag2/ingestion.py):54-65 assigns the older ABS document a `CURRENT` status and open end date. Both require source verification before any temporal conclusion changes.

### Citation registry for legal-audit claims

These URLs are copied from repository manifests/records; they were not fetched or verified during this code audit. Each registry entry has `verification_status: "needs_human_verification"` and `evidence_freshness: "repository_snapshot_only_current_law_not_verified"`. “Assigned” dates below mean ingestion metadata, not confirmed commencement dates.

- **ABS-2014**: source ID `NBA_ABS_GUIDELINES_2014`; title “Guidelines on Access to Biological Resources and Associated Knowledge and Benefits Sharing Regulations, 2014”; version `2014`; assigned effective date `2014-11-21`; [source URL](https://faolex.fao.org/docs/pdf/ind188691.pdf). Corpus records listed above; manifest category `nba_abs_guidelines`.
- **BD-RULES-2004**: source ID `BIODIVERSITY_RULES_2004`; title “The Biological Diversity Rules, 2004”; version `2004`; assigned effective date `2004-04-15`; [source URL](https://faolex.fao.org/docs/pdf/ind53983.pdf); record `RAG2-00080` for benefits earmarking.
- **BD-ACT**: source ID `BIODIVERSITY_ACT_2002`; title “The Biological Diversity Act, 2002”; version `2002`; assigned effective date `2003-02-05`; [source URL](https://faolex.fao.org/docs/pdf/ind40698.pdf); candidate records `RAG2-00009`, `RAG2-00035`, `RAG2-00039`.
- **PATENTS-ACT**: source ID `PATENTS_ACT_1970`; title “The Patents Act, 1970 (Consolidated till 2024)”; version `2024`; assigned effective date `1972-04-20` is category-wide and does not establish the date of each amended provision; [source URL](https://ipindia.gov.in/frontend/pdf/patents/1_113_1_The_Patents_Act__1970___incorporating_all_amendments_till_1-08-2024.pdf); candidate records `RAG2-03457`, `RAG2-03458`, `RAG2-03468`. Later duplicate records exist; pin to the retained record and content hash.
- **ABS-SEED**: source ID `RAG1-AYUSH-0016`; title “Monetary Benefit Sharing Percentage on Gross Sales”; version/effective date absent; [source URL](https://nbaindia.nic.in); auxiliary domain-context seed, not independently sufficient legal evidence.

## Tests and conventions

### Setup and coverage

- Backend uses pytest to collect both ordinary pytest functions and `unittest.TestCase` / `IsolatedAsyncioTestCase`. [requirements-dev.txt](../backend/requirements-dev.txt) includes the runtime requirements plus pytest. There is no checked-in backend lint/type-check configuration or CI workflow.
- [tests/conftest.py](../backend/tests/conftest.py) disables Groq and BHASHINI by default. API tests use `TestClient` with lifespan; corpus tests load real checked-in data and may create ignored SQLite indexes. Escalation tests redirect storage to temporary directories. New rule tests should use explicit small fixtures, fixed dates, isolated settings, and no external providers.
- [test_api.py](../backend/tests/test_api.py) covers main RAG/orchestrator endpoints; [test_rag1.py](../backend/tests/test_rag1.py) and [test_rag2.py](../backend/tests/test_rag2.py) cover retrieval/ingestion, legal metadata, historical filtering, and conflicts; [test_orchestrator.py](../backend/tests/test_orchestrator.py) covers routing/connectors.
- [test_frontend_contract.py](../backend/tests/test_frontend_contract.py), [test_integration_extensions.py](../backend/tests/test_integration_extensions.py), [test_features.py](../backend/tests/test_features.py), and [test_llm_prompt_policy.py](../backend/tests/test_llm_prompt_policy.py) cover citations, international isolation, search/document filters, errors, CORS, voice, escalation, confidence, and prompt policy.
- Existing tests check an empty international statutory trace and deterministic graph selection, but **do not snapshot full India reasoner output** or establish correctness of its legal interpretations. Capture these snapshots before refactoring.
- Root frontend: Node's test runner executes `tests/*.test.js`; Vitest/jsdom executes only `tests/ui.spec.jsx` per [vitest.config.js](../frontend/vitest.config.js). `npm test` chains them with `&&`, so UI tests must be run separately if Node tests fail. ESLint is configured in [eslint.config.js](../frontend/eslint.config.js).
- Follow module-level loggers, typed function signatures, Pydantic v2 models and validators, existing API prefixes, `pathlib` paths, and stdlib persistence. Existing broad catches and untyped graph dictionaries are not patterns to copy into the new engine.

### Phase 0 validation results

Local runtime: Windows, Node `24.16.0`, npm `11.13.0`, Python `3.14.5`. The repository's `.python-version` and Docker runtime specify Python 3.12, so these results are a local baseline, not a reproduction of the deployed container. The initial `npm test` could not collect backend tests because pytest was absent; an ignored `backend/.venv` was created using the existing `requirements-dev.txt`. No dependency declaration/lockfile was changed. Installed key versions: pytest `9.1.1`, FastAPI `0.141.1`, Pydantic `2.13.5`, NumPy `2.5.3`, scikit-learn `1.9.1`, httpx `0.28.1`.

- Root `npm run test:backend`: **51 passed, 3 subtests passed**, two third-party deprecation warnings (Starlette/httpx integration and the AnyIO portal alias). No application test failed.
- Root `npm run test:frontend`, with its Node stage also inspected directly using `node --test --test-reporter=tap tests/*.test.js` from `frontend`: **14 passed, 3 failed**. All failures are in `frontend/tests/scrollSequence.test.js` (tests beginning at lines 32, 49, 65), raising `ReferenceError: requestAnimationFrame is not defined` from `frontend/src/components/scrollSequence.js:51`. The tests supply image/fetch stubs but no animation-frame scheduler; no source or test was changed during Phase 0.
- `npm run test:ui` from `frontend`, run separately because the combined command stops after the Node failures: **14 passed**.
- `npm run lint` from `frontend`: **passed** (exit 0).
- `npm test` from `backend/frontend`: **11 passed** after installing its existing locked dependencies with `npm ci --ignore-scripts --no-audit --no-fund`. Its first attempt had a missing-axios setup error; that was resolved without changing the lockfile. This older source copy's passing tests do not repair or replace the maintained frontend's failing tests.

The complete test inventory was exercised, but the repository does **not** have an all-green baseline. The Phase 0 documentation-only boundary takes precedence over making unrelated animation-code fixes. Frontend build, Docker build, external providers, and production deployment were not tested in this phase. Generated virtual-environment, dependency, and corpus-index files are ignored; existing tracked escalation data was not modified.

## Proposed Phase 1 implementation, not started

### Compatibility contract and limits

The first Phase 1 change must capture current reasoner output **before** modifying the implementation. Preserve the current trigger order, substring matching, unconditional India behavior, international early return, five-step order, action ordering, and public method signature. Treat these as compatibility facts, not verified determinations.

There is a real requirements conflict: byte-for-byte legacy output retains uncited conclusions, overbroad TKDL wording, and unsupported verification language, while the new hard constraints require citations, freshness, three evidence categories, and human-review warnings. Proposed resolution for approval with the Phase 1 plan:

- First prove exact equality of the legacy projection after mechanical extraction; retain baseline fixtures as historical behavior records.
- Add separate typed rule-audit metadata with source refs, rule/corpus versions, freshness, verification items, and a decision-support disclaimer. Do not convert missing evidence into a supported finding. Do not label a RAG1 passage as patent prior art or legal authority.
- Apply narrowly enumerated wording/metadata exceptions for the restricted TKDL scope, unsupported “verified” wording, and disputed ABS statements, with explicit before/after assertions. Use the required phrase “based on the accessible evidence corpus”; do not claim a complete TKDL search.
- Do not represent this additive/safety work as full byte-for-byte public JSON equality. If literal equality of the entire output is required, those safety changes need a separate agreed scope. Do not silently choose a legal correction or remove failing baseline assertions.

No change to chat routing, confidence scoring, translation, retrieval ranking, or LLM answer generation is proposed in Phase 1. A full migration of the conflict engine and every graph assertion is also outside the reasoner-specific refactor; their limitations remain documented. The ABS node/edge and associated warnings are explicitly included because the user called them out.

### Concrete file-level sequence

1. **Regression fixtures first** — add `backend/tests/test_agentic_reasoner_regression.py` and `backend/tests/fixtures/agentic_reasoner_legacy.json`. Capture all existing orchestrator query examples, India/international, greetings/no citations, each individual trigger, combined triggers and intent precedence, case variants, and translated/original-query differences. Freeze supplied citations rather than snapshot live LLM responses. Add graph ABS-node/edge fixtures, including labels/descriptions. Record baseline commit and capture procedure.
2. **Typed internal contracts** — add `backend/app/rules/__init__.py` and `backend/app/rules/models.py`. Define `RuleDefinition`, recursive discriminated `RuleCondition`, `RuleSourceRef`, `RuleSet`, `RuleSelection`, `RuleContext`, `RuleMatch`, `RuleEvaluation`, and `EvidenceFreshness` models. Required rule fields are `id`, `jurisdiction`, `topic`, `condition`, `conclusion_template`, `source_refs`, `effective_from`, `effective_to`, `version`, `verification_status`; add deterministic priority/order and explicit review notes. Source refs carry stable source/document/chunk IDs, title, URL where available, source version/effective dates, and corpus hash. Distinguish source law version from rule implementation version.
3. **Versioned data** — add `backend/data/rules/legacy_india.json`, `backend/data/rules/reasoning_presentation.json`, `backend/data/rules/sources.json`, and `backend/data/rules/verification_items.json`. Move all three conditions, findings/statuses/mitigations, intent keyword groups and labels, statutory trace templates, and the action checklist into validated JSON, subject to the provenance gate below. Keep non-decisional presentation/config distinguishable from legal rules. Add review entries for every ABS surface above and the unsupported numerical mitigation; never invent a missing source or effective date. Existing Python text alone is not sufficient authority for a new numerical rule: unsupported numbers require a traceable candidate `source_url` plus `verification_status: "unverified"` and a linked human-verification TODO, or must become a non-numeric TODO under the explicit compatibility exceptions. Apply the same provenance gate to newly saved regression fixtures; candidate URLs are not assertions of evidentiary support.
4. **Loader and evaluator** — add `backend/app/rules/loader.py` and `backend/app/rules/evaluator.py`. Proposed interfaces: `load_rule_set(path: Path) -> RuleSet`, `select_rules(rule_set: RuleSet, jurisdiction: str, as_of: date) -> RuleSelection`, and `evaluate_rules(context: RuleContext, selection: RuleSelection) -> RuleEvaluation`. Use a small allowlist (`all`, `any`, `not`, `eq`, `contains_any`) with validated fields/types, explicit missing-input semantics, ordered results, and matched-condition/source traces. Do not use `eval`, executable expressions, an LLM, network access, or unordered set iteration for decisions.
5. **Date and verification policy** — make the assessment date explicit. Reject invalid intervals, duplicate `(id, version)` pairs, and overlapping dated versions of one rule. Define and test inclusive effective-date bounds to align with the existing corpus filter. Unknown `effective_from` must remain null with `needs_human_verification`; return such rules as temporally unresolved, never “in force.” A separately named legacy compatibility selector may preserve old undated behavior with audit warnings; future assessments must use the strict selector. Copy existing category dates only as unverified source metadata until provision-level applicability is confirmed.
6. **Configuration and reasoner adapter** — add a rules-directory setting in `backend/app/config.py`; refactor `backend/app/core/agentic_reasoner.py` to build context and delegate to the engine/templates. Remove all statutory identifiers, legal keyword groups, conclusions, and actions from its Python body/comments. Keep the existing callable interface and legacy projection; expose audit metadata through a typed result. Validate loading at startup in `backend/app/main.py` with clear logged errors. Editing JSON should require only controlled reload/restart, not Python edits; document that it is not live file watching.
7. **Source-audit integration** — update `backend/app/core/knowledge_graph.py` to attach the central verification entry to the ABS node/edge without changing selection/topology. Use the same registry for the mock ABS entry and normalization alias instead of treating either as current authority. Extend `backend/app/data/models.py` and, where needed, `backend/app/orchestrator/service.py` with additive rule-audit metadata. Update `frontend/src/components/AgenticReasoningCard.jsx` only as necessary to show review status, accessible-corpus scope, source links, and freshness; add a focused case in `frontend/tests/ui.spec.jsx`. This is an explicitly proposed safety exception to strict legacy display preservation, not a UI redesign.
8. **Corpus handling** — do not rewrite source excerpts or insert 2025 figures. The audit registry should identify affected RAG1/RAG2 record IDs and both mirrors; preserve their source text. If adding verification metadata to raw records is chosen, update both JSONL/CSV, the ingestion/Pydantic/storage path, and index rebuild instructions in the same reviewed change so metadata is not silently dropped. Keep this separate from the mechanical reasoner extraction.
9. **Engine and integration tests** — add `backend/tests/test_rules.py` and `backend/tests/test_rule_provenance.py`; extend the reasoner regression tests and `backend/tests/test_integration_extensions.py`. Cover invalid/missing data, unknown operators/fields, deterministic ordering, no match, combined conditions, jurisdiction isolation, date boundaries/gaps/unknowns/overlaps, unresolved source refs, corpus-hash changes, unverified ABS propagation, repeat equality, and JSON edits taking effect after explicit reload. Ensure structured engine results do not depend on LLM availability. Test the existing endpoint's added fields; Phase 1 needs no new endpoint.
10. **Documentation and commits** — add `docs/RULES.md` for the schema, operator semantics, date bounds, compatibility selector, verification workflow, source mapping, reload procedure, and regression workflow; update `docs/RECON.md` and `CHANGELOG.md`. Suggested small commits: baseline snapshots; validated rules/engine; reasoner extraction; explicit provenance/ABS safety integration. Do not mix a legal-rate correction or later-phase feature into these commits.

No new heavy dependency is proposed: stdlib JSON, dates, hashing, and logging plus existing Pydantic and pytest suffice. No endpoint is proposed for Phase 1; all new public metadata requires typed Pydantic fields. Rule source references must be evidence mappings, not merely a list of generally related citations.

### Phase 1 validation gate

- Run the full backend suite, both maintained frontend test stages, frontend lint, and any copied-tree tests retained in the repository; report baseline failures separately without hiding them.
- Require exact equality of the preserved legacy projection and explicit tests for any approved safety exceptions; changing snapshots to conceal a regression is not acceptable.
- Check that `agentic_reasoner.py` has no remaining statutory constants, including hidden legal references in trace text and the checklist. Test JSON editability and temporal selection independently of retrieval and the LLM.
- Require every new rule result to carry source references, freshness, verification status, and unresolved-evidence reasons; no unverified rule should masquerade as a verified assessment conclusion.
- Record source/corpus hashes and rule versions so repeatability means the same normalized inputs, explicit date, rules, and corpus. Exclude runtime timestamps from the deterministic result itself.
- Stop at Phase 1 completion for the next go-ahead. Passport work remains Phase 2.

## Human verification and unresolved decisions

1. **Current ABS authority** — the user must confirm the applicable NBA text, scope, rates/bands, and commencement/supersession dates against the source they will supply. All ABS entries remain `needs_human_verification`; the presence of older sales bands is not proof of the current regime.
2. **Legacy legal wording** — verify applicant/resource scope, approval timing, exemption interpretation, the numerical synergy mitigation, and exact biological-origin subsection attribution. Corpus anchors are candidates, not endorsements.
3. **Compatibility versus evidence safety** — approve the explicitly separated safety exceptions above or retain literal legacy output only in a clearly identified compatibility scope. These requirements cannot both be satisfied silently on the same unchanged payload.
4. **Pre-existing test failures** — resolve any documented baseline failures in an explicitly scoped follow-up before claiming the full-suite-green Phase 1 acceptance criterion. Phase 0 does not change feature code to repair them.
5. **Future-phase assumptions** — use the maintained frontend, add a UI translation catalog when needed, reuse existing persistence technology with a durable path, and preserve separate TK, patent prior-art, and legal-regulatory result categories. TKDL is restricted-access and non-exhaustive; future results must say “based on the accessible evidence corpus.”

This document is engineering decision support, not legal advice or an Innovation Assessment. It establishes no product classification, patentability, clearance, ABS amount, or legal currency. Phase 0 ends here; Phase 1 requires the user's go-ahead.
