"""Main FastAPI Application for IP-SAKTI Backend."""
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.rag1.service import rag1_service
from app.rag1.routes import router as rag1_router
from app.rag2.service import rag2_service
from app.rag2.routes import router as rag2_router
from app.orchestrator.routes import router as orchestrator_router
from app.orchestrator.registry import rag_registry
from app.orchestrator.local_connector import LocalRAG1Connector
from app.orchestrator.local_rag2_connector import LocalRAG2Connector
from app.orchestrator.mock_rag2_connector import MockRAG2Connector
from app.orchestrator.http_connector import HTTPRAGConnector
from app.orchestrator.human_routes import router as human_router
from app.orchestrator.voice_routes import router as voice_router
from app.core.bhashini import SUPPORTED_LANGUAGES, bhashini
from app.rules.loader import reload_rule_set

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("ip_sakti")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management."""
    logger.info("Starting up IP-SAKTI Knowledge Backend...")
    reload_rule_set()

    # 1. Initialize RAG 1 Domain Service
    rag1_service.initialize()

    # 2. Initialize RAG 2 Legal & Regulatory Service
    rag2_service.initialize()

    # 3. Register RAG 1 in Multi-RAG Registry
    local_rag1 = LocalRAG1Connector()
    rag_registry.register(local_rag1)

    # 4. Connect RAG 2 (HTTP, Production Local, or Reference Mock)
    if settings.RAG2_HTTP_URL:
        logger.info(f"Connecting to remote RAG 2 at: {settings.RAG2_HTTP_URL}")
        http_rag2 = HTTPRAGConnector(
            rag_id="rag2_legal_regulatory",
            endpoint_url=settings.RAG2_HTTP_URL,
            name="RAG 2: Legal & Regulatory Evidence (Remote)",
            role="authoritative_legal",
            authority_tier="statutory_authority"
        )
        rag_registry.register(http_rag2)
    elif settings.USE_LOCAL_RAG2:
        logger.info("Attaching Production RAG 2 (Authoritative Legal & Regulatory Evidence) local connector.")
        local_rag2 = LocalRAG2Connector()
        rag_registry.register(local_rag2)
    elif settings.ENABLE_MOCK_RAG2:
        logger.info("Attaching Reference RAG 2 (Legal & Regulatory Evidence) mock connector.")
        mock_rag2 = MockRAG2Connector()
        rag_registry.register(mock_rag2)

    logger.info("IP-SAKTI Backend is fully initialized and ready.")
    yield
    logger.info("Shutting down IP-SAKTI Backend...")


app = FastAPI(
    title="IP-SAKTI: Ayurveda & IP Knowledge Backend",
    description=(
        "Production-grade domain RAG service providing Ayurveda + Intellectual Property knowledge, "
        "hybrid retrieval (BM25 + Dense Semantic Vector Search), multilingual normalization, and a "
        "modular Multi-RAG Orchestrator connectable to RAG 2 (Legal & Regulatory Evidence) and future RAGs."
    ),
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(rag1_router)
app.include_router(rag2_router)
app.include_router(orchestrator_router)
app.include_router(human_router)
app.include_router(voice_router)


@app.get("/api/v1/languages", tags=["Multilingual"])
async def supported_languages():
    return {"languages": [{"code": code, "name": name} for code, name in SUPPORTED_LANGUAGES.items()], "bhashini_enabled": bhashini.enabled}


# Locate built frontend if available
def _get_frontend_dist() -> Path | None:
    candidates = [
        settings.BASE_DIR.parent / "frontend" / "dist",
        settings.BASE_DIR / "frontend" / "dist",
    ]
    for candidate in candidates:
        if candidate.exists() and (candidate / "index.html").exists():
            return candidate
    return None


frontend_dist = _get_frontend_dist()

if frontend_dist:
    assets_dir = frontend_dist / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend-assets")
    animations_dir = frontend_dist / "animations"
    if animations_dir.is_dir():
        app.mount("/animations", StaticFiles(directory=str(animations_dir)), name="frontend-animations")

    @app.get("/favicon.svg", include_in_schema=False)
    async def favicon():
        fav = frontend_dist / "favicon.svg"
        if fav.exists():
            return FileResponse(fav)
        return Response(status_code=404)

    @app.get("/icons.svg", include_in_schema=False)
    async def icons():
        ico = frontend_dist / "icons.svg"
        if ico.exists():
            return FileResponse(ico)
        return Response(status_code=404)

    @app.get("/chat", include_in_schema=False)
    async def chat_spa():
        return FileResponse(frontend_dist / "index.html")


@app.get("/", tags=["System Information"])
async def root(request: Request):
    accept = request.headers.get("accept", "")
    # Serve SPA index.html when a browser requests HTML
    if "text/html" in accept and frontend_dist and (frontend_dist / "index.html").exists():
        return FileResponse(frontend_dist / "index.html")

    return {
        "service": "IP-SAKTI Backend",
        "version": "1.0.0",
        "description": "Multi-RAG Knowledge Backend: RAG 1 (Domain Knowledge) + RAG 2 (Legal & Regulatory Evidence)",
        "docs_url": "/docs",
        "endpoints": {
            "rag1_query": "/api/v1/rag/knowledge/query",
            "rag1_search": "/api/v1/rag/knowledge/search",
            "rag1_health": "/api/v1/rag/knowledge/health",
            "rag2_query": "/api/v1/rag/legal/query",
            "rag2_historical": "/api/v1/rag/legal/historical",
            "rag2_search": "/api/v1/rag/legal/search",
            "rag2_health": "/api/v1/rag/legal/health",
            "orchestrator_query": "/api/v1/orchestrator/query",
            "orchestrator_route": "/api/v1/orchestrator/route",
            "orchestrator_rags": "/api/v1/orchestrator/rags",
            "orchestrator_register": "/api/v1/orchestrator/rags/register"
        }
    }


@app.get("/api", tags=["System Information"])
@app.get("/api/info", tags=["System Information"])
async def api_info():
    return {
        "service": "IP-SAKTI Backend",
        "version": "1.0.0",
        "description": "Multi-RAG Knowledge Backend: RAG 1 (Domain Knowledge) + RAG 2 (Legal & Regulatory Evidence)",
        "docs_url": "/docs",
        "endpoints": {
            "rag1_query": "/api/v1/rag/knowledge/query",
            "rag1_search": "/api/v1/rag/knowledge/search",
            "rag1_health": "/api/v1/rag/knowledge/health",
            "rag2_query": "/api/v1/rag/legal/query",
            "rag2_historical": "/api/v1/rag/legal/historical",
            "rag2_search": "/api/v1/rag/legal/search",
            "rag2_health": "/api/v1/rag/legal/health",
            "orchestrator_query": "/api/v1/orchestrator/query",
            "orchestrator_route": "/api/v1/orchestrator/route",
            "orchestrator_rags": "/api/v1/orchestrator/rags",
            "orchestrator_register": "/api/v1/orchestrator/rags/register"
        }
    }
