"""
ranking.py

Simple final ranking: sort candidates by composite score descending.
"""

from __future__ import annotations


def rank_candidates(candidates: list[dict]) -> list[dict]:
    """Sort *candidates* by ``score`` in descending order and add rank/percentile."""
    sorted_candidates = sorted(candidates, key=lambda c: c.get("score", 0.0), reverse=True)
    
    total = len(sorted_candidates)
    if total == 0:
        return []
        
    for i, candidate in enumerate(sorted_candidates):
        candidate["rank"] = i + 1
        # Percentile calculation
        candidate["percentile"] = round(1.0 - (i / total), 2)
        
    return sorted_candidates
