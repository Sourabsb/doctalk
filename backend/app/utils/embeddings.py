"""
Embedding and Vector Search utilities using Qdrant + Sentence Transformers.

This module provides:
- QdrantVectorStore: Manages embeddings in Qdrant vector database
- HybridRAGProcessor: Combines document RAG + chat history for context building
"""

import hashlib
import json
import threading
import uuid
from typing import List, Dict, Sequence, Optional
from pathlib import Path
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue

from ..config import (
    CHUNK_SIZE, CHUNK_OVERLAP, 
    QDRANT_HOST, QDRANT_PORT, QDRANT_COLLECTION_NAME,
    EMBEDDING_MODEL, EMBEDDING_DIMENSION
)

# Global embedding model instances (loaded once per model type)
_embedding_models: Dict[str, object] = {}
_qdrant_client: Optional[QdrantClient] = None
_qdrant_initialized: bool = False
_qdrant_init_lock = threading.Lock()
_embedding_init_lock = threading.Lock()
_qdrant_client_lock = threading.Lock()

# Model name constants
ALLMINILM_MODEL_NAME = "all-MiniLM-L6-v2"

def get_embedding_model(model_name: str = None):
    """Get or initialize an embedding model by name (singleton per model, thread-safe).
    
    Args:
        model_name: 'custom' for DocTalk model, 'allminilm' for all-MiniLM-L6-v2.
                    If None, uses the global EMBEDDING_MODEL config.
    """
    global _embedding_models
    
    if model_name is None:
        model_name = EMBEDDING_MODEL
    
    # Normalize
    model_name = model_name.lower().strip()
    
    if model_name in _embedding_models:
        return _embedding_models[model_name]
    
    with _embedding_init_lock:
        if model_name in _embedding_models:
            return _embedding_models[model_name]
        
        if model_name == "custom":
            print(f"[Embeddings] Loading custom DocTalk embedding model")
            from .custom_model import DocTalkEmbeddingModel
            model_path = Path(__file__).parent.parent.parent / "models"
            model = DocTalkEmbeddingModel(str(model_path))
            print(f"[Embeddings] Custom model loaded successfully")
        elif model_name == "allminilm":
            print(f"[Embeddings] Loading model: {ALLMINILM_MODEL_NAME}")
            model = SentenceTransformer(ALLMINILM_MODEL_NAME)
            print(f"[Embeddings] {ALLMINILM_MODEL_NAME} loaded successfully")
        else:
            print(f"[Embeddings] Loading model: {model_name}")
            trusted_prefixes = ["jinaai/jina-embeddings", "nomic-ai/nomic-embed"]
            trust_code = any(model_name.startswith(prefix) for prefix in trusted_prefixes)
            model = SentenceTransformer(model_name, trust_remote_code=trust_code)
            print(f"[Embeddings] Model loaded successfully")
        
        _embedding_models[model_name] = model
    
    return _embedding_models[model_name]


def get_qdrant_client() -> QdrantClient:
    """Get Qdrant client instance (singleton pattern, thread-safe).
    
    Tries to connect to external Qdrant server first.
    Falls back to local disk-based storage if connection fails.
    """
    global _qdrant_client
    
    if _qdrant_client is not None:
        return _qdrant_client
    
    with _qdrant_client_lock:
        if _qdrant_client is not None:
            return _qdrant_client
        
        try:
            client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT, timeout=3)
            client.get_collections()
            print(f"[Qdrant] Connected to {QDRANT_HOST}:{QDRANT_PORT}")
            _qdrant_client = client
        except Exception as e:
            print(f"[Qdrant] External server not available: {e}")
            print("[Qdrant] Using local disk-based storage instead")
            from pathlib import Path
            qdrant_path = Path(__file__).parent.parent.parent / "qdrant_data"
            qdrant_path.mkdir(exist_ok=True)
            _qdrant_client = QdrantClient(path=str(qdrant_path))
            print(f"[Qdrant] Local storage initialized at: {qdrant_path}")
    
    return _qdrant_client


