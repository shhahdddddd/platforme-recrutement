import json
import logging
import pickle
import re
from typing import Dict, List, TypedDict

import numpy as np
from asgiref.sync import sync_to_async
from django.conf import settings
from langgraph.graph import END, StateGraph

from ..retrieval.vector_store import hybrid_search
from ..preprocessing.query_expansion import extract_job_key_terms
from ...utils import call_ollama, tokenize_technical, cosine_similarity
from ...models import QuizQuestion, ParentChunk

logger = logging.getLogger(__name__)

# Domain-aware configuration for industry-agnostic question generation
DOMAIN_CONFIG = {
    "software_engineering": {
        "question_types": ["mcq", "debugging", "code_reasoning", "technical"],
        "style": "technical_implementation",
        "examples": {
            "intern": "What is the purpose of ___ in {skill}?",
            "junior": "How would you use {skill} to solve...",
            "mid": "Debug this code using {skill}",
            "senior": "Design a system using {skill}. What trade-offs?"
        }
    },
    "sales": {
        "question_types": ["situational", "behavioral", "roleplay"],
        "style": "situational_behavioral",
        "examples": {
            "intern": "What is {skill} and why is it important?",
            "junior": "Describe a time you used {skill}",
            "mid": "A customer objects to price. How do you handle it using {skill}?",
            "senior": "Design a sales strategy using {skill} for a complex deal"
        }
    },
    "finance": {
        "question_types": ["analytical", "calculation", "case_study"],
        "style": "analytical_calculation",
        "examples": {
            "intern": "Define {skill} and give an example",
            "junior": "Calculate {skill} for this scenario",
            "mid": "Analyze this financial statement using {skill}",
            "senior": "Evaluate this investment using {skill}. What's the risk?"
        }
    },
    "healthcare": {
        "question_types": ["scenario", "protocol", "clinical"],
        "style": "scenario_protocol",
        "examples": {
            "intern": "What is {skill} and when is it used?",
            "junior": "A patient presents with X. Apply {skill}",
            "mid": "Handle this emergency using {skill} protocol",
            "senior": "Design a care protocol using {skill} for complex cases"
        }
    },
    "marketing": {
        "question_types": ["strategic", "analytical", "creative"],
        "style": "strategic_analytical",
        "examples": {
            "intern": "What is {skill} in marketing?",
            "junior": "How would you apply {skill} to a campaign?",
            "mid": "Analyze this campaign's {skill} performance",
            "senior": "Develop a marketing strategy using {skill}"
        }
    },
    "hr": {
        "question_types": ["behavioral", "situational", "compliance"],
        "style": "behavioral_situational",
        "examples": {
            "intern": "What is {skill} in HR?",
            "junior": "Describe a situation requiring {skill}",
            "mid": "Handle this employee issue using {skill}",
            "senior": "Design an HR policy using {skill}"
        }
    },
    "general": {
        "question_types": ["mcq", "situational", "behavioral"],
        "style": "general_professional",
        "examples": {
            "intern": "What is {skill}?",
            "junior": "How would you use {skill} in your work?",
            "mid": "Describe a challenging situation using {skill}",
            "senior": "How would you lead a team using {skill}?"
        }
    }
}

