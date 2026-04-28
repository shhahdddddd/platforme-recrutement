"""
Industry Detection + Dynamic Weighting

Detects the industry from job description and adjusts scoring weights dynamically.
This is VERY POWERFUL for industry-specific matching.
"""
from __future__ import annotations

import json
import hashlib
from dataclasses import dataclass
from typing import Optional
from enum import Enum

from agents.matching.llm_reasoning import cached_llm_call


class IndustryType(str, Enum):
    """Supported industry types."""
    IT = "IT"
    HEALTHCARE = "Healthcare"
    FINANCE = "Finance"
    MARKETING = "Marketing"
    SALES = "Sales"
    EDUCATION = "Education"
    MANUFACTURING = "Manufacturing"
    CONSULTING = "Consulting"
    GENERAL = "General"


@dataclass
class IndustryProfile:
    """Industry-specific scoring weights."""
    industry: IndustryType
    skills_weight: float
    degree_weight: float
    experience_weight: float
    semantic_weight: float
    certifications_weight: float
    soft_skills_weight: float
    
    # Industry-specific skill categories that matter most
    critical_skill_categories: list[str]


# Industry weight profiles
INDUSTRY_PROFILES: dict[IndustryType, IndustryProfile] = {
    IndustryType.IT: IndustryProfile(
        industry=IndustryType.IT,
        skills_weight=0.45,  # Skills very important
        degree_weight=0.10,    # Degree less important
        experience_weight=0.25,
        semantic_weight=0.15,
        certifications_weight=0.05,
        soft_skills_weight=0.05,
        critical_skill_categories=["Programming", "DevOps", "Data/AI", "Cloud"]
    ),
    
    IndustryType.HEALTHCARE: IndustryProfile(
        industry=IndustryType.HEALTHCARE,
        skills_weight=0.25,
        degree_weight=0.35,    # Degree VERY important
        experience_weight=0.25,
        semantic_weight=0.10,
        certifications_weight=0.05,
        soft_skills_weight=0.05,
        critical_skill_categories=["Healthcare", "Medical", "Patient Care"]
    ),
    
    IndustryType.FINANCE: IndustryProfile(
        industry=IndustryType.FINANCE,
        skills_weight=0.30,
        degree_weight=0.25,    # Degree important (accounting, finance)
        experience_weight=0.30,
        semantic_weight=0.10,
        certifications_weight=0.05,
        soft_skills_weight=0.05,
        critical_skill_categories=["Finance", "Accounting", "Data"]
    ),
    
    IndustryType.MARKETING: IndustryProfile(
        industry=IndustryType.MARKETING,
        skills_weight=0.30,
        degree_weight=0.10,
        experience_weight=0.30,  # Experience very important
        semantic_weight=0.20,
        certifications_weight=0.05,
        soft_skills_weight=0.10,  # Soft skills matter
        critical_skill_categories=["Marketing", "Content", "Social Media", "SEO"]
    ),
    
    IndustryType.SALES: IndustryProfile(
        industry=IndustryType.SALES,
        skills_weight=0.20,
        degree_weight=0.05,     # Degree less important
        experience_weight=0.40, # Experience VERY important
        semantic_weight=0.20,
        certifications_weight=0.05,
        soft_skills_weight=0.15, # Soft skills VERY important
        critical_skill_categories=["Sales", "CRM", "Negotiation"]
    ),
    
    IndustryType.EDUCATION: IndustryProfile(
        industry=IndustryType.EDUCATION,
        skills_weight=0.25,
        degree_weight=0.40,     # Degree VERY important
        experience_weight=0.20,
        semantic_weight=0.10,
        certifications_weight=0.05,
        soft_skills_weight=0.05,
        critical_skill_categories=["Education", "Teaching"]
    ),
    
    IndustryType.CONSULTING: IndustryProfile(
        industry=IndustryType.CONSULTING,
        skills_weight=0.25,
        degree_weight=0.15,
        experience_weight=0.30,
        semantic_weight=0.20,
        certifications_weight=0.05,
        soft_skills_weight=0.10,
        critical_skill_categories=["Management", "Domain Expertise"]
    ),
    
    IndustryType.GENERAL: IndustryProfile(
        industry=IndustryType.GENERAL,
        skills_weight=0.30,
        degree_weight=0.15,
        experience_weight=0.25,
        semantic_weight=0.20,
        certifications_weight=0.05,
        soft_skills_weight=0.05,
        critical_skill_categories=[]
    ),
}


def detect_industry(
    job_title: str,
    job_description: str,
    required_skills: list[str]
) -> IndustryType:
    """
    Detect industry from job information using LLM.
    
    Falls back to keyword matching if LLM fails.
    """
    # Try LLM detection first
    try:
        industry = _llm_detect_industry(job_title, job_description, required_skills)
        return industry
    except Exception:
        # Fallback to keyword-based detection
        return _keyword_detect_industry(job_title, job_description)


