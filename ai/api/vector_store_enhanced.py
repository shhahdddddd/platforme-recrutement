"""
vector_store_chroma.py

Production-grade ChromaDB vector store with:
- Local persistence
- Collection-based multi-tenancy (company_id)
- Efficient search with metadata filtering
"""

from __future__ import annotations

import logging
import chromadb
from chromadb.config import Settings
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
from django.conf import settings

logger = logging.getLogger(__name__)


class PersistentVectorStore:
    """
    ChromaDB vector store with disk persistence.
    """

    def __init__(
        self, 
        storage_path: Optional[str] = None,
        company_id: Optional[int] = None,
    ) -> None:
        self.company_id = company_id
        self.storage_path = storage_path or settings.CHROMA_PERSIST_DIR
        
        # Initialize Chroma client
        self.client = chromadb.PersistentClient(path=self.storage_path)
        
        # Collection name (one per company for true isolation)
        self.collection_name = f"company_{company_id}" if company_id else "global_knowledge"
        
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        
        logger.info(f"Initialized ChromaDB collection: {self.collection_name} at {self.storage_path}")

    def add_batch(self, embeddings: List[List[float]], profiles: List[Dict], ids: Optional[List[str]] = None) -> List[str]:
        """Add multiple vectors in batch."""
        if not embeddings or not profiles:
            return []
        
        if not ids:
            ids = [f"id_{datetime.now().timestamp()}_{i}" for i in range(len(embeddings))]
        
        # Extract documents (texts) if available in profile
        documents = [p.get('content', p.get('full_name', '')) for p in profiles]
        
        # Prepare metadata
        metadatas = []
        for p in profiles:
            # Chroma metadata values must be simple types (str, int, float, bool)
            meta = {}
            for k, v in p.items():
                if isinstance(v, (str, int, float, bool)):
                    meta[k] = v
            metadatas.append(meta)

        self.collection.add(
            embeddings=embeddings,
            metadatas=metadatas,
            documents=documents,
            ids=ids
        )
        
        return ids

    def add(self, embedding: List[float], profile: Dict, id: Optional[str] = None) -> str:
        """Add a single vector."""
        ids = self.add_batch([embedding], [profile], [id] if id else None)
        return ids[0]

    def search(
        self, 
        embedding: List[float], 
        top_k: int = 10,
        filter_metadata: Optional[Dict] = None
    ) -> List[Dict]:
        """Search for similar vectors."""
        if not embedding:
            return []

        query_params: Dict = {
            "query_embeddings": [embedding],
            "n_results": top_k,
        }
        
        if filter_metadata:
            # Simplify filter (Chroma uses $and, $eq, etc. but simple dict often works for equality)
            query_params["where"] = filter_metadata

        results = self.collection.query(**query_params)
        
        formatted_results = []
        if results['ids'] and len(results['ids'][0]) > 0:
            for i in range(len(results['ids'][0])):
                formatted_results.append({
                    "id": results['ids'][0][i],
                    "similarity": 1.0 - results['distances'][0][i], # Chroma distance is usually 1 - cosine
                    "profile": results['metadatas'][0][i],
                    "document": results['documents'][0][i] if results['documents'] else ""
                })
        
        return formatted_results

    def count(self) -> int:
        """Number of vectors indexed."""
        return self.collection.count()

    def reset(self) -> None:
        """Clear the entire collection."""
        self.client.delete_collection(self.collection_name)
        self.collection = self.client.get_or_create_collection(self.collection_name)
        logger.info(f"Reset ChromaDB collection: {self.collection_name}")

    def delete(self, ids: List[str]):
        """Delete specific items."""
        self.collection.delete(ids=ids)

    def get_metrics(self) -> Dict:
        return {
            "total_vectors": self.count(),
            "collection_name": self.collection_name,
            "storage_path": self.storage_path
        }