# Domain detection keywords
DOMAIN_KEYWORDS = {
    "software_engineering": ["javascript", "python", "java", "react", "angular", "docker", "kubernetes", 
                             "developer", "engineer", "coding", "programming", "software", "backend", 
                             "frontend", "fullstack", "devops", "api", "database", "sql", "nosql",
                             "git", "agile", "scrum", "testing", "debugging", "algorithm"],
    "sales": ["sales", "selling", "revenue", "quota", "prospecting", "lead", "closing", "negotiation",
              "crm", "pipeline", "account", "customer", "deal", "commission", "b2b", "b2c"],
    "finance": ["finance", "accounting", "financial", "budget", "investment", "roi", "npv", 
                "balance sheet", "cash flow", "audit", "tax", "banking", "equity", "stock", 
                "trading", "risk", "compliance", "cfa", "cpa"],
    "healthcare": ["medical", "healthcare", "clinical", "patient", "nurse", "doctor", "physician",
                   "pharmacy", "hospital", "diagnosis", "treatment", "care", "medicine", "emergency",
                   "surgery", "therapy", "mental health", "epidemiology"],
    "marketing": ["marketing", "brand", "campaign", "digital", "seo", "sem", "social media",
                  "content", "advertising", "ppc", "conversion", "funnel", "analytics", "growth",
                  "product marketing", "market research"],
    "hr": ["hr", "human resources", "recruiting", "talent", "payroll", "benefits", "compliance",
           "employee", "onboarding", "performance", "training", "culture", "diversity", "labor"]
}


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
    seniority_level: str  # "intern" | "junior" | "mid" | "senior"
    job_key_terms: List[str]
    current_question_index: int
    target_difficulty: str

    # RAG coordination
    min_seniority_score: int
    target_cluster: int
    target_focus: str
    hyde_query: str
    question_style: str  # adaptive based on seniority level
    covered_focuses: List[str]
    
    # Level-specific constraints (NEW)
    level_config: Dict  # Style, question types, constraints per seniority
    forbidden_concepts: List[str]  # Concepts too advanced for level

    # Skill extraction (NEW)
    extracted_skills: List[Dict]
    normalized_skills: List[Dict]
    target_skill: Dict
    skill_extraction_source: str
    next_skill: Dict
    remaining_skills: List[Dict]
    covered_concepts: List[str]  # Track concepts for diversity

    # Results
    retrieved_chunks: List[Dict]
    validated_chunks: List[Dict]
    generated_question: Dict
    retrieval_mode: str
    kb_gap_detected: bool
    fallback_reason: str
    quality_passed: bool

    # Domain awareness
    domain: str
    domain_config: Dict

    # Control
    retry_count: int
    is_cold_start: bool
    hallucination_flag: bool
    errors: List[str]


# Level-specific configuration for adaptive question generation
LEVEL_CONFIG = {
    "intern": {
        "style": "basic_understanding",
        "question_types": ["definition", "simple_mcq"],
        "max_concepts_per_question": 1,
        "allow_trick": False,
        "focus_areas": ["fundamentals", "core concepts", "basics"],
        "forbidden_concepts": ["architecture", "scalability", "distributed system", "optimization", "trade-offs", "design patterns"],
        "description": "Test basic understanding only, no real-world assumptions",
        "skill_weight": {"fundamentals": 0.7, "practical": 0.3}
    },
    "junior": {
        "style": "applied_basics",
        "question_types": ["mcq", "simple_scenario"],
        "max_concepts_per_question": 1,
        "allow_trick": False,
        "focus_areas": ["basic usage", "simple scenarios", "common commands"],
        "forbidden_concepts": ["system design", "distributed architecture", "performance tuning"],
        "description": "Simple real usage, no complex scenarios",
        "skill_weight": {"fundamentals": 0.5, "practical": 0.5}
    },
    "mid": {
        "style": "practical",
        "question_types": ["scenario", "debugging", "troubleshooting"],
        "max_concepts_per_question": 2,
        "allow_trick": True,
        "focus_areas": ["debugging", "practical scenarios", "problem solving"],
        "forbidden_concepts": ["enterprise architecture", "large-scale design"],
        "description": "Debugging and practical scenarios",
        "skill_weight": {"practical": 0.6, "advanced": 0.4}
    },
    "senior": {
        "style": "architecture",
        "question_types": ["design", "tradeoff", "system_design", "optimization"],
        "max_concepts_per_question": 3,
        "allow_trick": True,
        "focus_areas": ["system design", "trade-offs", "architecture decisions", "optimization"],
        "forbidden_concepts": [],  # No restrictions
        "description": "System design, trade-offs, and advanced concepts",
        "skill_weight": {"advanced": 0.7, "architecture": 0.3}
    }
}


async def domain_detection_node(state: QuizState):
    """Node 0 - Detect industry/domain from job description and KB metadata.
    
    Enables domain-aware question generation for any industry.
    """
    job_title = state.get("job_title", "").lower()
    job_desc = state.get("job_description", "").lower()
    combined_text = f"{job_title} {job_desc}"
    
    # Step 1: Count keyword matches per domain
    domain_scores = {}
    for domain, keywords in DOMAIN_KEYWORDS.items():
        score = sum(1 for keyword in keywords if keyword in combined_text)
        if score > 0:
            domain_scores[domain] = score
    
    # Step 2: If no clear match, use LLM classification
    detected_domain = None
    if domain_scores:
        detected_domain = max(domain_scores, key=domain_scores.get)
        logger.info(f"Domain detected via keywords: {detected_domain} (score: {domain_scores[detected_domain]})")
    else:
        # Fallback to LLM
        try:
            prompt = f"""Classify this job into one industry category:

Job Title: {job_title}
Job Description: {job_desc[:500]}

Categories: software_engineering, sales, finance, healthcare, marketing, hr, general

Return ONLY the category name, nothing else."""
            
            response = await call_ollama(prompt, model=settings.OLLAMA_FAST_MODEL)
            detected_domain = response.strip().lower()
            if detected_domain not in DOMAIN_CONFIG:
                detected_domain = "general"
            logger.info(f"Domain detected via LLM: {detected_domain}")
        except Exception as e:
            logger.warning(f"LLM domain detection failed: {e}")
            detected_domain = "general"
    
    # Get domain configuration
    domain_config = DOMAIN_CONFIG.get(detected_domain, DOMAIN_CONFIG["general"])
    
    return {
        "domain": detected_domain,
        "domain_config": domain_config
    }


