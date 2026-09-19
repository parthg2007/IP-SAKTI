# IP-SAKTI Backend: System Architecture & Codebase Context

Welcome to the **IP-SAKTI** backend codebase documentation. This document provides a complete guide to the project's directory structure, architecture principles, file-by-file explanations, data workflows, and instructions on how to run, extend, and deploy the system.

---

## 1. Project Purpose & High-Level Architecture

**IP-SAKTI** is an intelligent AI/RAG system for Ayurveda and Intellectual Property (IP) compliance in India.

### The Multi-RAG Principle
The system is divided into decoupled RAG layers following strict architectural boundaries:
- **RAG 1 (Domain Knowledge Layer)**: Answers conceptual questions regarding Ayurveda, medicinal plants, classical formulations, traditional knowledge (TKDL), and intellectual property principles (patents, prior art, trademarks, GI, etc.). **RAG 1 explains concepts but does NOT make final legal or regulatory decisions.**
- **RAG 2 (Legal & Regulatory Evidence Layer)**: Provides authoritative statutory legal provisions, mandatory regulatory requirements (such as National Biodiversity Authority Section 6 approval, Form I–IV procedures), Patent Act Section 3(p) and 3(e) exclusions, and legal rule validation.
- **Main Orchestrator**: Routes user queries to the appropriate RAG(s), queries them in parallel, verifies source citations, and synthesizes answers combining domain context with authoritative legal backing.
- **Connectability**: The orchestrator is designed with a pluggable connector interface (`BaseRAGConnector`) so that external RAG units (e.g. RAG 2 microservices, patent claim search engines, clinical trial databases) can be connected locally or over HTTP.

```
                          User Query
                              │
                              ▼
            ┌───────────────────────────────────┐
            │       FastAPI Main Service        │
            │   (/api/v1/orchestrator/query)    │
            └─────────────────┬─────────────────┘
                              │
                              ▼
            ┌───────────────────────────────────┐
            │        Query Intent Router        │
            │  (Domain? Legal? Hybrid/Multi?)   │
            └───────┬───────────────────┬───────┘
                    │                   │
         [Domain / Conceptual]   [Legal / Compliance]
                    │                   │
                    ▼                   ▼
    ┌──────────────────────┐    ┌──────────────────────────────┐
    │  RAG 1 Connector     │    │   RAG 2 Connector            │
    │  (Local In-Process)  │    │   (HTTP / Remote / Mock)     │
    ├──────────────────────┤    ├──────────────────────────────┤
    │ • Hybrid Search      │    │ • Authoritative Statutes     │
    │   (BM25 + Semantic)  │    │ • Case Law & Rules           │
    │ • Multilingual Norm  │    │ • Legal Determination        │
    │ • vector.db Chunks   │    │ • Rule Engine                │
    │ • Domain Context     │    │ • Compliance Evidence        │
    └───────────┬──────────┘    └──────────────┬───────────────┘
                │                              │
                └──────────────┬───────────────┘
                               ▼
            ┌───────────────────────────────────┐
            │     Multi-RAG Evidence Fusion     │
            │      & Citation Verification      │
            ├───────────────────────────────────┤
            │  • Domain context from RAG 1      │
            │  • Authoritative law from RAG 2   │
            │  • Strict boundary disclaimer     │
            │    (RAG 1 != legal advice)        │
            └──────────────────┬────────────────┘
                               ▼
                        Final Response
```

---

## 2. Directory Structure

