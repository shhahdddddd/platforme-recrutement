"""
scoring_engine.py

Upgraded scoring logic and dynamic weighting for the AI Matching system.
"""

from __future__ import annotations
import logging
from typing import Dict, Any, Tuple, List

import numpy as np

logger = logging.getLogger(__name__)

def compute_weights(job_description: str, job_profile: dict) -> Dict[str, float]:
    """
    REPLACE STATIC INDUSTRY WEIGHTS with DYNAMIC WEIGHTING.
    Logic:
    - Count skills and degrees in the job description/profile.
    - Compute densities and relative importance.
    """
    skills = job_profile.get("skills", [])
    degrees = job_profile.get("required_degrees", []) or job_profile.get("education", [])
    
    # Calculate density relative to a typical job (approx 15 skills, 1 degree)
    skill_count = len(skills)
    degree_count = len(degrees)
    
    # User's specified dynamic logic:
    # skill_density = count_skills(job_description)
    # return { "skill": min(0.5, skill_density), ... }
    
    # We'll normalize density based on typical counts
    skill_density = min(0.6, skill_count / 15.0) if skill_count > 0 else 0.2
    degree_density = min(0.3, degree_count / 2.0) if degree_count > 0 else 0.1
    
    # Experience gets the remainder
    experience_weight = 1.0 - (skill_density + degree_density)
    
    return {
        "skills": round(skill_density, 2),
        "education": round(degree_density, 2),
        "experience": round(experience_weight, 2),
        "traits": 0.05  # Constant small weight for soft skills
    }

def calculate_confidence_score(scores: Dict[str, float], data_quality: float) -> float:
    """
    Two-factor confidence model:
    Reflects both input quality (extraction) and scoring consistency (variance).
    """
    if not scores:
        return round(data_quality, 3)
        
    # Variance Penalty: High score spread = low reliability
    variance_penalty = np.var(list(scores.values()))
    
    raw_confidence = 1.0 - variance_penalty
    final_confidence = raw_confidence * data_quality
    
    return round(float(final_confidence), 3)

def calculate_risk_score(candidate_profile: dict, matching_context: dict) -> float:
    """
    RISK ENGINE (Final Safeguard)
    Evaluates:
    - Skill Gaps (Criticality)
    - Overqualification (Flight Risk)
    - Career Instability (Job-hopping)
    """
    risk = 0.0
    
    # Pillar 1 — Missing Critical Skills (0.0 to 0.4)
    missing_critical = matching_context.get("missing_critical_count", 0)
    if missing_critical > 0:
        risk += min(0.4, missing_critical * 0.15)

    # Pillar 2 — Overqualification Risk (0.0 to 0.3)
    # HR care about flight risk for candidates applying below their level
    if matching_context.get("overqualified", False):
        risk += 0.3

    # Pillar 3 — Instability (0.0 to 0.3)
    # Calculate avg months per job from experience history
    exp = candidate_profile.get("experience", [])
    if exp:
        tenures = []
        for e in exp:
            months = e.get("tenure_months", 24) # Assume 2 years if unknown
            if months: tenures.append(months)
        
        if tenures:
            avg_months = sum(tenures) / len(tenures)
            if avg_months < 14: # Less than ~1 year avg
                risk += 0.3
            elif avg_months < 20: # Less than ~1.5 years avg
                risk += 0.15
                
    return round(min(1.0, risk), 2)


def calculate_risk_factors(
    missing_critical: List[str],
    experience_score: float,
    education_score: float,
    candidate_profile: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    NEW: Detailed risk assessment for recruiters.
    
    Returns structured risk factors that recruiters actually care about.
    """
    risks = {
        "missing_critical": len(missing_critical) > 0,
        "missing_critical_list": missing_critical,
        "experience_gap": experience_score < 0.5,
        "education_gap": education_score < 0.5,
        "instability": False,
        "overqualified": False,
        "risk_level": "LOW",  # LOW, MEDIUM, HIGH
        "risk_score": 0.0,
    }
    
    risk_score = 0.0
    
    # Missing critical skills (major risk)
    if risks["missing_critical"]:
        risk_score += min(0.5, len(missing_critical) * 0.15)
    
    # Experience gap
    if risks["experience_gap"]:
        risk_score += 0.2
    
    # Education gap
    if risks["education_gap"]:
        risk_score += 0.15
    
    # Career instability (job hopping)
    if candidate_profile:
        exp = candidate_profile.get("experience", [])
        if len(exp) >= 3:
            tenures = []
            for e in exp:
                months = e.get("tenure_months", 0)
                if months > 0:
                    tenures.append(months)
            
            if tenures:
                avg_tenure = sum(tenures) / len(tenures)
                if avg_tenure < 12:  # Less than 1 year average
                    risks["instability"] = True
                    risk_score += 0.3
                elif avg_tenure < 18:  # Less than 1.5 years
                    risk_score += 0.15
    
    # Determine risk level
    risks["risk_score"] = round(min(1.0, risk_score), 2)
    if risk_score >= 0.6:
        risks["risk_level"] = "HIGH"
    elif risk_score >= 0.3:
        risks["risk_level"] = "MEDIUM"
    else:
        risks["risk_level"] = "LOW"
    
    return risks


def compute_final_score(
    semantic_score: float,
    skill_coverage: float,
    experience_score: float,
    education_score: float,
    weights: Dict[str, float] = None
) -> float:
    """
    NEW: Simplified weighted scoring without hard fails.
    
    All components contribute proportionally to final score.
    """
    if weights is None:
        weights = {
            "semantic": 0.3,
            "skills": 0.4,
            "experience": 0.2,
            "education": 0.1
        }
    
    final_score = (
        semantic_score * weights.get("semantic", 0.3) +
        skill_coverage * weights.get("skills", 0.4) +
        experience_score * weights.get("experience", 0.2) +
        education_score * weights.get("education", 0.1)
    )
    
    return round(min(1.0, max(0.0, final_score)), 4)


def compute_final_score_legacy(base_score: float, context: Dict[str, Any]) -> Tuple[float, str]:
    """
    PRODUCTION-GRADE DECISION LOGIC.
    
    Uses:
    - Hard fail conditions
    - Penalties
    - Boosts
    - Confidence
    """
    penalty = 1.0
    boost = 1.0

    # 🔴 HARD FAIL CONDITIONS
    # Critical skill coverage requirement
    if context.get("critical_skill_coverage", 1.0) < 0.4:
        logger.info("Hard fail: critical skill coverage too low (%.2f)", context["critical_skill_coverage"])
        return 0.0, "FAIL"

    # Experience score requirement
    if context.get("experience_score", 1.0) < 0.2:
        logger.info("Hard fail: experience score too low (%.2f)", context["experience_score"])
        return 0.0, "FAIL"

    # ⚠️ PENALTIES
    if context.get("missing_critical", False):
        penalty *= 0.6

    if context.get("underqualified", False):
        penalty *= 0.7

    # 🟢 BOOSTS
    if context.get("rare_skill", False):
        boost *= 1.1

    if context.get("strong_experience", False):
        boost *= 1.05

    # 🧠 CONFIDENCE (Two-Factor Logic)
    # Applied as a direct multiplier to the final decision
    confidence = context.get("confidence", 1.0)

    # Calculate final score
    final = base_score * penalty * boost * confidence
    final = min(1.0, max(0.0, final))

    # 🎯 DECISION
    if final >= 0.75:
        return round(final, 4), "PASS"
    elif final >= 0.5:
        return round(final, 4), "REVIEW"
    else:
        return round(final, 4), "FAIL"
