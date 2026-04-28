from langgraph.graph import END, StateGraph
from .state import MatchingState
import asyncio
import logging
from typing import Dict, Any
from asgiref.sync import sync_to_async

logger = logging.getLogger(__name__)

from .nodes import (
    cv_parser_node,
    jd_understanding_node,
    explanation_node
)
from .scoring_engine import compute_weights, compute_final_score, calculate_confidence_score, calculate_risk_score
from .seniority_matcher import match_seniority
from .feedback_loop import get_optimized_weights
from .matching_agent import MatchingAgent
from .chroma_store import VectorStore

# Re-initialize these singletons/classes
_store = VectorStore()
_intelligence = MatchingAgent(vector_store=_store)

async def run_matching_pipeline(
    cv_path: str,
    job_description: str,
    job_requirements: Dict,
    candidate_id: str | int | None = None,
    job_id: int | None = None,
    offer_type: str = "job"
) -> Dict[str, Any]:
    """
    V3 ARCHITECTURE: Pure Separation of Concerns.
    1. Orchestration Layer (LangGraph) -> LLM Tasks
    2. Intelligence Layer (Python) -> Semantic Core & Math
    """
    state: MatchingState = {
        "cv_path": cv_path,
        "job_description": job_description,
        "job_requirements": job_requirements,
        "offer_type": offer_type,
        "industry": "General",
        "dynamic_weights": {},
        "candidate_profile": None,
        "job_profile": None,
        "candidate_embedding": None,
        "job_embedding": None,
        "raw_scores": {},
        "final_score": 0.0,
        "matched_skills": [],
        "missing_skills": [],
        "gate_status": "PASS",
        "gate_reason": "",
        "failed_critical": [],
        "audit_log": ["Starting V3 Matching Pipeline."],
        "explanation": "",
        "metadata": {}
    }

    # ── 1. ORCHESTRATION LAYER (LLM Parsing) ──
    # Run LLM-heavy nodes to get structured profiles
    state.update(await cv_parser_node(state))
    
    # JD Understanding with Persistent Cache (Fix: Invalidates if content changed)
    use_jd_cache = False
    if job_id:
        try:
            from api.models import JobDescription
            import hashlib
            
            @sync_to_async
            def get_or_create_jd():
                return JobDescription.objects.get_or_create(
                    job_id=job_id,
                    defaults={'content': job_description}
                )
            
            @sync_to_async
            def save_jd(jd_obj):
                jd_obj.save()
            
            jd_obj, created = await get_or_create_jd()
            
            # If JD changed, the .save() logic in models already triggered MatchResult invalidation.
            # Here we just decide if we can skip the LLM node.
            if not created and jd_obj.parsed_profile and jd_obj.content_hash == hashlib.md5(job_description.encode('utf-8')).hexdigest():
                state["job_profile"] = jd_obj.parsed_profile
                state["audit_log"].append("Using cached JD parsed profile (V3 Stale Invalidation active).")
                use_jd_cache = True
            else:
                state.update(await jd_understanding_node(state))
                jd_obj.content = job_description
                jd_obj.parsed_profile = state["job_profile"]
                await save_jd(jd_obj)
        except Exception as e:
            logger.warning("JD Cache failure: %s. Falling back to fresh parse.", e)
            state.update(await jd_understanding_node(state))
    else:
        state.update(await jd_understanding_node(state))

    # ── 2. INTELLIGENCE LAYER (Semantic Core) ──
    # ❌ DO NOT use LangGraph here for math/scoring
    # A. Dynamic Weighting
    job_prof = state["job_profile"]
    weights = compute_weights(state["job_description"], job_prof)
    biases = get_optimized_weights()
    if biases:
        weights["skills"] = max(0.1, weights["skills"] + biases.get("skill_weight_bias", 0.0))
        weights["experience"] = max(0.1, weights["experience"] + biases.get("experience_weight_bias", 0.0))
    state["dynamic_weights"] = weights

    # B. Semantic Matching (Core Intelligence)
    base_match = await _intelligence.match_core(
        job_profile=job_prof,
        candidate_profile=state["candidate_profile"],
        weights=weights
    )

    # C. Scoring Engine (Final Decision Logic)
    # Applied as a direct multiplier to the decision
    conf_scores_input = {
        "skill": base_match["skill_score"],
        "experience": base_match["experience_score"],
        "education": base_match["education_score"]
    }
    final_conf = calculate_confidence_score(conf_scores_input, state.get("confidence_score", 1.0))

    # Seniority & Risk Assessment
    required_years = job_prof.get("required_experience_years", 0)
    seniority_res = match_seniority(required_years, state["candidate_profile"])
    
    risk_ctx = {
        "missing_critical_count": len(base_match.get("missing_skills", [])),
        "overqualified": seniority_res.get("overqualified_risk", False)
    }
    risk_score = calculate_risk_score(state["candidate_profile"], risk_ctx)

    scoring_context = {
        "critical_skill_coverage": base_match["skill_score"],
        "experience_score": base_match["experience_score"],
        "missing_critical": len(base_match["missing_skills"]) > 5, # Threshold
        "underqualified": base_match["experience_score"] < 0.3,
        "confidence": final_conf,
        "risk": risk_score
    }
    
    final_score, gate_status = compute_final_score(base_match["raw_score"], scoring_context)
    
    # D. Persistent Indexing (Upsert Strategy)
    # Replaces stale embeddings if CV hash changed
    if candidate_id and state["candidate_embedding"]:
        # Extract hash from candidate_profile (populated by ingestion_agent)
        # Note: ingestion_agent hashes the PDF file.
        import hashlib
        with open(state["cv_path"], "rb") as f:
            cv_hash = hashlib.sha256(f.read()).hexdigest()
            
        _intelligence.add_candidate(
            candidate_id=candidate_id,
            embedding=state["candidate_embedding"],
            cv_hash=cv_hash,
            profile=state["candidate_profile"]
        )

    # Update state with Intelligence results
    state.update({
        "raw_scores": {
            "skill": base_match["skill_score"],
            "experience": base_match["experience_score"],
            "degree": base_match["education_score"],
            "semantic": base_match["raw_score"],
            "seniority": 1.0  # Placeholder or computed if available
        },
        "final_score": final_score,
        "risk_score": risk_score,
        "gate_status": gate_status,
        "matched_skills": base_match["matched_skills"],
        "missing_skills": base_match["missing_skills"],
        "failed_critical": [f for f in base_match.get("failed_critical", []) if f],
        "confidence_score": final_conf,
        "needs_manual_review": gate_status == "REVIEW"
    })

    # ── 3. ORCHESTRATION LAYER (LLM Explanation) ──
    # Run the final LLM node to generate rationale
    explanation_res = await explanation_node(state)
    state.update(explanation_res)

    # ── 4. PERSISTENCE LAYER ──
    if job_id and candidate_id:
        try:
            from api.models import MatchResult
            
            # Serialize state for persistence (clean up complex types if needed)
            persist_state = {k: v for k, v in state.items() if k != 'audit_log'}
            
            MatchResult.objects.update_or_create(
                job_id=job_id,
                candidate_id=candidate_id,
                defaults={
                    'score': final_score,
                    'result_data': persist_state,
                    'is_stale': False
                }
            )
            logger.info("Persisted match result for job %s, candidate %s", job_id, candidate_id)
        except Exception as e:
            logger.error("Failed to persist match result: %s", e)

    return state
