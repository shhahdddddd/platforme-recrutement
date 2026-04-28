import logging
import numpy as np
from typing import Dict, List, Any, Tuple, Optional
from sklearn.metrics.pairwise import cosine_similarity
from rapidfuzz import fuzz

from .chroma_store import VectorStore
from .scoring_engine import compute_final_score, calculate_risk_factors
from ..ingestion.embedding import EmbeddingService

logger = logging.getLogger(__name__)


class FastMatchingEngineV2:
    """
    Ultra-fast matching with NO hardcoded thresholds.
    Uses percentile-based scoring and embedding similarity.
    """
    
    def __init__(self):
        self.vector_store = VectorStore()
        self.embedder = EmbeddingService()
        # Cache for skill embeddings (to avoid recomputing)
        self._skill_embedding_cache: Dict[str, List[float]] = {}
        self._missing_skill_embedding_warnings: set[str] = set()
    
    async def match_candidate(
        self,
        candidate_id: str,
        job_id: int,
        job_requirements: Dict[str, Any],
        job_embedding: List[float],
    ) -> Dict[str, Any]:
        """
        Match a candidate against a job.
        
        NO LLM calls - pure math and embeddings.
        """
        try:
            # 1. FETCH PRECOMPUTED CV DATA
            cv_data = self._fetch_cv_data(candidate_id)
            if not cv_data:
                return {"success": False, "error": "CV not found", "score": 0.0}
            
            cv_embedding = cv_data["embedding"]
            cv_profile = cv_data["profile"]

            # Preload embeddings with async API (EmbeddingService has no sync .embed()).
            await self._warm_skill_embeddings(job_requirements, cv_profile)
            
            # 2. SEMANTIC SIMILARITY (Overall match)
            semantic_score = self._compute_similarity(cv_embedding, job_embedding)
            
            # 3. SKILL MATCHING with transferable detection
            skill_matches = self._match_skills_with_embeddings(
                job_requirements.get("skills", []),
                cv_profile.get("skills", []),
                transferable_threshold=0.65  # Embedding similarity threshold
            )
            
            # 4. EXPERIENCE MATCHING (relevance-weighted)
            job_title = job_requirements.get("title", "")
            exp_score = self._match_experience_relevance_weighted(
                job_requirements.get("experience_years", 0),
                cv_profile.get("total_experience_years", 0),
                cv_profile.get("experience", []),
                job_role=job_title
            )
            
            # 4.5 CV QUALITY SCORE (affects confidence, not score)
            cv_quality = self._compute_cv_quality(cv_profile)
            
            # 5. EDUCATION (weighted signal, never hard gate)
            edu_score = self._match_education_weighted(
                job_requirements.get("education_level"),
                cv_profile.get("education", [])
            )
            
            # 6. RISK ASSESSMENT
            risk = calculate_risk_factors(
                skill_matches["missing_critical"],
                exp_score,
                edu_score,
                cv_profile
            )
            
            # 7. SOFT + HARD GATE DECISION
            missing_critical_ratio = len(skill_matches["missing_critical"]) / len(job_requirements.get("skills", [])) if job_requirements.get("skills") else 0
            
            gate_status = "PASS"
            if missing_critical_ratio > 0.5:
                gate_status = "FAIL"
            elif missing_critical_ratio > 0.2:
                gate_status = "REVIEW"
            
            # Hard gates ONLY for legal/certification requirements
            hard_requirements = job_requirements.get("hard_requirements", [])
            for req in hard_requirements:
                if req.get("type") in ["certification", "license", "legal"]:
                    if not self._check_hard_requirement(req, cv_profile):
                        gate_status = "FAIL"
                        final_score = 0.0  # Absolute fail
                        break
            
            # 8. UNCERTAINTY DECOMPOSITION
            uncertainty = {
                "data_quality": cv_data.get("confidence", 0.85),
                "skill_coverage": skill_matches["coverage"] if skill_matches["coverage"] > 0.5 else skill_matches["coverage"] * 1.5,
                "experience_alignment": min(1.0, exp_score + 0.2),
                "education_alignment": min(1.0, edu_score + 0.3),
            }
            overall_confidence = round(sum(uncertainty.values()) / len(uncertainty), 2)
            
            # 9. FINAL SCORE (with dynamic weights)
            weights = self._compute_dynamic_weights(job_requirements, job_requirements.get("description", ""))
            final_score = compute_final_score(
                semantic_score=semantic_score,
                skill_coverage=skill_matches["coverage"],
                experience_score=exp_score,
                education_score=edu_score,
                weights=weights
            )
            
            # Apply gate penalty
            if gate_status == "FAIL":
                final_score = min(final_score * 0.3, 0.3)
            elif gate_status == "REVIEW":
                final_score = min(final_score * 0.7, 0.7)
            
            return {
                "success": True,
                "score": round(final_score, 4),
                "gate_status": gate_status,
                "semantic_score": semantic_score,
                "skill_coverage": skill_matches["coverage"],
                "matched_skills": skill_matches["matched"],
                "missing_skills": skill_matches["missing"],
                "missing_critical": skill_matches["missing_critical"],
                "transferable_skills": skill_matches["transferable"],
                "experience_score": exp_score,
                "education_score": edu_score,
                "risk": risk,
                "weights_used": weights,
                "confidence": {
                    "overall": overall_confidence,
                    "breakdown": uncertainty
                },
                "cv_quality": cv_quality,
            }
            
        except Exception as e:
            logger.error(f"Matching failed for {candidate_id}: {e}")
            return {"success": False, "error": str(e), "score": 0.0}
    
    def _fetch_cv_data(self, candidate_id: str) -> Optional[Dict[str, Any]]:
        """Fetch CV from ChromaDB."""
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
            logger.warning(f"CV fetch failed: {e}")
        return None
    
    def _compute_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Cosine similarity between two vectors."""
        try:
            v1 = np.array(vec1).reshape(1, -1)
            v2 = np.array(vec2).reshape(1, -1)
            return float(cosine_similarity(v1, v2)[0][0])
        except Exception:
            return 0.0
    
    def _get_skill_embedding(self, skill_name: str) -> List[float]:
        """Get or compute skill embedding (cached)."""
        skill_key = skill_name.lower().strip()
        
        cached = self._skill_embedding_cache.get(skill_key)
        if cached:
            return cached

        redis_vec = self.embedder.redis.get_skill_embedding(skill_key)
        if redis_vec:
            self._skill_embedding_cache[skill_key] = redis_vec
            return redis_vec

        if skill_key and skill_key not in self._missing_skill_embedding_warnings:
            logger.debug(
                "Missing embedding for '%s'; using lexical-only fallback for this term.",
                skill_key,
            )
            self._missing_skill_embedding_warnings.add(skill_key)
        return []

    async def _warm_skill_embeddings(
        self,
        job_requirements: Dict[str, Any],
        cv_profile: Dict[str, Any],
    ) -> None:
        """
        Warm embedding cache for terms used in skill and experience matching.
        """
        terms: set[str] = set()

        for skill in job_requirements.get("skills", []):
            if isinstance(skill, dict):
                name = str(skill.get("name", "")).strip().lower()
            else:
                name = str(skill).strip().lower()
            if name:
                terms.add(name)

        for skill in cv_profile.get("skills", []):
            if isinstance(skill, dict):
                name = str(skill.get("name", "")).strip().lower()
            else:
                name = str(skill).strip().lower()
            if name:
                terms.add(name)

        job_role = str(job_requirements.get("title", "")).strip().lower()
        if job_role:
            terms.add(job_role)

        for exp in cv_profile.get("experience", []):
            if not isinstance(exp, dict):
                continue
            role = str(exp.get("title", "") or exp.get("role", "")).strip().lower()
            if role:
                terms.add(role)

        if not terms:
            return

        try:
            generated = await self.embedder.embed_skill_list(list(terms))
            for key, vec in generated.items():
                normalized_key = str(key).strip().lower()
                if normalized_key and vec:
                    self._skill_embedding_cache[normalized_key] = vec
        except Exception as exc:
            logger.warning("Skill embedding warmup failed: %s", exc)
    
    def _grounded_similarity(self, skill_a: str, skill_b: str) -> float:
        """
        Hybrid similarity: 70% semantic + 30% lexical.
        
        Prevents: Java ≈ JavaScript
        Allows: ML ≈ Machine Learning
        """
        # 1. Semantic similarity (embeddings)
        emb_a = self._get_skill_embedding(skill_a)
        emb_b = self._get_skill_embedding(skill_b)
        semantic_sim = self._compute_similarity(emb_a, emb_b)
        
        # 2. Lexical similarity (token-based for stability)
        lexical_sim = fuzz.token_set_ratio(skill_a.lower(), skill_b.lower()) / 100.0
        
        # 3. Hybrid score (weighted combination)
        hybrid_score = 0.7 * semantic_sim + 0.3 * lexical_sim
        
        # 4. Soft penalty for very low lexical similarity
        # (prevents vector hallucination but less binary)
        if lexical_sim < 0.2:
            hybrid_score *= 0.7  # Soft penalty, not harsh
        
        return hybrid_score
    
    def _match_skills_with_embeddings(
        self,
        job_skills: List[Any],
        cv_skills: List[Any],
        transferable_threshold: float = 0.65
    ) -> Dict[str, Any]:
        """
        Match skills using embeddings for transferable detection.
        
        Returns:
            matched: Direct matches
            transferable: Similar skills (cosine > threshold)
            missing: Not found
            missing_critical: Critical requirements not met
        """
        matched = []
        transferable = []
        missing = []
        missing_critical = []
        
        # Normalize CV skills
        cv_skill_list = []
        for s in cv_skills:
            if isinstance(s, dict):
                cv_skill_list.append({
                    "name": s.get("name", "").lower(),
                    "data": s
                })
            else:
                cv_skill_list.append({"name": str(s).lower(), "data": s})
        
        for job_skill in job_skills:
            # Parse job skill
            if isinstance(job_skill, dict):
                skill_name = job_skill.get("name", "").lower()
                is_critical = job_skill.get("critical", False)
                is_hard = job_skill.get("type") == "hard"
            else:
                skill_name = str(job_skill).lower()
                is_critical = False
                is_hard = False
            
            if not skill_name:
                continue
            
            # Find best match
            best_match = None
            best_score = 0.0
            match_type = None
            
            for cv_skill in cv_skill_list:
                cv_name = cv_skill["name"]
                
                # 1. Exact match
                if skill_name == cv_name:
                    best_match = cv_skill
                    best_score = 1.0
                    match_type = "exact"
                    break
                
                # 2. Check substring (with safety)
                if skill_name in cv_name or cv_name in skill_name:
                    if self._has_safe_overlap(skill_name, cv_name):
                        best_match = cv_skill
                        best_score = 0.9
                        match_type = "substring"
                        break
                
                # 3. Embedding similarity (for transferable skills)
                sim = self._grounded_similarity(skill_name, cv_name)
                if sim > best_score:
                    best_score = sim
                    best_match = cv_skill
                    match_type = "semantic" if sim >= transferable_threshold else None
            
            # Classify result
            if best_score >= 0.9:
                matched.append({
                    "job_skill": skill_name,
                    "cv_skill": best_match["name"],
                    "match_type": match_type,
                    "score": best_score
                })
            elif best_score >= transferable_threshold:
                transferable.append({
                    "job_skill": skill_name,
                    "cv_skill": best_match["name"],
                    "similarity": best_score,
                    "match_type": "transferable"
                })
            else:
                missing.append(skill_name)
                if is_critical:
                    missing_critical.append(skill_name)
        
        # Coverage includes both direct and transferable
        total_matched = len(matched) + len(transferable)
        coverage = total_matched / len(job_skills) if job_skills else 0.0
        
        return {
            "matched": matched,
            "transferable": transferable,
            "missing": missing,
            "missing_critical": missing_critical,
            "coverage": coverage
        }
    
    def _has_safe_overlap(self, str1: str, str2: str) -> bool:
        """Check if two strings have meaningful token overlap."""
        words1 = set(str1.replace(".", " ").replace("-", " ").split())
        words2 = set(str2.replace(".", " ").replace("-", " ").split())
        meaningful = {w for w in (words1 & words2) if len(w) >= 3}
        return len(meaningful) > 0
    
    def _match_experience_relevance_weighted(
        self,
        required_years: float,
        actual_years: Any,
        experience_history: List[Dict],
        job_role: str = ""
    ) -> float:
        """
        Relevance-weighted experience scoring.
        
        5 years irrelevant experience ≠ 2 years relevant experience
        
        Uses cosine similarity between job role and experience titles
        to weight experience by relevance.
        """
        if not required_years or required_years <= 0:
            return 1.0  # No requirement
        
        if not experience_history:
            return 0.0 if actual_years else 0.3
        
        # Compute relevance-weighted years
        relevant_years = 0.0
        total_years = 0.0
        
        for exp in experience_history:
            if isinstance(exp, dict):
                # Get tenure
                years = exp.get("years", 0)
                if not years and exp.get("tenure_months"):
                    years = exp.get("tenure_months") / 12
                
                # Get role/title
                role = exp.get("title", "") or exp.get("role", "")
                
                # Calculate relevance to job role
                if job_role and role:
                    relevance = self._grounded_similarity(job_role.lower(), role.lower())
                else:
                    relevance = 0.5  # Default moderate relevance
                
                # Weight years by relevance
                relevant_years += years * relevance
                total_years += years
            else:
                # Simple numeric value
                total_years += float(exp) if isinstance(exp, (int, float)) else 0
        
        # Use relevant years if job role provided, else total years
        effective_years = relevant_years if job_role else total_years
        
        # Score based on effective years vs required
        if effective_years >= required_years:
            return 1.0
        
        # Smooth sigmoid curve for partial credit
        gap_ratio = effective_years / required_years
        import math
        score = 1 / (1 + math.exp(-10 * (gap_ratio - 0.5)))
        
        # Relevance diversity bonus
        if relevant_years > 0 and len(experience_history) >= 2:
            score = min(1.0, score * 1.05)
        
        return round(score, 3)
    
    def _match_education_weighted(
        self,
        required_level: Optional[str],
        cv_education: List[Dict]
    ) -> float:
        """
        Education as weighted signal - NEVER hard gate.
        
        Returns continuous score, not binary pass/fail.
        """
        if not required_level:
            return 1.0  # No requirement
        
        if not cv_education:
            return 0.3  # Some penalty but not zero
        
        # Education levels hierarchy
        levels = {
            "high school": 1,
            "associate": 2,
            "bachelor": 3,
            "master": 4,
            "phd": 5,
            "doctorate": 5
        }
        
        required_idx = self._get_edu_level(required_level.lower())
        best_match = 0.0
        
        for edu in cv_education:
            level_str = ""
            if isinstance(edu, dict):
                level_str = edu.get("degree", "").lower()
            else:
                level_str = str(edu).lower()
            
            edu_idx = self._get_edu_level(level_str)
            
            if edu_idx >= required_idx:
                return 1.0
            elif edu_idx > 0:
                # Partial credit for being close
                best_match = max(best_match, edu_idx / required_idx)
        
        return round(max(0.3, best_match), 2)  # Minimum 0.3 (not zero)
    
    def _get_edu_level(self, level_str: str) -> int:
        """Get education level index."""
        level_str = level_str.lower()
        if any(x in level_str for x in ["phd", "doctorate", "doctoral"]):
            return 5
        if any(x in level_str for x in ["master", "mba", "msc", "ma", "m.s.", "m.eng"]):
            return 4
        if any(x in level_str for x in ["bachelor", "bs", "ba", "b.s.", "b.a.", "bsc", "beng"]):
            return 3
        if "associate" in level_str:
            return 2
        if any(x in level_str for x in ["high school", "secondary", "baccalaureate"]):
            return 1
        return -1
    
    def _compute_dynamic_weights(self, job_requirements: Dict, job_description: str = "") -> Dict[str, float]:
        """
        Compute dynamic weights using SIGNAL STRENGTH from JD text.
        
        Instead of counting, detect keywords:
        - "must have", "required", "critical" → boost skill weight
        - "nice to have", "preferred" → reduce weight
        - "years of experience", "proven track record" → boost experience
        - "degree", "bachelor", "master" → boost education
        """
        # Extract critical vs optional skills
        critical_skills = []
        optional_skills = []
        
        for skill in job_requirements.get("skills", []):
            if isinstance(skill, dict):
                skill_name = skill.get("name", "")
                is_critical = skill.get("critical", False) or skill.get("type") == "hard"
            else:
                skill_name = str(skill)
                is_critical = False
            
            if is_critical:
                critical_skills.append(skill_name)
            else:
                optional_skills.append(skill_name)
        
        # Analyze JD text for emphasis signals
        jd_lower = job_description.lower()
        
        # Experience signals
        exp_signals = [
            "years of experience", "proven track record", "extensive experience",
            "demonstrated experience", "solid background", "minimum experience"
        ]
        exp_emphasis = sum(1 for signal in exp_signals if signal in jd_lower)
        
        # Education signals
        edu_signals = [
            "degree required", "bachelor's required", "master's preferred",
            "formal education", "academic background", "graduate degree"
        ]
        edu_emphasis = sum(1 for signal in edu_signals if signal in jd_lower)
        
        # Critical signals (for hard gates)
        critical_signals = [
            "must have", "required", "essential", "mandatory", "critical",
            "cannot proceed without", "deal breaker"
        ]
        critical_emphasis = sum(1 for signal in critical_signals if signal in jd_lower)
        
        # Compute weighted skill importance
        critical_weight = len(critical_skills) * 1.5 + critical_emphasis * 0.3
        optional_weight = len(optional_skills) * 0.5
        total_skill_weight = critical_weight + optional_weight
        
        # Base weights adjusted by signals
        weights = {
            "semantic": 0.25,
            "skills": 0.35,
            "experience": 0.25,
            "education": 0.15
        }
        
        # Boost skills if critical emphasis detected
        if critical_emphasis > 0 or critical_skills:
            weights["skills"] += 0.1
            weights["semantic"] -= 0.05
        
        # Boost experience if experience signals detected
        if exp_emphasis > 0 or job_requirements.get("experience_years", 0) > 3:
            weights["experience"] += min(0.15, exp_emphasis * 0.05)
        
        # Boost education if education signals detected
        if edu_emphasis > 0 or job_requirements.get("education_level"):
            weights["education"] += min(0.1, edu_emphasis * 0.03)
        
        # Reduce education if explicitly optional
        if "degree preferred" in jd_lower or "education preferred" in jd_lower:
            weights["education"] *= 0.6
            weights["skills"] += 0.05
        
        # Normalize to sum to 1.0
        total = sum(weights.values())
        return {k: round(v / total, 2) for k, v in weights.items()}
    
    def _compute_skill_rarity_boost(
        self,
        matched_skills: List[Dict],
        skill_frequency_db: Dict[str, float]
    ) -> float:
        """
        Compute rarity boost based on skill frequency in database.
        
        Rare skills = higher boost
        """
        if not matched_skills or not skill_frequency_db:
            return 0.0
        
        total_boost = 0.0
        for skill_match in matched_skills:
            skill_name = skill_match.get("job_skill", "").lower()
            frequency = skill_frequency_db.get(skill_name, 0.5)  # Default medium frequency
            
            # Rarity = inverse of frequency
            rarity = 1 - frequency
            
            # Boost for rare skills (frequency < 0.3)
            if rarity > 0.7:  # Very rare skill
                total_boost += 0.05
            elif rarity > 0.5:  # Moderately rare
                total_boost += 0.03
        
        return min(total_boost, 0.15)  # Cap at 0.15
    
    async def match_candidates_batch(
        self,
        candidate_ids: List[str],
        job_id: int,
        job_requirements: Dict[str, Any],
        job_embedding: List[float],
        skill_frequency_db: Dict[str, float] = None
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Batch match with ranking, percentiles, and z-scores.
        
        Returns:
            results: List of match results
            ranked: Results sorted by score with rank, percentile, z-score
        """
        import asyncio
        import numpy as np
        
        # Match all candidates in parallel
        tasks = [
            self.match_candidate(cid, job_id, job_requirements, job_embedding)
            for cid in candidate_ids
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        processed = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Match failed for {candidate_ids[i]}: {result}")
                processed.append({
                    "candidate_id": candidate_ids[i],
                    "success": False,
                    "score": 0.0,
                    "error": str(result)
                })
            else:
                result["candidate_id"] = candidate_ids[i]
                
                # Apply skill rarity boost
                if skill_frequency_db and result.get("success"):
                    rarity_boost = self._compute_skill_rarity_boost(
                        result.get("matched_skills", []),
                        skill_frequency_db
                    )
                    # Add boost to score (capped)
                    result["score"] = min(1.0, result["score"] + rarity_boost)
                    result["rarity_boost"] = rarity_boost
                
                processed.append(result)
        
        # Sort by score
        valid_results = [r for r in processed if r.get("success")]
        valid_results.sort(key=lambda x: x.get("score", 0), reverse=True)
        
        # Calculate distribution statistics for z-score
        scores = [r.get("score", 0) for r in valid_results]
        if len(scores) > 1:
            mean_score = np.mean(scores)
            std_score = np.std(scores)
        else:
            mean_score = scores[0] if scores else 0
            std_score = 0.1  # Small default to avoid division by zero
        
        # Add rank, percentile, and z-score
        total = len(valid_results)
        for i, result in enumerate(valid_results):
            result["rank"] = i + 1
            result["percentile"] = round(1 - (i / total), 2) if total > 1 else 1.0
            
            # Z-score: how many standard deviations above/below mean
            score = result.get("score", 0)
            if std_score > 0:
                z_score = (score - mean_score) / std_score
            else:
                z_score = 0.0
            result["z_score"] = round(z_score, 2)
            
            # Distribution context
            result["distribution"] = {
                "mean": round(mean_score, 3),
                "std": round(std_score, 3),
                "above_average": score > mean_score
            }
        
        # Merge back with errors
        all_results = valid_results + [r for r in processed if not r.get("success")]
        
        return all_results, valid_results
    
    def _check_hard_requirement(self, requirement: Dict, cv_profile: Dict) -> bool:
        """
        Check hard requirements (certifications, licenses, legal).
        
        These are absolute gates - candidate MUST have these.
        """
        req_type = requirement.get("type", "")
        req_value = requirement.get("value", "").lower()
        
        if req_type == "certification":
            # Check certifications in CV
            certs = cv_profile.get("certifications", [])
            for cert in certs:
                cert_name = cert.get("name", "").lower() if isinstance(cert, dict) else str(cert).lower()
                if req_value in cert_name or fuzz.ratio(req_value, cert_name) > 80:
                    return True
            return False
        
        elif req_type == "license":
            # Check licenses
            licenses = cv_profile.get("licenses", cv_profile.get("certifications", []))
            for lic in licenses:
                lic_name = lic.get("name", "").lower() if isinstance(lic, dict) else str(lic).lower()
                if req_value in lic_name:
                    return True
            return False
        
        elif req_type == "legal":
            # Legal requirements (work authorization, etc.)
            # This would need specific fields in CV
            legal_info = cv_profile.get("legal_status", {})
            return legal_info.get(req_value, False)
        
        return True  # Unknown requirement type - don't block
    
    def _compute_cv_quality(self, cv_profile: Dict) -> Dict[str, float]:
        """
        Compute CV quality score based on completeness and structure.
        
        Used to adjust confidence, NOT score directly.
        """
        scores = {
            "completeness": 0.0,
            "structure": 0.0,
            "consistency": 0.0,
        }
        
        # Completeness: check key sections
        required_sections = ["skills", "experience", "education"]
        present = sum(1 for section in required_sections if cv_profile.get(section))
        scores["completeness"] = present / len(required_sections)
        
        # Structure: check for proper formatting indicators
        structure_score = 0.5  # Base
        if cv_profile.get("full_name"):
            structure_score += 0.1
        if cv_profile.get("contact_info"):
            structure_score += 0.1
        if len(cv_profile.get("experience", [])) > 0:
            structure_score += 0.15
        if len(cv_profile.get("skills", [])) > 0:
            structure_score += 0.15
        scores["structure"] = min(1.0, structure_score)
        
        # Consistency: check for contradictions (basic check)
        consistency_score = 1.0
        
        # Check total experience matches individual entries
        total_exp = cv_profile.get("total_experience_years", 0)
        exp_entries = cv_profile.get("experience", [])
        if exp_entries and total_exp:
            calculated_total = sum(
                e.get("years", 0) or (e.get("tenure_months", 0) / 12)
                for e in exp_entries if isinstance(e, dict)
            )
            # Allow 20% tolerance
            if abs(calculated_total - total_exp) > (total_exp * 0.2):
                consistency_score -= 0.2
        
        scores["consistency"] = max(0.5, consistency_score)
        
        # Overall quality score
        overall = sum(scores.values()) / len(scores)
        scores["overall"] = round(overall, 2)
        
        return scores
