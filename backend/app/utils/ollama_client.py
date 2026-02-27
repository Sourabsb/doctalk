import asyncio
import logging
import os
import queue
import threading
import weakref
from contextlib import asynccontextmanager
from typing import List, Dict, Optional, AsyncGenerator, Any

import requests
import ollama
from ollama import Client

from ..config import OLLAMA_MODEL, OLLAMA_HOST, OLLAMA_CONTEXT_LENGTH, OLLAMA_MAX_PARALLEL

logger = logging.getLogger(__name__)

# ============== LLM Server Configuration ==============
# Supports both Ollama and llama.cpp servers via OpenAI-compatible API
OLLAMA_SERVER = OLLAMA_HOST or "http://127.0.0.1:11434"


# ============== Concurrency Management System ==============
# Per-event-loop storage for conversation locks and semaphores
# Prevents race conditions in async LLM request handling

_conversation_locks_storage: weakref.WeakKeyDictionary = weakref.WeakKeyDictionary()
_conversation_acquired_storage: weakref.WeakKeyDictionary = weakref.WeakKeyDictionary()
_global_lock_storage: weakref.WeakKeyDictionary = weakref.WeakKeyDictionary()
_local_mode_semaphores: weakref.WeakKeyDictionary = weakref.WeakKeyDictionary()


def _get_conversation_locks() -> Dict[int, asyncio.Semaphore]:
    """Get per-loop conversation locks dict."""
    loop = asyncio.get_running_loop()
    if loop not in _conversation_locks_storage:
        _conversation_locks_storage[loop] = {}
    return _conversation_locks_storage[loop]


def _get_conversation_acquired() -> Dict[int, bool]:
    """Get per-loop conversation acquired status dict."""
    loop = asyncio.get_running_loop()
    if loop not in _conversation_acquired_storage:
        _conversation_acquired_storage[loop] = {}
    return _conversation_acquired_storage[loop]


def _get_global_lock() -> asyncio.Lock:
    """Get or create a global lock for the current event loop."""
    loop = asyncio.get_running_loop()
    if loop not in _global_lock_storage:
        _global_lock_storage[loop] = asyncio.Lock()
    return _global_lock_storage[loop]


def _get_local_semaphore() -> asyncio.Semaphore:
    """Get or create a semaphore for local mode allowing parallel requests."""
    loop = asyncio.get_running_loop()
    if loop not in _local_mode_semaphores:
        _local_mode_semaphores[loop] = asyncio.Semaphore(OLLAMA_MAX_PARALLEL)
    return _local_mode_semaphores[loop]


async def _get_conversation_lock(conversation_id: int) -> asyncio.Semaphore:
    """Get or create a semaphore for a specific conversation."""
    async with _get_global_lock():
        locks = _get_conversation_locks()
        acquired = _get_conversation_acquired()
        if conversation_id not in locks:
            locks[conversation_id] = asyncio.Semaphore(1)
            acquired[conversation_id] = False
        return locks[conversation_id]


async def acquire_llm_lock(conversation_id: int, timeout: float = 180.0) -> bool:
    """Acquire the LLM lock for a conversation (used for streaming)."""
    semaphore = await _get_conversation_lock(conversation_id)
    try:
        await asyncio.wait_for(semaphore.acquire(), timeout=timeout)
    except asyncio.TimeoutError:
        return False
    # Don't catch CancelledError here - let it propagate (semaphore not yet acquired)
    
    # Semaphore acquired - now we must release on any failure
    marked_acquired = False
    try:
        async with _get_global_lock():
            _get_conversation_acquired()[conversation_id] = True
            marked_acquired = True
        return True
    except BaseException:
        # Release semaphore only if we failed to mark as acquired
        # (if marked, release_llm_lock will handle it)
        if not marked_acquired:
            semaphore.release()
        raise


async def release_llm_lock(conversation_id: int):
    """Release the LLM lock for a conversation."""
    async with _get_global_lock():
        locks = _get_conversation_locks()
        acquired = _get_conversation_acquired()
        if conversation_id in locks and acquired.get(conversation_id, False):
            try:
                locks[conversation_id].release()
                acquired[conversation_id] = False
            except ValueError:
                pass


async def cleanup_conversation_locks(conversation_id: int) -> bool:
    """Remove lock entries for a finished conversation.
    
    Returns True if cleanup was performed, False if lock is still held.
    Only cleans up if the lock is not currently acquired to prevent
    breaking release_llm_lock for in-progress operations.
    """
    async with _get_global_lock():
        acquired = _get_conversation_acquired()
        # Only clean up if lock is not currently held
        if acquired.get(conversation_id, False):
            # Lock is still held, skip cleanup to allow proper release later
            logger.debug(
                "Skipping cleanup for conversation %d: lock still held",
                conversation_id
            )
            return False
        _get_conversation_locks().pop(conversation_id, None)
        acquired.pop(conversation_id, None)
        return True


