"""
degree_matcher.py

Compares job education requirements against candidate qualifications.

Hierarchy: 0 (none) → 1 (high school) → 2 (associate) → 3 (bachelor) → 4 (master) → 5 (phd)
"""

from __future__ import annotations

import re

# ── Degree hierarchy (higher number = higher qualification) ───────────────────

DEGREE_HIERARCHY: dict[str, int] = {
    # Level 1 — Secondary
    "high school": 1,
    "bac": 1,
    "baccalauréat": 1,
    "baccalaureat": 1,
    # Level 2 — Short-cycle post-secondary
    "diploma": 2,
    "associate": 2,
    "bts": 2,
    "dut": 2,
    "technicien": 2,
    # Level 3 — Undergraduate
    "licence": 3,
    "license": 3,
    "bachelor": 3,
    "bsc": 3,
    "ba": 3,
    "undergraduate": 3,
    # Level 4 — Postgraduate / Engineering
    "maîtrise": 4,
    "maitrise": 4,
    "master": 4,
    "msc": 4,
    "mba": 4,
    "m2": 4,
    "m1": 4,
    "postgraduate": 4,
    "engineer": 4,
    "ingénieur": 4,
    "ingenieur": 4,
    "ing": 4,
    "diplôme d'ingénieur": 4,
    # Level 5 — Doctoral / Advanced Professional
    "phd": 5,
    "doctorate": 5,
    "doctorat": 5,
    "dr": 5,
    "md": 5,          # Medical Doctor
}

def _classify_degree(text: str) -> int:
    """Map a free-text degree description to a hierarchy level (0 = unknown)."""
    normalised = re.sub(r"['\u2019\u0027]", "'", text.lower().strip())
    normalised = re.sub(r"\s+", " ", normalised)

    for keyword in sorted(DEGREE_HIERARCHY, key=len, reverse=True):
        if keyword in normalised:
            return DEGREE_HIERARCHY[keyword]
            
    return 0


DEGREE_LEVEL_NAMES = {
    0: "No degree / Unknown",
    1: "High School / Bac",
    2: "Associate / BTS / DUT",
    3: "Bachelor / Licence",
    4: "Master / Engineer",
    5: "PhD / Doctorate",
}


def match_degrees(
    required_degrees: list[str],
    candidate_education: list[dict],
    is_required: bool = False,
) -> dict:
    """
    Return detailed degree comparison with score and explainability data.
    
    Returns:
        {
            "score": float,  # 0.0 to 1.0
            "comparison_result": "below" | "meets" | "exceeds" | "unknown",
            "required_level": int,
            "required_level_name": str,
            "candidate_level": int,
            "candidate_level_name": str,
            "candidate_highest_degree": str,
            "is_required": bool,
            "field_relevance": float,  # 0.0 to 1.0 if field info available
        }
    """
    # Default result for when no degree requirements
    if not required_degrees:
        return {
            "score": 1.0,
            "comparison_result": "not_required",
            "required_level": 0,
            "required_level_name": "Not specified",
            "candidate_level": 0,
            "candidate_level_name": "N/A",
            "candidate_highest_degree": "",
            "is_required": False,
            "field_relevance": 1.0,
        }
    
    # Parse required degree levels
    required_levels = [_classify_degree(d) for d in required_degrees]
    required_levels = [lv for lv in required_levels if lv > 0]
    
    if not required_levels:
        # Required degrees specified but couldn't parse
        return {
            "score": 0.5,
            "comparison_result": "unknown",
            "required_level": 0,
            "required_level_name": "Unknown requirement",
            "candidate_level": 0,
            "candidate_level_name": "N/A",
            "candidate_highest_degree": "",
            "is_required": is_required,
            "field_relevance": 1.0,
        }
    
    target_level = min(required_levels)  # Most lenient requirement
    
    # Parse candidate education
    candidate_levels: list[tuple[int, str]] = []
    candidate_fields: list[str] = []
    
    for edu in candidate_education:
        degree_text = str(edu.get("degree", "")).strip()
        field_text = str(edu.get("field", "")).strip()
        if degree_text:
            level = _classify_degree(degree_text)
            if level > 0:
                candidate_levels.append((level, degree_text))
                if field_text:
                    candidate_fields.append(field_text.lower())
    
    if not candidate_levels:
        # No degree info found
        return {
            "score": 0.3 if is_required else 0.7,  # Soft penalty if required, neutral if not
            "comparison_result": "unknown",
            "required_level": target_level,
            "required_level_name": DEGREE_LEVEL_NAMES.get(target_level, "Unknown"),
            "candidate_level": 0,
            "candidate_level_name": "No degree info",
            "candidate_highest_degree": "",
            "is_required": is_required,
            "field_relevance": 1.0,
        }
    
    # Get highest candidate degree
    best_level, best_degree_name = max(candidate_levels, key=lambda x: x[0])
    
    # Calculate comparison with softer scoring
    # 1 level below → ~0.8, 2+ levels → ~0.6
    if best_level >= target_level:
        comparison = "exceeds" if best_level > target_level else "meets"
        # Small bonus for exceeding, capped at 1.0
        score = min(1.0, 0.95 + 0.05 * (best_level - target_level))
    elif best_level == target_level - 1:
        comparison = "slightly_below"
        score = 0.8 if is_required else 0.9  # Soft penalty for 1 level below
    else:
        comparison = "below"
        score = 0.6 if is_required else 0.8  # Softer penalty for 2+ levels below
    
    return {
        "score": round(score, 2),
        "comparison_result": comparison,
        "required_level": target_level,
        "required_level_name": DEGREE_LEVEL_NAMES.get(target_level, "Unknown"),
        "candidate_level": best_level,
        "candidate_level_name": DEGREE_LEVEL_NAMES.get(best_level, "Unknown"),
        "candidate_highest_degree": best_degree_name,
        "is_required": is_required,
        "field_relevance": 1.0,  # Could be enhanced with field matching
    }
