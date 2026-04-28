"""
Retrieval Layer

Hybrid search combining:
- ChromaDB semantic search (embeddings)
- BM25 lexical search (keywords)
- RRF fusion for ranking
"""

from .vector_store import (
    hybrid_search,
    semantic_search,
    get_collection_stats,
    add_chunks_to_collection,
    delete_chunks_by_document,
    get_or_create_company_collection,
)
from .bm25_service import get_bm25_scores, build_bm25_index

__all__ = [
    'hybrid_search',
    'semantic_search',
    'get_collection_stats',
    'add_chunks_to_collection',
    'delete_chunks_by_document',
    'get_or_create_company_collection',
    'get_bm25_scores',
    'build_bm25_index',
]
