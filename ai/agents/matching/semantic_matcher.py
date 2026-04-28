"""
semantic_matcher.py

Extracts the pre-computed cosine similarity from a vector-store search result.
"""

from __future__ import annotations


def get_semantic_score(candidate: dict) -> float:
    """Return the cosine similarity score set by the vector store."""
    return float(candidate.get("similarity", 0.0))
