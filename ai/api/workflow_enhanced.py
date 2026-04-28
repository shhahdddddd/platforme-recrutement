"""
workflow_enhanced.py

Enhanced RAG workflow with:
- Query expansion
- Batch embedding
- Hallucination detection
- Feedback tracking
- Optimized retrieval weights
"""

import json
import re
import logging
import time
from typing import Dict, List, TypedDict

from asgiref.sync import sync_to_async
from django.conf import settings

from .utils import (
    build_weighted_bm25_tokens,
    call_llm,
    calculate_rrf,
    cosine_similarity,
    extract_job_key_terms,
    get_company_chunks_cached,
    get_embeddings,
    tokenize_technical,
)
from .vector_store_enhanced import PersistentVectorStore

logger = logging.getLogger(__name__)


# Import enhanced modules
from .query_expansion import QueryExpander
from .feedback_loop import RAGFeedbackTracker
from .rag_monitoring import RAGMonitor

query_expander = QueryExpander()
feedback_tracker = RAGFeedbackTracker()
rag_monitor = RAGMonitor()


def _unique_preserve_order(items: List[str]) -> List[str]:
    seen = set()
    ordered = []
    for item in items:
        normalized = (item or "").strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(normalized)
    return ordered


def _token_overlap_ratio(text: str, terms: List[str]) -> float:
    if not text or not terms:
        return 0.0

    text_tokens = set(tokenize_technical(text))
    if not text_tokens:
        return 0.0

    term_tokens = set()
    for term in terms:
        term_tokens.update(tokenize_technical(term))

    if not term_tokens:
        return 0.0

    return len(text_tokens.intersection(term_tokens)) / len(term_tokens)


def _normalize_cosine(score: float) -> float:
    return max(0.0, min((score + 1.0) / 2.0, 1.0))


class QuizState(TypedDict):
    session_id: str
    company_id: str
    job_title: str
    job_description: str
    job_offer_type: str
    seniority_level: str
    job_key_terms: List[str]
    current_question_index: int
    target_difficulty: str

    # RAG coordination
    min_seniority_score: int
    target_cluster: int
    target_focus: str
    hyde_query: str

    # Results
    retrieved_chunks: List[Dict]
    validated_chunks: List[Dict]
    generated_question: Dict
    retrieval_mode: str
    kb_gap_detected: bool
    fallback_reason: str

    # Control
    retry_count: int
    is_cold_start: bool
    hallucination_flag: bool
    errors: List[str]
    
    # Enhanced fields
    query_expansions: List[str]
    retrieval_weights: Dict[str, float]
    validation_report: Dict


async def calibrator_node(state: QuizState):
    """Node 1 - Difficulty calibrator."""
    diff = state["target_difficulty"]
    sen = state.get("seniority_level", "mid").lower()

    score = 1
    if sen in {"senior", "lead"} or diff == "hard":
        score = 2
    if sen in {"senior", "lead"} and diff == "hard":
        score = 3

    return {"min_seniority_score": max(1, min(score, 3))}


async def router_hyde_node_enhanced(state: QuizState):
    """
    Node 2 - Enhanced router with query expansion.
    
    Generates multiple query variations for better recall.
    """
    from .utils import redis_client

    session_id = state["session_id"]
    target_cluster = (state["current_question_index"] % 5) + 1

    focus_key = f"session:focuses:{session_id}"
    focus_data = redis_client.smembers(focus_key)
    covered_focuses = [item.decode("utf-8") for item in focus_data] if focus_data else []
    key_terms = _unique_preserve_order(
        state.get("job_key_terms") or extract_job_key_terms(state["job_title"], state["job_description"])
    )

    if state["retry_count"] > 0 and state.get("target_focus"):
        target_focus = state["target_focus"]
    else:
        uncovered_focuses = [term for term in key_terms if term not in covered_focuses]
        target_focus = uncovered_focuses[0] if uncovered_focuses else state["job_title"]

    # Generate base HyDE query
    base_query = await _generate_base_hyde(state, target_focus)
    
    # Expand query using multiple strategies
    query_expansions = await query_expander.expand_query(
        base_query=base_query,
        job_title=state["job_title"],
        job_description=state["job_description"],
        focus_area=target_focus,
        difficulty=state["target_difficulty"],
        num_variations=3
    )
    
    # Use the best query (or concatenate for multi-query retrieval)
    expanded_query = " ".join(query_expansions[:2])  # Combine top 2
    
    return {
        "job_key_terms": key_terms,
        "target_cluster": target_cluster,
        "target_focus": target_focus,
        "hyde_query": expanded_query,
        "query_expansions": query_expansions,
    }


