from typing import Optional

from ..config import DEFAULT_LLM_MODE


def get_llm_client(llm_mode: Optional[str] = None):
    mode = (llm_mode or DEFAULT_LLM_MODE or "api").lower()
    if mode == "local":
        from .ollama_client import OllamaClient
        return OllamaClient()

    from .gemini_client import GeminiClient
    return GeminiClient()
