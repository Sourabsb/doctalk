import json
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from typing import List, Dict, Sequence, Optional
from ..config import CHUNK_SIZE, CHUNK_OVERLAP

class EmbeddingProcessor:
    def __init__(self):
        # Use TF-IDF instead of sentence-transformers (lightweight)
        self.vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2)
        )
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            length_function=len,
        )
        self.texts = []
        self.metadatas = []
        self.embeddings = None
    
    def create_vector_store(self, text_data: Dict[str, str]):
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
        
        # Create TF-IDF embeddings (lightweight)
        embeddings = self.vectorizer.fit_transform(texts)
        
        # Store data
        self.texts = texts
        self.metadatas = metadatas
        self.embeddings = embeddings
        
        return self

    def load_from_chunks(self, chunks: Sequence[Dict]):
        if not chunks:
            raise ValueError("No chunks available for vector store")

        texts = []
        metadatas = []

        for chunk in chunks:
            texts.append(chunk["content"])
            metadata = chunk.get("metadata_json")
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except Exception:
                    metadata = {"source": "unknown", "chunk_id": chunk.get("chunk_index", 0)}
            metadata["type"] = "document"
            metadatas.append(metadata)

        embeddings = self.vectorizer.fit_transform(texts)
        self.texts = texts
        self.metadatas = metadatas
        self.embeddings = embeddings

        return self
    
    def search_similar(self, query: str, k: int = 3, filter_type: Optional[str] = None) -> List[Dict]:
        if self.embeddings is None:
            return []
            
        # Transform query using same vectorizer
        query_embedding = self.vectorizer.transform([query])
        
        # Calculate cosine similarity
        similarities = cosine_similarity(query_embedding, self.embeddings).flatten()
        top_indices = np.argsort(similarities)[::-1]
        
        # Get diverse results - try to include results from different sources
        results = []
        sources_seen = set()
        
        # First pass: get top results from different sources
        for idx in top_indices:
            # Apply type filter if specified
            if filter_type and self.metadatas[idx].get("type") != filter_type:
                continue
                
            source = self.metadatas[idx].get("source", "unknown")
            if source not in sources_seen and len(results) < k:
                results.append({
                    "content": self.texts[idx],
                    "metadata": self.metadatas[idx],
                    "score": float(similarities[idx])
                })
                sources_seen.add(source)
        
        # Second pass: fill remaining slots with best remaining results
        for idx in top_indices:
            if len(results) >= k:
                break
            
            # Apply type filter if specified
            if filter_type and self.metadatas[idx].get("type") != filter_type:
                continue
            
            # Check if this result is already included
            is_duplicate = any(
                r["content"] == self.texts[idx] for r in results
            )
            
            if not is_duplicate:
                results.append({
                    "content": self.texts[idx],
                    "metadata": self.metadatas[idx],
                    "score": float(similarities[idx])
                })
        
        return results


class HybridRAGProcessor:
    """
    Hybrid RAG processor that combines:
    1. Document chunks RAG
    2. Chat history RAG
    3. Recent conversation context
    """
    
    def __init__(self):
        self.document_processor = None
        self.chat_processor = None
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=300,  # Smaller chunks for chat history
            chunk_overlap=50,
            length_function=len,
        )
    
    def load_documents(self, chunks: Sequence[Dict]):
        """Load document chunks into the document processor"""
        if not chunks:
            return self
        
        self.document_processor = EmbeddingProcessor()
        self.document_processor.load_from_chunks(chunks)
        return self
    
    def load_chat_history(self, chat_messages: List[Dict]):
        """
        Load chat history into the chat processor
        Each message pair (user + assistant) is treated as a searchable unit
        """
        if not chat_messages:
            return self
        
        texts = []
        metadatas = []
        
        # Group messages into Q&A pairs for better context retrieval
        i = 0
        while i < len(chat_messages):
            msg = chat_messages[i]
            
            if msg["role"] == "user":
                # Look for the assistant response
                user_content = msg["content"]
                assistant_content = ""
                
                if i + 1 < len(chat_messages) and chat_messages[i + 1]["role"] == "assistant":
                    assistant_content = chat_messages[i + 1]["content"]
                    i += 1
                
                # Create a combined Q&A chunk
                combined = f"User asked: {user_content}\n\nAssistant answered: {assistant_content[:500]}"  # Limit assistant response
                
                # Split if too long
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
        
        if texts:
            self.chat_processor = EmbeddingProcessor()
            self.chat_processor.vectorizer = TfidfVectorizer(
                max_features=500,
                stop_words='english',
                ngram_range=(1, 2)
            )
            self.chat_processor.texts = texts
            self.chat_processor.metadatas = metadatas
            self.chat_processor.embeddings = self.chat_processor.vectorizer.fit_transform(texts)
        
        return self
    
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
        1. Relevant document chunks
        2. Relevant past Q&A from chat history
        3. Most recent messages for conversational context
        """
        results = {
            "document_chunks": [],
            "relevant_chat_history": [],
            "recent_context": []
        }
        
        # 1. Search document chunks
        if self.document_processor:
            results["document_chunks"] = self.document_processor.search_similar(query, k=doc_k)
        
        # 2. Search relevant past conversations (excluding very recent ones)
        if self.chat_processor and len(chat_history) > recent_messages:
            results["relevant_chat_history"] = self.chat_processor.search_similar(query, k=chat_k)
        
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
        """
        Build a comprehensive context for the LLM combining all sources
        """
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