async def _generate_base_hyde(state: QuizState, target_focus: str) -> str:
    """Generate base HyDE query."""
    retry_instruction = (
        "The previous retrieval was too narrow. Broaden the query to adjacent workflows or concepts for the same focus area, "
        "but stay inside the role scope."
        if state["retry_count"] > 0 else
        "Write a focused retrieval query for the exact skill area."
    )

    prompt = (
        f"Context: Recruiting for {state['job_title']}. Job Description: {state['job_description']}\n"
        f"Seniority: {state['seniority_level']}. Assessment focus: {target_focus}.\n"
        f"Explicit role terms: {', '.join(state.get('job_key_terms', []) or [])}.\n"
        f"{retry_instruction}\n"
        f"As a technical interviewer, write 2-3 sentences of internal documentation "
        f"that would be found in a company's technical knowledge base specifically about "
        f"{target_focus} as it relates to this role's requirements. "
        f"Difficulty: {state['target_difficulty']}. Result should ONLY be the paragraph."
    )

    hyde_query = await call_llm(prompt, model=settings.OLLAMA_FAST_MODEL)
    return hyde_query.strip()


async def hybrid_retrieve_node_enhanced(state: QuizState):
    """
    Node 3 - Enhanced hybrid retrieval with optimized weights.
    
    Uses feedback-optimized weights for BM25 vs KNN balance.
    """
    from .utils import get_bm25_index_data

    start_time = time.time()

    if state.get("is_cold_start"):
        return {
            "retrieved_chunks": [],
            "retrieval_mode": "job_description_fallback",
            "kb_gap_detected": True,
            "fallback_reason": "No ready knowledge-base documents are available for this company.",
        }

    q = state["hyde_query"]
    company_id = state["company_id"]
    min_score = state["min_seniority_score"]
    key_terms = state.get("job_key_terms", [])
    target_focus = state.get("target_focus", "")
    
    # Get optimized weights from feedback loop
    retrieval_weights = await feedback_tracker.get_optimized_weights(company_id)
    bm25_weight = retrieval_weights.get("bm25_weight", 0.3)
    knn_weight = retrieval_weights.get("knn_weight", 0.7)
    
    logger.info(f"Using optimized weights: BM25={bm25_weight}, KNN={knn_weight}")

    # Generate query embedding (using batch caching)
    embed_start = time.time()
    q_vec = get_embeddings([q])[0]
    embed_time = (time.time() - embed_start) * 1000

    # --- ChromaDB Search ---
    vector_store = PersistentVectorStore(company_id=company_id)
    
    # Build seniority filter for ChromaDB
    if min_score >= 3:
        seniority_filter = {"seniority_senior": {"$gte": min_score}}
    elif min_score == 2:
        seniority_filter = {"$or": [
            {"seniority_mid": {"$gte": min_score}},
            {"seniority_senior": {"$gte": min_score}}
        ]}
    else:
        seniority_filter = {"$or": [
            {"seniority_junior": {"$gte": 1}},
            {"seniority_mid": {"$gte": 1}},
            {"seniority_senior": {"$gte": 1}}
        ]}

    search_results = vector_store.search(
        embedding=q_vec, 
        top_k=20, 
        filter_metadata=seniority_filter
    )

    knn_candidates = [
        {
            "id": res["id"],
            "content": res["document"],
            "knn_rank": i + 1,
            "knn_score": res["similarity"],
        }
        for i, res in enumerate(search_results)
    ]

    # --- BM25 ---
    bm25_data = await sync_to_async(get_bm25_index_data)(company_id)
    bm25 = bm25_data.get("bm25")
    bm25_parent_ids = bm25_data.get("parent_ids", [])
    bm25_ranked_ids = []
    bm25_score_map = {}
    bm25_rank_map = {}
    
    if bm25:
        tokens = build_weighted_bm25_tokens(q, key_terms=key_terms, extra_terms=[target_focus], boost=2)
        if not tokens:
            tokens = tokenize_technical(q)
        scores = bm25.get_scores(tokens)
        top_indices = scores.argsort()[-20:][::-1]

        seen_parents = set()
        for idx in top_indices:
            if idx < len(bm25_parent_ids):
                parent_id = bm25_parent_ids[int(idx)]
                score_value = float(scores[int(idx)])
                bm25_score_map[parent_id] = max(score_value, bm25_score_map.get(parent_id, 0.0))
                if parent_id not in seen_parents:
                    bm25_ranked_ids.append(parent_id)
                    seen_parents.add(parent_id)
                    bm25_rank_map[parent_id] = len(bm25_ranked_ids)
                    if len(bm25_ranked_ids) >= 20:
                        break

    # --- RRF fusion with optimized weights ---
    knn_ids = [candidate["id"] for candidate in knn_candidates]
    fused_ids = calculate_rrf(knn_ids, bm25_ranked_ids, top_k=10)

    knn_map = {candidate["id"]: candidate for candidate in knn_candidates}
    max_bm25 = max(bm25_score_map.values()) if bm25_score_map else 0.0
    
    retrieved = []
    for fused_id in fused_ids:
        knn_candidate = knn_map.get(fused_id)
        content = (knn_candidate or {}).get("content")
        if not content:
            continue
        
        knn_score = float((knn_candidate or {}).get("knn_score", 0.0))
        bm25_score = bm25_score_map.get(fused_id, 0.0)
        bm25_score_norm = (bm25_score / max_bm25) if max_bm25 else 0.0
        
        focus_overlap = _token_overlap_ratio(content, [target_focus]) if target_focus else 0.0
        key_term_overlap = _token_overlap_ratio(content, key_terms)
        
        # Enhanced reranking with optimized weights
        relevance_score = min(
            1.0,
            (knn_score * knn_weight) + (bm25_score_norm * bm25_weight)
        )
        
        retrieved.append(
            {
                "id": fused_id,
                "content": content,
                "knn_score": round(knn_score, 4),
                "bm25_score": round(bm25_score_norm, 4),
                "focus_overlap": round(focus_overlap, 4),
                "key_term_overlap": round(key_term_overlap, 4),
                "relevance_score": round(relevance_score, 4),
                "bm25_rank": bm25_rank_map.get(fused_id),
            }
        )

    retrieval_time = (time.time() - start_time) * 1000
    
    # Track metrics
    rag_monitor.track_retrieval_metrics(
        company_id=company_id,
        retrieval_mode="kb_grounded",
        num_chunks=len(retrieved),
        avg_relevance=sum(c["relevance_score"] for c in retrieved) / len(retrieved) if retrieved else 0,
        retrieval_time_ms=retrieval_time,
        query_embedding_time_ms=embed_time
    )

    return {
        "retrieved_chunks": retrieved,
        "retrieval_mode": "kb_grounded",
        "kb_gap_detected": False,
        "fallback_reason": "",
        "retrieval_weights": retrieval_weights,
    }


