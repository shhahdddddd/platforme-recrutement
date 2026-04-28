"""
Universal Skill Ontology Layer

Provides skill categorization and classification using LLM.
This adds semantic context to skills for better matching.
"""
from __future__ import annotations

import json
import hashlib
from typing import Optional
from dataclasses import dataclass

from agents.matching.llm_reasoning import cached_llm_call


@dataclass
class SkillClassification:
    """Classification of a single skill."""
    skill: str
    category: str
    type: str  # 'technical', 'soft', 'domain', 'tool'
    importance_weight: float = 1.0


# Pre-defined skill categories for common tech/business skills
# Used as cache + fallback when LLM is unavailable
COMMON_SKILL_CATEGORIES: dict[str, SkillClassification] = {
    # DevOps/Infrastructure
    "docker": SkillClassification("docker", "DevOps", "tool", 1.0),
    "kubernetes": SkillClassification("kubernetes", "DevOps", "tool", 1.0),
    "aws": SkillClassification("aws", "Cloud", "tool", 1.0),
    "azure": SkillClassification("azure", "Cloud", "tool", 1.0),
    "gcp": SkillClassification("gcp", "Cloud", "tool", 1.0),
    "terraform": SkillClassification("terraform", "DevOps", "tool", 0.9),
    "jenkins": SkillClassification("jenkins", "DevOps", "tool", 0.8),
    "cicd": SkillClassification("cicd", "DevOps", "domain", 0.9),
    
    # Programming Languages
    "python": SkillClassification("python", "Programming", "technical", 1.0),
    "javascript": SkillClassification("javascript", "Programming", "technical", 1.0),
    "typescript": SkillClassification("typescript", "Programming", "technical", 1.0),
    "java": SkillClassification("java", "Programming", "technical", 1.0),
    "c++": SkillClassification("c++", "Programming", "technical", 0.9),
    "go": SkillClassification("go", "Programming", "technical", 0.9),
    "rust": SkillClassification("rust", "Programming", "technical", 0.9),
    
    # Web Development
    "react": SkillClassification("react", "Frontend", "technical", 1.0),
    "angular": SkillClassification("angular", "Frontend", "technical", 1.0),
    "vue": SkillClassification("vue", "Frontend", "technical", 1.0),
    "html": SkillClassification("html", "Frontend", "technical", 0.8),
    "css": SkillClassification("css", "Frontend", "technical", 0.8),
    "node.js": SkillClassification("node.js", "Backend", "technical", 1.0),
    "django": SkillClassification("django", "Backend", "technical", 0.9),
    "laravel": SkillClassification("laravel", "Backend", "technical", 0.9),
    
    # Data/AI
    "machine learning": SkillClassification("machine learning", "Data/AI", "domain", 1.0),
    "deep learning": SkillClassification("deep learning", "Data/AI", "domain", 1.0),
    "tensorflow": SkillClassification("tensorflow", "Data/AI", "tool", 0.9),
    "pytorch": SkillClassification("pytorch", "Data/AI", "tool", 0.9),
    "sql": SkillClassification("sql", "Data", "technical", 1.0),
    "postgresql": SkillClassification("postgresql", "Data", "tool", 0.9),
    "mongodb": SkillClassification("mongodb", "Data", "tool", 0.9),
    
    # Marketing
    "seo": SkillClassification("seo", "Marketing", "domain", 1.0),
    "sem": SkillClassification("sem", "Marketing", "domain", 1.0),
    "content marketing": SkillClassification("content marketing", "Marketing", "domain", 0.9),
    "social media": SkillClassification("social media", "Marketing", "domain", 0.8),
    "google analytics": SkillClassification("google analytics", "Marketing", "tool", 0.8),
    
    # Sales/Business
    "crm": SkillClassification("crm", "Sales", "tool", 0.9),
    "salesforce": SkillClassification("salesforce", "Sales", "tool", 1.0),
    "cold calling": SkillClassification("cold calling", "Sales", "domain", 0.7),
    "negotiation": SkillClassification("negotiation", "Sales", "soft", 0.9),
    "lead generation": SkillClassification("lead generation", "Sales", "domain", 0.9),
    
    # Finance
    "accounting": SkillClassification("accounting", "Finance", "domain", 1.0),
    "financial analysis": SkillClassification("financial analysis", "Finance", "domain", 1.0),
    "excel": SkillClassification("excel", "Finance", "tool", 0.8),
    "quickbooks": SkillClassification("quickbooks", "Finance", "tool", 0.8),
    
    # Healthcare
    "patient care": SkillClassification("patient care", "Healthcare", "domain", 1.0),
    "medical records": SkillClassification("medical records", "Healthcare", "domain", 0.9),
    "surgery": SkillClassification("surgery", "Healthcare", "domain", 1.0),
    "nursing": SkillClassification("nursing", "Healthcare", "domain", 1.0),
    
    # Soft Skills
    "communication": SkillClassification("communication", "Soft Skills", "soft", 0.8),
    "leadership": SkillClassification("leadership", "Soft Skills", "soft", 0.9),
    "teamwork": SkillClassification("teamwork", "Soft Skills", "soft", 0.7),
    "problem solving": SkillClassification("problem solving", "Soft Skills", "soft", 0.8),
    "project management": SkillClassification("project management", "Management", "domain", 1.0),
}


