"""
BM25 Lexical Search Service
===========================

Standalone BM25 service for hybrid retrieval.
Complements ChromaDB semantic search with keyword-based matching.
"""

import logging
import pickle
from typing import List, Dict, Optional
from functools import lru_cache

import numpy as np
from rank_bm25 import BM25Okapi

from ...utils import tokenize_technical, get_technical_stopwords, redis_client
from ...models import ChildChunk, ParentChunk

logger = logging.getLogger(__name__)

# Cache TTL in seconds
BM25_CACHE_TTL = 3600 * 24 * 30  # 30 days


# ---------------------------------------------------------------------------
# BM25 Index Management
# ---------------------------------------------------------------------------

def build_bm25_index(company_id: int) -> Optional[Dict]:
    """
    Build BM25 index from child chunks for a company.
    
    Returns:
        Dict with 'bm25' model and 'parent_ids' list, or None if no chunks.
    """
    from .models import ChildChunk
    
    chunk_rows = list(
        ChildChunk.objects
        .filter(company_id=company_id, document__status='ready')
        .order_by('id')
        .values_list('content', 'parent_id')
    )
    
    if not chunk_rows:
        return None
    
    corpus = [tokenize_technical(content) for content, _ in chunk_rows]
    parent_ids = [str(parent_id) for _, parent_id in chunk_rows]
    
    bm25 = BM25Okapi(corpus)
    
    return {
        'bm25': bm25,
        'parent_ids': parent_ids,
        'chunk_count': len(chunk_rows)
    }


def get_bm25_index(company_id: int) -> Optional[Dict]:
    """
    Get BM25 index for a company.
    Uses Redis cache with in-memory fallback.
    """
    cache_key = f"bm25:company:{company_id}"
    
    # Try Redis cache first
    try:
        cached_data = redis_client.get(cache_key)
        if cached_data:
            return pickle.loads(cached_data)
    except Exception as e:
        logger.warning(f"Redis BM25 cache miss for company {company_id}: {e}")
    
    # Build new index
    index_data = build_bm25_index(company_id)
    
    if index_data is None:
        return None
    
    # Cache in Redis
    try:
        redis_client.set(cache_key, pickle.dumps(index_data), ex=BM25_CACHE_TTL)
    except Exception as e:
        logger.warning(f"Failed to cache BM25 index for company {company_id}: {e}")
    
    return index_data


def invalidate_bm25_index(company_id: int) -> bool:
    """Invalidate cached BM25 index for a company."""
    cache_key = f"bm25:company:{company_id}"
    
    try:
        redis_client.delete(cache_key)
        logger.info(f"Invalidated BM25 index for company {company_id}")
        return True
    except Exception as e:
        logger.warning(f"Failed to invalidate BM25 for company {company_id}: {e}")
        return False


# ---------------------------------------------------------------------------
# BM25 Search
# ---------------------------------------------------------------------------

def get_bm25_scores(
    company_id: int,
    query: str,
    key_terms: Optional[List[str]] = None,
    target_focus: Optional[str] = None,
    n_results: int = 20,
    boost: int = 2
) -> List[Dict]:
    """
    Perform BM25 lexical search.
    
    Args:
        company_id: Company ID
        query: Search query
        key_terms: Optional key terms to boost
        target_focus: Optional focus term to boost
        n_results: Maximum results to return
        boost: Boost factor for key terms
    
    Returns:
        List of dicts with id, content, bm25_score, bm25_rank
    """
    index_data = get_bm25_index(company_id)
    
    if not index_data:
        return []
    
    bm25 = index_data['bm25']
    parent_ids = index_data['parent_ids']
    
    # Build weighted tokens
    tokens = tokenize_technical(query)
    
    # Boost key terms and focus
    for term in (key_terms or []):
        tokens.extend([t] * boost for t in tokenize_technical(term))
    
    if target_focus:
        tokens.extend([t] * boost for t in tokenize_technical(target_focus))
    
    # Flatten if needed
    flat_tokens = []
    for t in tokens:
        if isinstance(t, list):
            flat_tokens.extend(t)
        else:
            flat_tokens.append(t)
    
    if not flat_tokens:
        flat_tokens = tokenize_technical(query)
    
    # Get scores
    scores = bm25.get_scores(flat_tokens)
    top_indices = np.argsort(scores)[-n_results:][::-1]
    
    # Build results
    results = []
    seen_parents = set()
    
    for rank, idx in enumerate(top_indices):
        if idx >= len(parent_ids):
            continue
        
        parent_id = parent_ids[int(idx)]
        score = float(scores[int(idx)])
        
        if parent_id in seen_parents:
            continue
        
        seen_parents.add(parent_id)
        
        # Get content from ParentChunk
        from .models import ParentChunk
        try:
            chunk = ParentChunk.objects.get(id=parent_id)
            content = chunk.content
        except ParentChunk.DoesNotExist:
            content = ''
        
        results.append({
            'id': parent_id,
            'content': content,
            'bm25_score': round(score, 4),
            'bm25_rank': len(results) + 1,
        })
        
        if len(results) >= n_results:
            break
    
    return results


def build_weighted_bm25_tokens(
    query: str,
    key_terms: Optional[List[str]] = None,
    extra_terms: Optional[List[str]] = None,
    boost: int = 2
) -> List[str]:
    """
    Build weighted token list for BM25 query.
    Key terms and extra terms are boosted by repetition.
    """
    tokens = tokenize_technical(query)
    
    for term in (key_terms or []):
        for t in tokenize_technical(term):
            tokens.extend([t] * boost)
    
    for term in (extra_terms or []):
        for t in tokenize_technical(term):
            tokens.extend([t] * boost)
    
    return tokens
