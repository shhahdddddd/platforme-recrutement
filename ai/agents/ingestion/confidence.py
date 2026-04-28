"""
confidence.py

Computes a heuristic confidence score in [0.0, 1.0] indicating how
"complete" a parsed CV profile is.  Higher confidence means the AI
pipeline extracted more usable information from the document.

This score is NOT a quality judgement of the candidate — it reflects
extraction quality only.
"""

from __future__ import annotations


from typing import Any

def compute_confidence(profile: dict) -> dict[str, Any]:
    """
    Return a confidence score in [0.0, 1.0] based on field completeness.

    Weight breakdown (sums to ≤ 1.0):
        email             0.15
        phone             0.10
        full_name         0.05
        skills ≥ 3        0.20   (bonus +0.05 if ≥ 8)
        experience ≥ 1    0.25   (bonus +0.05 if ≥ 3)
        education ≥ 1     0.10
        languages         0.05
    """
    score = 0.0

    if profile.get("email"):
        score += 0.15
    if profile.get("phone"):
        score += 0.10
    if profile.get("full_name"):
        score += 0.05

    skill_count = len(profile.get("skills", []))
    if skill_count >= 3:
        score += 0.20
    if skill_count >= 8:
        score += 0.05  # bonus for rich skill set

    experience_count = len(profile.get("experience", []))
    if experience_count >= 1:
        score += 0.25
    if experience_count >= 3:
        score += 0.05  # bonus for detailed history

    if len(profile.get("education", [])) >= 1:
        score += 0.10
    if profile.get("languages"):
        score += 0.05

    final_score = round(float(min(score, 1.0)), 2)
    needs_manual_review = final_score < 0.40
    
    # Also update the profile in place as a convenience
    if needs_manual_review:
        profile["needs_manual_review"] = True
        
    return {
        "score": final_score,
        "needs_manual_review": bool(needs_manual_review)
    }
