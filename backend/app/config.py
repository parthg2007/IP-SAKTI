"""Application configuration settings."""
import os
from pathlib import Path
from typing import Optional

# Load .env file BEFORE any os.getenv calls
from dotenv import load_dotenv
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings:
    BASE_DIR: Path = BASE_DIR
    RULES_DIR: Path = Path(os.getenv("RULES_DIR", str(BASE_DIR / "data" / "rules")))

    # Server configuration
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "False").lower() in ("true", "1", "t")
    CORS_ORIGINS: list[str] = [
        origin.strip().rstrip("/") for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
        ).split(",") if origin.strip()
    ]

    # Dataset and DB paths (RAG 1)
    DATA_JSONL_PATH: Path = BASE_DIR / "rag1_ayurveda_ip_knowledge.jsonl"
    DATA_CSV_PATH: Path = BASE_DIR / "rag1_ayurveda_ip_knowledge.csv"
    DATA_MANIFEST_PATH: Path = BASE_DIR / "rag1_source_manifest.csv"
    VECTOR_DB_PATH: Path = Path(os.getenv("VECTOR_DB_PATH", str(BASE_DIR / "vector.db")))

    # Dataset and DB paths (RAG 2 - Legal & Regulatory)
    RAG2_DATA_JSONL_PATH: Path = BASE_DIR / "rag2_legal_regulatory_evidence.jsonl"
    RAG2_DATA_CSV_PATH: Path = BASE_DIR / "rag2_legal_regulatory_evidence.csv"
    RAG2_MANIFEST_PATH: Path = BASE_DIR / "rag2_source_manifest.csv"
    RAG2_VECTOR_DB_PATH: Path = Path(os.getenv("RAG2_VECTOR_DB_PATH", str(BASE_DIR / "vector_rag2.db")))

    # Retrieval parameters
    BM25_K1: float = float(os.getenv("BM25_K1", "1.5"))
    BM25_B: float = float(os.getenv("BM25_B", "0.75"))
    HYBRID_BM25_WEIGHT: float = float(os.getenv("HYBRID_BM25_WEIGHT", "0.45"))
    HYBRID_VECTOR_WEIGHT: float = float(os.getenv("HYBRID_VECTOR_WEIGHT", "0.55"))
    RRF_K: int = int(os.getenv("RRF_K", "60"))
    DEFAULT_TOP_K: int = int(os.getenv("DEFAULT_TOP_K", "5"))

    # Secondary / External RAGs (e.g., RAG 2 Legal & Regulatory)
    ENABLE_MOCK_RAG2: bool = os.getenv("ENABLE_MOCK_RAG2", "False").lower() in ("true", "1", "t")
    USE_LOCAL_RAG2: bool = os.getenv("USE_LOCAL_RAG2", "True").lower() in ("true", "1", "t")
    RAG2_HTTP_URL: Optional[str] = os.getenv("RAG2_HTTP_URL", None)
    RAG_TIMEOUT_SECONDS: float = float(os.getenv("RAG_TIMEOUT_SECONDS", "10.0"))

    # Groq LLM & Voice Configuration
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY", None)
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
    GROQ_WHISPER_MODEL: str = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")
    GROQ_MAX_TOKENS: int = int(os.getenv("GROQ_MAX_TOKENS", "900"))
    GROQ_TEMPERATURE: float = float(os.getenv("GROQ_TEMPERATURE", "0.2"))
    DEEPGRAM_API_KEY: Optional[str] = os.getenv("DEEPGRAM_API_KEY", None)

    # BHASHINI multilingual translation (optional but production-integrable)
    BHASHINI_ENABLED: bool = os.getenv("BHASHINI_ENABLED", "False").lower() in ("true", "1", "t")
    BHASHINI_USER_ID: Optional[str] = os.getenv("BHASHINI_USER_ID")
    BHASHINI_API_KEY: Optional[str] = os.getenv("BHASHINI_API_KEY")
    BHASHINI_PIPELINE_ID: Optional[str] = os.getenv("BHASHINI_PIPELINE_ID")
    BHASHINI_CONFIG_URL: str = os.getenv("BHASHINI_CONFIG_URL", "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline")
    BHASHINI_INFERENCE_URL: Optional[str] = os.getenv("BHASHINI_INFERENCE_URL")
    BHASHINI_TIMEOUT_SECONDS: float = float(os.getenv("BHASHINI_TIMEOUT_SECONDS", "20"))

    # Human IP facilitator escalation
    HUMAN_ESCALATION_ENABLED: bool = os.getenv("HUMAN_ESCALATION_ENABLED", "True").lower() in ("true", "1", "t")
    IP_FACILITATOR_EMAIL: Optional[str] = os.getenv("IP_FACILITATOR_EMAIL")
    ESCALATION_STORE_PATH: Path = Path(os.getenv("ESCALATION_STORE_PATH", str(BASE_DIR / "data" / "escalations.jsonl")))

settings = Settings()
