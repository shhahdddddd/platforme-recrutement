import asyncio
import logging
from typing import Dict, List, Any, Optional
from asgiref.sync import sync_to_async

from .state import MatchingState
from .fast_engine_v2 import FastMatchingEngineV2
from .fast_engine_v3 import FastMatchingEngineV3, run_matching_pipeline_v3
from .jd_cache import get_jd_cache_manager
from ..ingestion.ingestion_agent import IngestionAgent
from ..ingestion.embedding import EmbeddingService

logger = logging.getLogger(__name__)

# Initialize singletons
_fast_engine = FastMatchingEngineV2()
_fast_engine_v3 = FastMatchingEngineV3()  # NEW: V3 with all improvements
_jd_cache = get_jd_cache_manager()
_embedder = EmbeddingService()


async def run_matching_pipeline_fast(
    cv_path: str,
    job_description: str,
    job_requirements: Dict,
    candidate_id: str | int | None = None,
    job_id: int | None = None,
    offer_type: str = "job"
) -> Dict[str, Any]:
    """
    V3 FAST: Optimized matching pipeline.
    
    Steps:
    1. Parse CV (if not cached) - 1 LLM call
    2. Parse JD (if not cached) - 1 LLM call max
    3. Fast matching (NO LLM) - < 300ms
    4. Generate explanation (async/deferred) - 1 LLM call
    
    Args:
        cv_path: Path to CV PDF
        job_description: Raw job description text
        job_requirements: Basic requirements from Laravel
        candidate_id: Candidate identifier
        job_id: Job offer ID
        offer_type: "job" or "internship"
    
    Returns:
        Match result with score, explanation, and risk factors
    """
    start_time = asyncio.get_event_loop().time()
    
    # ─────────────────────────────────────────────────────────────────
    # STEP 1: PARSE CV (1 LLM call if not cached)
    # ─────────────────────────────────────────────────────────────────
    cv_data = await _get_or_parse_cv(cv_path, candidate_id)
    if not cv_data:
        return {
            "success": False,
            "error": "Failed to parse CV",
            "final_score": 0.0,
        }
    
    # ─────────────────────────────────────────────────────────────────
    # STEP 2: PARSE JD (cached - skip if already parsed)
    # ─────────────────────────────────────────────────────────────────
    jd_data = await _get_or_parse_jd(job_id, job_description, job_requirements)
    if not jd_data:
        return {
            "success": False,
            "error": "Failed to parse job description",
            "final_score": 0.0,
        }
    
    # ─────────────────────────────────────────────────────────────────
    # STEP 3: FAST MATCHING (NO LLM - deterministic)
    # ─────────────────────────────────────────────────────────────────
    # Ensure job title is in requirements for relevance-weighted experience
    if "title" not in jd_data.get("requirements", {}) and job_id:
        jd_data["requirements"]["title"] = job_requirements.get("title", "")
    
    # Add job description for signal-strength weighting
    jd_data["requirements"]["description"] = job_description
    
    match_result = await _fast_engine.match_candidate(
        candidate_id=str(candidate_id) if candidate_id else cv_path,
        job_id=job_id or 0,
        job_requirements=jd_data["requirements"],
        job_embedding=jd_data["embedding"],
    )
    
    if not match_result.get("success"):
        return {
            "success": False,
            "error": match_result.get("error", "Matching failed"),
            "final_score": 0.0,
        }
    
    # ─────────────────────────────────────────────────────────────────
    # STEP 4: ASYNC EXPLANATION (trigger background job)
    # ─────────────────────────────────────────────────────────────────
    explanation = await _generate_quick_explanation(match_result)
    
    # ─────────────────────────────────────────────────────────────────
    # BUILD RESPONSE
    # ─────────────────────────────────────────────────────────────────
    elapsed = asyncio.get_event_loop().time() - start_time
    
    result = {
        "success": True,
        "final_score": match_result["score"],
        "semantic_score": match_result.get("semantic_score", 0.0),
        "skill_coverage": match_result.get("skill_coverage", 0.0),
        "experience_score": match_result.get("experience_score", 0.0),
        "education_score": match_result.get("education_score", 0.0),
        "confidence_score": match_result.get("confidence", 0.85),
        "risk": match_result.get("risk", {}),
        "matched_skills": match_result.get("matched_skills", []),
        "missing_skills": match_result.get("missing_skills", []),
        "missing_critical": match_result.get("missing_critical", []),
        "explanation": explanation,
        "candidate_profile": match_result.get("candidate_profile", {}),
        "elapsed_time": round(elapsed, 3),
        "audit_log": [
            f"CV parsed: {cv_data.get('source', 'cache')}",
            f"JD parsed: {jd_data.get('source', 'cache')}",
            f"Fast match: {len(match_result.get('matched_skills', []))} skills matched",
            f"Completed in {elapsed:.3f}s",
        ]
    }
    
    logger.info(
        f"Match completed for candidate {candidate_id} vs job {job_id}: "
        f"score={result['final_score']:.2f}, time={elapsed:.3f}s"
    )
    
    return result