async def calibrator_node(state: QuizState):
    """Node 1 - Adaptive difficulty calibrator with granular seniority levels.
    
    Maps seniority to specific question constraints and styles.
    """
    diff = state["target_difficulty"]
    sen = state.get("seniority_level", "mid").lower()
    
    # Normalize seniority input
    if sen in {"intern", "internship", "entry", "trainee"}:
        level = "intern"
    elif sen in {"junior", "jr", "entry-level", "associate"}:
        level = "junior"
    elif sen in {"senior", "sr", "lead", "principal", "staff"}:
        level = "senior"
    else:
        level = "mid"  # Default
    
    config = LEVEL_CONFIG.get(level, LEVEL_CONFIG["mid"])
    
    # Seniority score for metadata filtering (1-4 scale)
    score_map = {"intern": 1, "junior": 1, "mid": 2, "senior": 3}
    if diff == "hard":
        score = score_map.get(level, 2) + 1
    elif diff == "easy":
        score = max(1, score_map.get(level, 2) - 1)
    else:
        score = score_map.get(level, 2)

    return {
        "min_seniority_score": max(1, min(score, 4)),
        "question_style": config["style"],
        "level_config": config,
        "forbidden_concepts": config["forbidden_concepts"],
        "seniority_normalized": level
    }


async def query_builder_node(state: QuizState):
    """Node 2 - Build clean retrieval query from job description.
    
    Responsibility: Query shaping only (NO skill selection)
    """
    # Extract and clean keywords
    key_terms = _unique_preserve_order(
        state.get("job_key_terms") or extract_job_key_terms(state["job_title"], state["job_description"])
    )
    
    # Build clean query: title + key terms (limited)
    query_parts = [state['job_title']] + key_terms[:3]
    query = " ".join(query_parts)
    
    return {
        "hyde_query": query,  # Kept for API compat
        "job_key_terms": key_terms,
        "search_query": query
    }


async def hybrid_retrieve_node(state: QuizState):
    """Node 3 - Hybrid BM25 + ChromaDB with aggressive metadata filtering."""
    if state.get("is_cold_start"):
        return {
            "retrieved_chunks": [],
            "retrieval_mode": "job_description_fallback",
            "kb_gap_detected": True,
            "fallback_reason": "No ready knowledge-base documents are available for this company.",
        }

    company_id = state["company_id"]
    min_score = state["min_seniority_score"]
    key_terms = state.get("job_key_terms", [])
    target_focus = state.get("target_focus", "")
    hyde_query = state["hyde_query"]
    
    # 🔥 NEW: Extract domain from job description for filtering
    job_desc = state.get("job_description", "")
    domain_hints = []
    if "react" in job_desc.lower() or "frontend" in job_desc.lower():
        domain_hints.append("frontend")
    if "python" in job_desc.lower() or "django" in job_desc.lower():
        domain_hints.append("backend")
    if "docker" in job_desc.lower() or "kubernetes" in job_desc.lower():
        domain_hints.append("devops")
    
    # 🔥 NEW: Build aggressive metadata filter
    metadata_filter = {
        "seniority_min": min_score,
        # "quality_score": {"$gte": 0.7},  # Only high-quality chunks
    }
    if domain_hints:
        metadata_filter["domain"] = domain_hints

    # Use ChromaDB hybrid search with metadata filtering
    retrieved = await sync_to_async(hybrid_search)(
        company_id=int(company_id),
        query=hyde_query,
        key_terms=key_terms,
        target_focus=target_focus,
        n_results=15,  # Get more for quality filtering
        seniority_min=min_score,
        semantic_weight=0.7,
        bm25_weight=0.3,
        metadata_filter=metadata_filter  # 🔥 NEW: Pass filter
    )

    # Format results for downstream nodes
    formatted_chunks = []
    for result in retrieved:
        metadata = result.get('metadata', {})
        formatted_chunks.append({
            "id": result['id'],
            "content": result['content'],
            "knn_score": 1.0 - result.get('distance', 0.0),  # Convert distance to similarity
            "bm25_score": result.get('bm25_score', 0.0),
            "focus_overlap": _token_overlap_ratio(result['content'], [target_focus]) if target_focus else 0.0,
            "key_term_overlap": _token_overlap_ratio(result['content'], key_terms),
            "relevance_score": result.get('combined_score', 0.0),
        })

    return {
        "retrieved_chunks": formatted_chunks,
        "retrieval_mode": "kb_grounded",
        "kb_gap_detected": False,
        "fallback_reason": "",
    }



