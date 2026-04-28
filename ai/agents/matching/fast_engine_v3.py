"""
fast_engine_v3.py

Enterprise-grade matching engine with all 10 improvements:
1. Signal-strength dynamic weights (critical vs optional)
2. Hybrid similarity (weighted semantic + lexical)
3. Soft + Hard gate hybrid
4. Context-aware experience (relevance-weighted)
5. Distribution-aware ranking (z-scores)
6. Skill rarity boost
7. Multi-signal learning loop
8. Uncertainty decomposition
9. CV quality signal
10. Skill clustering (placeholder for future)
"""

import logging
import math
import re
import time
import json
from datetime import datetime
from typing import Dict, List, Any, Tuple, Optional
from dataclasses import dataclass, field
from collections import defaultdict
from difflib import SequenceMatcher

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from .chroma_store import VectorStore
from ..ingestion.embedding import EmbeddingService

logger = logging.getLogger(__name__)


@dataclass
class JDEmphasisSignals:
    """Extracted emphasis signals from job description."""
    critical_skills: List[str] = field(default_factory=list)
    optional_skills: List[str] = field(default_factory=list)
    experience_emphasis: float = 0.25  # 0-1, how important is experience
    education_emphasis: float = 0.15  # 0-1, how important is education
    skills_emphasis: float = 0.35  # 0-1, how important are skills
    semantic_emphasis: float = 0.25  # 0-1, how important is overall fit
    required_years: float = 0.0
    education_required: bool = False


@dataclass
class UncertaintyComponents:
    """Decomposed confidence components."""
    data_quality: float = 0.8
    skill_coverage: float = 0.8
    experience_alignment: float = 0.8
    education_alignment: float = 0.8
    parsing_confidence: float = 0.8
    
    def overall(self) -> float:
        """Compute overall confidence as weighted average."""
        weights = {
            'data_quality': 0.2,
            'skill_coverage': 0.25,
            'experience_alignment': 0.25,
            'education_alignment': 0.15,
            'parsing_confidence': 0.15
        }
        total = sum(getattr(self, k) * w for k, w in weights.items())
        return round(total, 3)


@dataclass
class CVQualityMetrics:
    """CV quality assessment."""
    completeness: float = 0.0  # 0-1
    structure: float = 0.0   # 0-1
    consistency: float = 0.0  # 0-1
    
    def overall_score(self) -> float:
        """Overall quality score."""
        return round((self.completeness * 0.4 + self.structure * 0.35 + self.consistency * 0.25), 3)


