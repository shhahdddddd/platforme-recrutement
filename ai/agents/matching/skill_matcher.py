"""
skill_matcher.py

Semantic Skill Coverage - Continuous similarity scoring.
SINGLE SOURCE OF TRUTH for skill matching. NO LLM scoring here.
"""

from __future__ import annotations

import re
import numpy as np

# Pure continuous scoring - no thresholds, all similarities count
SKILL_CONTEXT_TEMPLATE = "{skill} professional competency expertise"


def normalize_skill(skill: str) -> str:
    """Lowercase and normalize skill name."""
    if not isinstance(skill, str):
        return ""
    value = skill.strip().lower()
    value = re.sub(r"[\-_/]+", " ", value)
    value = re.sub(r"[\.\*\+\?]", "", value)
    return re.sub(r"\s+", " ", value).strip()


def enrich_skill_for_embedding(skill: str) -> str:
    """
    Enrich skill with context to improve semantic similarity.
    
    Plain: "html" → "html professional competency expertise"
    Plain: "react" → "react professional competency expertise"
    
    This boosts similarity between related skills by giving embeddings
    richer context to work with.
    """
    if not skill:
        return skill
    # Add professional context to improve semantic relationships
    return SKILL_CONTEXT_TEMPLATE.format(skill=skill.strip().lower())


def _is_exact_match(job_skill: str, cand_skill: str) -> bool:
    """Check for exact skill match after normalization."""
    return normalize_skill(job_skill) == normalize_skill(cand_skill)


def _skill_name(value: str | dict) -> str:
    if isinstance(value, dict):
        return str(value.get("name", "")).strip()
    return str(value or "").strip()


def _skill_tokens(normalized_skill: str) -> set[str]:
    if not normalized_skill:
        return set()
    return {token for token in normalized_skill.split() if token and len(token) >= 2}


def _passes_semantic_prefilter(
    job_norm: str,
    cand_norm: str,
    job_tokens: set[str],
    cand_tokens: set[str],
) -> bool:
    """
    Cheap pre-filter to reduce pairwise semantic comparisons.
    Keeps candidates with direct phrase overlap or token overlap.
    """
    if not job_norm or not cand_norm:
        return False
    if job_norm == cand_norm:
        return True
    if job_norm in cand_norm or cand_norm in job_norm:
        return True
    if job_tokens and cand_tokens and (job_tokens & cand_tokens):
        return True
    return False


def _normalized_vector_map(vectors: dict[str, list[float]]) -> dict[str, list[float]]:
    normalized: dict[str, list[float]] = {}
    for name, vec in (vectors or {}).items():
        if not vec:
            continue
        key = normalize_skill(name)
        if key and key not in normalized:
            normalized[key] = vec
    return normalized