def _is_quality_chunk(chunk: Dict) -> bool:
    """Check if chunk has educational value (not just similarity)."""
    content = chunk.get("content", "")
    if len(content) < 100:  # Too short
        return False
    
    # Check for boilerplate content
    boilerplate_phrases = [
        "all rights reserved", "copyright", "table of contents",
        "page \d+ of \d+", "confidential", "disclaimer"
    ]
    content_lower = content.lower()
    for phrase in boilerplate_phrases:
        if phrase in content_lower:
            return False
    
    # Check for technical/educational signal
    educational_markers = [
        "?", "example", "usage", "implement", "function", "method",
        "class", "api", "syntax", "parameter", "return", "error"
    ]
    has_signal = any(marker in content_lower for marker in educational_markers)
    
    return has_signal


async def rerank_node(state: QuizState):
    """Node 4 - Quality-aware reranking with signal-based filtering.
    
    Responsibility: Filter by quality (not just similarity), then rerank.
    """
    chunks = state.get("retrieved_chunks", [])
    if not chunks:
        return {"validated_chunks": [], "retrieval_mode": "job_description_fallback"}
    
    # 🔥 NEW: Quality filter first (remove low-signal chunks)
    quality_chunks = [c for c in chunks if _is_quality_chunk(c)]
    
    if not quality_chunks:
        # Fallback: use original chunks but warn
        quality_chunks = chunks[:3]  # At least try with top 3
    
    # Sort by combined relevance
    reranked = sorted(
        quality_chunks,
        key=lambda chunk: (
            chunk.get("relevance_score", 0.0),
            chunk.get("knn_score", 0.0),
            chunk.get("bm25_score", 0.0),
        ),
        reverse=True,
    )
    
    # Apply threshold and limit
    validated = [c for c in reranked if c.get("relevance_score", 0) >= 0.6][:5]
    
    return {
        "validated_chunks": validated,
        "retrieval_mode": "kb_grounded" if validated else "job_description_fallback",
        "kb_gap_detected": not validated
    }