async def _get_or_parse_cv(
    cv_path: str,
    candidate_id: str | int | None = None
) -> Optional[Dict[str, Any]]:
    """
    Get CV data - from ChromaDB cache or parse fresh.
    
    Priority:
    1. ChromaDB (precomputed embedding)
    2. Parse fresh (1 LLM call) -> Store in ChromaDB
    """
    candidate_id_str = str(candidate_id) if candidate_id else cv_path
    
    # Try ChromaDB first
    try:
        from .chroma_store import VectorStore
        store = VectorStore()
        cached = store.get_candidate(candidate_id_str)
        if cached and cached.get("embedding") and cached.get("profile"):
            logger.info(f"CV cache HIT for candidate {candidate_id_str}")
            return {
                "embedding": cached.get("embedding"),
                "profile": cached.get("profile", {}),
                "confidence": cached.get("metadata", {}).get("confidence", 0.85),
                "source": "chromadb",
            }
    except Exception as e:
        logger.warning(f"ChromaDB lookup failed: {e}")
    
    # Parse fresh
    logger.info(f"CV cache MISS - parsing fresh for {candidate_id_str}")
    ingestion = IngestionAgent()
    
    try:
        cv_result = await ingestion.process_cv(cv_path)
        
        # Store in ChromaDB for future use
        try:
            store = VectorStore()
            store.add_or_update_candidate(
                candidate_id=candidate_id_str,
                embedding=cv_result["embedding"],
                cv_hash=cv_result.get("cv_hash", candidate_id_str),
                profile=cv_result["profile"]
            )
            logger.info(f"CV stored in ChromaDB for {candidate_id_str}")
        except Exception as e:
            logger.warning(f"Failed to store CV in ChromaDB: {e}")
        
        return {
            "embedding": cv_result["embedding"],
            "profile": cv_result["profile"],
            "confidence": cv_result.get("confidence", 0.85),
            "source": "parsed",
        }
        
    except Exception as e:
        logger.error(f"CV parsing failed: {e}")
        return None


