"""
FAST ENGINE: Real-time matching without LLM calls
Target: < 300ms per candidate

LAYER 1 — FAST ENGINE (NO LLM)
- Precomputed embeddings
- Cosine similarity
- Deterministic scoring
- Ranking
"""
import logging
import numpy as np
from typing import Dict, List, Any, Tuple
from sklearn.metrics.pairwise import cosine_similarity

from .chroma_store import VectorStore
from .scoring_engine import compute_final_score, calculate_risk_factors

logger = logging.getLogger(__name__)


class FastMatchingEngine:
    """
    High-speed matching engine (NO LLM calls).
    
    Flow:
    1. Load precomputed CV embedding from ChromaDB
    2. Load precomputed JD embedding from cache/DB
    3. Compute cosine similarity
    4. Match skills deterministically
    5. Calculate score
    6. Return result (< 300ms)
    """
    
    def __init__(self):
        self.vector_store = VectorStore()
    
    async def match_candidate_fast(
        self,
        candidate_id: str,
        job_id: int,
        job_requirements: Dict[str, Any],
        job_embedding: List[float],
    ) -> Dict[str, Any]:
        """
        Fast matching for a single candidate.
        
        Args:
            candidate_id: ID from database
            job_id: Job offer ID
            job_requirements: Structured requirements from cached JD
            job_embedding: Precomputed job embedding vector
            
        Returns:
            Match result with score, skills, and risk assessment
        """
        try:
            # 1. FETCH PRECOMPUTED CV EMBEDDING
            cv_data = self._fetch_cv_embedding(candidate_id)
            if not cv_data:
                return {
                    "success": False,
                    "error": f"CV embedding not found for candidate {candidate_id}",
                    "score": 0.0,
                }
            
            cv_embedding = cv_data["embedding"]
            cv_profile = cv_data["profile"]
            
            # 2. SEMANTIC SIMILARITY (Math only - no LLM)
            semantic_score = self._compute_similarity(cv_embedding, job_embedding)
            
            # 3. SKILL MATCHING (Deterministic - no LLM)
            skill_matches = self._match_skills_deterministic(
                job_requirements.get("skills", []),
                cv_profile.get("skills", [])
            )
            
            # 4. EXPERIENCE MATCHING
            exp_score = self._match_experience(
                job_requirements.get("experience_years", 0),
                cv_profile.get("total_experience_years", 0)
            )
            
            # 5. EDUCATION MATCHING
            edu_score = self._match_education(
                job_requirements.get("education_level", None),
                cv_profile.get("education", [])
            )
            
            # 6. RISK ASSESSMENT
            risk_factors = calculate_risk_factors(
                skill_matches["missing_critical"],
                exp_score,
                edu_score
            )
            
            # 7. FINAL SCORE
            final_score = compute_final_score(
                semantic_score=semantic_score,
                skill_coverage=skill_matches["coverage"],
                experience_score=exp_score,
                education_score=edu_score,
                weights={"semantic": 0.3, "skills": 0.4, "experience": 0.2, "education": 0.1}
            )
            
            return {
                "success": True,
                "score": final_score,
                "semantic_score": semantic_score,
                "skill_coverage": skill_matches["coverage"],
                "matched_skills": skill_matches["matched"],
                "missing_skills": skill_matches["missing"],
                "missing_critical": skill_matches["missing_critical"],
                "experience_score": exp_score,
                "education_score": edu_score,
                "risk": risk_factors,
                "confidence": cv_data.get("confidence", 0.85),
                "candidate_profile": cv_profile,
            }
            
        except Exception as e:
            logger.error(f"Fast matching failed for candidate {candidate_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "score": 0.0,
            }
    
    def _fetch_cv_embedding(self, candidate_id: str) -> Dict[str, Any]:
        """Fetch precomputed CV embedding from ChromaDB."""
        try:
            # Primary: modern vector-store API.
            result = self.vector_store.get_candidate(candidate_id)
            if result and result.get("embedding") is not None:
                metadata = result.get("metadata") or {}
                profile = result.get("profile")
                if not isinstance(profile, dict) or not profile:
                    profile = metadata.get("profile")
                if not isinstance(profile, dict):
                    profile = {}
                return {
                    "embedding": result.get("embedding"),
                    "profile": profile,
                    "confidence": metadata.get("confidence", 0.85)
                }

            # Fallback: legacy API shape.
            legacy = self.vector_store.get_by_candidate_id(candidate_id)
            if legacy:
                metadata = legacy.get("metadata") or {}
                profile = metadata.get("profile")
                if not isinstance(profile, dict):
                    profile = {}
                return {
                    "embedding": legacy.get("embedding"),
                    "profile": profile,
                    "confidence": metadata.get("confidence", 0.85)
                }
        except Exception as e:
            logger.warning(f"Could not fetch CV embedding for {candidate_id}: {e}")
        return None
    
    def _compute_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Compute cosine similarity between two vectors."""
        try:
            v1 = np.array(vec1).reshape(1, -1)
            v2 = np.array(vec2).reshape(1, -1)
            return float(cosine_similarity(v1, v2)[0][0])
        except Exception:
            return 0.0
    
    def _match_skills_deterministic(
        self,
        job_skills: List[str],
        cv_skills: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Deterministic skill matching (NO LLM).
        
        Uses token overlap + semantic similarity with safety filter.
        """
        matched = []
        missing = []
        missing_critical = []
        
        cv_skill_names = {
            s["name"].lower() if isinstance(s, dict) else s.lower(): s
            for s in cv_skills
        }
        
        for job_skill in job_skills:
            skill_name = job_skill.lower() if isinstance(job_skill, str) else job_skill.get("name", "").lower()
            is_critical = job_skill.get("critical", False) if isinstance(job_skill, dict) else False
            
            # Check exact match or substring
            found = False
            for cv_name, cv_skill in cv_skill_names.items():
                if self._skills_match(skill_name, cv_name):
                    matched.append({
                        "job_skill": skill_name,
                        "cv_skill": cv_name,
                        "cv_data": cv_skill
                    })
                    found = True
                    break
            
            if not found:
                missing.append(skill_name)
                if is_critical:
                    missing_critical.append(skill_name)
        
        coverage = len(matched) / len(job_skills) if job_skills else 0.0
        
        return {
            "matched": matched,
            "missing": missing,
            "missing_critical": missing_critical,
            "coverage": coverage
        }
    
    def _skills_match(self, skill_a: str, skill_b: str) -> bool:
        """
        Check if two skills match with semantic safety filter.
        
        Prevents false positives like:
        - Java ≈ JavaScript
        - Python ≈ PythonScript
        """
        skill_a = skill_a.lower().strip()
        skill_b = skill_b.lower().strip()
        
        # Exact match
        if skill_a == skill_b:
            return True
        
        # One contains the other (e.g., "React" in "React.js")
        if skill_a in skill_b or skill_b in skill_a:
            # Safety check: don't match if they're clearly different technologies
            # e.g., "Java" should not match "JavaScript"
            if self._has_token_overlap(skill_a, skill_b):
                return True
        
        return False
    
    def _has_token_overlap(self, str1: str, str2: str) -> bool:
        """Check if two strings share meaningful token overlap."""
        # Extract words
        words1 = set(str1.replace(".", " ").replace("-", " ").split())
        words2 = set(str2.replace(".", " ").replace("-", " ").split())
        
        # Must have at least one meaningful word overlap
        meaningful_words = words1 & words2
        # Filter out very short words
        meaningful_words = {w for w in meaningful_words if len(w) >= 3}
        
        return len(meaningful_words) > 0
    
    def _match_experience(self, required_years: int, actual_years: Any) -> float:
        """Score experience match."""
        if not required_years or required_years <= 0:
            return 1.0  # No requirement
        
        if not actual_years:
            return 0.0
        
        actual = float(actual_years) if actual_years else 0
        
        if actual >= required_years:
            return 1.0
        elif actual >= required_years * 0.8:
            return 0.8
        elif actual >= required_years * 0.5:
            return 0.5
        else:
            return actual / required_years if required_years > 0 else 0
    
    def _match_education(
        self,
        required_level: str,
        cv_education: List[Dict[str, Any]]
    ) -> float:
        """Score education match."""
        if not required_level:
            return 1.0  # No requirement
        
        if not cv_education:
            return 0.0
        
        # Simple level matching
        levels = ["high school", "associate", "bachelor", "master", "phd", "doctorate"]
        required_idx = self._get_education_index(required_level.lower())
        
        best_match = 0.0
        for edu in cv_education:
            level = edu.get("degree", "").lower() if isinstance(edu, dict) else str(edu).lower()
            edu_idx = self._get_education_index(level)
            
            if edu_idx >= required_idx:
                return 1.0
            elif edu_idx >= 0:
                best_match = max(best_match, edu_idx / required_idx if required_idx > 0 else 0)
        
        return best_match
    
    def _get_education_index(self, level: str) -> int:
        """Get education level index for comparison."""
        level = level.lower()
        if "phd" in level or "doctorate" in level or "doctoral" in level:
            return 5
        if "master" in level or "mba" in level or "msc" in level or "ma" in level:
            return 4
        if "bachelor" in level or "bs" in level or "ba" in level or "b." in level or "bsc" in level:
            return 3
        if "associate" in level:
            return 2
        if "high school" in level or "secondary" in level:
            return 1
        return -1  # Unknown
    
    async def batch_match_candidates(
        self,
        candidate_ids: List[str],
        job_id: int,
        job_requirements: Dict[str, Any],
        job_embedding: List[float],
    ) -> List[Dict[str, Any]]:
        """
        Parallel batch matching for multiple candidates.
        
        Args:
            candidate_ids: List of candidate IDs to match
            job_id: Job offer ID
            job_requirements: Cached job requirements
            job_embedding: Precomputed job embedding
            
        Returns:
            List of match results (sorted by score descending)
        """
        import asyncio
        
        # Create all match tasks
        tasks = [
            self.match_candidate_fast(cid, job_id, job_requirements, job_embedding)
            for cid in candidate_ids
        ]
        
        # Execute all in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out errors and sort by score
        valid_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Batch match failed for candidate {candidate_ids[i]}: {result}")
                valid_results.append({
                    "success": False,
                    "candidate_id": candidate_ids[i],
                    "score": 0.0,
                    "error": str(result)
                })
            else:
                result["candidate_id"] = candidate_ids[i]
                valid_results.append(result)
        
        # Sort by score descending
        valid_results.sort(key=lambda x: x.get("score", 0), reverse=True)
        
        return valid_results