def ensure_collection_exists(client: QdrantClient, collection_name: str = QDRANT_COLLECTION_NAME):
    """Create collection if it doesn't exist (thread-safe)."""
    global _qdrant_initialized
    
    # Quick check without lock
    if _qdrant_initialized:
        return
    
    with _qdrant_init_lock:
        # Re-check inside lock
        if _qdrant_initialized:
            return
        
        try:
            collections = client.get_collections().collections
            exists = any(c.name == collection_name for c in collections)
            
            if not exists:
                print(f"[Qdrant] Creating collection: {collection_name}")
                client.create_collection(
                    collection_name=collection_name,
                    vectors_config=VectorParams(
                        size=EMBEDDING_DIMENSION,
                        distance=Distance.COSINE
                    )
                )
                print(f"[Qdrant] Collection created")
            
            _qdrant_initialized = True
        except Exception as e:
            # Do NOT set _qdrant_initialized on error - allow retries
            import logging
            logger = logging.getLogger(__name__)
            logger.exception("Error ensuring Qdrant collection")
            raise  # Re-raise to let callers fail fast


class QdrantVectorStore:
    """
    Vector store using Qdrant for document embeddings.
    Uses conversation_id for multi-tenant filtering.
    """
    
    def __init__(self, conversation_id: int, embedding_model_name: str = None):
        self.conversation_id = conversation_id
        self.embedding_model_name = embedding_model_name
        self.client = get_qdrant_client()
        self.model = get_embedding_model(embedding_model_name)
        self.collection_name = QDRANT_COLLECTION_NAME
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            length_function=len,
        )
        ensure_collection_exists(self.client, self.collection_name)
    
    def embed_text(self, text: str) -> List[float]:
        """Generate embedding for a single text."""
        embedding = self.model.encode([text] if isinstance(text, str) else text)
        # Ensure we return a flat 1D list
        if hasattr(embedding, 'shape') and len(embedding.shape) > 1:
            embedding = embedding[0]
        return embedding.tolist()
    
    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts (batched)."""
        return self.model.encode(texts).tolist()
    
    def add_documents(
        self, 
        text_data: Dict[str, str], 
        document_ids: Optional[Dict[str, int]] = None
    ) -> tuple:
        """
        Add documents to vector store.
        
        Args:
            text_data: Dict mapping source name to text content
            document_ids: Optional dict mapping source name to document_id
            
        Returns:
            Tuple of (chunk_count, texts, metadatas) where texts and metadatas 
            can be reused by EmbeddingProcessor for SQLite storage
        """
        texts = []
        metadatas = []
        
        for source, text in text_data.items():
            chunks = self.text_splitter.split_text(text)
            doc_id = document_ids.get(source) if document_ids else None
            
            for i, chunk in enumerate(chunks):
                texts.append(chunk)
                metadatas.append({
                    "source": source,
                    "chunk_index": i,
                    "chunk_id": i,  # Include chunk_id for EmbeddingProcessor compatibility
                    "document_id": doc_id,
                    "conversation_id": self.conversation_id,
                    "type": "document"
                })
        
        if not texts:
            return 0, [], []
        
        # Generate embeddings in batch
        print(f"[Qdrant] Generating embeddings for {len(texts)} chunks...")
        embeddings = self.embed_texts(texts)
        
        points = []
        for i, (text, embedding, metadata) in enumerate(zip(texts, embeddings, metadatas)):
            doc_id = metadata.get("document_id")
            chunk_idx = metadata.get("chunk_index", i)
            source = metadata.get("source", "unknown")
            namespace_string = f"{self.conversation_id}:{source}:{doc_id}:{chunk_idx}:{text[:100]}"
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, namespace_string))
            points.append(PointStruct(
                id=point_id,
                vector=embedding,
                payload={
                    **metadata,
                    "content": text
                }
            ))
        
        # Upsert to Qdrant in batches
        batch_size = 100
        for i in range(0, len(points), batch_size):
            batch = points[i:i + batch_size]
            self.client.upsert(
                collection_name=self.collection_name,
                points=batch
            )
        
        print(f"[Qdrant] Added {len(points)} vectors to collection")
        return len(points), texts, metadatas
    
    def search(
        self, 
        query: str, 
        k: int = 5,
        document_ids: Optional[List[int]] = None
    ) -> List[Dict]:
        """
        Semantic search in vector store.
        
        Args:
            query: Search query
            k: Number of results
            document_ids: Optional list of document_ids to filter (for active documents)
            
        Returns:
            List of results with content, metadata, and score
        """
        try:
            query_embedding = self.embed_text(query)
            
            # Build filter conditions
            must_conditions = [
                FieldCondition(
                    key="conversation_id",
                    match=MatchValue(value=self.conversation_id)
                )
            ]
            
            # Add document filter if specified
            if document_ids:
                must_conditions.append(
                    models.FieldCondition(
                        key="document_id",
                        match=models.MatchAny(any=document_ids)
                    )
                )
            
            search_filter = Filter(must=must_conditions)
            
            # Use query_points which works with both local and remote Qdrant
            points = self.client.query_points(
                collection_name=self.collection_name,
                query=query_embedding,  # must be a flat 1D list
                query_filter=search_filter,
                limit=k,
                with_payload=True
            ).points
            
            # Build results with adjusted scores
            # Significantly boost longer chunks to prefer detailed content over short index entries
            # Index entries are typically <100 chars, detailed sections are 300+ chars
            raw_results = []
            for hit in points:
                content = hit.payload.get("content", "")
                content_length = len(content)
                
                # Apply content length boost:
                # - Very short (<100 chars): likely index entry, penalize with -0.05
                # - Short (100-200 chars): neutral
                # - Medium (200-400 chars): small boost +0.03
                # - Long (400+ chars): good boost up to +0.08
                if content_length < 100:
                    length_boost = -0.05  # Penalize very short (index-like) entries
                elif content_length < 200:
                    length_boost = 0
                elif content_length < 400:
                    length_boost = 0.03
                else:
                    # Boost scales with length, max +0.08 for 800+ char chunks
                    length_boost = min(content_length / 10000, 0.08)
                
                adjusted_score = hit.score + length_boost
                
                raw_results.append({
                    "content": content,
                    "metadata": {
                        "source": hit.payload.get("source", "Unknown"),
                        "chunk_index": hit.payload.get("chunk_index", 0),
                        "document_id": hit.payload.get("document_id"),
                        "type": hit.payload.get("type", "document")
                    },
                    "score": adjusted_score,
                    "raw_score": hit.score
                })
            
            # Re-sort by adjusted score
            raw_results.sort(key=lambda x: x["score"], reverse=True)
            
            return raw_results
        except Exception as e:
            print(f"[Qdrant] Search error: {e}")
            raise
    
    def delete_by_document(self, document_id: int) -> Optional[str]:
        """Delete all vectors for a specific document. Returns operation_id if available."""
        result = self.client.delete(
            collection_name=self.collection_name,
            points_selector=models.FilterSelector(
                filter=Filter(
                    must=[
                        FieldCondition(
                            key="conversation_id",
                            match=MatchValue(value=self.conversation_id)
                        ),
                        FieldCondition(
                            key="document_id",
                            match=MatchValue(value=document_id)
                        )
                    ]
                )
            )
        )
        operation_id = getattr(result, 'operation_id', None)
        print(f"[Qdrant] Deleted vectors for document {document_id}, operation_id={operation_id}")
        return operation_id
    
    def delete_by_conversation(self) -> Optional[str]:
        """Delete all vectors for this conversation. Returns operation_id if available."""
        result = self.client.delete(
            collection_name=self.collection_name,
            points_selector=models.FilterSelector(
                filter=Filter(
                    must=[
                        FieldCondition(
                            key="conversation_id",
                            match=MatchValue(value=self.conversation_id)
                        )
                    ]
                )
            )
        )
        operation_id = getattr(result, 'operation_id', None)
        print(f"[Qdrant] Deleted all vectors for conversation {self.conversation_id}, operation_id={operation_id}")
        return operation_id


class EmbeddingProcessor:
    """
    Legacy-compatible wrapper around QdrantVectorStore.
    Used during upload to process and store documents.
    """
    
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            length_function=len,
        )
        self.texts = []
        self.metadatas = []
    
    def create_vector_store(self, text_data: Dict[str, str], precomputed_texts: List[str] = None, precomputed_metadatas: List[Dict] = None):
        """
        Process documents and prepare for storage.
        Note: Actual Qdrant storage happens in upload route with conversation_id.
        
        Args:
            text_data: Dict mapping source name to text content (used if no precomputed data)
            precomputed_texts: Optional pre-chunked texts (reuse from Qdrant processing)
            precomputed_metadatas: Optional pre-computed metadata (reuse from Qdrant processing)
        """
        # If precomputed data is provided, use it directly to avoid duplicate chunking
        if precomputed_texts is not None and precomputed_metadatas is not None:
            self.texts = precomputed_texts
            self.metadatas = precomputed_metadatas
            # Validate precomputed data same as computed path
            if not self.texts:
                raise ValueError("No documents to process")
            if len(self.texts) != len(self.metadatas):
                raise ValueError(f"Texts/metadatas length mismatch: {len(self.texts)} vs {len(self.metadatas)}")
            return self
        
        # Otherwise, process from scratch
        texts = []
        metadatas = []
        
        for source, text in text_data.items():
            chunks = self.text_splitter.split_text(text)
            for i, chunk in enumerate(chunks):
                texts.append(chunk)
                metadatas.append({
                    "source": source,
                    "chunk_id": i,
                    "type": "document"
                })
        
        if not texts:
            raise ValueError("No documents to process")
        
        self.texts = texts
        self.metadatas = metadatas
        
        return self


class HybridRAGProcessor:
    """
    Hybrid RAG processor that combines:
    1. Document chunks from Qdrant (semantic search)
    2. Chat history context
    3. Recent conversation context
    """
    
    def __init__(self, conversation_id: Optional[int] = None, embedding_model_name: str = None):
        self.conversation_id = conversation_id
        self.embedding_model_name = embedding_model_name
        self.vector_store: Optional[QdrantVectorStore] = None
        self.active_document_ids: Optional[List[int]] = None
        self._fallback_chunks: Sequence[Dict] = []
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=300,
            chunk_overlap=50,
            length_function=len,
        )
        self._chat_texts = []
        self._chat_metadatas = []
        self._chat_embeddings = None
    
    def load_documents(self, chunks: Sequence[Dict] = None, document_ids: List[int] = None):
        """
        Initialize vector store for document search.
        
        Args:
            chunks: SQLite chunks as fallback (used if Qdrant returns no results)
            document_ids: List of active document IDs to filter search
        """
        # Store SQLite chunks as fallback
        self._fallback_chunks = chunks or []
        
        if self.conversation_id:
            try:
                self.vector_store = QdrantVectorStore(self.conversation_id, self.embedding_model_name)
                self.active_document_ids = document_ids
            except Exception as e:
                print(f"[RAG] Error initializing Qdrant: {e}")
                self.vector_store = None
        return self
    
    def load_chat_history(self, chat_messages: List[Dict]):
        """
        Load chat history for context.
        Uses in-memory embedding for chat (not stored in Qdrant).
        """
        if not chat_messages:
            return self
        
        texts = []
        metadatas = []
        
        i = 0
        while i < len(chat_messages):
            msg = chat_messages[i]
            
            if msg["role"] == "user":
                user_content = msg["content"]
                assistant_content = ""
                
                if i + 1 < len(chat_messages) and chat_messages[i + 1]["role"] == "assistant":
                    assistant_content = chat_messages[i + 1]["content"]
                    i += 1
                
                combined = f"User asked: {user_content}\n\nAssistant answered: {assistant_content[:500]}"
                
                chunks = self.text_splitter.split_text(combined)
                for chunk_idx, chunk in enumerate(chunks):
                    texts.append(chunk)
                    metadatas.append({
                        "source": "chat_history",
                        "chunk_id": len(texts),
                        "type": "chat",
                        "user_query": user_content[:200],
                        "message_index": i
                    })
            i += 1
        
        self._chat_texts = texts
        self._chat_metadatas = metadatas
        
        # Pre-compute and cache chat embeddings
        if texts:
            model = get_embedding_model(self.embedding_model_name)
            self._chat_embeddings = model.encode(texts)
        else:
            self._chat_embeddings = None
        
        return self
    
    def _search_chat_history(self, query: str, k: int = 3) -> List[Dict]:
        """Search chat history using cached embedding similarity."""
        if not self._chat_texts or self._chat_embeddings is None:
            return []
        
        model = get_embedding_model(self.embedding_model_name)
        import numpy as np
        query_emb = np.array(model.encode([query] if isinstance(query, str) else query)).flatten()
        
        # Compute cosine similarities with epsilon to guard against zero-norm division
        epsilon = 1e-8
        text_norms = np.linalg.norm(self._chat_embeddings, axis=1)
        query_norm = np.linalg.norm(query_emb)
        # Add epsilon to prevent division by zero
        similarities = np.dot(self._chat_embeddings, query_emb) / (
            np.maximum(text_norms, epsilon) * max(query_norm, epsilon)
        )
        
        top_indices = np.argsort(similarities)[::-1][:k]
        
        return [
            {
                "content": self._chat_texts[idx],
                "metadata": self._chat_metadatas[idx],
                "score": float(similarities[idx])
            }
            for idx in top_indices
        ]
    
    def hybrid_search(
        self, 
        query: str, 
        chat_history: List[Dict],
        doc_k: int = 8,
        chat_k: int = 3,
        recent_messages: int = 8
    ) -> Dict:
        """
        Perform hybrid search combining:
        1. Relevant document chunks from Qdrant
        2. Relevant past Q&A from chat history
        3. Most recent messages for conversational context
        """
        results = {
            "document_chunks": [],
            "relevant_chat_history": [],
            "recent_context": []
        }
        
        # 1. Search document chunks in Qdrant
        if self.vector_store:
            results["document_chunks"] = self.vector_store.search(
                query=query,
                k=doc_k,
                document_ids=self.active_document_ids
            )
        
        # Fallback to SQLite chunks if Qdrant returned no results
        if not results["document_chunks"] and hasattr(self, '_fallback_chunks') and self._fallback_chunks:
            print("[RAG] Qdrant returned no results, using SQLite fallback")
            # Use first N chunks from SQLite as fallback
            fallback_results = []
            for i, chunk in enumerate(self._fallback_chunks[:doc_k]):
                content = chunk.get("content", "")
                metadata = chunk.get("metadata_json", {})
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except (json.JSONDecodeError, TypeError):
                        metadata = {}
                fallback_results.append({
                    "content": content,
                    "metadata": {
                        "source": metadata.get("source", "Document"),
                        "chunk_index": chunk.get("chunk_index", i),
                        "type": "document"
                    },
                    "score": 0.5  # Default score for fallback
                })
            results["document_chunks"] = fallback_results
        
        # 2. Search relevant past conversations
        if self._chat_texts and len(chat_history) > recent_messages:
            results["relevant_chat_history"] = self._search_chat_history(query, k=chat_k)
        
        # 3. Get most recent messages for conversational context
        if chat_history:
            recent = chat_history[-recent_messages:] if len(chat_history) > recent_messages else chat_history
            results["recent_context"] = recent
        
        return results
    
    def build_context(
        self,
        query: str,
        chat_history: List[Dict],
        doc_k: int = 8,
        chat_k: int = 3,
        recent_messages: int = 8
    ) -> Dict:
        """Build a comprehensive context for the LLM combining all sources."""
        search_results = self.hybrid_search(query, chat_history, doc_k, chat_k, recent_messages)
        
        context_parts = []
        
        # Add document context
        if search_results["document_chunks"]:
            doc_context = "### Relevant Document Information:\n"
            for i, chunk in enumerate(search_results["document_chunks"], 1):
                source = chunk["metadata"].get("source", "Unknown")
                doc_context += f"\n[Source {i}: {source}]\n{chunk['content']}\n"
            context_parts.append(doc_context)
        
        # Add relevant past Q&A
        if search_results["relevant_chat_history"]:
            chat_context = "### Relevant Past Conversations:\n"
            seen_queries = set()
            for chunk in search_results["relevant_chat_history"]:
                user_query = chunk["metadata"].get("user_query", "")
                if user_query and user_query not in seen_queries:
                    chat_context += f"\n{chunk['content']}\n"
                    seen_queries.add(user_query)
            context_parts.append(chat_context)
        
        return {
            "combined_context": "\n\n".join(context_parts),
            "document_chunks": search_results["document_chunks"],
            "relevant_chat_history": search_results["relevant_chat_history"],
            "recent_context": search_results["recent_context"]
        }