async def _get_or_parse_jd(
    job_id: int | None,
    job_description: str,
    job_requirements: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """
    Get JD data - from cache or parse fresh.
    
    Priority:
    1. Redis cache (1 hour TTL)
    2. PostgreSQL cache (persistent)
    3. Parse fresh (1 LLM call) -> Cache in both
    """
    # Try cache first
    if job_id:
        cached = await _jd_cache.get_cached_jd(job_id, job_description)
        if cached:
            cached_requirements = cached.get("requirements")
            if not cached_requirements:
                cached_profile = cached.get("parsed_profile", {})
                if isinstance(cached_profile, dict):
                    cached_requirements = cached_profile.get("requirements") or cached_profile
            if not isinstance(cached_requirements, dict):
                cached_requirements = job_requirements
            return {
                "requirements": cached_requirements or job_requirements,
                "embedding": cached.get("embedding"),
                "parsed_profile": cached.get("parsed_profile", {}),
                "source": "cache",
            }
    
    # Parse fresh
    logger.info(f"JD cache MISS - parsing fresh for job {job_id}")
    ingestion = IngestionAgent()
    
    try:
        job_result = await ingestion.process_job(job_description, job_requirements)
        parsed_profile = job_result.get("profile", {}) or {}
        parsed_requirements = parsed_profile.get("requirements", {})
        if not isinstance(parsed_requirements, dict) or not parsed_requirements:
            parsed_requirements = parsed_profile if isinstance(parsed_profile, dict) else {}
        if not parsed_requirements:
            parsed_requirements = job_requirements
        
        parsed_data = {
            "requirements": parsed_requirements,
            "embedding": job_result.get("embedding"),
            "profile": parsed_profile,
        }
        
        # Cache for future use
        if job_id:
            await _jd_cache.cache_jd(job_id, job_description, parsed_data)
        
        return {
            "requirements": parsed_data["requirements"],
            "embedding": parsed_data["embedding"],
            "parsed_profile": parsed_data["profile"],
            "source": "parsed",
        }
        
    except Exception as e:
        logger.error(f"JD parsing failed: {e}")
        # Fallback: use raw requirements
        return {
            "requirements": job_requirements,
            "embedding": None,
            "parsed_profile": {},
            "source": "fallback",
        }


async def _generate_quick_explanation(match_result: Dict[str, Any]) -> Dict[str, str]:
    """
    Generate quick explanation without LLM call.
    
    Uses template-based generation for speed.
    For detailed explanation, use async background job.
    """
    score = match_result.get("score", 0.0)
    matched = len(match_result.get("matched_skills", []))
    missing = len(match_result.get("missing_skills", []))
    missing_critical = match_result.get("missing_critical", [])
    risk = match_result.get("risk", {})
    
    # Template-based summary
    if score >= 0.75:
        summary = f"Strong match ({score*100:.0f}%). {matched} key skills aligned."
    elif score >= 0.5:
        summary = f"Moderate match ({score*100:.0f}%). {matched} skills matched, {missing} gaps."
    else:
        summary = f"Below threshold ({score*100:.0f}%). Significant gaps in requirements."
    
    # Risk-based recommendation
    if risk.get("risk_level") == "HIGH" or missing_critical:
        recommendation = "REVIEW - Critical skill gaps or high risk factors identified."
    elif risk.get("risk_level") == "MEDIUM":
        recommendation = "PROCEED WITH CAUTION - Some risk factors present."
    else:
        recommendation = "PROCEED - Low risk, good skill alignment."
    
    return {
        "summary": summary,
        "recommendation": recommendation,
        "strengths": [f"{m['job_skill']} matched" for m in match_result.get("matched_skills", [])[:5]],
        "gaps": missing_critical[:5] if missing_critical else match_result.get("missing_skills", [])[:5],
        "risk_level": risk.get("risk_level", "UNKNOWN"),
        "note": "Detailed explanation available via async background job",
    }


async def run_matching_pipeline_enterprise(
    cv_path: str,
    job_description: str,
    job_requirements: Dict,
    candidate_id: str | int | None = None,
    job_id: int | None = None,
    offer_type: str = "job",
    use_v3: bool = True
) -> Dict[str, Any]:
    """
    ENTERPRISE: Full V3 matching with all improvements.
    
    All 10 improvements enabled:
    1. Signal-strength dynamic weights
    2. Hybrid similarity (0.7 semantic + 0.3 lexical)
    3. Tiered gate system (PASS/REVIEW/FAIL)
    4. Relevance-weighted experience
    5. Z-score ranking
    6. Skill rarity boost
    7. Learning feedback storage
    8. Uncertainty decomposition
    9. CV quality signal
    10. Skill clustering ready
    
    Returns:
        Enhanced match result with confidence components, z-score, CV quality,
        gate status, and all V3 features.
    """
    if use_v3:
        return await run_matching_pipeline_v3(
            cv_path=cv_path,
            job_description=job_description,
            job_requirements=job_requirements,
            candidate_id=candidate_id,
            job_id=job_id,
            offer_type=offer_type
        )
    else:
        # Fallback to V2
        return await run_matching_pipeline_fast(
            cv_path=cv_path,
            job_description=job_description,
            job_requirements=job_requirements,
            candidate_id=candidate_id,
            job_id=job_id,
            offer_type=offer_type
        )


async def run_batch_matching_fast(
    candidate_ids: List[str],
    job_id: int,
    job_description: str,
    job_requirements: Dict[str, Any],
    use_v3: bool = True
) -> List[Dict[str, Any]]:
    """
    Batch matching for multiple candidates in parallel.
    
    Args:
        candidate_ids: List of candidate IDs
        job_id: Job offer ID
        job_description: Raw job description
        job_requirements: Job requirements
        use_v3: Use V3 engine with z-scores and distribution metrics
    
    Returns:
        List of match results sorted by score with z-scores
    """
    # Get JD data once (shared across all candidates)
    jd_data = await _get_or_parse_jd(job_id, job_description, job_requirements)
    if not jd_data:
        logger.error("Failed to get JD data for batch matching")
        return []
    
    if use_v3:
        # Use V3 with z-scores and distribution metrics
        all_results, ranked_results = await _fast_engine_v3.match_candidates_batch(
            candidate_ids=candidate_ids,
            job_id=job_id,
            job_requirements=jd_data["requirements"],
            job_embedding=jd_data["embedding"],
            jd_text=job_description
        )
        return all_results
    else:
        # Legacy V2 batch matching
        results = await _fast_engine.batch_match_candidates(
            candidate_ids=candidate_ids,
            job_id=job_id,
            job_requirements=jd_data["requirements"],
            job_embedding=jd_data["embedding"],
        )
        return results


async def store_hiring_feedback(
    match_result: Dict,
    outcome: str,
    candidate_id: str,
    job_id: int
) -> bool:
    """
    Store hiring outcome for learning loop.
    
    Args:
        match_result: The match result from matching pipeline
        outcome: "hired", "rejected", "interview", "shortlisted"
        candidate_id: Candidate identifier
        job_id: Job offer ID
    
    Returns:
        True if feedback stored successfully
    """
    try:
        _fast_engine_v3.store_feedback(match_result, outcome, candidate_id, job_id)
        return True
    except Exception as e:
        logger.error(f"Failed to store feedback: {e}")
        return False
