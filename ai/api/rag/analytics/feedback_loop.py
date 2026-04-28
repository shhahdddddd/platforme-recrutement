"""
feedback_loop.py

Quiz performance analytics with learning loop for continuous improvement.

Tracks:
- Question difficulty calibration
- Skill coverage gaps
- Generation quality metrics
"""

from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


@dataclass
class QuestionAnalytics:
    """Analytics for a single question's performance."""
    question_id: str
    skill_tested: str
    difficulty: str
    times_asked: int = 0
    correct_count: int = 0
    wrong_count: int = 0
    avg_time_seconds: float = 0.0
    
    @property
    def success_rate(self) -> float:
        total = self.correct_count + self.wrong_count
        if total == 0:
            return 0.5  # Unknown
        return self.correct_count / total
    
    @property
    def is_too_hard(self) -> bool:
        """Question is too hard if < 30% success rate after 10+ attempts."""
        return self.times_asked >= 10 and self.success_rate < 0.3
    
    @property
    def is_too_easy(self) -> bool:
        """Question is too easy if > 90% success rate after 10+ attempts."""
        return self.times_asked >= 10 and self.success_rate > 0.9
    
    @property
    def calibration_status(self) -> str:
        if self.is_too_hard:
            return "too_hard"
        elif self.is_too_easy:
            return "too_easy"
        elif 0.4 <= self.success_rate <= 0.8:
            return "well_calibrated"
        return "needs_more_data"


class QuizFeedbackLoop:
    """
    Learning loop for quiz generation improvement.
    
    Uses QuizAnswer data to:
    1. Calibrate question difficulty
    2. Identify skill coverage gaps
    3. Improve future generation prompts
    """
    
    def __init__(self):
        self._analytics_cache: Dict[str, QuestionAnalytics] = {}
    
    def record_answer(
        self,
        question_id: str,
        skill_tested: str,
        difficulty: str,
        is_correct: bool,
        time_seconds: float
    ):
        """Record a quiz answer for analytics."""
        if question_id not in self._analytics_cache:
            self._analytics_cache[question_id] = QuestionAnalytics(
                question_id=question_id,
                skill_tested=skill_tested,
                difficulty=difficulty
            )
        
        analytics = self._analytics_cache[question_id]
        analytics.times_asked += 1
        
        if is_correct:
            analytics.correct_count += 1
        else:
            analytics.wrong_count += 1
        
        # Update average time
        n = analytics.times_asked
        analytics.avg_time_seconds = (
            (analytics.avg_time_seconds * (n - 1) + time_seconds) / n
        )
        
        # Log calibration issues
        status = analytics.calibration_status
        if status == "too_hard":
            logger.warning(f"Question {question_id} is too hard ({analytics.success_rate:.0%} success)")
        elif status == "too_easy":
            logger.warning(f"Question {question_id} is too easy ({analytics.success_rate:.0%} success)")
    
    def get_skill_coverage_report(self) -> Dict[str, Dict]:
        """Get coverage analysis for all skills."""
        skill_stats: Dict[str, Dict] = {}
        
        for qa in self._analytics_cache.values():
            skill = qa.skill_tested
            if skill not in skill_stats:
                skill_stats[skill] = {
                    "questions": 0,
                    "avg_success_rate": 0.0,
                    "difficulties": set()
                }
            
            stats = skill_stats[skill]
            stats["questions"] += 1
            stats["difficulties"].add(qa.difficulty)
        
        # Calculate averages
        for skill, stats in skill_stats.items():
            related = [qa for qa in self._analytics_cache.values() 
                      if qa.skill_tested == skill]
            if related:
                stats["avg_success_rate"] = sum(r.success_rate for r in related) / len(related)
            stats["difficulties"] = list(stats["difficulties"])
        
        return skill_stats
    
    def get_underrepresented_skills(self, target_skills: List[str]) -> List[str]:
        """Identify skills that need more question coverage."""
        coverage = self.get_skill_coverage_report()
        underrepresented = []
        
        for skill in target_skills:
            if skill not in coverage:
                underrepresented.append(skill)  # No questions at all
            elif coverage[skill]["questions"] < 3:
                underrepresented.append(skill)  # Not enough variety
        
        return underrepresented
    
    def get_generation_adjustments(self) -> Dict:
        """Get adjustments for next generation cycle."""
        adjustments = {
            "avoid_questions": [],  # Too hard/easy
            "focus_skills": [],     # Underrepresented
            "difficulty_bias": {}   # Adjust difficulty per skill
        }
        
        for qa in self._analytics_cache.values():
            # Mark poorly calibrated questions
            if qa.calibration_status in ("too_hard", "too_easy"):
                adjustments["avoid_questions"].append(qa.question_id)
            
            # Suggest difficulty adjustments
            if qa.is_too_hard:
                adjustments["difficulty_bias"][qa.skill_tested] = "easier"
            elif qa.is_too_easy:
                adjustments["difficulty_bias"][qa.skill_tested] = "harder"
        
        return adjustments
    
    def generate_feedback_prompt(self) -> str:
        """Generate prompt section based on historical performance."""
        adjustments = self.get_generation_adjustments()
        
        sections = []
        
        if adjustments["avoid_questions"]:
            sections.append(
                f"AVOID generating questions similar to these poorly calibrated IDs: "
                f"{', '.join(adjustments['avoid_questions'][:5])}"
            )
        
        if adjustments["difficulty_bias"]:
            bias_str = "\n".join([
                f"- {skill}: make questions {bias}"
                for skill, bias in adjustments["difficulty_bias"].items()
            ])
            sections.append(f"DIFFICULTY ADJUSTMENTS:\n{bias_str}")
        
        return "\n\n".join(sections) if sections else ""


# Global instance
feedback_loop = QuizFeedbackLoop()


def analyze_candidate_weaknesses(
    candidate_skills: List[str],
    correct_answers: List[str],
    wrong_answers: List[str]
) -> List[str]:
    """
    Identify skill weaknesses from quiz performance.
    
    Used to connect Matching Agent → RAG quiz generation.
    """
    weaknesses = []
    
    # Count failures per skill
    failure_counts: Dict[str, int] = {}
    for question_id in wrong_answers:
        # In real implementation, lookup skill from question_id
        # For now, use placeholder logic
        skill = question_id.split("_")[0] if "_" in question_id else "unknown"
        failure_counts[skill] = failure_counts.get(skill, 0) + 1
    
    # Skills with > 50% failure rate are weaknesses
    for skill in candidate_skills:
        correct = sum(1 for q in correct_answers if skill in q)
        wrong = failure_counts.get(skill, 0)
        total = correct + wrong
        
        if total > 0 and wrong / total > 0.5:
            weaknesses.append(skill)
    
    return weaknesses