```
IP-Sakti/
├── app/
│   ├── __init__.py                     # Package marker
│   ├── config.py                       # Global settings & environment variables
│   ├── main.py                         # FastAPI application entry & lifecycle
│   ├── core/
│   │   ├── __init__.py                 # Core package marker
│   │   ├── chunking.py                 # Semantic chunking, hashing & metadata enrichment
│   │   └── language.py                 # Language detection & technical term normalization
│   ├── data/
│   │   ├── __init__.py                 # Data package marker
│   │   ├── ingestion.py                # Dataset parsing, cleaning & deduplication
│   │   ├── models.py                   # Pydantic schemas (requests, responses, chunks)
│   │   └── storage.py                  # Standalone SQLite vector.db persistence
│   ├── retrieval/
│   │   ├── __init__.py                 # Retrieval package marker
│   │   ├── bm25.py                     # Okapi BM25 sparse keyword search engine
│   │   ├── vector.py                   # Dense semantic vector retrieval engine
│   │   ├── hybrid.py                   # Reciprocal Rank Fusion (RRF) hybrid search
│   │   └── synthesizer.py              # Evidence formatter & context synthesizer
│   ├── rag1/
│   │   ├── __init__.py                 # RAG 1 package marker
│   │   ├── service.py                  # RAG 1 Domain Knowledge service implementation
│   │   └── routes.py                   # REST endpoints for RAG 1 (/api/v1/rag/knowledge/*)
│   └── orchestrator/
│       ├── __init__.py                 # Orchestrator package marker
│       ├── base_connector.py           # Abstract BaseRAGConnector interface
│       ├── local_connector.py          # In-process connector for RAG 1
│       ├── http_connector.py           # Remote HTTP REST connector for external RAGs
│       ├── mock_rag2_connector.py      # Reference RAG 2 Legal Evidence connector
│       ├── registry.py                 # Dynamic RAG registry
│       ├── router.py                   # Query intent router
│       ├── service.py                  # Multi-RAG execution & evidence fusion service
│       └── routes.py                   # REST endpoints for Orchestrator (/api/v1/orchestrator/*)
├── tests/
│   ├── __init__.py                     # Test package marker
│   ├── test_rag1.py                    # Unit tests for Ingestion, BM25, Vector, RAG 1
│   ├── test_orchestrator.py            # Unit tests for Router, Multi-RAG query & Registry
│   └── test_api.py                     # Integration tests for FastAPI endpoints
├── build_vector_db.py                  # Standalone script to populate vector.db
├── run.py                              # Server launcher (reads dynamic PORT)
├── requirements.txt                    # Project dependencies
├── Procfile                            # Render web process definition
├── render.yaml                         # Render blueprint deployment file
├── Dockerfile                          # Optional Docker container definition
├── vector.db                           # Standalone SQLite database (chunks + embeddings)
├── rag1_ayurveda_ip_knowledge.jsonl    # Raw dataset (JSON Lines)
├── rag1_ayurveda_ip_knowledge.csv      # Raw dataset (CSV fallback)
├── rag1_source_manifest.csv            # Manifest of official AYUSH/IP domain sources
├── README.MD                           # Project specification document
└── context.md                          # Comprehensive project & codebase context (this file)
```

---

## 3. File-by-File Breakdown

### Root Configuration & Entrypoints

#### [`run.py`](file:///Users/parth/Desktop/IP-Sakti/run.py)
- **Role**: Command-line entrypoint to start the backend server.
- **How it works**: Reads `PORT` and `HOST` from environment variables (fallback to `0.0.0.0:8000`). Starts Uvicorn running `app.main:app`. Handles dynamic `$PORT` assignment on Render.

#### [`build_vector_db.py`](file:///Users/parth/Desktop/IP-Sakti/build_vector_db.py)
- **Role**: Standalone build tool to parse the raw datasets and construct/rebuild `vector.db`.
- **How it works**:
  1. Calls `ingest_knowledge_base()` to load and deduplicate raw records.
  2. Fits the semantic `VectorRetriever` and computes embeddings.
  3. Writes metadata, text chunks, and embedding binary blobs into `vector.db`.
  4. Runs as part of the Render build step: `pip install -r requirements.txt && python build_vector_db.py`.

#### [`vector.db`](file:///Users/parth/Desktop/IP-Sakti/vector.db)
- **Role**: Standalone, file-based SQLite database.
- **Why it is used**: Completely removes the need for a separate MySQL/PostgreSQL server. Allows the entire app to run self-contained on Render or local machines with zero external database configuration.

