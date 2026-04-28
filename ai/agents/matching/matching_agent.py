from __future__ import annotations
import logging
import numpy as np
from .chroma_store import VectorStore
from .skill_matcher import match_skills
from .degree_matcher import match_degrees
from .experience_matcher import match_experience
from .seniority_matcher import match_seniority

logger = logging.getLogger(__name__)

# Simplified scoring - no hard penalties, clean weighted composition

# Industry-specific configs removed in favor of V3 Dynamic Weighting


class MatchingAgent:
    """Orchestrates multi-pillar semantic matching with Reasoning Layer."""

    def __init__(self, vector_store: VectorStore) -> None:
        self.vector_store = vector_store

    def add_candidate(self, candidate_id: str | int, embedding: list[float], cv_hash: str, profile: dict) -> None:
        """
        Public entry point for the Intelligence Layer upsert.
        Ensures the persistent VectorStore stays synchronized.
        """
        self.vector_store.add_or_update_candidate(candidate_id, embedding, cv_hash, profile)

    async def match(
        self,
        job_profile: dict,
        job_embedding: list[float] | None,
        top_k: int = 50,
        offer_type: str = "job",
    ) -> list[dict]:
        """Rank candidates with Dynamic Industry Weights and Reasoning."""
        if self.vector_store.count() == 0:
            return []

        candidates = self.vector_store.search(job_embedding, top_k=top_k)
        if not candidates: return []

    async def match_core(
        self,
        job_profile: dict,
        candidate_profile: dict,
        weights: dict
    ) -> dict:
        """
        🧠 INTELLIGENCE LAYER: Semantic Core Matching.
        Pure scoring logic - no LLM tasks here.
        """
        job_skills = job_profile.get("skills", [])
        cand_skills = candidate_profile.get("skills", [])
        
        # 1. Semantic Skill Match (SINGLE SOURCE OF TRUTH)
        skill_result = match_skills(
            job_skills=job_skills,
            job_skill_vectors=job_profile.get("skill_embeddings") or {},
            candidate_skills=cand_skills,
            candidate_skill_vectors=candidate_profile.get("skill_embeddings") or {},
        )
        
        # 2. Experience Alignment
        exp_result = match_experience(job_profile, candidate_profile)
        
        # 3. Education Verification
        degree_result = match_degrees(
            required_degrees=job_profile.get("required_degrees", []),
            candidate_education=candidate_profile.get("education", []),
            is_required=job_profile.get("degree_required", False),
        )
        
        # Clean Weighted Composition
        raw_score = (
            (skill_result["score"] * weights.get("skills", 0.4)) +
            (exp_result["score"] * weights.get("experience", 0.4)) +
            (degree_result["score"] * weights.get("education", 0.2))
        )
        
        return {
            "raw_score": round(float(raw_score), 4),
            "skill_score": skill_result["score"],
            "experience_score": exp_result["score"],
            "education_score": degree_result["score"],
            "matched_skills": skill_result["matched_skills"],
            "missing_skills": skill_result["missing_skills"],
            "failed_critical": degree_result["score"] < 0.5 if job_profile.get("degree_required") else False
        }
