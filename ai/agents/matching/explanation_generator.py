"""
explanation_generator.py

V3 Translator: Converts mathematical matching data into professional, 
grounded, and structured explanations.

RULES:
1. Factual and grounded in data.
2. Fixed 4-part structure.
3. LLM only formats the explanation, it does NOT decide scores.
"""
from __future__ import annotations
import json
import logging
from typing import Dict, List, Any, Optional

from api.utils import call_llm

logger = logging.getLogger(__name__)

class ExplanationGenerator:
    """Translates matching math into human reasoning."""
    
    def __init__(self):
        pass  # Use call_llm directly

    async def generate_v3_explanation(
        self,
        match_result: Dict[str, Any],
        candidate_profile: Dict[str, Any],
        confidence_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Main entry point for grounded explanation.
        """
        # 1. Prepare Grounded Data Bundle
        data_bundle = {
            "final_score": match_result.get("score", 0),
            "category_scores": match_result.get("category_scores", {}),
            "matches": [
                {
                    "req": m["requirement"],
                    "coverage": m["coverage"],
                    "evidence": m.get("evidence"),
                    "importance": m.get("importance", 1.0)
                }
                for m in match_result.get("matches", [])
            ],
            "confidence": confidence_data.get("confidence", "MEDIUM"),
            "confidence_reasons": confidence_data.get("confidence_reasons", [])
        }

        # 2. Build Structured Prompt
        prompt = f"""As a hiring expert, translate this mathematical matching data into a professional 4-part structured explanation.

DATA BUNDLE:
{json.dumps(data_bundle, indent=2)}

RULES:
- ONLY use the data above. DO NOT invent skills or experience.
- Be factual and objective.
- Use the exact JSON format below.

REQUIRED JSON FORMAT:
{{
  "summary": "One sentence decision-oriented summary",
  "strengths": ["List of requirements with high coverage (>0.75) and their evidence"],
  "gaps": ["List of requirements with low coverage (<0.40) or missing evidence"],
  "interpretation": "One sentence explaining why the score is not higher (e.g. missing skills, low coverage)",
  "confidence_explanation": "One sentence explaining the trust level based on confidence_reasons",
  "recommendation": "One sentence actionable recommendation (Proceed, Review Gaps, or Reject)",
  "improvement_suggestion": "One specific skill or area to improve to increase this score"
}}

Return ONLY the JSON object."""

        try:
            response = await call_llm(prompt)
            # Find and parse JSON
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            if json_start != -1 and json_end != -1:
                explanation = json.loads(response[json_start:json_end])
                return explanation
        except Exception as e:
            logger.error(f"Failed to generate V3 explanation: {e}")
        
        # Fallback
        return {
            "summary": "Match calculated via vector similarity.",
            "strengths": ["Data-driven matching completed"],
            "gaps": ["Detailed breakdown unavailable"],
            "interpretation": "Score represents mathematical proximity in vector space.",
            "confidence_explanation": "Standard confidence based on parsing.",
            "recommendation": "Review candidate profile.",
            "improvement_suggestion": "Consult full CV for specifics."
        }

def format_explanation(explanation: Dict[str, Any]) -> str:
    """Formats the JSON explanation into a readable text block."""
    text = f"SUMMARY: {explanation.get('summary', '')}\n\n"
    text += "STRENGTHS:\n" + "\n".join([f"- {s}" for s in explanation.get("strengths", [])]) + "\n\n"
    text += "GAPS:\n" + "\n".join([f"- {g}" for g in explanation.get("gaps", [])]) + "\n\n"
    text += f"INTERPRETATION: {explanation.get('interpretation', '')}\n"
    text += f"CONFIDENCE: {explanation.get('confidence_explanation', '')}\n"
    text += f"RECOMMENDATION: {explanation.get('recommendation', '')}\n"
    if explanation.get("improvement_suggestion"):
        text += f"IMPROVEMENT: {explanation.get('improvement_suggestion', '')}"
    return text
