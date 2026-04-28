"""
RAG Integration Layer

Connects RAG pipeline with other AI systems:
- Matching Agent integration
- External API connectors
"""

from .matching_connector import (
    MatchingRAGConnector,
    matching_connector,
    build_integrated_quiz_pipeline
)

__all__ = [
    'MatchingRAGConnector',
    'matching_connector',
    'build_integrated_quiz_pipeline',
]
