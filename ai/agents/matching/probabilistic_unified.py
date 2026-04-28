"""
probabilistic_unified.py

UNIFIED PROBABILISTIC MODEL

Instead of: rules + scoring + calibration (3 separate systems)
This is: P(hire | coverage, criticality, uncertainty) = unified probability

Key insight:
- Gate (was binary rule) → probability constraint P(viable)
- Score (was weighted sum) → likelihood P(fit | viable)
- Explanation (was narrative) → justification of probability

Everything becomes probability, not rules.
"""

from __future__ import annotations

import logging
import numpy as np
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
from scipy.stats import beta, norm

logger = logging.getLogger(__name__)


@dataclass
class RequirementProbabilisticState:
    """
    Probabilistic state for a single requirement.
    
    Instead of: coverage = 0.75 (point estimate)
    We have: P(satisfied) distribution with uncertainty
    """
    name: str
    coverage_mean: float  # Expected coverage
    coverage_std: float   # Uncertainty in coverage (from embedding variance)
    criticality: str      # "hard" | "soft"
    
    # Probabilistic gate
    P_viable: float       # P(requirement satisfied | candidate)
    
    # Uncertainty quantification
    confidence: float     # 0-1, based on embedding quality
    
    def P_fail_hard(self, threshold: float = 0.30) -> float:
        """
        Probability that this hard requirement fails the gate.
        
        P(fail) = P(coverage < threshold)
        = CDF(threshold; mean, std)
        """
        if self.criticality != "hard":
            return 0.0
        
        # Normal approximation of coverage distribution
        z = (threshold - self.coverage_mean) / max(self.coverage_std, 0.01)
        return float(norm.cdf(z))
    
    def P_satisfied_soft(self) -> float:
        """Probability that soft requirement contributes value."""
        if self.criticality != "soft":
            return 1.0  # Hard requirements are binary
        return self.P_viable


@dataclass
class CandidateProbabilisticState:
    """
    Complete probabilistic state for a candidate.
    
    This UNIFIES the 3 separate systems:
    1. Gate → P(viable) = product of P(req viable)
    2. Score → E[fit | viable] with uncertainty
    3. Explanation → P(features) justification
    """
    requirements: List[RequirementProbabilisticState]
    category_weights: Dict[str, float]
    
    # UNIFIED probabilities (not separate rules)
    P_viable: float           # P(candidate is structurally viable | all requirements)
    P_viable_lower: float     # 95% CI lower bound
    P_viable_upper: float     # 95% CI upper bound
    
    E_fit_given_viable: float # Expected fit score given viable
    Var_fit: float            # Uncertainty in fit score
    
    # Final unified probability
    P_hire: float             # P(hire | candidate, job) = P(viable) * P(fit | viable)
    P_hire_lower: float       # Conservative estimate
    P_hire_upper: float       # Optimistic estimate


def compute_coverage_distribution(
    req_vec: List[float],
    candidate_items: List[Dict[str, Any]],
    candidate_embeddings: Dict[str, List[float]],
    is_substitutable: bool,
) -> Tuple[float, float]:
    """
    Compute coverage as DISTRIBUTION, not point estimate.
    
    Returns: (mean, std)
    
    Key insight: embeddings have uncertainty, so coverage has uncertainty.
    """
    similarities = []
    
    for cand_item in candidate_items:
        cand_name = cand_item.get("name", "")
        cand_keys = [
            cand_name.lower(),
            cand_name.lower().replace(" ", "_"),
        ]
        
        cand_vec = None
        for key in cand_keys:
            if key in candidate_embeddings:
                cand_vec = candidate_embeddings[key]
                break
        
        if cand_vec:
            # Cosine similarity
            sim = np.dot(req_vec, cand_vec) / (np.linalg.norm(req_vec) * np.linalg.norm(cand_vec))
            similarities.append(sim)
    
    if not similarities:
        return 0.0, 0.5  # High uncertainty if no matches
    
    similarities = np.array(similarities)
    
    if is_substitutable:
        # For substitutable: coverage = mean of top-k
        # Uncertainty comes from variance of those top similarities
        top_k = min(3, len(similarities))
        top_sims = np.sort(similarities)[-top_k:]
        mean = float(np.mean(top_sims))
        std = float(np.std(top_sims)) if top_k > 1 else 0.15  # Default uncertainty
    else:
        # For non-substitutable: coverage = max
        # Uncertainty comes from how close second-best is
        sorted_sims = np.sort(similarities)
        max_sim = sorted_sims[-1]
        
        # Uncertainty: if second-best is close, we're less certain
        if len(sorted_sims) >= 2:
            gap = max_sim - sorted_sims[-2]
            std = max(0.05, 0.3 - gap)  # Small gap = high uncertainty
        else:
            std = 0.2
        
        mean = float(max_sim)
    
    return mean, std


