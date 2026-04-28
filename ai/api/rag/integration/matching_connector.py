"""
matching_connector.py

Connects Matching Agent output to RAG quiz generation.

Uses candidate weakness analysis to generate targeted assessment questions.
"""

from typing import Dict, List, Any, Optional
import logging

logger = logging.getLogger(__name__)


class MatchingRAGConnector:
    """
    Bridges Matching Agent ↔ RAG Quiz Generation
    
    Flow:
    1. Matching Agent scores candidate
    2. Identify weak/missing skills
    3. Generate focused quiz on those gaps
    """
    
    def __init__(self):
        self._weakness_cache: Dict[str, List[str]] = {}
    
    def extract_weak_skills_from_match(
        self,
        match_result: Dict[str, Any],
        skill_threshold: float = 0.6
    ) -> List[str]:
        """
        Extract skills below threshold from matching result.
        
        Args:
            match_result: Output from matching agent
            skill_threshold: Score below which is considered weak
        
        Returns:
            List of weak skill names to focus quiz on
        """
        weak_skills = []
        
        # Extract from skill scores
        skill_scores = match_result.get("skill_scores", {})
        for skill, score in skill_scores.items():
            if isinstance(score, (int, float)) and score < skill_threshold:
                weak_skills.append(skill)
        
        # Extract from explanation
        explanation = match_result.get("explanation", {})
        missing = explanation.get("missing_skills", [])
        weak_skills.extend(missing)
        
        # Deduplicate
        return list(set(weak_skills))
    
    def build_focused_quiz_config(
        self,
        job_description: str,
        job_title: str,
        weak_skills: List[str],
        candidate_level: str = "mid"
    ) -> Dict[str, Any]:
        """
        Build quiz configuration focused on candidate weaknesses.
        
        This overrides default skill extraction with targeted skills.
        """
        return {
            "job_title": job_title,
            "job_description": job_description,
            "seniority_level": candidate_level,
            "target_skills": weak_skills,  # 🔥 Override: focus on weaknesses
            "skill_focus_mode": True,  # Signal to use provided skills
            "min_questions_per_skill": 2,  # Ensure coverage
            "difficulty_adjustment": "adaptive"  # Adjust based on weakness severity
        }
    
    def create_skill_priority_queue(
        self,
        required_skills: List[str],
        candidate_skills: List[str],
        match_scores: Dict[str, float]
    ) -> List[Dict[str, Any]]:
        """
        Create prioritized skill list for quiz generation.
        
        Priority order:
        1. Required but missing skills (highest priority)
        2. Required but weak skills (medium priority)
        3. Required and strong skills (low priority - verify)
        """
        prioritized = []
        
        required_set = set(required_skills)
        candidate_set = set(candidate_skills)
        
        # 1. Missing skills (critical gap)
        missing = required_set - candidate_set
        for skill in missing:
            prioritized.append({
                "skill": skill,
                "priority": "critical",
                "reason": "missing_from_cv",
                "match_score": 0.0,
                "questions_needed": 3  # Thorough assessment
            })
        
        # 2. Weak skills (needs improvement)
        for skill in required_set & candidate_set:
            score = match_scores.get(skill, 0.5)
            if score < 0.6:
                prioritized.append({
                    "skill": skill,
                    "priority": "high",
                    "reason": "low_match_score",
                    "match_score": score,
                    "questions_needed": 2
                })
            elif score < 0.8:
                prioritized.append({
                    "skill": skill,
                    "priority": "medium",
                    "reason": "moderate_match",
                    "match_score": score,
                    "questions_needed": 1
                })
            else:
                prioritized.append({
                    "skill": skill,
                    "priority": "low",
                    "reason": "strong_match",
                    "match_score": score,
                    "questions_needed": 1  # Verification only
                })
        
        # Sort by priority
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        prioritized.sort(key=lambda x: priority_order.get(x["priority"], 4))
        
        return prioritized
    
    def generate_personalized_quiz_prompt(
        self,
        candidate_name: str,
        job_title: str,
        weak_skills: List[str],
        strong_skills: List[str]
    ) -> str:
        """
        Generate personalized context for quiz generation.
        
        Adds candidate-specific constraints to the prompt.
        """
        sections = [
            f"CANDIDATE: {candidate_name}",
            f"POSITION: {job_title}",
            ""
        ]
        
        if weak_skills:
            sections.append(
                f"FOCUS ASSESSMENT AREAS (candidate shows weakness in):\n"
                f"- " + "\n- ".join(weak_skills)
            )
        
        if strong_skills:
            sections.append(
                f"\nALREADY VERIFIED (no need to test heavily):\n"
                f"- " + "\n- ".join(strong_skills)
            )
        
        sections.append(
            f"\nINSTRUCTION: Generate questions that help determine "
            f"if candidate can overcome their skill gaps in: {', '.join(weak_skills)}"
        )
        
        return "\n".join(sections)
    
    def cache_candidate_weaknesses(
        self,
        candidate_id: str,
        weak_skills: List[str]
    ):
        """Cache weaknesses for reuse in quiz sessions."""
        self._weakness_cache[candidate_id] = weak_skills
        logger.info(f"Cached weaknesses for candidate {candidate_id}: {weak_skills}")
    
    def get_cached_weaknesses(self, candidate_id: str) -> Optional[List[str]]:
        """Retrieve cached weaknesses."""
        return self._weakness_cache.get(candidate_id)


# Global connector instance
matching_connector = MatchingRAGConnector()


def build_integrated_quiz_pipeline(
    candidate_profile: Dict[str, Any],
    job_requirements: Dict[str, Any],
    match_scores: Dict[str, float]
) -> Dict[str, Any]:
    """
    High-level function to integrate matching → quiz generation.
    
    Returns complete quiz configuration ready for RAG pipeline.
    """
    connector = MatchingRAGConnector()
    
    # Extract skills
    required = job_requirements.get("required_skills", [])
    candidate = candidate_profile.get("skills", [])
    
    # Build priority queue
    prioritized = connector.create_skill_priority_queue(
        required_skills=required,
        candidate_skills=candidate,
        match_scores=match_scores
    )
    
    # Extract weak skills for focus
    weak_skills = [s["skill"] for s in prioritized if s["priority"] in ("critical", "high")]
    
    # Build config
    config = connector.build_focused_quiz_config(
        job_description=job_requirements.get("description", ""),
        job_title=job_requirements.get("title", ""),
        weak_skills=weak_skills,
        candidate_level=candidate_profile.get("experience_level", "mid")
    )
    
    # Add full priority info
    config["skill_priority_queue"] = prioritized
    
    return config