@asynccontextmanager
async def LLMRequestContext(conversation_id: int, timeout: float = 500.0):
    """Async context manager that serializes LLM requests per conversation."""
    semaphore = await _get_conversation_lock(conversation_id)
    acquired = False
    try:
        await asyncio.wait_for(semaphore.acquire(), timeout=timeout)
        acquired = True
        # Mark as acquired so cleanup_conversation_locks knows lock is held
        async with _get_global_lock():
            _get_conversation_acquired()[conversation_id] = True
        yield
    except asyncio.TimeoutError:
        raise TimeoutError("Another LLM request is in progress. Please wait and try again.")
    finally:
        if acquired:
            # Use asyncio.shield to prevent cancellation from interrupting cleanup
            # This ensures semaphore.release() always runs
            try:
                await asyncio.shield(_reset_acquired_flag(conversation_id))
            except asyncio.CancelledError:
                pass  # Ignore cancellation during cleanup, flag reset attempted
            finally:
                semaphore.release()


async def _reset_acquired_flag(conversation_id: int):
    """Helper to reset acquired flag under global lock."""
    async with _get_global_lock():
        _get_conversation_acquired()[conversation_id] = False


@asynccontextmanager
async def LocalModeLock(timeout: float = 180.0):
    """Global lock for local mode - ensures only one Ollama request at a time."""
    semaphore = _get_local_semaphore()
    acquired = False
    try:
        await asyncio.wait_for(semaphore.acquire(), timeout=timeout)
        acquired = True
        yield
    except asyncio.TimeoutError:
        raise TimeoutError("Ollama is busy processing another request. Please wait.")
    finally:
        if acquired:
            semaphore.release()


# ============== Ollama Client ==============