async def extract_skills_node(state: QuizState):
    """Node 5 - Extract skills from job description + chunks (LLM-powered).
    
    Responsibility: Extract and prioritize skills using LLM.
    """
    chunks = state.get("validated_chunks", [])
    job_desc = state.get("job_description", "")
    
    # Step 1: Extract from job description (primary source)
    prompt_job = f"""Extract the most important skills for evaluating a candidate.

Job Description:
{job_desc[:1000]}

Rules:
- Max 7 skills
- Prioritize technical skills
- Avoid generic words like "teamwork" unless explicitly required
- Consider the role: {state['job_title']}

Return JSON:
[
  {{"skill": "Docker", "importance": "high", "type": "technical"}},
  {{"skill": "REST APIs", "importance": "medium", "type": "technical"}}
]"""
    
    try:
        response_job = await call_ollama(prompt_job, model=settings.OLLAMA_FAST_MODEL)
        primary_skills = json.loads(response_job.strip(" \n`"))
        if not isinstance(primary_skills, list):
            primary_skills = []
    except Exception:
        # Fallback: extract from job_key_terms
        primary_skills = [{"skill": t, "importance": "medium", "type": "technical"} 
                         for t in state.get("job_key_terms", [])[:5]]
    
    # Step 2: Extract SPECIFIC CONCEPTS from KB chunks (NOT just skills)
    # This is the key to generating diverse, KB-grounded questions
    chunk_concepts = []
    if chunks:
        chunk_text = "\n\n".join([f"Passage {i+1}: {c.get('content', '')[:600]}" for i, c in enumerate(chunks[:4])])
        prompt_concepts = f"""You are analyzing knowledge base documents for technical interview preparation.

Extract 5-8 SPECIFIC technical concepts that could be tested in interview questions.
These should be SUB-TOPICS within the main skill, NOT the skill itself.

Example: If skill is "JavaScript", extract concepts like:
- closures (not just "JavaScript")
- promises/async-await
- event loop
- prototype chain
- hoisting
- event delegation

Passages from knowledge base:
{chunk_text}

Extract concepts mentioned in these passages that candidates should know.
Return JSON:
[
  {{"concept": "closures", "skill": "JavaScript", "context": "how lexical scoping works"}},
  {{"concept": "promises", "skill": "JavaScript", "context": "async operation handling"}}
]"""
        
        try:
            response_chunks = await call_ollama(prompt_concepts, model=settings.OLLAMA_FAST_MODEL)
            chunk_concepts = json.loads(response_chunks.strip(" \n`"))
            if not isinstance(chunk_concepts, list):
                chunk_concepts = []
        except Exception as e:
            logger.warning(f"Concept extraction failed: {e}")
            chunk_concepts = []
    
    # Convert concepts to skill format for compatibility
    chunk_skills = []
    for concept in chunk_concepts:
        if isinstance(concept, dict) and concept.get("concept"):
            chunk_skills.append({
                "skill": concept["concept"],  # The specific concept (e.g., "closures")
                "parent_skill": concept.get("skill", state["job_title"]),  # Parent skill (e.g., "JavaScript")
                "importance": "high",  # KB concepts are high priority
                "type": "technical",
                "context": concept.get("context", ""),
                "from_kb": True  # Flag to indicate this came from KB
            })
    
    # Step 3: Merge and deduplicate (KB concepts prioritized FIRST)
    # KB concepts come first because they're specific and grounded in company docs
    seen = set()
    merged = []
    
    # Add KB concepts first (high priority)
    for skill in chunk_skills:
        name = skill.get("skill", "").strip()
        key = name.lower()
        if key and key not in seen:
            seen.add(key)
            skill["difficulty"] = skill.get("difficulty", "medium")
            skill["from_kb"] = True
            merged.append(skill)
    
    # Then add job description skills (if not duplicates)
    for skill in primary_skills:
        name = skill.get("skill", "").strip()
        key = name.lower()
        if key and key not in seen:
            seen.add(key)
            importance = skill.get("importance", "medium")
            difficulty_map = {"high": "hard", "medium": "medium", "low": "easy"}
            skill["difficulty"] = difficulty_map.get(importance, "medium")
            skill["from_kb"] = False
            merged.append(skill)
    
    return {
        "extracted_skills": merged[:7],  # Max 7 skills
        "skill_count": len(merged),
        "extraction_source": "llm_enhanced"
    }


async def normalize_skills_node(state: QuizState):
    """Node 6 - Normalize, deduplicate, and prepare skill queue."""
    skills = state.get("extracted_skills", [])
    
    if not skills:
        # Ultimate fallback
        return {
            "normalized_skills": [{"skill": state["job_title"], "difficulty": "medium"}],
            "next_skill": None,
            "remaining_skills": []
        }
    
    # Sort by importance (high -> medium -> low)
    importance_order = {"high": 0, "medium": 1, "low": 2}
    sorted_skills = sorted(skills, key=lambda s: importance_order.get(s.get("importance"), 1))
    
    # Normalize
    normalized = []
    for skill in sorted_skills:
        normalized.append({
            "skill": skill["skill"],
            "difficulty": skill.get("difficulty", "medium"),
            "importance": skill.get("importance", "medium"),
            "type": skill.get("type", "technical"),
            "normalized": skill["skill"].lower()
        })
    
    # Pick next skill for question generation
    next_skill = normalized[0] if normalized else None
    remaining = normalized[1:] if len(normalized) > 1 else []
    
    return {
        "normalized_skills": normalized,
        "next_skill": next_skill,
        "remaining_skills": remaining,
        "target_skill": next_skill  # For single question generation
    }


