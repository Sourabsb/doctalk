from typing import Optional

from ..config import DEFAULT_LLM_MODE


def get_llm_client(llm_mode: Optional[str] = None, cloud_model: Optional[str] = None):
    mode = (llm_mode or DEFAULT_LLM_MODE or "api").lower()
    if mode == "local":
        from .ollama_client import OllamaClient
        return OllamaClient()

    selected_cloud = (cloud_model or "gemini").lower()
    if selected_cloud == "groq":
        from .groq_client import GroqClient
        return GroqClient()

    from .gemini_client import GeminiClient
    return GeminiClient()