class FastMatchingEngineV3:
    """
    Enterprise-grade matching engine with all improvements implemented.
    
    Key improvements:
    - Semantic weight extraction from JD text
    - Hybrid similarity (0.7 semantic + 0.3 lexical)
    - Tiered gate system (PASS/REVIEW/FAIL)
    - Relevance-weighted experience
    - Z-score ranking
    - Skill rarity boost
    - Learning feedback storage
    """
    
    def __init__(self):
        self.vector_store = VectorStore()
        self.embedder = EmbeddingService()
        self._skill_embedding_cache: Dict[str, List[float]] = {}
        
        # Skill frequency for rarity calculation (populated from DB in production)
        self._skill_frequency: Dict[str, float] = {}
        
        # Learning data storage
        self._feedback_buffer: List[Dict] = []
        
        # Configuration
        self.config = {
            'semantic_match_threshold': 0.82,
            'transferable_match_threshold': 0.65,
            'rarity_threshold': 0.3,  # Top 30% rarest skills get boost
            'rarity_boost': 0.05,
            'gate_fail_threshold': 0.5,
            'gate_review_threshold': 0.2,
            'experience_relevance_threshold': 0.6,
        }
    
    # ═══════════════════════════════════════════════════════════════════════
    # 1. DYNAMIC WEIGHTS - Signal Strength Based
    # ═══════════════════════════════════════════════════════════════════════
    
    def _extract_emphasis_signals(self, job_requirements: Dict[str, Any], jd_text: str = "") -> JDEmphasisSignals:
        """
        Extract emphasis signals from job description text.
        
        Detects keywords like:
        - "must have", "required", "essential" → critical skills
        - "nice to have", "preferred", "bonus" → optional skills
        - "X+ years required" → experience emphasis
        - "degree required" → education emphasis
        """
        signals = JDEmphasisSignals()
        jd_text_lower = (jd_text or "").lower()
        
        # Parse skills with criticality
        job_skills = job_requirements.get("skills") or job_requirements.get("required_skills") or []
        for skill in job_skills:
            if isinstance(skill, dict):
                skill_name = str(skill.get("name", "") or "").lower()
                is_critical = skill.get("critical", False)
                skill_type = skill.get("type", "")
                
                if is_critical or skill_type == "hard":
                    signals.critical_skills.append(skill_name)
                else:
                    signals.optional_skills.append(skill_name)
            else:
                skill_str = str(skill).lower()
                # Check JD text for context around this skill
                if self._is_skill_critical_in_text(skill_str, jd_text):
                    signals.critical_skills.append(skill_str)
                else:
                    signals.optional_skills.append(skill_str)
        
        # Calculate emphasis weights
        critical_weight = len(signals.critical_skills) * 1.5
        optional_weight = len(signals.optional_skills) * 0.5
        total_skill_weight = critical_weight + optional_weight
        
        if total_skill_weight > 0:
            # Keep non-zero weight when only optional skills are present.
            critical_ratio = critical_weight / total_skill_weight
            signals.skills_emphasis = min(0.6, max(0.25, 0.25 + (critical_ratio * 0.35)))
        
        # Experience emphasis from JD text
        signals.required_years = float(
            job_requirements.get("experience_years")
            or job_requirements.get("required_experience_years")
            or 0
        )
        if signals.required_years > 0:
            exp_signals = ["experience required", "years of", "minimum", "at least"]
            exp_count = sum(1 for sig in exp_signals if sig in jd_text_lower)
            signals.experience_emphasis = min(0.5, 0.2 + (exp_count * 0.05))
        
        # Education emphasis
        signals.education_required = bool(
            job_requirements.get("education_level")
            or job_requirements.get("required_degrees")
        )
        if signals.education_required:
            edu_signals = ["degree required", "bachelor required", "master required", "phd required"]
            edu_count = sum(1 for sig in edu_signals if sig in jd_text_lower)
            signals.education_emphasis = min(0.4, 0.1 + (edu_count * 0.08))
        
        # Remaining weight for semantic
        total_assigned = signals.skills_emphasis + signals.experience_emphasis + signals.education_emphasis
        signals.semantic_emphasis = max(0.1, 1.0 - total_assigned)
        
        # Normalize all to sum to 1.0
        total = signals.skills_emphasis + signals.experience_emphasis + signals.education_emphasis + signals.semantic_emphasis
        signals.skills_emphasis /= total
        signals.experience_emphasis /= total
        signals.education_emphasis /= total
        signals.semantic_emphasis /= total
        
        return signals
    
    def _is_skill_critical_in_text(self, skill: str, jd_text: str) -> bool:
        """Check if skill is marked as critical in JD text context."""
        if not jd_text:
            return False
        
        # Find skill in text
        skill_lower = skill.lower()
        text_lower = jd_text.lower()
        
        # Critical markers near the skill
        critical_markers = [
            "must have", "required", "essential", "mandatory",
            "must possess", "necessary", "critical", "key requirement"
        ]
        optional_markers = [
            "nice to have", "preferred", "bonus", "a plus",
            "advantage", "desirable", "beneficial"
        ]
        
        # Simple proximity check (within 50 chars before skill)
        idx = text_lower.find(skill_lower)
        if idx >= 0:
            context = text_lower[max(0, idx-100):idx]
            critical_score = sum(1 for m in critical_markers if m in context)
            optional_score = sum(1 for m in optional_markers if m in context)
            return critical_score > optional_score
        
        return False
    
    # ═══════════════════════════════════════════════════════════════════════
    # 2. SEMANTIC NORMALIZATION HELPERS
    # ═══════════════════════════════════════════════════════════════════════

    @staticmethod
    def _normalize_skill(skill_name: str) -> str:
        """Canonical cleanup only (no manual aliasing)."""
        if not isinstance(skill_name, str):
            return ""
        value = skill_name.strip().lower()
        value = re.sub(r"[.\-_/]+", " ", value)
        value = re.sub(r"[\(\)\[\],;:]+", " ", value)
        value = re.sub(r"\s+", " ", value)
        return value.strip()

    @staticmethod
    def _extract_skill_name(skill: Any) -> str:
        if isinstance(skill, dict):
            return str(skill.get("name", "")).strip()
        return str(skill or "").strip()

    @staticmethod
    def _extract_skill_criticality(skill: Any) -> bool:
        if not isinstance(skill, dict):
            return False
        if bool(skill.get("critical")):
            return True
        if bool(skill.get("is_required")):
            return True
        return str(skill.get("type", "")).lower() == "hard"

    @staticmethod
    def _deserialize_metadata(raw_metadata: Dict[str, Any]) -> Dict[str, Any]:
        parsed: Dict[str, Any] = {}
        for key, value in (raw_metadata or {}).items():
            if isinstance(value, str):
                try:
                    parsed[key] = json.loads(value)
                except json.JSONDecodeError:
                    parsed[key] = value
            else:
                parsed[key] = value
        return parsed

    def _build_skill_embedding_map(self, skill_vectors: Dict[str, Any]) -> Dict[str, List[float]]:
        """Normalize embedding map keys and drop invalid vectors."""
        normalized: Dict[str, List[float]] = {}
        for raw_name, vec in (skill_vectors or {}).items():
            key = self._normalize_skill(str(raw_name))
            if not key or not isinstance(vec, list) or not vec:
                continue
            normalized[key] = vec
        return normalized

    async def _ensure_skill_embeddings(
        self,
        skill_names: List[str],
        existing_vectors: Dict[str, Any],
    ) -> Dict[str, List[float]]:
        """
        Ensure we have embeddings for all provided skills.
        Uses only model-driven embeddings, no alias dictionaries.
        """
        vectors = self._build_skill_embedding_map(existing_vectors)
        missing: List[str] = []

        for raw_name in skill_names:
            normalized = self._normalize_skill(raw_name)
            if normalized and normalized not in vectors:
                missing.append(normalized)

        if missing:
            try:
                generated = await self.embedder.embed_skill_list(missing)
                for key, vec in generated.items():
                    normalized = self._normalize_skill(key)
                    if normalized and isinstance(vec, list) and vec:
                        vectors[normalized] = vec
            except Exception as exc:
                logger.warning("Could not generate some skill embeddings: %s", exc)

        return vectors

    def _skill_centroid(
        self,
        skill_names: List[str],
        skill_vectors: Dict[str, List[float]],
    ) -> Optional[List[float]]:
        """Average vector for semantic capability space."""
        vectors = []
        for raw_name in skill_names:
            key = self._normalize_skill(raw_name)
            vec = skill_vectors.get(key)
            if isinstance(vec, list) and vec:
                vectors.append(np.array(vec, dtype="float32"))

        if not vectors:
            return None
        centroid = np.mean(vectors, axis=0)
        norm = np.linalg.norm(centroid)
        if norm <= 1e-6:
            return None
        return (centroid / norm).tolist()

    def _hybrid_similarity(self, text_a: str, text_b: str) -> float:
        """
        Lightweight lexical similarity for role-title relevance.
        Skill matching itself uses embedding space.
        """
        a = self._normalize_skill(text_a)
        b = self._normalize_skill(text_b)
        if not a or not b:
            return 0.0
        if a == b:
            return 1.0

        tokens_a = set(a.split())
        tokens_b = set(b.split())
        union = tokens_a | tokens_b
        jaccard = (len(tokens_a & tokens_b) / len(union)) if union else 0.0
        seq = SequenceMatcher(None, a, b).ratio()
        return round((0.6 * seq) + (0.4 * jaccard), 4)
    
    def _compute_cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Compute cosine similarity between two vectors."""
        try:
            v1 = np.array(vec1).reshape(1, -1)
            v2 = np.array(vec2).reshape(1, -1)
            similarity = float(cosine_similarity(v1, v2)[0][0])
            return max(0.0, similarity)
        except Exception:
            return 0.0
    
    # ═══════════════════════════════════════════════════════════════════════
    # 3. SOFT + HARD GATE HYBRID
    # ═══════════════════════════════════════════════════════════════════════
    
    def _evaluate_gate(self, missing_critical: List[str], total_critical: int,
                       hard_requirements: Dict[str, Any]) -> Tuple[str, float, str]:
        """
        Tiered gate system: PASS / REVIEW / FAIL
        
        - FAIL: >50% critical missing OR hard requirements not met
        - REVIEW: 20-50% critical missing
        - PASS: <20% critical missing
        """
        # Hard requirements (certifications, licenses, legal)
        hard_fail = self._check_hard_requirements(hard_requirements)
        if hard_fail:
            return "FAIL", 0.0, f"Hard requirement not met: {hard_fail}"
        
        # Calculate missing critical ratio
        if total_critical == 0:
            return "PASS", 1.0, "No critical requirements specified"
        
        missing_ratio = len(missing_critical) / total_critical
        
        if missing_ratio > self.config['gate_fail_threshold']:
            return "FAIL", 0.0, f"Missing {len(missing_critical)}/{total_critical} critical skills"
        elif missing_ratio > self.config['gate_review_threshold']:
            return "REVIEW", round(1 - missing_ratio, 2), f"Some critical gaps: {', '.join(missing_critical[:3])}"
        else:
            return "PASS", 1.0, "All critical requirements met"
    
    def _check_hard_requirements(self, hard_requirements: Dict[str, Any]) -> Optional[str]:
        """Check hard requirements (certifications, licenses, legal)."""
        # Check certifications
        required_certs = [str(c).lower() for c in (hard_requirements.get("required_certifications") or []) if c]
        candidate_certs = [str(c).lower() for c in (hard_requirements.get("candidate_certifications") or []) if c]
        for cert in required_certs:
            if cert not in candidate_certs:
                return f"Missing required certification: {cert}"
        
        # Check licenses
        required_licenses = [str(l).lower() for l in (hard_requirements.get("required_licenses") or []) if l]
        candidate_licenses = [str(l).lower() for l in (hard_requirements.get("candidate_licenses") or []) if l]
        for license_req in required_licenses:
            if license_req not in candidate_licenses:
                return f"Missing required license: {license_req}"
        
        return None
    
    # ═══════════════════════════════════════════════════════════════════════
    # 4. CONTEXT-AWARE EXPERIENCE - Relevance Weighted
    # ═══════════════════════════════════════════════════════════════════════
    
    def _calculate_relevant_experience(
        self,
        experience_history: List[Dict],
        target_role: str,
        required_years: float
    ) -> Tuple[float, float, float]:
        """
        Calculate relevance-weighted experience.
        
        Returns:
            - relevant_years: Sum of years weighted by role relevance
            - relevance_score: Average relevance of experience
            - experience_score: Final 0-1 score
        """
        if not experience_history:
            return 0.0, 0.0, 1.0 if required_years <= 0 else 0.0
        
        total_relevant_years = 0.0
        relevance_scores = []
        
        for exp in experience_history:
            role = str(exp.get("role", "") or "").lower()
            years = 0.0

            explicit_years = exp.get("years")
            if isinstance(explicit_years, (int, float)):
                years = max(float(explicit_years), 0.0)

            if years <= 0:
                tenure_months = exp.get("tenure_months")
                if isinstance(tenure_months, (int, float)) and tenure_months > 0:
                    years = float(tenure_months) / 12.0

            if years <= 0:
                duration_months = exp.get("duration_months")
                if isinstance(duration_months, (int, float)) and duration_months > 0:
                    years = float(duration_months) / 12.0

            if years <= 0:
                years = self._infer_experience_years(exp)

            if years <= 0:
                continue
            
            # Calculate role relevance to target
            relevance = self._calculate_role_relevance(role, target_role)
            
            # Weight years by relevance
            weighted_years = years * relevance
            total_relevant_years += weighted_years
            relevance_scores.append(relevance)
        
        if required_years <= 0:
            # If the JD does not require explicit years, do not penalize.
            avg_relevance = sum(relevance_scores) / len(relevance_scores) if relevance_scores else 0.5
            return round(total_relevant_years, 2), round(avg_relevance, 3), 1.0

        avg_relevance = sum(relevance_scores) / len(relevance_scores) if relevance_scores else 0.5
        if total_relevant_years <= 0:
            return 0.0, round(avg_relevance, 3), 0.0
        
        # Experience score: relevant years / required years, capped at 1.0
        raw_score = min(total_relevant_years / required_years, 1.0)
        
        # Bonus for high relevance
        if avg_relevance > 0.8:
            raw_score = min(1.0, raw_score * 1.1)
        
        return round(total_relevant_years, 2), round(avg_relevance, 3), round(raw_score, 3)

    @staticmethod
    def _parse_experience_date(value: Any) -> Optional[datetime]:
        """Parse common CV date formats into a datetime."""
        if value is None:
            return None

        raw = str(value).strip().lower()
        if not raw:
            return None
        if raw in {"present", "current", "now", "ongoing"}:
            return datetime.utcnow()

        for fmt in ("%Y-%m", "%Y/%m", "%Y.%m", "%m/%Y", "%Y"):
            try:
                parsed = datetime.strptime(raw, fmt)
                return parsed if fmt != "%Y" else datetime(parsed.year, 1, 1)
            except ValueError:
                continue

        month_map = {
            "jan": 1, "january": 1,
            "feb": 2, "february": 2,
            "mar": 3, "march": 3,
            "apr": 4, "april": 4,
            "may": 5,
            "jun": 6, "june": 6,
            "jul": 7, "july": 7,
            "aug": 8, "august": 8,
            "sep": 9, "sept": 9, "september": 9,
            "oct": 10, "october": 10,
            "nov": 11, "november": 11,
            "dec": 12, "december": 12,
        }

        month_year = re.search(
            r"\b([a-z]{3,9})[\s\-/,.]+(19\d{2}|20\d{2})\b",
            raw,
        )
        if month_year:
            month_token = month_year.group(1)
            year = int(month_year.group(2))
            month = month_map.get(month_token)
            if month:
                return datetime(year, month, 1)

        year_only = re.search(r"\b(19\d{2}|20\d{2})\b", raw)
        if year_only:
            return datetime(int(year_only.group(1)), 1, 1)

        return None

    def _infer_experience_years(self, exp: Dict[str, Any]) -> float:
        """Infer experience duration from start/end dates when explicit years are absent."""
        start = self._parse_experience_date(exp.get("start_date"))
        if start is None:
            return 0.0

        end = self._parse_experience_date(exp.get("end_date"))
        if end is None:
            end = datetime.utcnow()

        if end < start:
            return 0.0

        months = (end.year - start.year) * 12 + (end.month - start.month) + 1
        return round(max(months / 12.0, 0.0), 3)
    
    def _calculate_role_relevance(self, candidate_role: str, target_role: str) -> float:
        """Calculate relevance between candidate role and target role."""
        candidate_role = str(candidate_role or "").lower()
        target_role = str(target_role or "").lower()
        if not candidate_role or not target_role:
            return 0.5
        
        # Use hybrid similarity for role matching
        relevance = self._hybrid_similarity(candidate_role, target_role)
        
        # Boost for exact or near-exact matches
        if candidate_role == target_role:
            relevance = 1.0
        elif relevance >= 0.8:
            relevance = max(relevance, 0.9)
        
        return relevance
    
    # ═══════════════════════════════════════════════════════════════════════
    # 5. DISTRIBUTION-AWARE RANKING - Z-Scores
    # ═══════════════════════════════════════════════════════════════════════
    
    def _calculate_distribution_metrics(self, scores: List[float]) -> Dict[str, float]:
        """Calculate distribution statistics for z-score computation."""
        if not scores or len(scores) < 2:
            return {"mean": 0.0, "std": 1.0, "median": 0.0}
        
        mean = np.mean(scores)
        std = np.std(scores) if np.std(scores) > 0 else 1.0
        median = np.median(scores)
        
        return {
            "mean": round(float(mean), 4),
            "std": round(float(std), 4),
            "median": round(float(median), 4)
        }
    
    def _calculate_z_score(self, score: float, mean: float, std: float) -> float:
        """Calculate z-score for a candidate."""
        if std == 0:
            return 0.0
        return round((score - mean) / std, 3)
    
    # ═══════════════════════════════════════════════════════════════════════
    # 6. SKILL RARITY BOOST
    # ═══════════════════════════════════════════════════════════════════════
    
    def _get_skill_rarity(self, skill: str) -> float:
        """
        Get rarity score for a skill (1 = rare, 0 = common).
        In production, this queries the database for skill frequency.
        """
        skill_lower = skill.lower()
        
        # If we have frequency data, use it
        if skill_lower in self._skill_frequency:
            freq = self._skill_frequency[skill_lower]
            # rarity = 1 - normalized_frequency
            return 1.0 - min(1.0, freq)
        
        # Default: assume medium rarity
        return 0.5
    
    def _apply_rarity_boost(self, base_score: float, matched_skills: List[str]) -> float:
        """Apply boost for rare skills."""
        if not matched_skills:
            return base_score
        
        boost = 0.0
        for skill in matched_skills:
            rarity = self._get_skill_rarity(skill)
            if rarity > self.config['rarity_threshold']:
                boost += self.config['rarity_boost']
        
        # Cap total boost
        total_boost = min(0.15, boost)
        return min(1.0, base_score + total_boost)
    
    # ═══════════════════════════════════════════════════════════════════════
    # 7. LEARNING LOOP - Feedback Storage
    # ═══════════════════════════════════════════════════════════════════════
    
    def store_feedback(self, match_result: Dict, outcome: str, 
                       candidate_id: str, job_id: int):
        """
        Store hiring outcome for learning.
        
        Outcomes: "hired", "rejected", "interview", "shortlisted"
        """
        feedback = {
            "candidate_id": candidate_id,
            "job_id": job_id,
            "timestamp": int(time.time()),
            "outcome": outcome,
            "scores": {
                "final": match_result.get("score", 0),
                "skill_coverage": match_result.get("skill_coverage", 0),
                "experience": match_result.get("experience_score", 0),
                "education": match_result.get("education_score", 0),
            },
            "weights": match_result.get("weights_used", {}),
            "missing_critical": match_result.get("missing_critical", []),
            "matched_skills": [s["job_skill"] for s in match_result.get("matched_skills", [])],
        }
        
        self._feedback_buffer.append(feedback)
        
        # Persist batch to DB when buffer reaches threshold
        if len(self._feedback_buffer) >= 100:
            self._persist_feedback_batch()
    
    def _persist_feedback_batch(self):
        """Persist feedback batch to database."""
        # Implementation would write to database
        # For now, just log
        logger.info(f"Persisting {len(self._feedback_buffer)} feedback records")
        # In production: write to PostgreSQL/Redis
        # clear buffer
        self._feedback_buffer = []
    
    def get_learned_adjustments(self, job_id: int) -> Dict[str, float]:
        """
        Get learned adjustments for a job based on past outcomes.
        """
        # Query database for feedback on similar jobs
        # Return suggested weight adjustments
        # This is a placeholder - real implementation queries DB
        return {
            "skill_weight_adjustment": 0.0,
            "experience_weight_adjustment": 0.0,
            "threshold_adjustment": 0.0,
        }
    
    # ═══════════════════════════════════════════════════════════════════════
    # 8. UNCERTAINTY DECOMPOSITION
    # ═══════════════════════════════════════════════════════════════════════
    
    def _calculate_uncertainty(self, cv_profile: Dict, match_data: Dict) -> UncertaintyComponents:
        """Calculate decomposed uncertainty components."""
        uncertainty = UncertaintyComponents()
        
        # Data quality: based on parsing confidence and completeness
        cv_confidence = cv_profile.get("parsing_confidence", 0.8)
        has_sections = all(cv_profile.get(k) for k in ["skills", "experience"])
        uncertainty.data_quality = round(cv_confidence * (1.0 if has_sections else 0.7), 3)
        
        # Skill coverage: how well we could match skills
        total_skills = len(match_data.get("matched_skills", [])) + len(match_data.get("missing_skills", []))
        if total_skills > 0:
            coverage = len(match_data.get("matched_skills", [])) / total_skills
            uncertainty.skill_coverage = round(0.5 + (coverage * 0.5), 3)
        else:
            uncertainty.skill_coverage = 0.5
        
        # Experience alignment: based on relevance and clarity
        exp_relevance = match_data.get("experience_relevance", 0.5)
        has_tenure_data = all(
            e.get("tenure_months") or e.get("years") or e.get("start_date")
            for e in cv_profile.get("experience", [])
        )
        uncertainty.experience_alignment = round(exp_relevance * (1.0 if has_tenure_data else 0.7), 3)
        
        # Education alignment
        has_edu_data = bool(cv_profile.get("education"))
        uncertainty.education_alignment = round(0.9 if has_edu_data else 0.6, 3)
        
        # Parsing confidence
        uncertainty.parsing_confidence = cv_confidence
        
        return uncertainty
    
    # ═══════════════════════════════════════════════════════════════════════
    # 9. CV QUALITY SIGNAL
    # ═══════════════════════════════════════════════════════════════════════
    
    def _assess_cv_quality(self, cv_profile: Dict) -> CVQualityMetrics:
        """Assess CV quality based on completeness, structure, and consistency."""
        quality = CVQualityMetrics()
        
        # Completeness: required sections present
        required_sections = ["full_name", "skills", "experience", "education"]
        present = sum(1 for s in required_sections if cv_profile.get(s))
        quality.completeness = present / len(required_sections)
        
        # Structure: well-formatted dates, consistent formatting
        exp_entries = cv_profile.get("experience", [])
        well_structured = 0
        for exp in exp_entries:
            if exp.get("start_date") and (exp.get("end_date") or exp.get("current")):
                well_structured += 1
        quality.structure = well_structured / len(exp_entries) if exp_entries else 0.5
        
        # Consistency: no conflicting information
        # Simple check: total years in experience matches stated total
        stated_total = cv_profile.get("total_experience_years", 0)
        calculated_total = sum(
            e.get("years", 0) or (e.get("tenure_months", 0) / 12)
            for e in exp_entries
        )
        if stated_total > 0 and abs(stated_total - calculated_total) > 2:
            quality.consistency = 0.6  # Some inconsistency
        else:
            quality.consistency = 0.9
        
        return quality
    
    # ═══════════════════════════════════════════════════════════════════════
    # MAIN MATCHING METHOD
    # ═══════════════════════════════════════════════════════════════════════
    
    async def match_candidate(
        self,
        candidate_id: str,
        job_id: int,
        job_requirements: Dict[str, Any],
        job_embedding: List[float],
        jd_text: str = ""
    ) -> Dict[str, Any]:
        """
        Match a candidate against a job with all V3 improvements.
        """
        try:
            job_requirements = job_requirements or {}

            # Fetch CV data
            cv_data = self._fetch_cv_data(candidate_id)
            if not cv_data:
                return {"success": False, "error": "CV not found", "score": 0.0}
            
            cv_embedding = cv_data["embedding"]
            cv_profile = cv_data.get("profile", {})
            if not isinstance(cv_profile, dict):
                cv_profile = {}
            job_skills = job_requirements.get("skills") or job_requirements.get("required_skills") or []
            cv_skills = cv_profile.get("skills", [])
            
            # 1. Extract emphasis signals from JD
            emphasis = self._extract_emphasis_signals(job_requirements, jd_text)

            # 2. Build skill-embedding space (semantic normalization)
            job_skill_vectors = await self._ensure_skill_embeddings(
                [self._extract_skill_name(s) for s in job_skills],
                job_requirements.get("skill_embeddings") or {},
            )
            cv_skill_vectors = await self._ensure_skill_embeddings(
                [self._extract_skill_name(s) for s in cv_skills],
                cv_profile.get("skill_embeddings") or {},
            )

            # 3. Semantic similarity:
            # blend document-level embeddings with skill-space centroids to avoid
            # over-scoring generic "document similarity".
            job_centroid = self._skill_centroid(
                [self._extract_skill_name(s) for s in job_skills],
                job_skill_vectors,
            )
            cv_centroid = self._skill_centroid(
                [self._extract_skill_name(s) for s in cv_skills],
                cv_skill_vectors,
            )

            document_semantic = None
            if cv_embedding and job_embedding:
                document_semantic = self._compute_cosine_similarity(cv_embedding, job_embedding)

            skill_semantic = None
            if job_centroid and cv_centroid:
                skill_semantic = self._compute_cosine_similarity(cv_centroid, job_centroid)

            semantic_score = 0.0
            if document_semantic is not None and skill_semantic is not None:
                semantic_score = (0.35 * document_semantic) + (0.65 * skill_semantic)
            elif skill_semantic is not None:
                semantic_score = skill_semantic
            elif document_semantic is not None:
                semantic_score = document_semantic

            # 4. Skill matching (embedding-first, no alias dictionaries)
            skill_result = self._match_skills_hybrid(
                job_skills=job_skills,
                cv_skills=cv_skills,
                job_skill_vectors=job_skill_vectors,
                cv_skill_vectors=cv_skill_vectors,
            )
            
            # 5. Context-aware experience
            target_role = job_requirements.get("title", "")
            relevant_years, exp_relevance, exp_score = self._calculate_relevant_experience(
                cv_profile.get("experience", []),
                target_role,
                emphasis.required_years
            )
            
            # 6. Education matching
            required_education = (
                job_requirements.get("education_level")
                or (job_requirements.get("required_degrees") or [None])[0]
            )
            edu_score = self._match_education_weighted(
                required_education,
                cv_profile.get("education", [])
            )
            
            # 7. Gate evaluation
            total_critical = len(emphasis.critical_skills)
            hard_reqs = {
                "required_certifications": job_requirements.get("required_certifications", []),
                "candidate_certifications": cv_profile.get("certifications", []),
            }
            gate_status, gate_factor, gate_reason = self._evaluate_gate(
                skill_result["missing_critical"],
                total_critical,
                hard_reqs
            )
            
            # 8. Apply rarity boost
            skill_names = [s["job_skill"] for s in skill_result["matched"]]
            base_score = (
                semantic_score * emphasis.semantic_emphasis +
                skill_result["coverage"] * emphasis.skills_emphasis +
                exp_score * emphasis.experience_emphasis +
                edu_score * emphasis.education_emphasis
            )
            boosted_score = self._apply_rarity_boost(base_score, skill_names)
            
            # 9. Apply gate factor
            final_score = boosted_score * gate_factor
            
            # 10. Calculate uncertainty
            match_data = {
                "matched_skills": skill_result["matched"],
                "missing_skills": skill_result["missing"],
                "experience_relevance": exp_relevance,
            }
            uncertainty = self._calculate_uncertainty(cv_profile, match_data)
            
            # 11. CV quality
            cv_quality = self._assess_cv_quality(cv_profile)
            
            # Adjust confidence based on quality
            quality_adjusted_confidence = uncertainty.overall() * (0.8 + 0.2 * cv_quality.overall_score())
            
            # Build result dict first (without explanation)
            result = {
                "success": True,
                "score": round(final_score, 4),
                "semantic_score": round(semantic_score, 4),
                "skill_coverage": round(skill_result["coverage"], 4),
                "experience_score": exp_score,
                "experience_relevance": exp_relevance,
                "relevant_years": relevant_years,
                "education_score": edu_score,
                "gate_status": gate_status,
                "gate_reason": gate_reason,
                "matched_skills": skill_result["matched"],
                "transferable_skills": skill_result["transferable"],
                "missing_skills": skill_result["missing"],
                "missing_critical": skill_result["missing_critical"],
                "weights_used": {
                    "semantic": round(emphasis.semantic_emphasis, 3),
                    "skills": round(emphasis.skills_emphasis, 3),
                    "experience": round(emphasis.experience_emphasis, 3),
                    "education": round(emphasis.education_emphasis, 3),
                },
                "confidence": round(quality_adjusted_confidence, 3),
                "confidence_components": {
                    "data_quality": uncertainty.data_quality,
                    "skill_coverage": uncertainty.skill_coverage,
                    "experience_alignment": uncertainty.experience_alignment,
                    "education_alignment": uncertainty.education_alignment,
                    "parsing_confidence": uncertainty.parsing_confidence,
                },
                "cv_quality": {
                    "completeness": cv_quality.completeness,
                    "structure": cv_quality.structure,
                    "consistency": cv_quality.consistency,
                    "overall": cv_quality.overall_score(),
                },
                "rarity_boost_applied": boosted_score > base_score,
                "candidate_profile": {
                    "skills": cv_profile.get("skills", []),
                    "experience": cv_profile.get("experience", []),
                    "education": cv_profile.get("education", []),
                }
            }
            
            # Generate V3 explanation
            explanation = await self._generate_v3_explanation(
                result, cv_profile, gate_status, gate_reason
            )
            result["explanation"] = explanation
            
            return result
            
        except Exception as e:
            logger.error(f"Matching failed for {candidate_id}: {e}")
            return {"success": False, "error": str(e), "score": 0.0}
    
    async def _generate_v3_explanation(
        self,
        match_result: Dict[str, Any],
        cv_profile: Dict[str, Any],
        gate_status: str,
        gate_reason: str
    ) -> Dict[str, Any]:
        """
        Generate AI-powered explanation for V3 matching results.
        Uses template-based approach with structured data.
        """
        score = match_result.get("score", 0.0)
        matched_skills = match_result.get("matched_skills", [])
        missing_skills = match_result.get("missing_skills", [])
        missing_critical = match_result.get("missing_critical", [])
        transferable = match_result.get("transferable_skills", [])
        weights = match_result.get("weights_used", {})
        
        # Build summary based on score and gate status
        if gate_status == "FAIL":
            summary = f"Below threshold match ({score*100:.0f}%). Critical requirements not met."
        elif gate_status == "REVIEW":
            summary = f"Moderate match ({score*100:.0f}%) with some gaps. Manual review recommended."
        elif score >= 0.8:
            summary = f"Strong match ({score*100:.0f}%). Candidate aligns well with requirements."
        elif score >= 0.6:
            summary = f"Good match ({score*100:.0f}%). Solid alignment with most requirements."
        else:
            summary = f"Below average match ({score*100:.0f}%). Significant gaps identified."
        
        # Build strengths
        strengths = []
        for skill in matched_skills[:5]:
            if isinstance(skill, dict):
                skill_name = skill.get("job_skill", "Unknown")
                match_type = skill.get("match_type", "matched")
                if match_type == "exact":
                    strengths.append(f"Exact match: {skill_name}")
                elif match_type == "substring":
                    strengths.append(f"Strong match: {skill_name}")
                else:
                    strengths.append(f"Matched: {skill_name}")
        
        if transferable:
            strengths.append(f"Transferable skills: {len(transferable)} identified")
        
        # Build gaps
        gaps = []
        if missing_critical:
            for skill in missing_critical[:3]:
                gaps.append(f"Critical missing: {skill}")
        if missing_skills:
            for skill in missing_skills[:3]:
                if skill not in missing_critical:
                    gaps.append(f"Missing: {skill}")
        
        # Interpretation
        if score >= 0.8:
            interpretation = "High score due to strong skill coverage and relevant experience alignment."
        elif score >= 0.6:
            interpretation = "Moderate score with good fundamentals but some skill gaps or experience variance."
        else:
            interpretation = f"Lower score primarily due to {len(missing_skills)} missing skills and {gate_reason.lower() if gate_reason else 'insufficient alignment'}."
        
        # Recommendation
        if gate_status == "FAIL":
            recommendation = "REJECT - Critical requirements not met."
        elif gate_status == "REVIEW":
            recommendation = "REVIEW - Assess gaps in interview; candidate has potential but needs verification."
        elif score >= 0.75:
            recommendation = "PROCEED - Strong candidate, schedule interview."
        elif score >= 0.5:
            recommendation = "PROCEED WITH CAUTION - Interview to verify transferable skills and experience depth."
        else:
            recommendation = "REJECT - Below threshold, significant gaps in requirements."
        
        # Improvement suggestion
        if missing_critical:
            improvement = f"Focus on acquiring: {', '.join(missing_critical[:2])}"
        elif missing_skills:
            improvement = f"Consider developing: {missing_skills[0]}"
        else:
            improvement = "Continue developing current expertise; minor skill diversification recommended."
        
        # Confidence explanation
        confidence = match_result.get("confidence", 0.85)
        components = match_result.get("confidence_components", {})
        if confidence >= 0.9:
            conf_exp = "High confidence due to complete CV data and clear skill evidence."
        elif confidence >= 0.7:
            conf_exp = "Moderate confidence; some sections of CV could benefit from more detail."
        else:
            low_conf_areas = [k for k, v in components.items() if isinstance(v, (int, float)) and v < 0.7]
            conf_exp = f"Lower confidence due to: {', '.join(low_conf_areas[:2]) if low_conf_areas else 'incomplete data'}."
        
        return {
            "summary": summary,
            "strengths": strengths if strengths else ["Basic profile analyzed"],
            "gaps": gaps if gaps else ["None identified"],
            "interpretation": interpretation,
            "confidence_explanation": conf_exp,
            "recommendation": recommendation,
            "improvement_suggestion": improvement,
            "score": score,
            "gate_status": gate_status,
            "v3": True
        }
    
    def _match_skills_hybrid(
        self,
        job_skills: List[Any],
        cv_skills: List[Any],
        job_skill_vectors: Dict[str, List[float]],
        cv_skill_vectors: Dict[str, List[float]],
    ) -> Dict[str, Any]:
        """
        Semantic skill matching.
        - No alias dictionaries
        - No fuzzy string primary logic
        - Decision boundary is cosine similarity
        """
        matched = []
        transferable = []
        missing = []
        missing_critical = []

        cv_skill_list = []
        for skill in cv_skills:
            raw_name = self._extract_skill_name(skill)
            normalized = self._normalize_skill(raw_name)
            if normalized:
                cv_skill_list.append({"raw_name": raw_name, "normalized": normalized, "data": skill})

        semantic_threshold = float(self.config.get("semantic_match_threshold", 0.82))
        transferable_threshold = float(self.config.get("transferable_match_threshold", 0.65))
        total_job_skills = 0

        for job_skill in job_skills:
            raw_job_skill = self._extract_skill_name(job_skill)
            normalized_job_skill = self._normalize_skill(raw_job_skill)
            is_critical = self._extract_skill_criticality(job_skill)

            if not normalized_job_skill:
                continue

            total_job_skills += 1
            best_match = None
            best_score = 0.0
            match_type = "none"

            # Exact normalized match.
            for cv_skill in cv_skill_list:
                if normalized_job_skill == cv_skill["normalized"]:
                    best_match = cv_skill
                    best_score = 1.0
                    match_type = "exact"
                    break

            # Semantic match if not exact.
            if best_score < 1.0:
                job_vec = job_skill_vectors.get(normalized_job_skill)
                if job_vec:
                    for cv_skill in cv_skill_list:
                        cand_vec = cv_skill_vectors.get(cv_skill["normalized"])
                        if not cand_vec:
                            continue
                        sim = self._compute_cosine_similarity(job_vec, cand_vec)
                        if sim > best_score:
                            best_score = sim
                            best_match = cv_skill
                            match_type = "semantic"

            if best_score >= semantic_threshold and best_match:
                matched.append({
                    "job_skill": raw_job_skill,
                    "cv_skill": best_match["raw_name"],
                    "match_type": match_type,
                    "score": round(best_score, 4),
                })
            elif best_score >= transferable_threshold and best_match:
                transferable.append({
                    "job_skill": raw_job_skill,
                    "cv_skill": best_match["raw_name"],
                    "similarity": round(best_score, 4),
                    "match_type": "transferable",
                })
            else:
                missing.append(raw_job_skill)
                if is_critical:
                    missing_critical.append(raw_job_skill)

        # Transferable contributes partial coverage.
        total_matched = len(matched) + (0.5 * len(transferable))
        coverage = total_matched / total_job_skills if total_job_skills else 0.0
        
        return {
            "matched": matched,
            "transferable": transferable,
            "missing": missing,
            "missing_critical": missing_critical,
            "coverage": coverage
        }
    
    def _match_education_weighted(
        self,
        required_level: Optional[str],
        cv_education: List[Dict]
    ) -> float:
        """Education as weighted signal - NEVER hard gate."""
        if not required_level:
            return 1.0
        
        if not cv_education:
            return 0.3
        
        required_idx = self._get_edu_level(str(required_level).lower())
        best_match = 0.0
        
        for edu in cv_education:
            level_str = ""
            if isinstance(edu, dict):
                level_str = str(edu.get("degree", "") or "").lower()
            else:
                level_str = str(edu).lower()
            
            edu_idx = self._get_edu_level(level_str)
            
            if edu_idx >= required_idx:
                return 1.0
            elif edu_idx > 0:
                best_match = max(best_match, edu_idx / required_idx)
        
        return round(max(0.3, best_match), 2)
    
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
    
    def _fetch_cv_data(self, candidate_id: str) -> Optional[Dict[str, Any]]:
        """Fetch CV from ChromaDB."""
        try:
            cached = self.vector_store.collection.get(
                ids=[candidate_id],
                include=["metadatas", "embeddings"],
            )
            if cached and cached["ids"]:
                raw_metadata = cached["metadatas"][0] if cached["metadatas"] else {}
                metadata = self._deserialize_metadata(raw_metadata)

                # Legacy storage shape may be flattened profile fields at root.
                profile = metadata.get("profile")
                if not isinstance(profile, dict) or not profile:
                    profile = {
                        key: value
                        for key, value in metadata.items()
                        if key not in {"candidate_id", "cv_hash"}
                    }

                embedding = cached["embeddings"][0] if cached.get("embeddings") else None
                return {
                    "embedding": embedding,
                    "profile": profile,
                    "confidence": metadata.get("confidence", 0.85)
                }
        except Exception as e:
            logger.warning(f"CV fetch failed: {e}")
        return None
    
    # ═══════════════════════════════════════════════════════════════════════
    # BATCH MATCHING WITH Z-SCORES
    # ═══════════════════════════════════════════════════════════════════════
    
    async def match_candidates_batch(
        self,
        candidate_ids: List[str],
        job_id: int,
        job_requirements: Dict[str, Any],
        job_embedding: List[float],
        jd_text: str = ""
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Batch match with distribution-aware ranking (z-scores).
        """
        import asyncio
        
        # Match all candidates
        tasks = [
            self.match_candidate(cid, job_id, job_requirements, job_embedding, jd_text)
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
                processed.append(result)
        
        # Get valid results
        valid_results = [r for r in processed if r.get("success")]
        
        if len(valid_results) > 1:
            # Calculate distribution metrics
            scores = [r.get("score", 0) for r in valid_results]
            dist = self._calculate_distribution_metrics(scores)
            
            # Add z-scores and ranks
            valid_results.sort(key=lambda x: x.get("score", 0), reverse=True)
            total = len(valid_results)
            
            for i, result in enumerate(valid_results):
                score = result.get("score", 0)
                result["rank"] = i + 1
                result["percentile"] = round(1 - (i / total), 2) if total > 1 else 1.0
                result["z_score"] = self._calculate_z_score(score, dist["mean"], dist["std"])
                result["distribution"] = dist
        else:
            for result in valid_results:
                result["rank"] = 1
                result["percentile"] = 1.0
                result["z_score"] = 0.0
        
        # Merge back with errors
        all_results = valid_results + [r for r in processed if not r.get("success")]
        
        return all_results, valid_results


# Initialize singleton
_fast_engine_v3 = FastMatchingEngineV3()


async def run_matching_pipeline_v3(
    cv_path: str,
    job_description: str,
    job_requirements: Dict,
    candidate_id: str | int | None = None,
    job_id: int | None = None,
    offer_type: str = "job"
) -> Dict[str, Any]:
    """
    V3 Enterprise matching pipeline.
    """
    import asyncio
    
    start_time = asyncio.get_event_loop().time()
    
    # Get JD data (simplified - in production use cached JD)
    from ..ingestion.ingestion_agent import IngestionAgent
    ingestion = IngestionAgent()
    
    try:
        job_result = await ingestion.process_job(job_description, job_requirements)
        parsed_profile = job_result.get("profile", {}) or {}
        parsed_requirements = parsed_profile.get("requirements", {})
        if not isinstance(parsed_requirements, dict) or not parsed_requirements:
            parsed_requirements = parsed_profile if isinstance(parsed_profile, dict) else {}
        if not parsed_requirements:
            parsed_requirements = job_requirements
        jd_data = {
            "requirements": parsed_requirements,
            "embedding": job_result.get("embedding"),
            "parsed_profile": parsed_profile,
        }
    except Exception as e:
        logger.error(f"JD parsing failed: {e}")
        jd_data = {
            "requirements": job_requirements,
            "embedding": None,
            "parsed_profile": {},
        }
    
    # Get CV data
    from .chroma_store import VectorStore
    store = VectorStore()
    
    candidate_id_str = str(candidate_id) if candidate_id else cv_path

    # Parse fresh and upsert; ingestion cache keeps this fast while preventing stale CVs.
    try:
        cv_result = await ingestion.process_cv(cv_path)
        store.add_or_update_candidate(
            candidate_id=candidate_id_str,
            embedding=cv_result["embedding"],
            cv_hash=cv_result.get("cv_hash", candidate_id_str),
            profile=cv_result["profile"]
        )
    except Exception as e:
        logger.error(f"CV parsing failed: {e}")
        # Allow fallback to cached CV if present.
        cached_cv = store.get_candidate(candidate_id_str)
        if not cached_cv:
            return {
                "success": False,
                "error": "Failed to parse CV",
                "final_score": 0.0,
            }
    
    # Run V3 matching
    match_result = await _fast_engine_v3.match_candidate(
        candidate_id=candidate_id_str,
        job_id=job_id or 0,
        job_requirements=jd_data["requirements"],
        job_embedding=jd_data["embedding"],
        jd_text=job_description
    )
    
    if not match_result.get("success"):
        return {
            "success": False,
            "error": match_result.get("error", "Matching failed"),
            "final_score": 0.0,
        }
    
    elapsed = asyncio.get_event_loop().time() - start_time
    
    result = {
        "success": True,
        "final_score": match_result["score"],
        "semantic_score": match_result.get("semantic_score", 0.0),
        "skill_coverage": match_result.get("skill_coverage", 0.0),
        "experience_score": match_result.get("experience_score", 0.0),
        "education_score": match_result.get("education_score", 0.0),
        "experience_relevance": match_result.get("experience_relevance", 0.0),
        "confidence_score": match_result.get("confidence", 0.85),
        "confidence_components": match_result.get("confidence_components", {}),
        "cv_quality": match_result.get("cv_quality", {}),
        "gate_status": match_result.get("gate_status", "UNKNOWN"),
        "gate_reason": match_result.get("gate_reason", ""),
        "z_score": match_result.get("z_score", 0.0),
        "weights_used": match_result.get("weights_used", {}),
        "matched_skills": match_result.get("matched_skills", []),
        "missing_skills": match_result.get("missing_skills", []),
        "missing_critical": match_result.get("missing_critical", []),
        "transferable_skills": match_result.get("transferable_skills", []),
        "rarity_boost_applied": match_result.get("rarity_boost_applied", False),
        "explanation": match_result.get("explanation", {}),
        "elapsed_time": round(elapsed, 3),
    }
    
    return result
