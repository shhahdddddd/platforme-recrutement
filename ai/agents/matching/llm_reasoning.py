"""
llm_reasoning.py

LLM utilities for extraction and normalization ONLY.
NO SCORING - skill_matcher.py is the single source of truth for skill scores.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from api.utils import call_llm

logger = logging.getLogger(__name__)

# Industry list for classification
INDUSTRIES = [
    "IT", "Healthcare", "Finance", "Marketing", "Sales",
    "Construction", "Manufacturing", "Education", "Legal",
    "Hospitality", "Retail", "Operations", "General"
]


async def extract_skill_metadata(
    skill: str,
    context: str = "",
) -> dict:
    """
    Extract skill metadata using LLM.
    Used during INGESTION phase, not scoring.
    
    Returns: {"category": str, "type": "technical/soft/tool/domain"}
    """
    prompt = f"""\
Classify this skill for recruitment:

Skill: {skill}
Context: {context or "Professional work"}

Respond with ONLY JSON:
{{
  "category": "IT|Healthcare|Finance|Marketing|Sales|General",
  "type": "technical|soft|tool|domain_knowledge"
}}
"""
    
    try:
        response = await call_llm(prompt, model="mistral", max_tokens=100)
        result = json.loads(response)
        return {
            "category": result.get("category", "General"),
            "type": result.get("type", "technical"),
        }
    except Exception as e:
        logger.debug(f"Skill metadata extraction failed for {skill}: {e}")
        return {"category": "General", "type": "technical"}


async def detect_industry(
    text: str,
    skills: list[str],
) -> dict:
    """
    Detect industry from job description or CV.
    Used during INGESTION, not scoring.
    """
    skills_text = ", ".join(skills[:10])
    
    prompt = f"""\
Determine the industry from this profile:

Text: {text[:500]}
Skills: {skills_text}

Choose from: {', '.join(INDUSTRIES)}

Respond with ONLY JSON:
{{
  "industry": "one of the listed industries",
  "confidence": 0.0-1.0
}}
"""
    
    try:
        response = await call_llm(prompt, model="mistral", max_tokens=100)
        result = json.loads(response)
        industry = result.get("industry", "General")
        if industry not in INDUSTRIES:
            industry = "General"
        return {
            "industry": industry,
            "confidence": max(0.0, min(1.0, float(result.get("confidence", 0.7)))),
        }
    except Exception as e:
        logger.debug(f"Industry detection failed: {e}")
        return {"industry": "General", "confidence": 0.5}


__all__ = [
    "extract_skill_metadata",
    "detect_industry",
    "INDUSTRIES",
]