async def synthesize_node(state: QuizState):
    """Node 7 - Adaptive skill-focused MCQ synthesis with level constraints.
    
    Responsibility: Generate level-appropriate questions per skill.
    """
    chunks = state.get("validated_chunks", [])
    target_skill = state.get("target_skill", {})
    level_config = state.get("level_config", LEVEL_CONFIG["mid"])
    covered_concepts = state.get("covered_concepts", [])
    fallback_mode = state.get("is_cold_start") or state.get("kb_gap_detected") or not chunks
    
    skill_name = target_skill.get("skill", state["job_title"])
    skill_difficulty = target_skill.get("difficulty", "medium")
    
    # Level-specific parameters
    level = state.get("seniority_normalized", "mid")
    
    # 🔥 Domain-aware configuration
    domain_config = state.get("domain_config", DOMAIN_CONFIG["general"])
    domain = state.get("domain", "general")
    
    # Merge level config with domain config (domain takes precedence for question types)
    style = domain_config.get("style", level_config.get("style", "practical"))
    question_types = domain_config.get("question_types", level_config.get("question_types", ["mcq"]))
    max_concepts = level_config.get("max_concepts_per_question", 1)
    forbidden = level_config.get("forbidden_concepts", [])
    level_description = level_config.get("description", "Practical questions")
    
    if not chunks and not fallback_mode:
        return {"errors": ["No relevant context found after retries"]}

    passages = ""
    for index, chunk in enumerate(chunks[:3]):
        passages += f"Passage {index + 1}: {chunk['content']}\n\n"

    source_val = "job_description" if fallback_mode else "internal_knowledge_base"
    
    # Concept diversity
    concepts_covered = ", ".join(covered_concepts) if covered_concepts else "none yet"
    forbidden_str = ", ".join(forbidden) if forbidden else "none"
    
    # 🔥 Domain-aware examples from DOMAIN_CONFIG
    domain_examples = domain_config.get("examples", {})
    examples = domain_examples.get(level, f"Ask a practical question about {skill_name}")
    # Replace {skill} placeholder with actual skill name
    examples = examples.replace("{skill}", skill_name)
    
    # 🔥 NEW: Structured generation schema with strict constraints
    MCQ_SCHEMA = {
        "type": "object",
        "required": ["skill", "level", "question_text", "choices", "correct_choice", "explanation"],
        "properties": {
            "skill": {"type": "string", "description": f"Must be: {skill_name}"},
            "level": {"type": "string", "enum": ["intern", "junior", "mid", "senior"]},
            "question_text": {"type": "string", "minLength": 20},
            "choices": {
                "type": "object",
                "required": ["A", "B", "C", "D"],
                "properties": {
                    "A": {"type": "string"},
                    "B": {"type": "string"},
                    "C": {"type": "string"},
                    "D": {"type": "string"}
                }
            },
            "correct_choice": {"type": "string", "enum": ["A", "B", "C", "D"]},
            "explanation": {"type": "string", "minLength": 10}
        }
    }
    
    # 🔥 NEW: Hard constraints prompt - STRICTER for KB grounding
    context_type = "knowledge base documents" if not fallback_mode else "job description"
    CONSTRAINTS = f"""
CRITICAL CONSTRAINTS (violations = rejection):
1. ONLY use technologies/concepts explicitly mentioned in the {context_type} above
2. Questions MUST be 100% answerable from the provided {context_type} (NO outside/general knowledge)
3. Each question MUST test the SPECIFIC skill: {skill_name}
4. DO NOT invent frameworks, versions, libraries, or features not explicitly in the {context_type}
5. Question difficulty MUST match {level} level requirements
6. All 4 choices MUST be plausible but only ONE correct
7. 🔥 ZERO TOLERANCE: If the {context_type} doesn't contain enough detail, generate a simpler question that IS fully covered
8. NEVER generate questions requiring knowledge beyond what's in the {context_type}
"""
    
    MCQ_FORMAT = f"""
Return EXACTLY one valid JSON object matching this schema:
{{
  "skill": "{skill_name}",
  "level": "{level}",
  "concept_tested": "Specific sub-topic of {skill_name}",
  "question_text": "The question text",
  "choices": {{"A": "First specific answer option", "B": "Second specific answer option", "C": "Third specific answer option", "D": "Fourth specific answer option"}},
  "correct_choice": "B",
  "explanation": "Why correct answer is right"
}}

IMPORTANT: Each choice must be a complete, meaningful answer (not empty, not "...", not "Option X")."""

    # Build targeted prompt based on source
    if not fallback_mode and chunks:
        # KB-grounded: Use specific concept from KB chunks
        kb_grounding = f"""
KNOWLEDGE BASE CONTEXT:
{passages}

TARGET CONCEPT TO TEST: {skill_name}
This concept was extracted from your company's knowledge base documents above.
"""
    else:
        # Fallback mode
        kb_grounding = f"Job Description: {state['job_description'][:500]}"

    # Domain-aware interviewer description
    interviewer_role = {
        "software_engineering": "technical interviewer",
        "sales": "sales assessment specialist",
        "finance": "financial analyst interviewer",
        "healthcare": "clinical assessment specialist",
        "marketing": "marketing assessment specialist",
        "hr": "HR assessment specialist",
        "general": "professional interviewer"
    }.get(domain, "professional interviewer")
    
    # Domain-aware question style description
    style_description = {
        "technical_implementation": "technical and implementation-focused",
        "situational_behavioral": "situational and behavioral",
        "analytical_calculation": "analytical and calculation-based",
        "scenario_protocol": "scenario and protocol-based",
        "strategic_analytical": "strategic and analytical",
        "general_professional": "professional competency-based"
    }.get(style, "practical")

    prompt = f"""You are a senior {interviewer_role} creating assessment questions for a {level}-level candidate.

DOMAIN: {domain.replace('_', ' ').title()}
QUESTION STYLE: {style_description}
CANDIDATE LEVEL: {level}
LEVEL REQUIREMENTS: {level_description}

{kb_grounding}

🔥 CRITICAL INSTRUCTIONS:
1. Generate a {style_description} question SPECIFICALLY about: {skill_name}
2. The question MUST be 100% answerable from the provided context above
3. Test a DIFFERENT specific concept than: {concepts_covered}
4. Do NOT ask generic questions like "What is {skill_name}?"
5. Use the appropriate question type for this domain: {', '.join(question_types)}
6. Make the question relevant to real-world {domain.replace('_', ' ')} scenarios

DOMAIN-SPECIFIC GUIDANCE:
- Software Engineering: Focus on technical implementation, debugging, system design
- Sales: Use situational "What would you do if..." scenarios
- Finance: Include calculations, analysis, and financial reasoning
- Healthcare: Present patient scenarios and protocol applications
- Marketing: Focus on strategy, analytics, and campaign design
- HR: Use behavioral and compliance-focused scenarios

{examples}

LEVEL-SPECIFIC RULES:
- Intern: Test basic definitions and understanding only
- Junior: Simple practical application without complex scenarios
- Mid: Problem-solving in realistic scenarios
- Senior: Strategy, design, trade-offs, and leadership

{CONSTRAINTS}

{MCQ_FORMAT}
"""

    response = await call_ollama(prompt, model=settings.OLLAMA_SYNTH_MODEL)
    try:
        generated = json.loads(response.strip(" \n`"))
        
        # Normalize choices - handle empty strings and placeholders
        raw_choices = generated.get("choices") or {}
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
        
        correct = (generated.get("correct_choice") or "A").strip().upper()
        if correct not in {"A", "B", "C", "D"}:
            correct = "A"
        
        concept = generated.get("concept_tested", skill_name)
        
        generated_question = {
            "concept_tested": concept,
            "question_text": generated.get("question_text", ""),
            "choices": choices_list,
            "correct_choice": correct,
            "explanation": generated.get("explanation", ""),
            "skill_targeted": skill_name,
            "difficulty": skill_difficulty,
            "level": level,
            "question_type": question_types[0] if question_types else "mcq",
            "follow_up_hint": "",
            "reference_answer": generated.get("explanation", ""),
            "source": source_val,
            "source_passage_indices": [],
            "hallucination_flag": fallback_mode  # Flag when not from KB
        }
        
        return {
            "generated_question": generated_question,
            "covered_concepts": covered_concepts + [concept]
        }
    except Exception:
        return {"retry_count": state["retry_count"] + 1}





