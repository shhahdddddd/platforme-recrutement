"""
transferable_skills.py

SIMPLIFIED Matching Logic:
Replaced LLM reasoning with Vector-based similarity.
Uses cosine similarity (via embeddings) to determine if skills are related.

Architecture:
1. Pure embedding similarity (cosine)
2. No manual maintenance
3. Consistent and deterministic
"""
from __future__ import annotations
import logging
from typing import Optional, Dict, Any, List
import numpy as np

logger = logging.getLogger(__name__)

def calculate_embedding_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Pure mathematical similarity between two skill vectors."""
    if not vec1 or not vec2:
        return 0.0
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(np.dot(v1, v2) / (norm1 * norm2))

def are_skills_related_vector(
    skill_a_vec: List[float], 
    skill_b_vec: List[float],
    threshold: float = 0.75
) -> Dict[str, Any]:
    """
    Determines if two skills are related based ONLY on vector proximity.
    Replaces LLM reasoning.
    """
    similarity = calculate_embedding_similarity(skill_a_vec, skill_b_vec)
    
    # 0.8+ is usually exact match or very close synonym
    # 0.7-0.8 is related (e.g. React/Angular)
    # <0.6 is unrelated
    is_related = similarity >= threshold
    
    return {
        "related": is_related,
        "similarity": similarity,
        "reason": "Determined via vector spatial proximity (Embedding Similarity)" if is_related else "Low vector similarity"
    }

def get_transferable_explanation(job_skill: str, candidate_skill: str, similarity: float) -> str:
    """Generates simple explanation for a vector-matched skill."""
    if similarity > 0.9:
        return f"Exact or synonymous match found for {job_skill}."
    elif similarity > 0.75:
        return f"High similarity between {job_skill} and {candidate_skill} detected in vector space."
    else:
        return f"Related experience in {candidate_skill} provides partial coverage for {job_skill}."
