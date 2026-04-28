"""
reasoning.py

LLM Reasoning Layer for domain-agnostic matching.
Decides if candidate traits are relevant to job requirements when embeddings
might be ambiguous (e.g., transferable skills).
"""

import logging
from typing import Dict, List, Any
from ...api.utils import call_llm

logger = logging.getLogger(__name__)

REASONING_PROMPT = """\
You are an expert recruitment analyst. 
Compare a Job Requirement against a Candidate's Evidence and decide if they match semantically or via transferable skills.

Job Requirement: "{requirement}"
Candidate Evidence: "{evidence}"

Consider:
1. Direct matching (e.g., "React" vs "React.js").
2. Transferable skills (e.g., "Project Management" vs "Team Lead").
3. Industry context (e.g., "Customer Service" is relevant to "Sales").
4. Semantic overlap.

Return ONLY a JSON object:
{{
  "related": boolean,
  "confidence": float (0.0 to 1.0),
  "reason": "brief explanation"
}}
"""

async def check_relevancy(requirement: str, evidence: str) -> Dict[str, Any]:
    """Ask LLM to verify if evidence satisfies a requirement."""
    prompt = REASONING_PROMPT.format(requirement=requirement, evidence=evidence)
    try:
        raw = await call_llm(prompt, system_prompt="Answer in JSON only.")
        # Simple JSON extraction
        import json
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"Reasoning layer failed: {e}")
        return {"related": False, "confidence": 0.0, "reason": "Error in reasoning"}

async def batch_reasoning(matches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Verify multiple matches in parallel."""
    import asyncio
    tasks = [check_relevancy(m["requirement"], m["evidence"]) for m in matches]
    results = await asyncio.gather(*tasks)
    return results
