from typing import Annotated, Dict, List, Optional, TypedDict, Union
import operator

class MatchingState(TypedDict):
    """
    Enhanced State for the matching agent pipeline.
    Tracks candidate-job matching progress across all layers.
    """
    # Inputs
    cv_path: str
    job_description: str
    job_requirements: Dict
    offer_type: str
    
    # Context & Industry
    industry: str
    industry_confidence: float
    dynamic_weights: Dict[str, float]
    
    # Intermediary Profiles
    candidate_profile: Optional[Dict]
    job_profile: Optional[Dict]
    candidate_embedding: Optional[List[float]]
    job_embedding: Optional[List[float]]
    
    # Matching Results
    raw_scores: Dict[str, float]
    final_score: float
    matched_skills: List[str]
    missing_skills: List[str]
    transferable_matches: List[Dict]
    
    # Gatekeeper Status
    gate_status: str  # PASS, REVIEW, FAIL
    gate_reason: str
    failed_critical: List[str]
    
    # Flags
    needs_manual_review: bool
    review_reasons: List[str]
    
    # Evaluation & Audit
    confidence_score: float
    evaluation_notes: List[str]
    audit_log: Annotated[List[str], operator.add]
    
    # Output
    explanation: str
    explanation_structured: Dict
    metadata: Dict
