import json
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from typing import List, Dict, Sequence
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
                    "chunk_id": i
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
            metadatas.append(metadata)

        embeddings = self.vectorizer.fit_transform(texts)
        self.texts = texts
        self.metadatas = metadatas
        self.embeddings = embeddings

        return self
    
    def search_similar(self, query: str, k: int = 3) -> List[Dict]:
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
            source = self.metadatas[idx]["source"]
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
