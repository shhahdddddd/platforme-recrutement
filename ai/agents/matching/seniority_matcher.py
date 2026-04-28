"""
seniority_matcher.py

SIMPLIFIED Seniority Matching:
Focused on years of experience and career progression.
Removed fuzzy title overengineering.
"""
from typing import Dict, Any, List

def calculate_years_experience(experience: List[Dict[str, Any]]) -> float:
    """Sum up years from experience items."""
    total = 0.0
    for exp in experience:
        total += exp.get("years", 0) or 0
    return total

def match_seniority(
    required_years: int,
    candidate_profile: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Simple seniority matching based on years and progress.
    """
    experience = candidate_profile.get("experience", [])
    actual_years = candidate_profile.get("total_experience_years", 0) or calculate_years_experience(experience)
    
    # Progression: Do they have more than 1 experience entry?
    progression_score = min(1.0, len(experience) / 3) 
    
    # Seniority Level (Simple)
    if actual_years < 2:
        level = "Junior"
    elif actual_years < 6:
        level = "Mid"
    else:
        level = "Senior"
        
    score = 1.0 if actual_years >= required_years else (actual_years / required_years if required_years > 0 else 1.0)
    
    # Risk factor: Overqualification
    overqualified = actual_years > (required_years + 5) if required_years > 0 else False

    return {
        "score": round(score, 2),
        "candidate_level": level,
        "total_years": actual_years,
        "progression_score": round(progression_score, 2),
        "meets_requirement": actual_years >= required_years,
        "overqualified_risk": overqualified
    }
