"""
degree_intelligence.py

SIMPLIFIED Degree Intelligence

Uses embedding similarity instead of hardcoded matrices.

Features:
- Degree level detection (PhD > Master > Bachelor > ...)
- Field relevance via EMBEDDING similarity (not hardcoded matrix)
- Simple, unified approach
"""

from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
import numpy as np


# Degree hierarchy levels (factual, not subjective)
DEGREE_HIERARCHY = {
    "PhD": 5, "Doctorate": 5, "Doctoral": 5,
    "Master": 4, "MSc": 4, "MA": 4, "MBA": 4, "MEng": 4,
    "Bachelor": 3, "BS": 3, "BA": 3, "BSc": 3, "BEng": 3, "License": 3,
    "Diploma": 2, "Associate": 2,
    "Certificate": 1,
    "High School": 0, "Secondary": 0,
}


@dataclass
class DegreeMatch:
    """Result of degree matching via embeddings."""
    
    candidate_level: int  # 0-5
    required_level: int   # 0-5
    field_relevance: float  # 0-1 (from embedding similarity)
    level_match: float     # 0-1
    overall_score: float   # 0-1
    
    # Details
    candidate_field: str
    job_field: str
    level_gap: int
    
    # Explanation
    assessment: str


def parse_degree_level(degree_str: str) -> int:
    """Parse degree string to get hierarchy level."""
    degree_str = degree_str.lower()
    
    for deg_name, deg_level in DEGREE_HIERARCHY.items():
        if deg_name.lower() in degree_str:
            return deg_level
    
    return 0  # Default to lowest


def compute_field_similarity(
    degree_field: str,
    job_field: str,
    degree_embedding: Optional[List[float]] = None,
    job_embedding: Optional[List[float]] = None,
) -> float:
    """
    Compute field relevance via EMBEDDING SIMILARITY.
    
    NO HARDCODED MATRICES - use actual semantic similarity.
    
    If embeddings provided: use cosine similarity
    If not: use simple keyword overlap as fallback
    """
    # If we have embeddings, use them
    if degree_embedding and job_embedding:
        # Cosine similarity
        v1 = np.array(degree_embedding, dtype="float32")
        v2 = np.array(job_embedding, dtype="float32")
        
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        
        if norm1 > 0 and norm2 > 0:
            return float(np.dot(v1, v2) / (norm1 * norm2))
    
    # Fallback: keyword matching (simple, no hardcoded matrix)
    degree_words = set(degree_field.lower().split())
    job_words = set(job_field.lower().split())
    
    if not degree_words or not job_words:
        return 0.5
    
    overlap = len(degree_words & job_words)
    total = len(degree_words | job_words)
    
    return overlap / total if total > 0 else 0.5


def match_degree(
    candidate_degree: str,
    job_title: str,
    job_description: str = "",
    required_level: Optional[int] = None,
    required_field: Optional[str] = None,
    degree_embedding: Optional[List[float]] = None,
    job_embedding: Optional[List[float]] = None,
) -> DegreeMatch:
    """
    Match candidate degree to job requirements via EMBEDDINGS.
    
    Uses semantic similarity, not hardcoded matrices.
    """
    # Parse candidate level
    cand_level = parse_degree_level(candidate_degree)
    
    # Extract field from degree string (simple heuristic)
    cand_field = "Unknown"
    for field in ["Computer Science", "Engineering", "Business", "Mathematics", 
                  "Physics", "Medicine", "Finance", "Accounting", "Education"]:
        if field.lower() in candidate_degree.lower():
            cand_field = field
            break
    
    # Job field from title
    job_field = required_field or job_title
    
    # Required level inference
    if required_level is None:
        text = (job_title + " " + job_description).lower()
        if any(k in text for k in ["phd", "doctorate", "research"]):
            req_level = 5
        elif any(k in text for k in ["senior", "lead", "principal"]):
            req_level = 3
        elif any(k in text for k in ["junior", "entry", "associate"]):
            req_level = 2
        else:
            req_level = 3
    else:
        req_level = required_level
    
    # Field relevance via EMBEDDING SIMILARITY (not hardcoded matrix)
    field_rel = compute_field_similarity(
        cand_field, job_field, 
        degree_embedding, job_embedding
    )
    
    # Level match
    level_gap = cand_level - req_level
    if level_gap >= 0:
        level_match = 1.0 if level_gap == 0 else (0.95 if level_gap == 1 else 0.90)
    else:
        level_match = max(0.0, 0.7 ** abs(level_gap))
    
    # Overall: equal weighting
    overall = 0.5 * field_rel + 0.5 * level_match
    
    # Simple assessment
    if overall >= 0.8:
        assessment = "Strong degree match"
    elif overall >= 0.6:
        assessment = "Good degree match"
    elif overall >= 0.4:
        assessment = "Moderate degree match"
    else:
        assessment = "Weak degree match"
    
    return DegreeMatch(
        candidate_level=cand_level,
        required_level=req_level,
        field_relevance=field_rel,
        level_match=level_match,
        overall_score=overall,
        candidate_field=cand_field,
        job_field=job_field,
        level_gap=level_gap,
        assessment=assessment,
    )


def batch_match_degrees(
    candidate_degrees: List[str],
    job_title: str,
    job_description: str = "",
) -> List[DegreeMatch]:
    """
    Match multiple candidate degrees to a job.
    
    Returns best match.
    """
    matches = []
    for degree in candidate_degrees:
        match = match_degree(degree, job_title, job_description)
        matches.append(match)
    
    return matches


def get_best_degree_match(
    candidate_degrees: List[str],
    job_title: str,
    job_description: str = "",
) -> DegreeMatch:
    """Get best degree match from list."""
    matches = batch_match_degrees(candidate_degrees, job_title, job_description)
    return max(matches, key=lambda m: m.overall_score)


def format_degree_explanation(match: DegreeMatch) -> str:
    """Format degree match for explanation."""
    parts = [
        f"Degree Level: {match.candidate_level}/5 (required: {match.required_level}/5)",
        f"Field Relevance: {match.field_relevance:.0%} ({match.candidate_field} → {match.required_field})",
        f"Overall Match: {match.overall_score:.0%}",
        f"Assessment: {match.assessment}",
    ]
    return " | ".join(parts)