class OllamaClient:
    """
    Unified client for local LLM inference.
    
    Supports both Ollama and llama.cpp servers through OpenAI-compatible API.
    Implements the same interface as cloud providers (GeminiClient, GroqClient)
    to enable seamless switching between local and cloud inference modes.
    
    Uses HTTP requests for maximum compatibility across different server implementations.
    """

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or OLLAMA_MODEL
        self.context_length = OLLAMA_CONTEXT_LENGTH
        # Create client to single Ollama server with GPU support
        self.client = Client(host=OLLAMA_SERVER)

    def _build_messages(self, query: str, context_docs: List[Dict], chat_history: List[Dict], hybrid_context: Optional[str] = None):
        context_text = self._format_context(context_docs)
        history_text = self._format_history(chat_history)

        system_prompt = """You are a helpful document assistant. Answer questions based on the uploaded documents.

INSTRUCTIONS:
- Be conversational and natural - this is a chat, not a formal Q&A
- If the user refers to previous parts of the conversation, use the conversation history to understand context
- The DOCUMENTS section contains the most relevant excerpts from the uploaded files - treat them as ground truth
- When the documents contain relevant facts, cite them with explicit source numbers (e.g., "According to [1]...")
- If only part of the answer is in the documents, combine it with your own knowledge naturally
- If the documents do not cover the topic at all, answer from general knowledge only - do NOT add any disclaimer or meta-commentary about what the documents do or do not contain
- Keep responses concise and well structured
- Do NOT add footers, disclaimers, notes, or "please note" paragraphs - just answer the question
- Respond in English by default. Switch to another language only if the user explicitly asks for it
- Do NOT format as tables - use paragraphs or bullet lists only

CITATION FORMAT:
- Documents are numbered: "[1] Source: filename"
- After EVERY fact taken from a document, add the citation number in brackets: e.g. "The economy shrank [1]."
- NEVER use bare numbers like 1 or 2 as citations - ALWAYS use brackets: [1], [2]
- Numbered list items (1. 2. 3.) are list counters, NOT citations - use both when needed:
  Example: "1. The market crashed [1]."

STYLE:
- Be concise, avoid repetition
- Cite document facts with [n] in brackets; do not cite general knowledge
- Keep responses focused and clear

CRITICAL - STOP AFTER ANSWERING:
- Answer the question completely and then STOP
- Do NOT generate questions, continuations, "USER:", "ASSISTANT:" labels, or additional commentary after your answer
"""
        
        
        parts = []
        if context_text and context_text != "No document context available.":
            parts.append(f"DOCUMENTS:\n{context_text}")
        if history_text and history_text != "No previous conversation.":
            parts.append(f"PREVIOUS CHAT:\n{history_text}")
        
        # Add explicit citation reminder before user query
        parts.append("REMINDER: When you reference information from the documents above, you MUST add the citation number in brackets like [1], [2], etc. after each fact. Example: 'The economy grew in 2024 [1].'")
        parts.append(f"QUESTION: {query}")
        
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
        """Stream response tokens using HTTP requests (compatible with llama.cpp)."""
        messages = self._build_messages(query, context_docs, chat_history, hybrid_context)
        token_queue = queue.Queue()
        error_holder = [None]
        
        def _stream_in_thread():
            """Stream HTTP response in background thread."""
            url = f"{OLLAMA_HOST.rstrip('/')}/v1/chat/completions"
            payload = {
                "model": self.model_name,
                "messages": messages,
                "max_tokens": 4000,
                "temperature": 0.7,
                "stream": True
            }
            try:
                import json
                response = requests.post(url, json=payload, stream=True, timeout=500)
                response.raise_for_status()
                
                for line in response.iter_lines(decode_unicode=True):
                    if not line:
                        continue
                    
                    if line.startswith('data: '):
                        data_str = line[6:]
                        if data_str == '[DONE]':
                            break
                        
                        try:
                            data = json.loads(data_str)
                            if 'choices' in data and len(data['choices']) > 0:
                                choice = data['choices'][0]
                                if 'delta' in choice and 'content' in choice['delta']:
                                    content = choice['delta']['content']
                                    if content:
                                        logger.debug(f"[Stream] Token: {content[:20]}")
                                        token_queue.put(("token", content))
                        except json.JSONDecodeError:
                            continue
                
                token_queue.put(("done", None))
            except Exception as e:
                error_holder[0] = e
                token_queue.put(("error", str(e)))
        
        # Start background thread
        thread = threading.Thread(target=_stream_in_thread, daemon=True)
        thread.start()
        
        # Yield tokens as they arrive
        while True:
            try:
                try:
                    msg_type, content = token_queue.get(timeout=0.1)
                except queue.Empty:
                    await asyncio.sleep(0.01)
                    continue
                
                if msg_type == "token":
                    # Clean chat template markers from streaming tokens
                    cleaned_content = self._clean_streaming_token(content)
                    if cleaned_content:
                        yield cleaned_content
                elif msg_type == "done":
                    break
                elif msg_type == "error":
                    raise ValueError(f"Streaming error: {content}")
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
    ) -> Dict[str, Any]:
        messages = self._build_messages(query, context_docs, chat_history, hybrid_context)

        def _call_http():
            # Use OpenAI-compatible chat completions endpoint
            url = f"{OLLAMA_HOST.rstrip('/')}/v1/chat/completions"
            payload = {
                "model": self.model_name,
                "messages": messages,
                "max_tokens": 2000,  # Reduced to prevent overload
                "temperature": 0.7
            }
            try:
                response = requests.post(url, json=payload, timeout=500)
                response.raise_for_status()
                return response.json()
            except requests.exceptions.RequestException as e:
                logger.error(f"HTTP request failed: {e}")
                raise

        try:
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(None, _call_http)
        except Exception as exc:
            hint = f"Ensure server is running on {OLLAMA_HOST} with model '{self.model_name}'."
            raise ValueError(f"Failed to generate response: {str(exc)}. {hint}")

        # Extract content from OpenAI-format response
        content = ""
        if isinstance(response, dict):
            if 'choices' in response and len(response['choices']) > 0:
                choice = response['choices'][0]
                if isinstance(choice, dict) and 'message' in choice:
                    content = choice['message'].get('content', '')
            elif 'message' in response:
                # Ollama format fallback
                msg = response.get("message", {})
                if isinstance(msg, dict):
                    content = msg.get("content", "")

        sources = self._extract_sources(context_docs)
        source_chunks = self._extract_source_chunks(context_docs)
        return {
            "response": content,
            "sources": sources,
            "source_chunks": source_chunks,
        }

    async def generate_simple_response(self, prompt: str) -> str:
        """
        Simple generation without document context - for mindmap/flashcards.
        Uses raw HTTP requests to support both Ollama and llama.cpp servers.
        """
        def _call_http():
            # Use OpenAI-compatible chat completions endpoint
            url = f"{OLLAMA_HOST.rstrip('/')}/v1/chat/completions"
            payload = {
                "model": self.model_name,
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 2000,  # Reduced to prevent overload
                "temperature": 0.7
            }
            try:
                response = requests.post(url, json=payload, timeout=500)
                response.raise_for_status()
                return response.json()
            except requests.exceptions.HTTPError as e:
                logger.error(f"HTTP request failed: {e}")
                logger.error(f"Response content: {e.response.text if hasattr(e, 'response') else 'No response'}")
                logger.error(f"Prompt length: {len(prompt)} characters")
                raise
            except requests.exceptions.RequestException as e:
                logger.error(f"HTTP request failed: {e}")
                raise

        try:
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(None, _call_http)
            logger.debug("HTTP response type: %s", type(response).__name__)
        except Exception as exc:
            hint = f"Ensure server is running on {OLLAMA_HOST} with model '{self.model_name}'."
            raise ValueError(f"LLM error: {str(exc)}. {hint}")

        # Extract content from OpenAI-format response
        content = ""
        logger.info(f"[LLM Response] Full response keys: {response.keys() if isinstance(response, dict) else 'not dict'}")
        if isinstance(response, dict):
            if 'choices' in response and len(response['choices']) > 0:
                # OpenAI format: response.choices[0].message.content
                choice = response['choices'][0]
                logger.info(f"[LLM Response] Choice keys: {choice.keys() if isinstance(choice, dict) else 'not dict'}")
                if isinstance(choice, dict) and 'message' in choice:
                    msg = choice['message']
                    logger.info(f"[LLM Response] Message: {msg}")
                    content = msg.get('content', '')
                    logger.info(f"[LLM Response] Extracted {len(content)} chars from OpenAI format")
            elif 'message' in response:
                # Ollama format fallback: response.message.content
                msg = response.get("message", {})
                if isinstance(msg, dict):
                    content = msg.get("content", "")
                    logger.info(f"[LLM Response] Extracted {len(content)} chars from Ollama format")
        
        logger.info(f"[LLM Response] Final content length: {len(content)}")
        
        # Clean up chat template markers from response
        content = self._clean_response(content)
        
        return content

    def _clean_response(self, text: str) -> str:
        """Remove chat template markers and formatting artifacts from response."""
        if not text:
            return text
        
        import re
        
        # Remove USER: and Assistant: labels that appear in responses
        text = re.sub(r'^(USER|Assistant):\s*', '', text, flags=re.MULTILINE)
        text = re.sub(r'\n(USER|Assistant):\s*', '\n', text)
        
        # Remove chat template tags if present
        text = re.sub(r'<\|system\|>.*?<\|end\|>', '', text, flags=re.DOTALL)
        text = re.sub(r'<\|user\|>.*?<\|end\|>', '', text, flags=re.DOTALL)
        text = re.sub(r'<\|assistant\|>', '', text)
        text = re.sub(r'<\|end\|>', '', text)
        
        # Strip trailing echoed prompt artifacts: "QUESTION: ...", "REMINDER: ...", "DOCUMENTS: ..."
        # These appear when the local LLM echoes back parts of the prompt at the end
        text = re.sub(r'\n*\bQUESTION\s*:.*$', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'\n*\bREMINDER\s*:.*$', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'\n*\bDOCUMENTS\s*:.*$', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'\n*\bPREVIOUS CHAT\s*:.*$', '', text, flags=re.DOTALL | re.IGNORECASE)
        
        # Strip trailing "Question: ..." / "Answer: ..." patterns added by hallucination
        text = re.sub(r'\n+(?:Q(?:uestion)?|A(?:nswer)?)\s*:\s*.+$', '', text, flags=re.DOTALL | re.IGNORECASE)
        
        # Strip "Please note..." disclaimer paragraphs
        text = re.sub(r'\n*\bPlease note\b.*$', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'\n*\bNote\s*:.*$', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'\n*\bImportant\s*:.*$', '', text, flags=re.DOTALL | re.IGNORECASE)
        
        # Remove empty lines at start and end
        return text.strip()

    def _clean_streaming_token(self, token: str) -> str:
        """Clean individual streaming tokens from chat template markers."""
        if not token:
            return token
        
        import re
        
        # Skip tokens that are just template markers
        if token.strip() in ['USER:', 'Assistant:', '<|assistant|>', '<|end|>', '<|user|>', '<|system|>']:
            return ''
        
        # Remove these patterns if they appear
        token = re.sub(r'(USER|Assistant):\s*', '', token)
        token = re.sub(r'<\|assistant\|>', '', token)
        token = re.sub(r'<\|end\|>', '', token)
        
        return token

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
            role = message.get("role", "user")
            content = message.get("content", "")
            # Use Q: and A: instead of User: and Assistant: to prevent model from continuing conversation
            prefix = "Q:" if role == "user" else "A:"
            formatted.append(f"{prefix} {content}")
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