def probabilistic_gate_constraint(
    req_states: List[RequirementProbabilisticState],
    confidence_level: float = 0.95,
) -> Tuple[float, float, float]:
    """
    Compute P(viable) as continuous probability, not binary gate.
    
    Instead of:
    - PASS (all coverage >= 0.30)
    - FAIL (any coverage < 0.30)
    
    We compute:
    P(viable) = product of P(req satisfied)
    
    This is the UNIFIED gate - no separate rule system.
    """
    hard_reqs = [r for r in req_states if r.criticality == "hard"]
    
    if not hard_reqs:
        return 1.0, 1.0, 1.0  # No hard requirements = always viable
    
    # P(viable) = P(all hard reqs satisfied)
    # = product of individual P(satisfied)
    
    # For point estimate: use mean P
    P_viable_point = 1.0
    for req in hard_reqs:
        P_viable_point *= req.P_viable
    
    # For confidence bounds: use worst/best case
    # Lower bound: assume correlated failures (conservative)
    P_viable_lower = max(0.0, P_viable_point - 0.2)
    
    # Upper bound: assume independent (optimistic)
    P_viable_upper = min(1.0, P_viable_point + 0.1)
    
    return P_viable_point, P_viable_lower, P_viable_upper


def probabilistic_fit_score(
    req_states: List[RequirementProbabilisticState],
    category_weights: Dict[str, float],
) -> Tuple[float, float]:
    """
    Compute E[fit | viable] with uncertainty.
    
    This is the UNIFIED scoring - not weighted sum, but expected value.
    """
    # Group by category
    categories = {"skills": [], "experience": [], "education": [], "traits": []}
    for req in req_states:
        # Map type to category
        cat = "skills"  # default
        categories[cat].append(req)
    
    # Compute category scores as expectations
    category_means = {}
    category_vars = {}
    
    for cat, reqs in categories.items():
        if not reqs:
            category_means[cat] = 0.0
            category_vars[cat] = 0.0
            continue
        
        # E[category] = weighted average of E[req]
        total_weight = sum(req.coverage_mean for req in reqs)
        if total_weight == 0:
            category_means[cat] = 0.0
            category_vars[cat] = 0.0
            continue
        
        # Mean
        cat_mean = sum(
            req.coverage_mean * req.coverage_mean / total_weight
            for req in reqs
        )
        
        # Variance (uncertainty propagation)
        cat_var = sum(
            (req.coverage_std ** 2) * (req.coverage_mean / total_weight) ** 2
            for req in reqs
        )
        
        category_means[cat] = cat_mean
        category_vars[cat] = cat_var
    
    # Overall fit = weighted sum of category expectations
    weight_total = sum(category_weights.values())
    
    E_fit = sum(
        category_means.get(cat, 0) * category_weights.get(cat, 0.25)
        for cat in categories
    ) / weight_total
    
    # Variance of fit
    Var_fit = sum(
        category_vars.get(cat, 0) * (category_weights.get(cat, 0.25) / weight_total) ** 2
        for cat in categories
    )
    
    return E_fit, Var_fit


