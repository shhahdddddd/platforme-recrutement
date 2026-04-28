"""
matching_agent_v2.py

V3 MATCHING AGENT: The Production Choice
Logic: Vector Similarity + Structured Scoring + Calibration
Workflow:
1. Extraction (JD Requirements & Candidate Evidence)
2. Dynamic Weighting (Extracted from JD)
3. Vector Matching (Evidence-based coverage)
4. Confidence & Seniority scoring
5. Grounded Explanation Generation
"""
from __future__ import annotations
import logging
import asyncio
from datetime import datetime
from typing import Dict, List, Any

from .chroma_store import VectorStore
from .llm_extractor import MatchingLLMExtractor
from .universal_matcher import match_universal, calibrate_hiring_probability
from .confidence_scorer import ConfidenceScorer
from .seniority_matcher import match_seniority_simple
from .explanation_generator import ExplanationGenerator

logger = logging.getLogger(__name__)

PIPELINE_VERSION = "v3.0.0"

class UniversalMatchingAgent:
    """The unified decision support system for recruitment matching."""

    def __init__(self, vector_store: VectorStore) -> None:
        self.vector_store = vector_store
        self.llm_extractor = MatchingLLMExtractor()
        self.confidence_scorer = ConfidenceScorer()
        self.explanation_gen = ExplanationGenerator()

    async def match(
        self,
        job_profile: Dict[str, Any],
        job_embedding: List[float] | None,
        job_description: str = "",
        top_k: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Main matching pipeline.
        """
        if self.vector_store.count() == 0:
            return []

        candidates = self.vector_store.search(job_embedding, top_k=top_k)
        if not candidates:
            return []

        # 1. ANALYZE JOB (Once per job)
        desc = job_description or job_profile.get("description", "")
        job_requirements = await self.llm_extractor.extract_job_requirements(desc, job_profile)
        job_context = await self.llm_extractor.extract_job_context(job_profile, desc)
        dynamic_weights = await self.llm_extractor.calculate_dynamic_weights(desc)
        
        job_skill_embeddings = job_profile.get("skill_embeddings", {})

        results = []
        for cand in candidates:
            profile = cand["profile"]
            
            # 2. EXTRACT CANDIDATE EVIDENCE (If not already cached in profile)
            candidate_evidence = await self.llm_extractor.extract_candidate_evidence(
                profile.get("raw_text", ""), profile
            )
            candidate_skill_embeddings = profile.get("skill_embeddings", {})

            # 3. CORE VECTOR MATCHING (Requirement-Level)
            match_result = match_universal(
                job_requirements=job_requirements,
                candidate_items=candidate_evidence,
                job_embeddings=job_skill_embeddings,
                candidate_embeddings=candidate_skill_embeddings,
                category_weights=dynamic_weights
            )

            # 4. CALIBRATION & ANCILLARY SCORING
            calibration_prob = calibrate_hiring_probability(
                score=match_result["score"],
                gate_status=match_result["gate_status"],
                category_scores=match_result["category_scores"]
            )
            
            confidence_data = self.confidence_scorer.calculate_confidence(profile)
            
            seniority_result = match_seniority_simple(
                required_years=int(job_context.get("required_years", 3)),
                candidate_profile=profile
            )

            # 5. GROUNDED EXPLANATION (Translation of Math)
            explanation = await self.explanation_gen.generate_v3_explanation(
                match_result, profile, confidence_data
            )

            # BUILD FINAL PRODUCTION OBJECT
            result = {
                "candidate_id": profile.get("id"),
                "name": profile.get("name", "Unknown"),
                "final_score": match_result["score"],
                "uncertainty": match_result.get("uncertainty", 0.0),
                "p_hire": calibration_prob.get("P_hire", 0),
                
                "metadata": {
                    "pipeline_version": PIPELINE_VERSION,
                    "scored_at": datetime.now().isoformat(),
                    "weights_applied": dynamic_weights,
                    "confidence": confidence_data
                },
                
                "match_details": {
                    "category_scores": match_result["category_scores"],
                    "requirements": match_result["matches"], # contains coverage + evidence
                    "seniority": seniority_result
                },
                
                "explanation": explanation, # Structured 4-part JSON
                "recommendation": explanation.get("recommendation", "Review required")
            }
            
            results.append(result)

        results.sort(key=lambda x: x["final_score"], reverse=True)
        return results

# Aliases
EnhancedMatchingAgent = UniversalMatchingAgent
MatchingAgent = UniversalMatchingAgent
