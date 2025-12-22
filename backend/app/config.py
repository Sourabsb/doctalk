import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

AZURE_VISION_ENDPOINT = os.getenv("AZURE_VISION_ENDPOINT")
AZURE_VISION_KEY = os.getenv("AZURE_VISION_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROK_API_KEY")
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-this-in-production-min-32-chars")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
# IMPORTANT: Use a stable absolute path for SQLite so data doesn't split across
# multiple app.db files depending on the server working directory.
_project_root = Path(__file__).resolve().parents[2]
_default_sqlite_path = (_project_root / "app.db").as_posix()
_default_database_url = f"sqlite:///{_default_sqlite_path}"
DATABASE_URL = os.getenv("DATABASE_URL", _default_database_url)
DEFAULT_LLM_MODE = os.getenv(
	"DEFAULT_LLM_MODE",
	"api" if GEMINI_API_KEY else "local"
).lower()
GROQ_MODEL = os.getenv("GROQ_MODEL", "groq/compound")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3:8b-instruct-q4_K_M")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
OLLAMA_CONTEXT_LENGTH = int(os.getenv("OLLAMA_CONTEXT_LENGTH", "4096"))

# Increase session timeout to 24 hours instead of 30 minutes
SESSION_TIMEOUT = 24 * 60 * 60  # 24 hours
MAX_FILE_SIZE = 20 * 1024 * 1024
CHUNK_SIZE = 512
CHUNK_OVERLAP = 50