async def quality_grader_node(state: QuizState):
    """Node 8 - Level-aware validation rules with hard constraints.
    
    Responsibility: Validate question meets level-specific requirements.
    """
    q_data = state.get("generated_question")
    level_config = state.get("level_config", LEVEL_CONFIG["mid"])
    
    if not q_data:
        return {"hallucination_flag": False, "quality_passed": False}
    
    errors = []
    question_text = q_data.get("question_text", "").lower()
    
    # Rule 1: Basic validation
    if len(q_data.get("question_text", "")) < 10:
        errors.append("Question too short")
    
    choices = q_data.get("choices", [])
    if len(choices) != 4:
        errors.append(f"Expected 4 choices, got {len(choices)}")
    
    correct = q_data.get("correct_choice", "")
    if correct not in {"A", "B", "C", "D"}:
        errors.append(f"Invalid correct_choice: {correct}")
    
    # Rule 2: HARD CONSTRAINT - Forbidden concepts for level
    forbidden = level_config.get("forbidden_concepts", [])
    for concept in forbidden:
        if concept.lower() in question_text:
            errors.append(f"Forbidden concept for this level: '{concept}'")
    
    # Rule 3: Level-appropriateness check
    level = q_data.get("level", "mid")
    if level == "intern":
        # Intern questions should be simple definitions
        if any(word in question_text for word in ["design", "architect", "scale", "optimize", "trade-off"]):
            errors.append("Intern question contains advanced concepts")
    
    # Rule 4: Skill relevance (soft check)
    skill = q_data.get("skill_targeted", "").lower()
    if skill and skill not in question_text:
        # Just log, don't fail
        pass
    
    if errors:
        return {
            "retry_count": state["retry_count"] + 1,
            "hallucination_flag": True,
            "quality_passed": False,
            "validation_errors": errors,
            "errors": list(state.get("errors", [])) + errors
        }
    
    return {"hallucination_flag": False, "quality_passed": True}


