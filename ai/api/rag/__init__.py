"""
RAG (Retrieval-Augmented Generation) Module for Quiz Generation

This module contains the core RAG pipeline for generating recruitment quiz questions.

Structure:
    pipeline/      - LangGraph workflow nodes and state management
    retrieval/     - Vector store (ChromaDB) and BM25 lexical search
    preprocessing/ - Query expansion, HyDE generation, text processing
    analytics/     - Feedback loops, monitoring, quality metrics

Usage:
    from api.rag.pipeline import create_quiz_graph
    from api.rag.retrieval import hybrid_search
"""

# Pipeline exports
from .pipeline.workflow import create_quiz_graph, QuizState, LEVEL_CONFIG
from .pipeline.workflow import (
    calibrator_node,
    query_builder_node,  # Renamed from router_hyde_node
    hybrid_retrieve_node,
    rerank_node,  # Renamed from cross_encoder_rerank_node + merged gate
    extract_skills_node,
    normalize_skills_node,
    synthesize_node,
    quality_grader_node,
    store_node,
)

# Retrieval exports
from .retrieval.vector_store import (
    hybrid_search,
    semantic_search,
    get_collection_stats,
    add_chunks_to_collection,
)
from .retrieval.bm25_service import get_bm25_scores

# Preprocessing exports
from .preprocessing.query_expansion import extract_job_key_terms, build_weighted_tokens

# Analytics exports
from .analytics.monitoring import log_pipeline_metrics

__all__ = [
    # Pipeline
    'create_quiz_graph',
    'QuizState',
    'LEVEL_CONFIG',
    'calibrator_node',
    'query_builder_node',
    'hybrid_retrieve_node',
    'rerank_node',
    'extract_skills_node',
    'normalize_skills_node',
    'synthesize_node',
    'quality_grader_node',
    'store_node',
    # Retrieval
    'hybrid_search',
    'semantic_search',
    'get_collection_stats',
    'add_chunks_to_collection',
    'get_bm25_scores',
    # Preprocessing
    'extract_job_key_terms',
    'build_weighted_tokens',
    # Analytics
    'log_pipeline_metrics',
]
