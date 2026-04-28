"""
experience_matcher.py

Skill-aware and domain-aware experience scoring.
Replaces simple "total years" comparison with relevant experience detection.
"""

from __future__ import annotations

import re
from typing import Any


def extract_skills_from_description(description: str, skills: list[str]) -> list[str]:
    """
    Extract which required skills are mentioned in an experience description.
    This identifies relevant experience vs generic experience.
    """
    if not description or not skills:
        return []
    
    description_lower = description.lower()
    found_skills = []
    
    for skill in skills:
        skill_lower = skill.lower()
        # Simple word boundary check
        pattern = rf"\b{re.escape(skill_lower)}\b"
        if re.search(pattern, description_lower):
            found_skills.append(skill)
        else:
            # Check for partial matches (e.g., "React" in "React.js")
            if skill_lower in description_lower:
                found_skills.append(skill)
    
    return found_skills


def score_experience_per_skill(
    candidate_experience: list[dict],
    required_skills: list[str | dict],
    required_years: float,
    total_experience_years: float | None,
) -> dict[str, Any]:
    """
    Score experience based on:
    - Relevant experience (experience mentioning required skills)
    - Total years (fallback)
    - Seniority level matching
    
    Returns dict with:
    - score: 0-1 experience match score
    - relevant_years: years of relevant experience
    - total_years: total years
    - skill_coverage: % of required skills found in experience
    - relevant_roles: list of roles with required skills
    """
    if not required_skills:
        # No requirements = neutral score
        return {
            "score": 1.0,
            "relevant_years": total_experience_years or 0,
            "total_years": total_experience_years or 0,
            "skill_coverage": 1.0,
            "relevant_roles": [],
        }
    
    # Extract skill names from required_skills (handle both string and dict formats)
    skill_names = []
    for s in required_skills:
        if isinstance(s, dict):
            skill_names.append(s.get("name", ""))
        else:
            skill_names.append(s)
    skill_names = [s for s in skill_names if s]
    
    if not candidate_experience:
        # No experience listed
        if required_years > 0:
            return {
                "score": 0.0,
                "relevant_years": 0,
                "total_years": 0,
                "skill_coverage": 0.0,
                "relevant_roles": [],
            }
        else:
            return {
                "score": 1.0,
                "relevant_years": 0,
                "total_years": 0,
                "skill_coverage": 1.0,
                "relevant_roles": [],
            }
    
    # Analyze each experience entry for relevant skills
    relevant_years = 0.0
    relevant_roles = []
    skills_found_in_exp = set()
    
    for exp in candidate_experience:
        description = exp.get("description", "")
        role = exp.get("role", "")
        company = exp.get("company", "")
        
        # Extract duration
        start = exp.get("start_date", "")
        end = exp.get("end_date", "")
        
        # Simple duration calculation (fallback to 1 year if unknown)
        duration_years = 1.0
        if start and end:
            # Try to extract years
            start_year_match = re.search(r"20\d{2}", str(start))
            end_year_match = re.search(r"20\d{2}", str(end))
            if start_year_match and end_year_match:
                start_year = int(start_year_match.group())
                end_year = int(end_year_match.group())
                duration_years = max(end_year - start_year, 0.5)  # Minimum 6 months
        
        # Check which required skills are mentioned
        skills_in_description = extract_skills_from_description(description, skill_names)
        skills_in_role = extract_skills_from_description(role, skill_names)
        all_skills_in_exp = set(skills_in_description + skills_in_role)
        
        if all_skills_in_exp:
            # This is relevant experience
            relevant_years += duration_years
            relevant_roles.append({
                "role": role,
                "company": company,
                "duration_years": duration_years,
                "skills_mentioned": list(all_skills_in_exp),
            })
            skills_found_in_exp.update(all_skills_in_exp)
    
    # Calculate skill coverage
    skill_coverage = len(skills_found_in_exp) / len(skill_names) if skill_names else 1.0
    
    # Experience scoring: role relevance + time ratio
    # Factor 1: Role relevance (% of roles mentioning required skills)
    role_relevance = len(relevant_roles) / len(candidate_experience) if candidate_experience else 0
    
    # Factor 2: Time spent in relevant roles vs required years
    total_years = total_experience_years or relevant_years
    if required_years > 0:
        time_ratio = min(relevant_years / required_years, 1.5)
    else:
        time_ratio = 1.0 if relevant_years > 0 else 0.5
    
    # Combined score: role relevance + time in relevant roles
    score = (role_relevance * 0.4) + (time_ratio * 0.6)
    score = min(score, 1.0)
    
    return {
        "score": round(score, 4),
        "relevant_years": round(relevant_years, 1),
        "total_years": round(total_years, 1),
        "skill_coverage": round(skill_coverage, 2),
        "relevant_roles": relevant_roles,
    }


def match_experience(
    job_profile: dict,
    candidate_profile: dict,
) -> dict[str, Any]:
    """
    Main entry point for experience matching.
    Compares job requirements with candidate experience.
    """
    required_skills = job_profile.get("skills", [])
    required_years = float(job_profile.get("required_experience_years") or 0.0)
    
    candidate_experience = candidate_profile.get("experience", [])
    total_years = candidate_profile.get("total_experience_years")
    
    return score_experience_per_skill(
        candidate_experience=candidate_experience,
        required_skills=required_skills,
        required_years=required_years,
        total_experience_years=total_years,
    )
