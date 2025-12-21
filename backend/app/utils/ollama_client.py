import asyncio
import os
import queue
import threading
from typing import List, Dict, Optional, AsyncGenerator

import ollama
from ollama import Client

from ..config import OLLAMA_MODEL, OLLAMA_HOST, OLLAMA_CONTEXT_LENGTH


class OllamaClient:
    """Lightweight client for local Ollama models.

    This mirrors the GeminiClient interface so chat routing can switch
    between providers without touching the rest of the code.
    """

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or OLLAMA_MODEL
        self.context_length = OLLAMA_CONTEXT_LENGTH
        # Create explicit client with host
        self.client = Client(host=OLLAMA_HOST) if OLLAMA_HOST else Client()

    def _build_messages(self, query: str, context_docs: List[Dict], chat_history: List[Dict], hybrid_context: Optional[str] = None):
        context_text = self._format_context(context_docs)
        history_text = self._format_history(chat_history)

        system_prompt = """You are a helpful document assistant. Answer questions based on the uploaded documents.

INSTRUCTIONS:
- Be conversational and natural - this is a chat, not a formal Q&A
- If the user refers to previous parts of the conversation (e.g., "explain that more", "what did you mean by..."), use the conversation history to understand context
- Analyze which file(s) contain relevant information for the question
- When the documents contain relevant facts, cite them with explicit source numbers ("According to [1]...")
- If only part of the answer is in the documents, combine it with your own knowledge and clearly label which portion is from the uploaded files and which is general knowledge
- If none of the uploaded files mention the topic, still answer using your own knowledge, but explicitly mention that the information is outside the provided documents
- Keep responses conversational, well structured, and cite sources clearly whenever document content is referenced
- Format multiple sources like: "According to the resume [1], X is Y. Meanwhile, from general knowledge, Z is W."
- Respond in English by default. Switch to another language only if the user explicitly asks for it
- If you rely on document passages written in another language, translate them fluently and mention that you translated them
- Follow safety best practices. If a translation seems ambiguous or the request is potentially unsafe, ask for clarification instead of refusing without context

CITATION FORMAT (MUST FOLLOW):
- Documents are numbered [1], [2], [3], etc.
- After EVERY fact or claim from a document, add the citation number in brackets
- Format: "The project uses RAG [1]. It was built in 2024 [2]."
- Multiple sources: "This is supported by multiple documents [1][3]."
- ALWAYS include at least one citation number in your response

RESPONSE STYLE:
- Be conversational and natural
- Answer directly without repeating the question
- If information is not in documents, say so"""
        
        parts = []
        if context_text and context_text != "No document context available.":
            parts.append(f"DOCUMENTS:\n{context_text}")
        if history_text and history_text != "No previous conversation.":
            parts.append(f"PREVIOUS CHAT:\n{history_text}")
        parts.append(f"USER: {query}")
        
        user_prompt = "\n\n".join(parts)

        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

    async def generate_response_stream(
        self,
        query: str,
        context_docs: List[Dict],
        chat_history: List[Dict],
        hybrid_context: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream response tokens using a thread-safe queue."""
        messages = self._build_messages(query, context_docs, chat_history, hybrid_context)
        token_queue = queue.Queue()
        error_holder = [None]
        
        def _stream_in_thread():
            try:
                stream = self.client.chat(
                    model=self.model_name,
                    messages=messages,
                    options={"num_ctx": self.context_length},
                    stream=True,
                )
                for chunk in stream:
                    content = getattr(chunk.message, "content", "") if hasattr(chunk, "message") else ""
                    if content:
                        token_queue.put(("token", content))
                token_queue.put(("done", None))
            except Exception as e:
                error_holder[0] = e
                token_queue.put(("error", str(e)))
        
        thread = threading.Thread(target=_stream_in_thread, daemon=True)
        thread.start()
        
        while True:
            try:
                try:
                    msg_type, content = token_queue.get(timeout=0.1)
                except queue.Empty:
                    await asyncio.sleep(0.01)
                    continue
                
                if msg_type == "token":
                    yield content
                elif msg_type == "done":
                    break
                elif msg_type == "error":
                    raise ValueError(f"Ollama error: {content}")
            except Exception as exc:
                if error_holder[0]:
                    raise ValueError(f"Streaming error: {error_holder[0]}")
                raise exc

    async def generate_response(
        self,
        query: str,
        context_docs: List[Dict],
        chat_history: List[Dict],
        hybrid_context: Optional[str] = None,
    ) -> Dict[str, any]:
        messages = self._build_messages(query, context_docs, chat_history, hybrid_context)

        def _call_ollama():
            return self.client.chat(
                model=self.model_name,
                messages=messages,
                options={"num_ctx": self.context_length},
            )

        try:
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(None, _call_ollama)
        except Exception as exc:
            hint = f"Ensure Ollama is running on {OLLAMA_HOST} and the model '{self.model_name}' is pulled."
            raise ValueError(f"Failed to generate response with local model: {str(exc)}. {hint}")

        message = response.get("message", {})
        content = message.get("content", "") if isinstance(message, dict) else ""

        sources = self._extract_sources(context_docs)
        source_chunks = self._extract_source_chunks(context_docs)
        return {
            "response": content,
            "sources": sources,
            "source_chunks": source_chunks,
        }

    def _format_context(self, context_docs: List[Dict]) -> str:
        formatted = []
        for i, doc in enumerate(context_docs, 1):
            source = doc.get("metadata", {}).get("source", "Unknown")
            content = doc.get("page_content", "")
            formatted.append(f"[{i}] Source: {source}\n{content}")
        return "\n\n".join(formatted) if formatted else "No document context available."

    def _format_history(self, chat_history: List[Dict]) -> str:
        if not chat_history:
            return "No previous conversation."

        formatted = []
        for message in chat_history[-10:]:
            role = message.get("role", "user").capitalize()
            content = message.get("content", "")
            formatted.append(f"{role}: {content}")
        return "\n".join(formatted)

    def _extract_sources(self, context_docs: List[Dict]) -> List[str]:
        sources = set()
        for doc in context_docs:
            source = doc.get("metadata", {}).get("source", "Unknown")
            sources.add(source)
        return list(sources)

    def _extract_source_chunks(self, context_docs: List[Dict]) -> List[Dict]:
        source_chunks = []
        for i, doc in enumerate(context_docs):
            source = doc.get("metadata", {}).get("source", "Unknown")
            content = doc.get("page_content", "")
            if content:
                source_chunks.append({
                    "index": i + 1,
                    "source": source,
                    "chunk": content[:800],
                })
        return source_chunks