#### [`render.yaml`](file:///Users/parth/Desktop/IP-Sakti/render.yaml) & [`Procfile`](file:///Users/parth/Desktop/IP-Sakti/Procfile) & [`Dockerfile`](file:///Users/parth/Desktop/IP-Sakti/Dockerfile)
- **Role**: Render cloud deployment configuration.
- **How it works**:
  - `render.yaml` declares a web service with Python 3.12, auto-build command, and start command.
  - `Procfile` declares `web: uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
  - `Dockerfile` provides a containerized alternative if deploying in Docker environments.

#### [`requirements.txt`](file:///Users/parth/Desktop/IP-Sakti/requirements.txt)
- **Dependencies**: `fastapi`, `uvicorn`, `pydantic`, `numpy`, `scikit-learn`, `httpx`, `requests`.

---

### App Core & Configuration (`app/`)

#### [`app/config.py`](file:///Users/parth/Desktop/IP-Sakti/app/config.py)
- **Role**: Centralized configuration management.
- **Key Parameters**:
  - `BASE_DIR`: Absolute project root path.
  - `HOST`, `PORT`, `DEBUG`: Server binding settings.
  - `DATA_JSONL_PATH`, `DATA_CSV_PATH`, `DATA_MANIFEST_PATH`, `VECTOR_DB_PATH`: File paths.
  - `BM25_K1`, `BM25_B`: Hyperparameters for BM25 term frequency saturation and document length normalization.
  - `HYBRID_BM25_WEIGHT` (0.45), `HYBRID_VECTOR_WEIGHT` (0.55), `RRF_K` (60): Reciprocal Rank Fusion weights.
  - `ENABLE_MOCK_RAG2` (True): Enables built-in reference RAG 2 connector.
  - `RAG2_HTTP_URL`: Optional remote URL for external RAG 2 service.

#### [`app/main.py`](file:///Users/parth/Desktop/IP-Sakti/app/main.py)
- **Role**: FastAPI application factory and lifecycle manager.
- **Lifespan Context Manager**:
  - **On Startup**:
    1. Initializes `rag1_service` (loads or builds `vector.db`).
    2. Registers `LocalRAG1Connector` in `rag_registry`.
    3. Connects RAG 2: if `RAG2_HTTP_URL` is set, registers `HTTPRAGConnector`; otherwise registers `MockRAG2Connector`.
  - **On Shutdown**: Closes connections cleanly.
- **Routers**: Attaches `/api/v1/rag/knowledge` and `/api/v1/orchestrator`.
- **CORS**: Configured with permissive CORS for frontend/client access.

---

### Data Models, Ingestion & Storage (`app/data/`)

#### [`app/data/models.py`](file:///Users/parth/Desktop/IP-Sakti/app/data/models.py)
- **Role**: Pydantic v2 data contracts.
- **Key Schemas**:
  - `KnowledgeChunk`: Canonical chunk representation containing `chunk_id`, `document_id`, `domain`, `subdomain`, `topic`, `language`, `title`, `text`, `source_name`, `source_url`, `authority_tier`, `rag_role`, `content_hash`.
  - `RAGEvidence`: Evidence snippet returned to callers with source attribution, domain, and relevance score.
  - `RAGQueryRequest` / `RAGQueryResponse`: Standard payload for `POST /api/v1/rag/knowledge/query`.
  - `RAGSearchRequest` / `RAGSearchResponse`: Payload for granular chunk search (`hybrid`, `vector`, `bm25`).
  - `RAGHealthResponse`: Operational health check schema.
  - `RAGRouteDecision`: Routing intent, target RAGs, and confidence.
  - `MultiRAGQueryRequest` / `MultiRAGQueryResponse`: Federated multi-RAG query request and combined answer.
  - `RAGRegistrationRequest` / `RAGInfo`: Dynamic external RAG connection metadata.

#### [`app/data/storage.py`](file:///Users/parth/Desktop/IP-Sakti/app/data/storage.py)
- **Role**: SQLite persistence interface for `vector.db`.
- **Tables**:
  - `chunks`: Stores chunk text and all metadata fields.
  - `embeddings`: Stores chunk ID, dimension, and dense vector as a binary `BLOB` using `struct.pack` / `struct.unpack` for microsecond-fast vector deserialization.
  - `metadata`: Stores key-value statistics (e.g. `total_chunks`).
- **Methods**:
  - `init_tables()`: Creates SQLite tables with proper schema and indexes.
  - `save_knowledge_base(chunks, chunk_embeddings)`: Upserts chunks and vectors.
  - `load_chunks() -> List[KnowledgeChunk]`: Reads all chunks into memory.
  - `load_embeddings() -> (List[str], np.ndarray)`: Returns numpy matrix of vectors.
  - `is_initialized() -> bool`: Verifies whether `vector.db` already contains data.

#### [`app/data/ingestion.py`](file:///Users/parth/Desktop/IP-Sakti/app/data/ingestion.py)
- **Role**: Ingests raw data from `rag1_ayurveda_ip_knowledge.jsonl` (or CSV) and `rag1_source_manifest.csv`.
- **Logic**:
  1. Loads source manifest for authority tier information (`auxiliary_seed`).
  2. Iterates over raw records, computes SHA-256 content hashes, and discards duplicates.
  3. Maps domain and subtopic to canonical values.
  4. Generates unique IDs: `RAG1-000001` format for chunks, `DOC-XXXXXX` for parent documents.

---

### Core Language & Chunking Utilities (`app/core/`)

#### [`app/core/language.py`](file:///Users/parth/Desktop/IP-Sakti/app/core/language.py)
- **Role**: Multilingual processing and technical term normalization.
- **Key Functions**:
  - `detect_language(text)`: Detects Devanagari script (`hi`), romanized Hinglish (`hi-Latn`), or English (`en`).
  - `normalize_and_expand_query(query)`: Matches user terms against the `TERM_NORMALIZATION_MAP`. For example, translates Hindi *"पूर्व कला"* or Hinglish *"purva kala"* into the canonical concept *"Prior Art & Classical Literature"*, suggesting the appropriate search domain and expanding query tokens for better retrieval recall.

#### [`app/core/chunking.py`](file:///Users/parth/Desktop/IP-Sakti/app/core/chunking.py)
- **Role**: Semantic domain chunking and metadata builder.
- **Functions**:
  - `generate_content_hash(text)`: Computes deterministic SHA-256.
  - `map_domain_to_canonical(raw_domain, subtopic)`: Categorizes raw inputs into canonical domains (`Prior Art & Classical Literature`, `Patents & IPR Procedures`, `Statutory Law`, `Access & Benefit Sharing (ABS)`).
  - `build_chunk_from_record(record, index)`: Assembles the complete `KnowledgeChunk` object.

---

### Retrieval Engine (`app/retrieval/`)

#### [`app/retrieval/bm25.py`](file:///Users/parth/Desktop/IP-Sakti/app/retrieval/bm25.py)
- **Role**: Pure-Python / NumPy Okapi BM25 keyword search engine.
- **Features**:
  - Full Unicode / Devanagari tokenization with stopword filtering.
  - Robertson/BM25+ inverse document frequency (IDF) calculation.
  - Document length normalization ($b=0.75$) and term frequency scaling ($k_1=1.5$).
  - Fast domain-filtered keyword retrieval.

#### [`app/retrieval/vector.py`](file:///Users/parth/Desktop/IP-Sakti/app/retrieval/vector.py)
- **Role**: Dense semantic vector retrieval engine.
- **Features**:
  - Uses sublinear-scaled word and subword n-gram vectorization with L2 normalization (`scikit-learn`).
  - Computes cosine similarity between query and document vectors.
  - `get_chunk_embeddings_dict()` exports dense vectors for binary SQLite persistence.
  - Zero external neural network weight downloads required; runs 100% offline.

#### [`app/retrieval/hybrid.py`](file:///Users/parth/Desktop/IP-Sakti/app/retrieval/hybrid.py)
- **Role**: Hybrid retriever combining BM25 keyword search and dense vector search.
- **Fusion Algorithm**: Reciprocal Rank Fusion (RRF):
  $$RRF(d) = \frac{w_{\text{bm25}}}{k + \text{rank}_{\text{bm25}}(d)} + \frac{w_{\text{vec}}}{k + \text{rank}_{\text{vec}}(d)}$$
  with $k=60$, $w_{\text{bm25}}=0.45$, $w_{\text{vec}}=0.55$.
- **Concept Boost**: Applies a reranking boost to chunks matching normalized concepts detected by `language.py`.

#### [`app/retrieval/synthesizer.py`](file:///Users/parth/Desktop/IP-Sakti/app/retrieval/synthesizer.py)
- **Role**: Formats evidence citations and creates domain answer contexts.
- **Boundary Enforcement**: Generates answers that explain concepts with source attribution while explicitly noting that RAG 1 does not make legal determinations.
- Supports English and Hindi localized output.

---

### RAG 1 Domain Service & Routes (`app/rag1/`)

#### [`app/rag1/service.py`](file:///Users/parth/Desktop/IP-Sakti/app/rag1/service.py)
- **Role**: Encapsulates the entire RAG 1 knowledge repository.
- **Methods**:
  - `initialize()`: Checks if `vector.db` is populated; if not, ingests and saves. Fits BM25 and Vector retrievers.
  - `query(request)`: Executes hybrid retrieval, formats evidence, synthesizes context, returns `RAGQueryResponse`.
  - `search(request)`: Granular chunk search supporting `hybrid`, `vector`, or `bm25` search modes.
  - `health()`: Reports total chunks, indexed domains, and retriever status.

#### [`app/rag1/routes.py`](file:///Users/parth/Desktop/IP-Sakti/app/rag1/routes.py)
- **Exposed Endpoints**:
  - `POST /api/v1/rag/knowledge/query`: Answers conceptual questions with citations.
  - `POST /api/v1/rag/knowledge/search`: Searches chunks by keyword, vector, or hybrid.
  - `GET /api/v1/rag/knowledge/health`: Health and index status check.

---

### Connectable Multi-RAG Orchestrator (`app/orchestrator/`)

#### [`app/orchestrator/base_connector.py`](file:///Users/parth/Desktop/IP-Sakti/app/orchestrator/base_connector.py)
- **Role**: Abstract Base Class defining the contract for all RAG units in IP-SAKTI.
- **Methods**:
  - `retrieve(query, filters, top_k) -> List[RAGEvidence]`
  - `query(query, filters) -> (answer_context, evidence_list, score)`
  - `health_check() -> bool`
  - `get_info() -> Dict`

#### [`app/orchestrator/local_connector.py`](file:///Users/parth/Desktop/IP-Sakti/app/orchestrator/local_connector.py)
- **Role**: Subclass of `BaseRAGConnector` connecting to `rag1_service` in-process.

#### [`app/orchestrator/http_connector.py`](file:///Users/parth/Desktop/IP-Sakti/app/orchestrator/http_connector.py)
- **Role**: Subclass of `BaseRAGConnector` for communicating with any external RAG service over HTTP/REST using `httpx.AsyncClient`.
- Allows connecting RAG 2, RAG 3, etc., running on separate containers or servers.

#### [`app/orchestrator/mock_rag2_connector.py`](file:///Users/parth/Desktop/IP-Sakti/app/orchestrator/mock_rag2_connector.py)
- **Role**: Reference implementation of RAG 2 (Authoritative Legal & Regulatory Evidence).
- **Corpus**:
  - Section 3(p) Patents Act (Traditional Knowledge Bar)
  - Section 3(e) Patents Act (Mere Admixture & Synergism Requirement)
  - Section 6 Biological Diversity Act (Mandatory NBA Approval for IPR)
  - Section 40 Biological Diversity Act (Normally Traded Commodities Exemption)
  - Legacy ABS corpus reference (benefit-sharing percentages require human verification). `verification_status: "needs_human_verification"`; see `data/rules/verification_items.json` (`abs-legacy`) and `../docs/RECON.md`. No current rate is determined from this reference.
- Allows full end-to-end testing of dual-RAG queries today before RAG 2 is built.

#### [`app/orchestrator/registry.py`](file:///Users/parth/Desktop/IP-Sakti/app/orchestrator/registry.py)
- **Role**: Registry holding active connectors (`rag_registry`).
- **Methods**: `register(connector)`, `unregister(rag_id)`, `get(rag_id)`, `get_status_list()`.

#### [`app/orchestrator/router.py`](file:///Users/parth/Desktop/IP-Sakti/app/orchestrator/router.py)
- **Role**: Classifies user queries to decide which RAG units should answer:
  - *"What is a classical formulation?"* → `rag1_domain_knowledge`
  - *"What are the criminal penalties under Section 55?"* → `rag2_legal_regulatory`
  - *"How can an Ayurvedic product be protected using IP?"* → `["rag1_domain_knowledge", "rag2_legal_regulatory"]` (Hybrid)

#### [`app/orchestrator/service.py`](file:///Users/parth/Desktop/IP-Sakti/app/orchestrator/service.py)
- **Role**: Executes multi-RAG queries using `asyncio.gather`.
- **Workflow**:
  1. Calls `query_router.route(query)`.
  2. Concurrently queries all target RAG connectors.
  3. Fuses responses: keeps domain context from RAG 1 and legal conclusions from RAG 2.
  4. Merges, deduplicates, and sorts citations (authoritative legal citations prioritized first).
  5. Appends statutory boundary disclaimer.

#### [`app/orchestrator/routes.py`](file:///Users/parth/Desktop/IP-Sakti/app/orchestrator/routes.py)
- **Exposed Endpoints**:
  - `POST /api/v1/orchestrator/query`: Multi-RAG query execution with synthesis.
  - `POST /api/v1/orchestrator/route`: Returns routing decision and confidence.
  - `GET /api/v1/orchestrator/rags`: Lists all connected RAG units and health status.
  - `POST /api/v1/orchestrator/rags/register`: Dynamically registers an external HTTP RAG.

---

## 4. How the API Endpoints Work

### RAG 1 Direct APIs

| Method | Path | Description | Example Query |
|---|---|---|---|
| `POST` | `/api/v1/rag/knowledge/query` | Domain concept QA with evidence citations | `"What is TKDL?"` |
| `POST` | `/api/v1/rag/knowledge/search` | Search chunks via `hybrid`, `vector`, or `bm25` | `"Form 27 startup patent"` |
| `GET` | `/api/v1/rag/knowledge/health` | Index metrics, total chunks, domains | N/A |

### Multi-RAG Orchestrator APIs

| Method | Path | Description | Example Query |
|---|---|---|---|
| `POST` | `/api/v1/orchestrator/query` | Federated multi-RAG answering (RAG 1 + RAG 2) | `"Can an Ayurvedic drug be patented?"` |
| `POST` | `/api/v1/orchestrator/route` | Returns routing decision & explanation | `"What is prior art?"` |
| `GET` | `/api/v1/orchestrator/rags` | Lists registered RAGs and their health | N/A |
| `POST` | `/api/v1/orchestrator/rags/register` | Connects a new remote HTTP RAG at runtime | N/A |

---

## 5. How to Connect Another RAG Architecture (e.g., RAG 2)

When your team builds the second RAG (RAG 2) as a separate service or microservice:

### Option A: Via Environment Variable (on Render or `.env`)
Set the environment variable:
```bash
RAG2_HTTP_URL=https://rag2-legal-service.onrender.com
```
On startup, `app/main.py` detects `RAG2_HTTP_URL` and automatically replaces the reference mock with an `HTTPRAGConnector` pointing to your real RAG 2.

### Option B: Via Dynamic API (at runtime without server restart)
Send a POST request to `/api/v1/orchestrator/rags/register`:
```bash
curl -X POST "http://localhost:8000/api/v1/orchestrator/rags/register" \
  -H "Content-Type: application/json" \
  -d '{
    "rag_id": "rag2_legal_service",
    "name": "RAG 2: Authoritative Legal & Regulatory Evidence",
    "role": "authoritative_legal",
    "endpoint_url": "https://rag2-legal-service.onrender.com",
    "authority_tier": "statutory_authority",
    "description": "Production RAG 2 service for Patents Act and Biological Diversity Act"
  }'
```

---

## 6. How to Run Locally and Run Tests

### Start the Server:
```bash
python3 run.py
```
Visit the interactive Swagger UI at:
**[http://localhost:8000/docs](http://localhost:8000/docs)**

### Run the Automated Test Suite:
```bash
python3 -m unittest discover -s tests -p "test_*.py" -v
```
All 17 tests verify data ingestion, multilingual term normalization, BM25, vector search, RAG 1 APIs, and Multi-RAG query orchestration.