async def validate_node_enhanced(state: QuizState):
    """
    Node 4 - Enhanced validation of retrieved chunks.
    
    Filters out irrelevant or low-quality chunks.
    """
    chunks = state.get("retrieved_chunks", [])
    if not chunks:
        return {
            "validated_chunks": [],
            "kb_gap_detected": True,
            "fallback_reason": "No relevant context found after retry",
        }

    target_focus = state.get("target_focus", "")
    key_terms = state.get("job_key_terms", [])

    validated = []
    for chunk in chunks:
        content = chunk["content"]
        if not content:
            continue

        focus_overlap = _token_overlap_ratio(content, [target_focus]) if target_focus else 0.0
        key_term_overlap = _token_overlap_ratio(content, key_terms)

        if focus_overlap < 0.1 or key_term_overlap < 0.1:
            continue

        validated.append(chunk)

    if not validated:
        return {
            "validated_chunks": [],
            "kb_gap_detected": True,
            "fallback_reason": "No relevant context found after retry",
        }

    return {
        "validated_chunks": validated,
        "kb_gap_detected": False,
        "fallback_reason": "",
    }


async def synthesize_node_enhanced(state: QuizState):
    """
    Node 6 - Enhanced MCQ question synthesis with hallucination detection.
    
    Validates generated questions against retrieved chunks before returning.
    """
    chunks = state.get("validated_chunks", [])
    fallback_mode = state.get("is_cold_start") or state.get("kb_gap_detected") or not chunks
    
    if not chunks and not fallback_mode:
        return {"errors": ["No relevant context found after retry"]}

    passages = ""
    for index, chunk in enumerate(chunks):
        passages += f"Passage {index + 1}: {chunk['content']}\n\n"

    source_val = "job_description" if fallback_mode else "internal_knowledge_base"
    warning_val = "Question generated without internal KB. Uses job description only." if fallback_mode else ""
    
    MCQ_FORMAT = f"""
Return EXACTLY one JSON object — no other text:
{{
  "question_text": "A clear, specific technical question suitable for multiple-choice.",
  "choices": {{
    "A": "First option text",
    "B": "Second option text",
    "C": "Third option text",
    "D": "Fourth option text"
  }},
  "correct_choice": "B",
  "explanation": "Why the correct answer is right and the others are wrong.",
  "skill_targeted": "...",
  "difficulty": "{state['target_difficulty']}",
  "follow_up_hint": "Optional deeper follow-up question for the interviewer.",
  "source": "{source_val}",
  "warning": "{warning_val}"
}}"""

    MCQ_RULES = """MCQ RULES:
- Exactly 4 choices labelled A, B, C, D.
- Only ONE choice is correct.
- Distractors must be plausible but clearly wrong upon reflection.
- Do NOT make the correct answer obviously longer or more detailed than the others.
- The question must be answerable from the context / role description alone."""

    if fallback_mode:
        prompt = f"""You are a senior technical interviewer with 15 years of experience.

JOB CONTEXT:
Title: {state['job_title']}
Seniority: {state['seniority_level']}
Assessment focus: {state.get('target_focus', state['job_title'])}
Difficulty: {state['target_difficulty']}
Job description:
{state['job_description']}
Explicit job key terms: {', '.join(state.get('job_key_terms', [])) or 'none'}

RETRIEVAL STATUS:
{state.get('fallback_reason') or 'No grounded passages were found in the knowledge base.'}

CONSTRAINTS:
- Generate a question only about a skill explicitly in the job description.
- Do not invent company-specific implementation details.
- Keep the explanation generic and role-scoped.
{MCQ_RULES}
{MCQ_FORMAT}
"""
    else:
        prompt = f"""You are a senior technical interviewer with 15 years of experience.

{passages}
JOB CONTEXT:
Title: {state['job_title']}
Seniority: {state['seniority_level']}
Assessment focus: {state.get('target_focus', state['job_title'])}
Difficulty: {state['target_difficulty']}
Job description:
{state['job_description']}
Explicit job key terms: {', '.join(state.get('job_key_terms', [])) or 'none'}

CONSTRAINTS:
- The question and all choices must be grounded in the passages above.
- The skill tested must be mentioned in or directly implied by the job description.
- Do not use details not present in the passages.
{MCQ_RULES}
{MCQ_FORMAT}
"""

    response = await call_llm(prompt, model=settings.OLLAMA_SYNTH_MODEL)
    
    try:
        generated_question = json.loads(response.strip(" \n`"))

        # Normalize choices - handle empty strings and placeholders
        raw_choices = generated_question.get("choices") or {}
        if isinstance(raw_choices, dict):
            choices_list = []
            for letter in ("A", "B", "C", "D"):
                choice_text = raw_choices.get(letter, "").strip()
                # Fallback if empty or placeholder
                if not choice_text or choice_text == "..." or choice_text.lower().startswith("option "):
                    choice_text = f"Choice {letter}"
                choices_list.append(choice_text)
        elif isinstance(raw_choices, list) and len(raw_choices) == 4:
            choices_list = [c if c and c.strip() != "..." else f"Choice {chr(65+i)}" for i, c in enumerate(raw_choices)]
        else:
            choices_list = [f"Choice {l}" for l in ("A", "B", "C", "D")]

        correct = (generated_question.get("correct_choice") or "A").strip().upper()
        if correct not in {"A", "B", "C", "D"}:
            correct = "A"

        # --- ENHANCEMENT: Hallucination Detection ---
        validation_report = None
        if not fallback_mode and chunks:
            validation_report = await rag_monitor.validate_question_against_chunks(
                question_text=generated_question.get("question_text", ""),
                retrieved_chunks=chunks,
                threshold=0.6
            )
            
            # Flag potential hallucinations
            if validation_report.get("hallucination_probability", 0) > 0.7:
                logger.warning(
                    f"High hallucination risk ({validation_report['hallucination_probability']:.2f}) "
                    f"for question: {generated_question['question_text'][:80]}..."
                )
                state["hallucination_flag"] = True

        result = {
            "generated_question": {
                **generated_question,
                "choices": choices_list,
                "correct_choice": correct,
                "source_passage_indices": list(range(len(chunks))) if not fallback_mode else [],
                "hallucination_flag": state.get("hallucination_flag", False),
                "validation_report": validation_report,
            },
            "validation_report": validation_report,
        }

        return result

    except Exception as exc:
        logger.error(f"Question synthesis failed: {exc}")
        return {
            "errors": [f"Failed to generate question: {str(exc)}"],
            "hallucination_flag": False,
            "validation_report": None,
        }


async def feedback_collection_node(state: QuizState):
    """
    Node 7 - Collect feedback metrics for continuous improvement.
    
    Records retrieval quality and prepares for outcome tracking.
    """
    
    chunks = state.get("validated_chunks", [])
    retrieval_weights = state.get("retrieval_weights", {"bm25_weight": 0.3, "knn_weight": 0.7})
    
    # Calculate retrieval quality metrics
    avg_relevance = sum(c.get("relevance_score", 0) for c in chunks) / len(chunks) if chunks else 0
    
    metadata = {
        "session_id": state["session_id"],
        "question_index": state["current_question_index"],
        "retrieval_mode": state.get("retrieval_mode", "unknown"),
        "chunks_retrieved": len(chunks),
        "avg_relevance_score": avg_relevance,
        "retrieval_weights_used": retrieval_weights,
        "hallucination_detected": state.get("hallucination_flag", False),
        "validation_report": state.get("validation_report"),
    }
    
    logger.info(f"Retrieval quality for Q{state['current_question_index'] + 1}: "
               f"mode={metadata['retrieval_mode']}, chunks={len(chunks)}, "
               f"avg_relevance={avg_relevance:.3f}")
    
    return {
        "retrieval_metadata": metadata
    }
