"""
Query Expansion and Key Term Extraction

Extracts important terms from job descriptions for better retrieval.
"""

import re
from typing import List, Dict, Set


def extract_job_key_terms(job_title: str, job_description: str) -> List[str]:
    """
    Extract key technical terms from job title and description.
    
    Returns a list of important skills and technologies mentioned.
    """
    # Combine title and description
    text = f"{job_title} {job_description}".lower()
    
    # Common technical keywords to look for
    tech_patterns = [
        # Programming languages
        r'\b(python|java|javascript|typescript|c\+\+|c#|go|rust|ruby|php|swift|kotlin)\b',
        # Frameworks & libraries
        r'\b(django|flask|fastapi|react|angular|vue|nodejs|express|spring|laravel|rails)\b',
        # Databases
        r'\b(postgresql|mysql|mongodb|redis|elasticsearch|cassandra|dynamodb|sqlite)\b',
        # Cloud & DevOps
        r'\b(aws|azure|gcp|docker|kubernetes|jenkins|git|terraform|ansible|ci/cd)\b',
        # AI/ML
        r'\b(machine learning|deep learning|tensorflow|pytorch|scikit-learn|nlp|computer vision)\b',
        # Data
        r'\b(sql|pandas|numpy|spark|hadoop|kafka|airflow|dbt|etl)\b',
        # Web
        r'\b(html|css|rest|graphql|api|microservices|oauth|jwt)\b',
        # General
        r'\b(agile|scrum|linux|unix|bash|shell|scripting)\b',
    ]
    
    found_terms: Set[str] = set()
    
    # Extract matches
    for pattern in tech_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        found_terms.update(matches)
    
    # Also extract words that look like technologies (capitalized or with version numbers)
    # Pattern: word followed by version number (e.g., "Python 3", "Angular 15")
    version_pattern = r'\b([a-z]+)\s*\d+\.?\d*'
    version_matches = re.findall(version_pattern, text, re.IGNORECASE)
    found_terms.update(version_matches)
    
    # Extract noun phrases (simple approach: consecutive capitalized words)
    noun_pattern = r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b'
    noun_matches = re.findall(noun_pattern, job_description)
    found_terms.update([m.lower() for m in noun_matches if len(m) > 3])
    
    return sorted(list(found_terms))


def build_weighted_tokens(terms: List[str], weights: Dict[str, float] = None) -> Dict[str, float]:
    """
    Build a weighted token dictionary for query expansion.
    
    Args:
        terms: List of extracted terms
        weights: Optional custom weights for specific terms
    
    Returns:
        Dictionary mapping terms to their weights
    """
    if weights is None:
        weights = {}
    
    # Default weight is 1.0, use provided weights where available
    result = {}
    for term in terms:
        result[term] = weights.get(term, 1.0)
    
    return result


def expand_query(original_query: str, key_terms: List[str], max_terms: int = 5) -> str:
    """
    Expand a query with additional key terms for better retrieval.
    
    Args:
        original_query: The base query
        key_terms: Additional terms to include
        max_terms: Maximum number of additional terms
    
    Returns:
        Expanded query string
    """
    if not key_terms:
        return original_query
    
    # Take top terms and append to query
    additional_terms = key_terms[:max_terms]
    expanded = f"{original_query} {' '.join(additional_terms)}"
    
    return expanded