def classify_skill(skill_name: str) -> SkillClassification:
    """
    Classify a single skill into category and type.
    Uses cache first, then LLM for unknown skills.
    """
    normalized = skill_name.lower().strip()
    
    # Check cache first
    if normalized in COMMON_SKILL_CATEGORIES:
        return COMMON_SKILL_CATEGORIES[normalized]
    
    # Try LLM classification for unknown skills
    try:
        classification = _llm_classify_skill(skill_name)
        # Add to cache
        COMMON_SKILL_CATEGORIES[normalized] = classification
        return classification
    except Exception:
        # Fallback: generic classification
        return SkillClassification(
            skill=skill_name,
            category="General",
            type="technical",
            importance_weight=0.8
        )


def _llm_classify_skill(skill_name: str) -> SkillClassification:
    """Use LLM to classify an unknown skill."""
    
    prompt = f"""Classify this skill into a category and type.

Skill: {skill_name}

Respond in JSON format:
{{
    "category": "Category name (e.g., DevOps, Marketing, Healthcare, Finance, Programming, Data/AI, etc.)",
    "type": "technical" | "soft" | "domain" | "tool",
    "importance_weight": 0.0 to 1.0 (how critical is this skill in its domain)
}}

Guidelines:
- "technical": Programming languages, frameworks, protocols, engineering skills
- "soft": Communication, leadership, teamwork, negotiation
- "domain": Industry-specific knowledge (medical, legal, finance concepts)
- "tool": Software tools, platforms, applications
"""
    
    response = cached_llm_call(
        prompt,
        cache_key=f"skill_class:{hashlib.md5(skill_name.encode()).hexdigest()}",
        ttl_hours=168  # Cache for 1 week
    )
    
    # Parse JSON response
    try:
        data = json.loads(response.strip())
        return SkillClassification(
            skill=skill_name,
            category=data.get("category", "General"),
            type=data.get("type", "technical"),
            importance_weight=data.get("importance_weight", 0.8)
        )
    except (json.JSONDecodeError, KeyError):
        raise ValueError(f"Invalid LLM response for skill classification: {response}")


def classify_skills_batch(skills: list[str]) -> list[SkillClassification]:
    """Classify multiple skills efficiently."""
    return [classify_skill(s) for s in skills]


def get_skills_by_category(
    skills: list[str], 
    category: str
) -> list[str]:
    """Filter skills by category."""
    classified = classify_skills_batch(skills)
    return [
        c.skill for c in classified 
        if c.category.lower() == category.lower()
    ]


def calculate_skill_importance_weights(skills: list[str]) -> dict[str, float]:
    """Get importance weights for a list of skills."""
    classified = classify_skills_batch(skills)
    return {c.skill: c.importance_weight for c in classified}