def match_skills(
    job_skills: list[str | dict],
    job_skill_vectors: dict[str, list[float]],
    candidate_skills: list[str | dict],
    candidate_skill_vectors: dict[str, list[float]],
) -> dict:
    """
    SINGLE SOURCE OF TRUTH for skill matching.
    
    Algorithm:
    1. For each job skill, find best candidate skill using embeddings
    2. Use cosine similarity directly (continuous scoring)
    3. Weight by importance (required=1.0, optional=0.5)
    4. Weighted average = final score
    
    Scoring logic (NO hard rejection):
    - Any similarity > 0 contributes to score
    - Below 0.30: Minimal contribution (0.1 weight)
    - 0.30-0.60: Reduced contribution (0.5-0.8 weight)
    - Above 0.60: Full contribution
    
    This allows "React" to match "HTML" with partial credit.
    NO LLM reasoning here - embeddings are the source of truth.
    """
    if not job_skills:
        return {
            "score": 0.0,
            "matched_skills": [],
            "missing_skills": [],
            "skill_match_details": [],
            "match_summary": {"max_similarity": 0.0, "avg_similarity": 0.0},
        }

    # Normalize job skills
    job_objs: list[dict] = []
    for skill in job_skills:
        obj = dict(skill) if isinstance(skill, dict) else {"name": skill, "importance": 1.0}
        name = _skill_name(skill)
        normalized = normalize_skill(name)
        if not name or not normalized:
            continue
        obj["name"] = name
        obj["_normalized"] = normalized
        job_objs.append(obj)

    if not job_objs:
        return {
            "score": 0.0,
            "matched_skills": [],
            "missing_skills": [],
            "skill_match_details": [],
            "match_summary": {"max_similarity": 0.0, "avg_similarity": 0.0},
        }

    # Build candidate lookup
    cand_name_by_norm: dict[str, str] = {}
    for skill in candidate_skills:
        name = _skill_name(skill)
        normalized = normalize_skill(name)
        if name and normalized:
            cand_name_by_norm[normalized] = name

    # Normalize vectors
    job_vectors_norm = _normalized_vector_map(job_skill_vectors or {})
    candidate_vectors_norm = _normalized_vector_map(candidate_skill_vectors or {})
    
    # Store enriched versions for better semantic matching
    # The enrichment adds context that helps embeddings infer relationships
    # e.g., "html" + context → better similarity with "react"
    job_vectors_enriched: dict[str, list[float]] = {}
    candidate_vectors_enriched: dict[str, list[float]] = {}
    
    # Merge candidate names with vectors
    for normalized in candidate_vectors_norm:
        if normalized not in cand_name_by_norm:
            cand_name_by_norm[normalized] = normalized

    # Build candidate matrix for batch similarity
    candidate_vector_names = list(candidate_vectors_norm.keys())
    candidate_vector_matrix = (
        np.array([candidate_vectors_norm[name] for name in candidate_vector_names], dtype="float32")
        if candidate_vector_names
        else None
    )

    # Match each job skill
    matched_skills: list[str] = []
    missing_skills: list[str] = []
    skill_match_details: list[dict] = []
    weighted_scores: list[tuple[float, float]] = []  # (score, weight)
    all_similarities: list[float] = []

    for obj in job_objs:
        job_skill_name = obj["name"]
        job_skill_norm = obj["_normalized"]
        is_required = obj.get("is_required", True)  # Default to required
        importance = 1.0 if is_required else 0.5

        # Check 1: Exact match
        if job_skill_norm in cand_name_by_norm:
            similarity = 1.0
            matched_with = cand_name_by_norm[job_skill_norm]
            match_type = "exact"
        else:
            # Check 2: Semantic match using embeddings
            job_vec = job_vectors_norm.get(job_skill_norm)
            
            if job_vec and candidate_vector_matrix is not None:
                job_array = np.array(job_vec, dtype="float32")
                similarities = np.dot(candidate_vector_matrix, job_array)
                best_idx = int(np.argmax(similarities))
                similarity = float(similarities[best_idx])
                matched_with = cand_name_by_norm.get(
                    candidate_vector_names[best_idx], 
                    candidate_vector_names[best_idx]
                )
                # No hard rejection - any similarity counts, just weighted differently
                if similarity >= 0.70:
                    match_type = "strong"
                elif similarity >= 0.40:
                    match_type = "moderate"
                elif similarity > 0.10:
                    match_type = "weak"
                else:
                    match_type = "none"
            else:
                similarity = 0.0
                matched_with = None
                match_type = "no_match"

        all_similarities.append(similarity)

        # Pure continuous scoring - ALL similarities contribute
        # No thresholds, no hard rejection
        # similarity 0.75 → contributes 0.75 (100%)
        # similarity 0.45 → contributes 0.45 (100%) 
        # similarity 0.20 → contributes 0.20 (100%)
        
        if similarity > 0.05:  # Essentially zero check only
            if match_type != "exact":
                matched_skills.append(job_skill_name)
        else:
            missing_skills.append(job_skill_name)
                
        weighted_scores.append((similarity, importance))

        skill_match_details.append({
            "skill": job_skill_name,
            "match_type": match_type,
            "matched_with": matched_with,
            "similarity": round(similarity, 2),
            "importance": importance,
            "is_required": is_required,
        })

    # Calculate weighted score
    total_weighted = sum(score * weight for score, weight in weighted_scores)
    total_weight = sum(weight for _, weight in weighted_scores)
    final_score = total_weighted / total_weight if total_weight > 0 else 0.0

    # Simple coverage check
    max_sim = max(all_similarities) if all_similarities else 0.0
    avg_sim = sum(all_similarities) / len(all_similarities) if all_similarities else 0.0

    # Boost score when semantic relationships exist (even if weak)
    # This prevents score collapse when candidate has related skills
    if avg_sim > 0.25 and max_sim > 0.50:
        # Found some semantic relationships - ensure minimum score
        final_score = max(final_score, 0.15)

    return {
        "score": float(final_score),
        "matched_skills": sorted(set(matched_skills)),
        "missing_skills": sorted(set(missing_skills)),
        "skill_match_details": skill_match_details,
        "match_summary": {
            "max_similarity": round(max_sim, 2),
            "avg_similarity": round(avg_sim, 2),
        },
    }

