"""
Application Configuration Module

Centralized configuration management for DocTalk backend.
All settings can be overridden via environment variables.
"""

import os
import secrets
import warnings
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# =============================================================================
# External API Keys
# =============================================================================
AZURE_VISION_ENDPOINT = os.getenv("AZURE_VISION_ENDPOINT")
AZURE_VISION_KEY = os.getenv("AZURE_VISION_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# =============================================================================
# JWT Authentication Configuration
# =============================================================================
_jwt_secret_env = os.getenv("JWT_SECRET")
if _jwt_secret_env:
    JWT_SECRET = _jwt_secret_env
else:
    JWT_SECRET = secrets.token_urlsafe(32)
    warnings.warn(
        "JWT_SECRET not set in environment. Generated a random secret. "
        "Sessions will not persist across restarts. Set JWT_SECRET in production.",
        RuntimeWarning
    )
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# =============================================================================
# Database Configuration
# =============================================================================
# Uses absolute path for SQLite to ensure consistent database location
_project_root = Path(__file__).resolve().parents[2]
_default_sqlite_path = (_project_root / "app.db").as_posix()
_default_database_url = f"sqlite:///{_default_sqlite_path}"
DATABASE_URL = os.getenv("DATABASE_URL", _default_database_url)

# =============================================================================
# LLM Provider Configuration
# =============================================================================
DEFAULT_LLM_MODE = os.getenv(
    "DEFAULT_LLM_MODE",
    "api" if GEMINI_API_KEY else "local"
).lower()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "tinyllama")  # 637MB - good balance speed/quality
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
OLLAMA_CONTEXT_LENGTH = int(os.getenv("OLLAMA_CONTEXT_LENGTH", "2048"))  # CPU: reduced context = faster
OLLAMA_MAX_PARALLEL = int(os.getenv("OLLAMA_MAX_PARALLEL", "6"))  # Use all 6 CPU cores!

# =============================================================================
# Session & File Processing Settings
# =============================================================================
SESSION_TIMEOUT = 24 * 60 * 60  # 24 hours
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
CHUNK_SIZE = 800  # Characters per chunk for document splitting
CHUNK_OVERLAP = 128  # Overlap between consecutive chunks

# =============================================================================
# Qdrant Vector Database Configuration
# =============================================================================
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
QDRANT_COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME", "doctalk_chunks")

# =============================================================================
# Embedding Model Configuration
# =============================================================================
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
EMBEDDING_DIMENSION = int(os.getenv("EMBEDDING_DIMENSION", "384"))
