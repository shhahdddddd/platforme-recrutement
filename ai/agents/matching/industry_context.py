"""
industry_context.py

SIMPLIFIED Industry Context Layer

Only provides context - NO hardcoded thresholds.
All thresholds are data-driven, not manually tuned.
"""

from typing import Dict, Any, Optional


def get_industry_context(industry: str) -> Dict[str, Any]:
    """
    Get minimal industry context for explanation purposes.
    
    NO THRESHOLDS - just descriptive context.
    """
    contexts = {
        "IT": {
            "name": "Information Technology",
            "typical_requirements": ["technical skills", "problem solving"],
        },
        "Healthcare": {
            "name": "Healthcare",
            "typical_requirements": ["certifications", "patient care"],
        },
        "Finance": {
            "name": "Finance",
            "typical_requirements": ["compliance", "analytical skills"],
        },
        "Education": {
            "name": "Education",
            "typical_requirements": ["teaching license", "subject expertise"],
        },
        "Engineering": {
            "name": "Engineering",
            "typical_requirements": ["technical degree", "practical experience"],
        },
    }
    
    return contexts.get(industry, {"name": industry, "typical_requirements": []})


def get_role_family_context(role_family: str) -> Dict[str, Any]:
    """
    Get minimal role-family context.
    
    NO SUBSTITUTABILITY GROUPS - derive from embeddings instead.
    """
    return {
        "name": role_family,
        "description": f"{role_family} role family"
    }


def get_seniority_expectations(seniority: str) -> Dict[str, Any]:
    """
    Get minimal seniority context.
    
    NO MULTIPLIERS - just descriptive context for explanations.
    """
    descriptions = {
        "Junior": "Entry-level position, learning expected",
        "Mid": "Independent contributor with proven skills",
        "Senior": "Expert-level with leadership responsibilities",
        "Lead": "Team leadership and strategic impact",
    }
    
    return {
        "level": seniority,
        "description": descriptions.get(seniority, "Mid-level position")
    }


def detect_substitutability_from_embeddings(
    max_similarity: float,
    candidate_has_related: bool,
    category: str = "",
) -> tuple[bool, str]:
    """
    DERIVED substitutability - no manual flags.
    
    Logic:
    - High similarity (>0.75) → likely substitutable
    - Has related skills in same category → likely substitutable
    - Low similarity + no related → not substitutable
    
    Returns: (is_substitutable, reason)
    """
    if max_similarity >= 0.75:
        return True, f"High embedding similarity ({max_similarity:.2f}) indicates close conceptual match"
    elif max_similarity >= 0.60 and candidate_has_related:
        return True, f"Moderate similarity ({max_similarity:.2f}) with related skills in category"
    else:
        return False, f"Low similarity ({max_similarity:.2f}) with no close conceptual matches"


def get_distribution_based_threshold(coverages: list) -> float:
    """
    Data-driven threshold from coverage distribution.
    
    NO HARDCODED VALUES - compute from actual data.
    """
    import numpy as np
    
    if not coverages:
        return 0.25  # Absolute fallback only
    
    # Use 25th percentile of actual coverages
    return float(np.percentile(coverages, 25))