def _llm_detect_industry(
    job_title: str,
    job_description: str,
    required_skills: list[str]
) -> IndustryType:
    """Use LLM to detect industry."""
    
    skills_text = ", ".join(required_skills[:10])  # Limit to first 10
    
    prompt = f"""Classify the industry for this job.

Job Title: {job_title}
Required Skills: {skills_text}
Job Description (first 500 chars):
{job_description[:500]}

Choose from: IT, Healthcare, Finance, Marketing, Sales, Education, Manufacturing, Consulting, General

Respond with just the industry name, nothing else."""
    
    response = cached_llm_call(
        prompt,
        cache_key=f"industry:{hashlib.md5(job_title.encode()).hexdigest()}",
        ttl_hours=24
    )
    
    # Parse and validate
    industry_str = response.strip()
    
    # Try to match to enum
    for industry in IndustryType:
        if industry.value.lower() == industry_str.lower():
            return industry
    
    # If no exact match, try partial match
    for industry in IndustryType:
        if industry.value.lower() in industry_str.lower():
            return industry
    
    return IndustryType.GENERAL


def _keyword_detect_industry(title: str, description: str) -> IndustryType:
    """Fallback keyword-based industry detection."""
    text = (title + " " + description).lower()
    
    # Healthcare keywords
    healthcare_keywords = [
        "medical", "health", "nurse", "doctor", "patient", "hospital", 
        "clinical", "pharmaceutical", "caregiver", "therapist", "dental"
    ]
    if any(kw in text for kw in healthcare_keywords):
        return IndustryType.HEALTHCARE
    
    # Finance keywords
    finance_keywords = [
        "finance", "accounting", "bank", "investment", "audit", "tax",
        "financial", "budget", "accountant", "cpa", "cfo"
    ]
    if any(kw in text for kw in finance_keywords):
        return IndustryType.FINANCE
    
    # Marketing keywords
    marketing_keywords = [
        "marketing", "seo", "social media", "content", "brand", "campaign",
        "digital marketing", "advertising", "ppc", "growth"
    ]
    if any(kw in text for kw in marketing_keywords):
        return IndustryType.MARKETING
    
    # Sales keywords
    sales_keywords = [
        "sales", "business development", "account executive", "sdr", "bdr",
        "revenue", "quota", "prospecting", "closing"
    ]
    if any(kw in text for kw in sales_keywords):
        return IndustryType.SALES
    
    # Education keywords
    education_keywords = [
        "teacher", "professor", "education", "curriculum", "instruction",
        "academic", "learning", "training", "tutor"
    ]
    if any(kw in text for kw in education_keywords):
        return IndustryType.EDUCATION
    
    # IT keywords (broader)
    it_keywords = [
        "software", "developer", "engineer", "programming", "code", 
        "technical", "devops", "cloud", "data", "ai", "ml"
    ]
    if any(kw in text for kw in it_keywords):
        return IndustryType.IT
    
    return IndustryType.GENERAL


def get_industry_weights(industry: IndustryType) -> IndustryProfile:
    """Get scoring weights for a specific industry."""
    return INDUSTRY_PROFILES.get(industry, INDUSTRY_PROFILES[IndustryType.GENERAL])


def adjust_score_by_industry(
    base_scores: dict[str, float],
    industry: IndustryType
) -> dict[str, float]:
    """
    Adjust scoring weights based on industry.
    
    Args:
        base_scores: Dict with keys like 'skills', 'degree', 'experience', 'semantic'
        industry: Detected industry
    
    Returns:
        Adjusted scores dict
    """
    profile = get_industry_weights(industry)
    
    # Apply industry weights
    adjusted = {
        "skills": base_scores.get("skills", 0) * profile.skills_weight,
        "degree": base_scores.get("degree", 0) * profile.degree_weight,
        "experience": base_scores.get("experience", 0) * profile.experience_weight,
        "semantic": base_scores.get("semantic", 0) * profile.semantic_weight,
    }
    
    # Normalize to ensure total doesn't exceed 1.0
    total = sum(adjusted.values())
    if total > 0:
        factor = min(total, 1.0) / total
        adjusted = {k: v * factor for k, v in adjusted.items()}
    
    return adjusted


def is_critical_skill_for_industry(
    skill: str,
    industry: IndustryType
) -> bool:
    """Check if a skill is in the critical category for an industry."""
    from agents.matching.skill_ontology import classify_skill
    
    classification = classify_skill(skill)
    profile = get_industry_weights(industry)
    
    return classification.category in profile.critical_skill_categories
