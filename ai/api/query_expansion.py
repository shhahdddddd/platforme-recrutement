"""
query_expansion.py

Advanced query expansion techniques for improved RAG retrieval:
- HyDE (Hypothetical Document Embeddings)
- Query variation generation
- Synonym expansion
- Multi-query fusion
"""

import re
import json
import logging
from typing import List, Dict, Optional
from django.conf import settings

logger = logging.getLogger(__name__)


class QueryExpander:
    """
    Generate multiple query variations to improve recall.
    
    Strategies:
    1. HyDE: Generate hypothetical document
    2. Variations: Rephrase query in multiple ways
    3. Synonyms: Expand with technical synonyms
    4. Specificity ladder: More general and more specific queries
    """
    
    def __init__(self, model: str = None):
        self.model = model or settings.OLLAMA_FAST_MODEL
        
    async def expand_query(
        self,
        base_query: str,
        job_title: str,
        job_description: str,
        focus_area: str,
        difficulty: str,
        num_variations: int = 3
    ) -> List[str]:
        """
        Generate multiple query variations from a base query.
        
        Returns:
            List of expanded queries for multi-query retrieval
        """
        queries = [base_query]  # Always include original
        
        # Strategy 1: HyDE - Generate hypothetical documentation
        hyde_query = await self._generate_hyde(
            job_title, job_description, focus_area, difficulty
        )
        if hyde_query:
            queries.append(hyde_query)
        
        # Strategy 2: Query variations
        variations = await self._generate_variations(
            base_query, num_variations - 1
        )
        queries.extend(variations)
        
        # Strategy 3: Specificity ladder
        specific_queries = self._generate_specificity_ladder(base_query, focus_area)
        queries.extend(specific_queries)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_queries = []
        for q in queries:
            q_normalized = q.lower().strip()
            if q_normalized not in seen and len(q_normalized) > 10:
                seen.add(q_normalized)
                unique_queries.append(q)
        
        logger.info(f"Expanded 1 query to {len(unique_queries)} variations")
        return unique_queries
    
    async def _generate_hyde(
        self,
        job_title: str,
        job_description: str,
        focus_area: str,
        difficulty: str
    ) -> str:
        """Generate hypothetical document using HyDE technique."""
        
        difficulty_context = {
            "easy": "fundamental concepts and basic usage",
            "medium": "intermediate patterns and best practices",
            "hard": "advanced optimization, edge cases, and architectural decisions"
        }.get(difficulty, "practical usage")
        
        prompt = f"""You are writing internal technical documentation for a software engineering team.

Role: {job_title}
Focus Area: {focus_area}
Difficulty Level: {difficulty} ({difficulty_context})

Job Description Context:
{job_description[:500]}

Write a concise technical documentation section (3-4 sentences) that would appear in a company's 
internal wiki about {focus_area}. Include:
- Practical implementation details
- Common patterns or approaches
- Technical considerations specific to this role

The documentation should be at {difficulty} level and focus on real-world application.

Return ONLY the documentation paragraph, no introduction or formatting."""

        try:
            from .utils import call_llm
            response = await call_llm(prompt, model=self.model)
            
            # Extract clean text
            response = re.sub(r'\*\*.*?\*\*', '', response)  # Remove markdown bold
            response = re.sub(r'^[\s#*-]+', '', response)  # Clean start
            
            return response.strip() if response else ""
        except Exception as exc:
            logger.error(f"HyDE generation failed: {exc}")
            return ""
    
    async def _generate_variations(
        self,
        base_query: str,
        num_variations: int
    ) -> List[str]:
        """Generate semantic variations of the base query."""
        
        prompt = f"""Rephrase the following technical query in {num_variations} different ways.
Each variation should maintain the same meaning but use different wording.

Original Query: "{base_query}"

Generate {num_variations} variations. Return ONLY a JSON array of strings.

Example format:
["variation 1", "variation 2", "variation 3"]"""

        try:
            from .utils import call_llm
            response = await call_llm(prompt, model=self.model)
            
            # Parse JSON array
            match = re.search(r'\[.*\]', response, re.DOTALL)
            if match:
                variations = json.loads(match.group())
                return [v.strip() for v in variations if v.strip()]
        except Exception as exc:
            logger.error(f"Query variation generation failed: {exc}")
        
        return []
    
    def _generate_specificity_ladder(
        self,
        base_query: str,
        focus_area: str
    ) -> List[str]:
        """
        Generate more general and more specific queries.
        
        This helps when the base query is too narrow or too broad.
        """
        queries = []
        
        # Extract key technical terms
        tech_terms = re.findall(r'\b[A-Z][a-zA-Z0-9+#.]*|\b[a-z]{4,}\b', base_query)
        tech_terms = list(set(tech_terms))[:5]  # Limit to top 5
        
        if tech_terms:
            # More specific: Add context
            specific = f"{base_query}. Focus on {focus_area} implementation details and practical examples."
            queries.append(specific)
            
            # More general: Broader context
            general = f"Best practices and approaches for {', '.join(tech_terms[:3])} in software development."
            queries.append(general)
        
        return queries
    
    async def generate_follow_up_queries(
        self,
        previous_query: str,
        retrieved_content: str,
        missing_information: str
    ) -> List[str]:
        """
        Generate follow-up queries based on retrieval gaps.
        
        Used when initial retrieval is insufficient.
        """
        
        prompt = f"""Previous query: {previous_query}

Retrieved content summary: {retrieved_content[:300]}

Missing information: {missing_information}

Generate 2 alternative search queries that might find the missing information.
Return ONLY a JSON array of 2 query strings.

Example: ["query 1", "query 2"]"""

        try:
            from .utils import call_llm
            response = await call_llm(prompt, model=self.model)
            
            match = re.search(r'\[.*\]', response, re.DOTALL)
            if match:
                queries = json.loads(match.group())
                return [q.strip() for q in queries if q.strip()]
        except Exception as exc:
            logger.error(f"Follow-up query generation failed: {exc}")
        
        return []
