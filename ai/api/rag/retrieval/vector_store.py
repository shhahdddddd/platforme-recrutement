"""
ChromaDB Vector Store Service
============================

Senior-level implementation with:
- Multi-tenant isolation (one collection per company)
- Hybrid retrieval (ChromaDB semantic + BM25 lexical)
- Automatic embedding via Ollama nomic-embed-text
- Metadata filtering for seniority, domain, document status
- Connection pooling and error resilience
"""

import logging
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from functools import lru_cache

import httpx
import chromadb
from chromadb.config import Settings
from chromadb.api import Collection
from django.conf import settings

from ...utils import redis_client
from ...models import ParentChunk

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

@dataclass
class ChunkMetadata:
    """Metadata for a chunk stored in ChromaDB."""
    chunk_id: str
    company_id: str
    document_id: str
    content: str
    seniority_junior: int
    seniority_mid: int
    seniority_senior: int
    domain: str
    source_filename: str
    chunk_type: str  # 'parent' or 'child'


# ---------------------------------------------------------------------------
# Ollama Embedding Function
# ---------------------------------------------------------------------------

class OllamaEmbeddingFunction:
    """
    Custom embedding function for ChromaDB using Ollama.
    Implements the EmbeddingFunction protocol.
    """
    
    def __init__(self, model_name: str = "nomic-embed-text", base_url: str = "http://127.0.0.1:11434"):
        self.model_name = model_name
        self.base_url = base_url
        self._cache: Dict[str, List[float]] = {}
    
    def __call__(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts."""
        if not texts:
            return []
        
        results = []
        texts_to_embed = []
        indices_to_embed = []
        
        # Check cache first
        for i, text in enumerate(texts):
            cache_key = self._hash_text(text)
            if cache_key in self._cache:
                results.append((i, self._cache[cache_key]))
            else:
                texts_to_embed.append(text)
                indices_to_embed.append(i)
        
        # Batch embed uncached texts
        if texts_to_embed:
            new_embeddings = self._batch_embed(texts_to_embed)
            for j, (text, embedding) in enumerate(zip(texts_to_embed, new_embeddings)):
                original_idx = indices_to_embed[j]
                results.append((original_idx, embedding))
                # Cache for future use
                self._cache[self._hash_text(text)] = embedding
        
        # Sort by original index and return
        results.sort(key=lambda x: x[0])
        return [emb for _, emb in results]
    
    def _batch_embed(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:
        """Batch embed texts via Ollama API."""
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            try:
                with httpx.Client(timeout=60.0) as client:
                    response = client.post(
                        f"{self.base_url}/api/embed",
                        json={
                            "model": self.model_name,
                            "input": batch,
                            "truncate": True
                        }
                    )
                    
                    if response.status_code == 200:
                        embeddings = response.json().get('embeddings', [])
                        all_embeddings.extend(embeddings)
                    else:
                        logger.error(f"Ollama embed error: {response.status_code}")
                        # Fallback to zero vectors
                        all_embeddings.extend([[0.0] * 768 for _ in batch])
            except Exception as e:
                logger.error(f"Ollama connection failed: {e}")
                all_embeddings.extend([[0.0] * 768 for _ in batch])
        
        return all_embeddings
    
    def _hash_text(self, text: str) -> str:
        """Create a cache key for text."""
        import hashlib
        return hashlib.md5(text.encode()).hexdigest()


# ---------------------------------------------------------------------------
# ChromaDB Client Singleton
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def get_chroma_client() -> chromadb.Client:
    """
    Get or create the ChromaDB client singleton.
    Uses persistent storage at CHROMA_PERSIST_DIR (default: ./chroma_data).
    """
    persist_dir = getattr(settings, 'CHROMA_PERSIST_DIR', './chroma_data')
    
    return chromadb.Client(Settings(
        chroma_db_impl="duckdb+parquet",
        persist_directory=persist_dir,
        anonymized_telemetry=False
    ))


@lru_cache(maxsize=1)
def get_embedding_function() -> OllamaEmbeddingFunction:
    """Get the shared embedding function singleton."""
    ollama_url = getattr(settings, 'OLLAMA_EMBED_URL', 'http://127.0.0.1:11434')
    model = getattr(settings, 'OLLAMA_EMBED_MODEL', 'nomic-embed-text')
    return OllamaEmbeddingFunction(model_name=model, base_url=ollama_url)


# ---------------------------------------------------------------------------
# Collection Management (Multi-Tenant)
# ---------------------------------------------------------------------------

def get_company_collection_name(company_id: int) -> str:
    """Generate collection name for a company."""
    return f"company_{company_id}_kb"


def get_or_create_company_collection(company_id: int) -> Collection:
    """
    Get or create a ChromaDB collection for a company.
    Each company gets its own isolated collection for multi-tenancy.
    """
    client = get_chroma_client()
    embedding_fn = get_embedding_function()
    collection_name = get_company_collection_name(company_id)
    
    try:
        # Try to get existing collection
        collection = client.get_collection(
            name=collection_name,
            embedding_function=embedding_fn
        )
        return collection
    except Exception:
        # Collection doesn't exist, create it
        logger.info(f"Creating new ChromaDB collection: {collection_name}")
        collection = client.create_collection(
            name=collection_name,
            embedding_function=embedding_fn,
            metadata={"company_id": str(company_id)}
        )
        return collection


def delete_company_collection(company_id: int) -> bool:
    """Delete all vector data for a company."""
    client = get_chroma_client()
    collection_name = get_company_collection_name(company_id)
    
    try:
        client.delete_collection(collection_name)
        logger.info(f"Deleted ChromaDB collection: {collection_name}")
        return True
    except Exception as e:
        logger.warning(f"Failed to delete collection {collection_name}: {e}")
        return False


# ---------------------------------------------------------------------------
# Chunk Operations
# ---------------------------------------------------------------------------

def add_chunks_to_collection(
    company_id: int,
    chunks: List[Dict[str, Any]]
) -> int:
    """
    Add multiple chunks to a company's collection.
    
    Args:
        company_id: Company ID for multi-tenant isolation
        chunks: List of chunk dicts with keys:
            - id: unique chunk ID
            - content: text content
            - document_id: parent document ID
            - seniority_junior/mid/senior: int scores
            - domain: str
            - source_filename: str
            - chunk_type: 'parent' or 'child'
    
    Returns:
        Number of chunks added
    """
    if not chunks:
        return 0
    
    collection = get_or_create_company_collection(company_id)
    
    ids = []
    documents = []
    metadatas = []
    
    for chunk in chunks:
        chunk_id = str(chunk.get('id'))
        content = chunk.get('content', '')
        
        if not content.strip():
            continue
        
        ids.append(chunk_id)
        documents.append(content)
        metadatas.append({
            'company_id': str(company_id),
            'document_id': str(chunk.get('document_id', '')),
            'seniority_junior': chunk.get('seniority_junior', 0),
            'seniority_mid': chunk.get('seniority_mid', 0),
            'seniority_senior': chunk.get('seniority_senior', 0),
            'domain': ','.join(chunk.get('domain', [])) if isinstance(chunk.get('domain'), list) else str(chunk.get('domain', '')),
            'source_filename': str(chunk.get('source_filename', '')),
            'chunk_type': chunk.get('chunk_type', 'parent'),
        })
    
    if not ids:
        return 0
    
    try:
        collection.add(
            ids=ids,
            documents=documents,
            metadatas=metadatas
        )
        logger.info(f"Added {len(ids)} chunks to collection for company {company_id}")
        return len(ids)
    except Exception as e:
        logger.error(f"Failed to add chunks to collection: {e}")
        return 0


def delete_chunks_by_document(company_id: int, document_id: str) -> bool:
    """Delete all chunks belonging to a specific document."""
    collection = get_or_create_company_collection(company_id)
    
    try:
        # Query for chunks with this document_id
        results = collection.get(
            where={'document_id': str(document_id)}
        )
        
        if results and results.get('ids'):
            collection.delete(ids=results['ids'])
            logger.info(f"Deleted {len(results['ids'])} chunks for document {document_id}")
        
        return True
    except Exception as e:
        logger.error(f"Failed to delete chunks for document {document_id}: {e}")
        return False


def delete_chunk(company_id: int, chunk_id: str) -> bool:
    """Delete a single chunk by ID."""
    collection = get_or_create_company_collection(company_id)
    
    try:
        collection.delete(ids=[str(chunk_id)])
        return True
    except Exception as e:
        logger.error(f"Failed to delete chunk {chunk_id}: {e}")
        return False


# ---------------------------------------------------------------------------
# Semantic Search
# ---------------------------------------------------------------------------

def semantic_search(
    company_id: int,
    query: str,
    n_results: int = 20,
    seniority_filter: Optional[Dict[str, int]] = None,
    where_filter: Optional[Dict] = None
) -> List[Dict[str, Any]]:
    """
    Perform semantic search on a company's knowledge base.
    
    Args:
        company_id: Company ID
        query: Search query text
        n_results: Maximum number of results
        seniority_filter: Optional filter like {'seniority_senior': {'$gte': 2}}
        where_filter: Optional additional where clause
    
    Returns:
        List of result dicts with id, content, metadata, distance
    """
    collection = get_or_create_company_collection(company_id)
    
    # Build where clause
    where_clause = {'chunk_type': 'parent'}  # Only search parent chunks
    
    if seniority_filter:
        where_clause.update(seniority_filter)
    
    if where_filter:
        where_clause.update(where_filter)
    
    try:
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            where=where_clause,
            include=['documents', 'metadatas', 'distances']
        )
        
        if not results or not results.get('ids') or not results['ids'][0]:
            return []
        
        # Format results
        formatted = []
        for i, chunk_id in enumerate(results['ids'][0]):
            formatted.append({
                'id': chunk_id,
                'content': results['documents'][0][i] if results.get('documents') else '',
                'metadata': results['metadatas'][0][i] if results.get('metadatas') else {},
                'distance': results['distances'][0][i] if results.get('distances') else 0.0,
            })
        
        return formatted
    
    except Exception as e:
        logger.error(f"Semantic search failed for company {company_id}: {e}")
        return []


def hybrid_search(
    company_id: int,
    query: str,
    key_terms: List[str] = None,
    target_focus: str = None,
    n_results: int = 10,
    seniority_min: int = 1,
    semantic_weight: float = 0.7,
    bm25_weight: float = 0.3
) -> List[Dict[str, Any]]:
    """
    Hybrid search combining ChromaDB semantic search with BM25 lexical search.
    
    Args:
        company_id: Company ID
        query: Search query
        key_terms: Optional key terms to boost in BM25
        target_focus: Optional focus area for filtering
        n_results: Number of final results
        seniority_min: Minimum seniority score required
        semantic_weight: Weight for semantic similarity (0-1)
        bm25_weight: Weight for BM25 lexical match (0-1)
    
    Returns:
        Fused and ranked results with combined scores
    """
    from .bm25_service import get_bm25_scores
    
    # 1. Semantic search via ChromaDB
    semantic_results = semantic_search(
        company_id=company_id,
        query=query,
        n_results=n_results * 2,  # Get more for fusion
        seniority_filter=_build_seniority_filter(seniority_min)
    )
    
    # 2. BM25 lexical search
    bm25_results = get_bm25_scores(
        company_id=company_id,
        query=query,
        key_terms=key_terms,
        target_focus=target_focus,
        n_results=n_results * 2
    )
    
    # 3. RRF Fusion
    fused = _rrf_fusion(
        semantic_results=semantic_results,
        bm25_results=bm25_results,
        semantic_weight=semantic_weight,
        bm25_weight=bm25_weight,
        top_k=n_results
    )
    
    return fused


def _build_seniority_filter(min_score: int) -> Dict:
    """Build ChromaDB where filter for seniority."""
    if min_score >= 3:
        return {'seniority_senior': {'$gte': min_score}}
    elif min_score >= 2:
        return {'$or': [
            {'seniority_senior': {'$gte': min_score}},
            {'seniority_mid': {'$gte': min_score}}
        ]}
    else:
        return {'$or': [
            {'seniority_junior': {'$gte': 1}},
            {'seniority_mid': {'$gte': 1}},
            {'seniority_senior': {'$gte': 1}}
        ]}


def _rrf_fusion(
    semantic_results: List[Dict],
    bm25_results: List[Dict],
    semantic_weight: float,
    bm25_weight: float,
    top_k: int,
    k: int = 60
) -> List[Dict]:
    """
    Reciprocal Rank Fusion for combining semantic and BM25 results.
    """
    scores = {}
    content_map = {}
    metadata_map = {}
    
    # Process semantic results
    for rank, result in enumerate(semantic_results):
        chunk_id = result['id']
        scores[chunk_id] = scores.get(chunk_id, 0) + semantic_weight / (k + rank + 1)
        content_map[chunk_id] = result.get('content', '')
        metadata_map[chunk_id] = result.get('metadata', {})
    
    # Process BM25 results
    for rank, result in enumerate(bm25_results):
        chunk_id = result['id']
        scores[chunk_id] = scores.get(chunk_id, 0) + bm25_weight / (k + rank + 1)
        if chunk_id not in content_map:
            content_map[chunk_id] = result.get('content', '')
            metadata_map[chunk_id] = result.get('metadata', {})
    
    # Sort by combined score
    sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)[:top_k]
    
    # Build final results
    results = []
    for chunk_id in sorted_ids:
        results.append({
            'id': chunk_id,
            'content': content_map.get(chunk_id, ''),
            'metadata': metadata_map.get(chunk_id, {}),
            'combined_score': round(scores[chunk_id], 4),
        })
    
    return results


# ---------------------------------------------------------------------------
# Collection Stats & Health
# ---------------------------------------------------------------------------

def get_collection_stats(company_id: int) -> Dict[str, Any]:
    """Get statistics about a company's collection."""
    collection = get_or_create_company_collection(company_id)
    
    try:
        count = collection.count()
        return {
            'company_id': company_id,
            'collection_name': collection.name,
            'chunk_count': count,
            'exists': True
        }
    except Exception as e:
        return {
            'company_id': company_id,
            'exists': False,
            'error': str(e)
        }


def health_check() -> Dict[str, Any]:
    """Check ChromaDB health status."""
    try:
        client = get_chroma_client()
        heartbeat = client.heartbeat()
        return {
            'status': 'healthy',
            'heartbeat': heartbeat
        }
    except Exception as e:
        return {
            'status': 'unhealthy',
            'error': str(e)
        }