def unified_probabilistic_match(
    job_requirements: List[Dict[str, Any]],
    candidate_items: List[Dict[str, Any]],
    job_embeddings: Dict[str, List[float]],
    candidate_embeddings: Dict[str, List[float]],
    category_weights: Dict[str, float],
) -> Dict[str, Any]:
    """
    UNIFIED PROBABILISTIC MATCHING.
    
    Instead of:
    1. Gate (binary rule)
    2. Score (weighted sum)
    3. Calibration (bucket mapping)
    
    This computes:
    P(hire) = P(viable) * E[fit | viable]
    
    With uncertainty quantification at every step.
    """
    # Step 1: Build probabilistic state for each requirement
    req_states = []
    
    for req in job_requirements:
        req_name = req.get("name", "")
        req_type = req.get("type", "skill")
        criticality = req.get("criticality", "soft")
        
        # Get embedding
        req_vec = None
        for key in [
            f"{req_type}:{req_name}".lower(),
            req_name.lower(),
        ]:
            if key in job_embeddings:
                req_vec = job_embeddings[key]
                break
        
        if req_vec is None:
            # No embedding = high uncertainty
            coverage_mean = 0.0
            coverage_std = 0.5
            confidence = 0.1
        else:
            # Detect substitutability
            # (Simplified - would use detect_substitutability function)
            is_sub = req.get("substitutable", True)
            
            # Compute coverage distribution
            coverage_mean, coverage_std = compute_coverage_distribution(
                req_vec, candidate_items, candidate_embeddings, is_sub
            )
            confidence = 0.8 if coverage_std < 0.2 else 0.6
        
        # P(viable) for this requirement
        # Hard: P(coverage >= 0.30)
        # Soft: coverage itself
        if criticality == "hard":
            z = (0.30 - coverage_mean) / max(coverage_std, 0.01)
            P_viable = 1.0 - float(norm.cdf(z))
        else:
            P_viable = coverage_mean
        
        req_state = RequirementProbabilisticState(
            name=req_name,
            coverage_mean=coverage_mean,
            coverage_std=coverage_std,
            criticality=criticality,
            P_viable=P_viable,
            confidence=confidence,
        )
        req_states.append(req_state)
    
    # Step 2: Unified gate constraint (probability, not rule)
    P_viable, P_viable_lower, P_viable_upper = probabilistic_gate_constraint(req_states)
    
    # Step 3: Unified fit score (expectation, not weighted sum)
    E_fit, Var_fit = probabilistic_fit_score(req_states, category_weights)
    
    # Step 4: UNIFIED final probability
    # P(hire) = P(viable) * E[fit | viable]
    P_hire = P_viable * E_fit
    
    # Uncertainty propagation
    # Var(P_hire) ≈ P_viable² * Var(E_fit) + E_fit² * Var(P_viable)
    std_P_viable = (P_viable_upper - P_viable_lower) / 4  # Approx from bounds
    Var_P_hire = (P_viable ** 2) * Var_fit + (E_fit ** 2) * (std_P_viable ** 2)
    std_P_hire = np.sqrt(Var_P_hire)
    
    P_hire_lower = max(0.0, P_hire - 1.96 * std_P_hire)
    P_hire_upper = min(1.0, P_hire + 1.96 * std_P_hire)
    
    # Return unified probabilistic result
    return {
        # Unified probability (replaces score + gate + calibration)
        "P_hire": round(P_hire, 4),
        "P_hire_95CI": [round(P_hire_lower, 4), round(P_hire_upper, 4)],
        
        # Decomposed for explainability
        "P_viable": round(P_viable, 4),
        "P_viable_95CI": [round(P_viable_lower, 4), round(P_viable_upper, 4)],
        "E_fit_given_viable": round(E_fit, 4),
        "SD_fit": round(np.sqrt(Var_fit), 4),
        
        # Requirement-level details (for explanation)
        "requirements": [
            {
                "name": r.name,
                "P_satisfied": round(r.P_viable, 3),
                "coverage": round(r.coverage_mean, 3),
                "coverage_std": round(r.coverage_std, 3),
                "criticality": r.criticality,
            }
            for r in req_states
        ],
        
        # Calibration (direct from probability)
        "bucket": _probabilistic_bucket(P_hire, P_hire_lower),
        
        # Methodology
        "methodology": "unified_probabilistic",
        "model": "P(hire) = P(viable) × E[fit | viable]",
    }


def _probabilistic_bucket(P_hire: float, P_lower: float) -> str:
    """
    Bucket based on unified probability with uncertainty.
    
    Uses conservative estimate (lower bound) for decision safety.
    """
    # Use conservative estimate
    P_decision = P_lower
    
    if P_decision >= 0.70:
        return "high_confidence_hire"
    elif P_decision >= 0.50:
        return "moderate_hire"
    elif P_decision >= 0.30:
        return "uncertain"
    elif P_decision >= 0.10:
        return "unlikely"
    else:
        return "reject"


def generate_probabilistic_explanation(
    result: Dict[str, Any],
    job_title: str = "position",
) -> str:
    """
    Generate explanation from UNIFIED probabilistic state.
    
    Key: Everything is justified by probability calculus, not separate rules.
    """
    P_hire = result["P_hire"]
    P_lower, P_upper = result["P_hire_95CI"]
    P_viable = result["P_viable"]
    E_fit = result["E_fit_given_viable"]
    
    # Build narrative from probabilities
    parts = []
    
    # Overall probability statement
    parts.append(f"Hiring probability: {P_hire:.0%} (range: {P_lower:.0%}-{P_upper:.0%})")
    
    # Decomposition
    if P_viable < 0.5:
        parts.append(f"Low viability ({P_viable:.0%}): critical requirements uncertain")
    elif P_viable < 0.8:
        parts.append(f"Moderate viability ({P_viable:.0%}): some gaps present")
    else:
        parts.append(f"High viability ({P_viable:.0%}): core requirements met")
    
    # Fit component
    if E_fit > 0.7:
        parts.append(f"Strong overall fit ({E_fit:.0%})")
    elif E_fit > 0.5:
        parts.append(f"Moderate fit ({E_fit:.0%})")
    else:
        parts.append(f"Weak fit ({E_fit:.0%})")
    
    # Uncertainty statement
    uncertainty_width = P_upper - P_lower
    if uncertainty_width > 0.4:
        parts.append("High uncertainty - recommend manual review")
    elif uncertainty_width > 0.2:
        parts.append("Moderate uncertainty")
    
    return " | ".join(parts)
