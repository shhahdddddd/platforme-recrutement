"""
feedback_loop.py

Adaptive learning loop for the matching system. Stores recruiter feedback
via Django Models and adjusts matching weights based on successful hires.
"""

from __future__ import annotations
import logging
from typing import Dict, Any
from api.models import MatchingFeedback, WeightBias
from django.db.models import Avg

logger = logging.getLogger(__name__)

def store_feedback(candidate_id: int, job_id: int, decision: str, scores: Dict[str, float]):
    """
    Step 1: Store recruiter feedback in SQL Database.
    Replaces corruptible JSON storage.
    """
    try:
        MatchingFeedback.objects.create(
            candidate_id=candidate_id,
            job_id=job_id,
            decision=decision,
            scores=scores
        )
        logger.info("Stored feedback in DB for candidate %s, job %s (Decision: %s)", candidate_id, job_id, decision)
        
        # Trigger an optimization check
        optimize_weights()
    except Exception as e:
        logger.error("Failed to store feedback in DB: %s", e)

def optimize_weights():
    """
    Step 2: Recalculate biases based on hiring patterns.
    """
    try:
        hired = MatchingFeedback.objects.filter(decision='hired')
        if not hired.exists():
            return
            
        # Example logic: Adjust biases based on average scores of hires
        # This is a simplified version of the logic
        avg_skill = hired.aggregate(avg=Avg('scores__skill'))['avg'] or 0.0
        avg_exp = hired.aggregate(avg=Avg('scores__experience'))['avg'] or 0.0
        
        # We only update if we have a significant move
        bias, _ = WeightBias.objects.get_or_create(id=1)
        bias.skill_bias = round(avg_skill - 0.5, 2)
        bias.experience_bias = round(avg_exp - 0.5, 2)
        bias.save()
        
        logger.info("Learning loop: Updated DB WeightBiases (Skill: %.2f, Exp: %.2f)", bias.skill_bias, bias.experience_bias)
    except Exception as e:
        logger.error("Weight optimization failed: %s", e)

def get_optimized_weights() -> Dict[str, float]:
    """Retrieve optimized biases from the database."""
    try:
        bias = WeightBias.objects.get(id=1)
        return {
            "skill_weight_bias": bias.skill_bias,
            "experience_weight_bias": bias.experience_bias
        }
    except WeightBias.DoesNotExist:
        return {}