async def store_node(state: QuizState):
    """Node 8 - Deduplicate focus areas and store the question."""
    from ...models import QuizQuestion
    from ...utils import redis_client

    q_data = state.get("generated_question")
    if not q_data or state.get("hallucination_flag"):
        return {}

    session_id = state["session_id"]
    focus_label = q_data.get("skill_targeted") or state.get("target_focus") or state["job_title"]
    lock_key = f"session:gen_lock:{session_id}"
    focus_key = f"session:focuses:{session_id}"
    current_index = state.get("current_question_index", 0)
    question_number = current_index + 1

    logger.info(f"[StoreNode] Session {session_id}, index={current_index}, storing as question_number={question_number}, focus='{focus_label}'")

    with redis_client.lock(lock_key, timeout=10):
        covered = [item.decode("utf-8") for item in redis_client.smembers(focus_key)]
        existing_question = await sync_to_async(
            lambda: QuizQuestion.objects.filter(session_id=session_id, question_number=question_number).first()
        )()
        # If focus already covered, add a suffix to make it unique
        if focus_label in covered:
            focus_label = f"{focus_label} (q{question_number})"

        await sync_to_async(QuizQuestion.objects.update_or_create)(
            session_id=session_id,
            question_number=question_number,
            defaults={
                "question_text": q_data["question_text"],
                "difficulty": q_data["difficulty"],
                "skill_targeted": focus_label,
                "reference_answer": q_data.get("reference_answer", q_data.get("explanation", "")),
                "explanation": q_data.get("explanation", ""),
                "choices": q_data.get("choices", []),
                "correct_choice": q_data.get("correct_choice", "A"),
                "follow_up_hint": q_data.get("follow_up_hint", ""),
                "source_passage_indices": q_data.get("source_passage_indices", []),
                "hyde_query": state.get("hyde_query", ""),
                "hallucination_flag": state.get("hallucination_flag", False),
            },
        )

        redis_client.sadd(focus_key, focus_label)

    return {}


def should_retry(state: QuizState):
    """Simplified retry logic - only check KB gap."""
    if state.get("kb_gap_detected"):
        return "synthesize"
    return "extract_skills"


def _build_quiz_graph():
    """Build domain-aware, industry-agnostic RAG pipeline."""
    workflow = StateGraph(QuizState)
    
    # Domain-aware pipeline nodes
    workflow.add_node("detect_domain", domain_detection_node)  # NEW: Domain detection
    workflow.add_node("calibrate", calibrator_node)
    workflow.add_node("query_builder", query_builder_node)
    workflow.add_node("retrieve", hybrid_retrieve_node)
    workflow.add_node("rerank", rerank_node)
    workflow.add_node("extract_skills", extract_skills_node)
    workflow.add_node("normalize_skills", normalize_skills_node)
    workflow.add_node("synthesize", synthesize_node)
    workflow.add_node("validate", quality_grader_node)
    workflow.add_node("store", store_node)

    # Domain-aware pipeline flow
    workflow.set_entry_point("detect_domain")  # Start with domain detection
    workflow.add_edge("detect_domain", "calibrate")
    workflow.add_edge("calibrate", "query_builder")
    workflow.add_edge("query_builder", "retrieve")
    workflow.add_edge("retrieve", "rerank")
    workflow.add_conditional_edges("rerank", should_retry)
    workflow.add_edge("extract_skills", "normalize_skills")
    workflow.add_edge("normalize_skills", "synthesize")
    workflow.add_edge("synthesize", "validate")
    workflow.add_edge("validate", "store")
    workflow.add_edge("store", END)

    return workflow.compile()


# Compiled once at module import — reused by every question generation task
_QUIZ_GRAPH = _build_quiz_graph()


def create_quiz_graph():
    """Return the shared compiled quiz graph singleton."""
    return _QUIZ_GRAPH
