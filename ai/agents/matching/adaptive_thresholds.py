"""
adaptive_thresholds.py

Percentile-based adaptive threshold system.

Computes thresholds from actual score distributions, not hardcoded values.
"""

import numpy as np
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class AdaptiveThresholds:
    """Thresholds computed from score distribution."""
    pass_threshold: float      # 75th percentile (top performers)
    review_threshold: float    # 25th percentile (minimum viable)
    fail_threshold: float      # 10th percentile (clear reject)
    
    # Distribution stats
    mean: float
    median: float
    std: float
    percentile_90: float
    
    # Metadata
    sample_size: int
    computed_at: str


def compute_adaptive_thresholds(
    scores: List[float],
    method: str = "percentile"
) -> AdaptiveThresholds:
    """
    Compute adaptive thresholds from score distribution.
    
    Methods:
    - percentile: Use fixed percentiles (75th, 25th, 10th)
    - std_based: mean ± k*std
    - iqr_based: median ± 1.5*IQR
    
    Args:
        scores: List of match scores (0-1)
        method: Threshold computation method
    
    Returns:
        AdaptiveThresholds with computed values
    """
    import datetime
    
    if not scores:
        # Default fallback if no data
        return AdaptiveThresholds(
            pass_threshold=0.65,
            review_threshold=0.35,
            fail_threshold=0.15,
            mean=0.5,
            median=0.5,
            std=0.2,
            percentile_90=0.8,
            sample_size=0,
            computed_at=datetime.datetime.now().isoformat(),
        )
    
    scores_arr = np.array(scores)
    
    if method == "percentile":
        # Percentile-based (recommended)
        # Pass: top 25% of candidates
        # Review: middle 50% (25th-75th percentile)
        # Fail: bottom 25%
        pass_thresh = float(np.percentile(scores_arr, 75))
        review_thresh = float(np.percentile(scores_arr, 25))
        fail_thresh = float(np.percentile(scores_arr, 10))
        
    elif method == "std_based":
        # Standard deviation based
        mean = np.mean(scores_arr)
        std = np.std(scores_arr)
        pass_thresh = min(0.9, mean + 0.5 * std)
        review_thresh = max(0.2, mean - 0.5 * std)
        fail_thresh = max(0.1, mean - 1.5 * std)
        
    elif method == "iqr_based":
        # Interquartile range based (robust to outliers)
        q1 = np.percentile(scores_arr, 25)
        q3 = np.percentile(scores_arr, 75)
        iqr = q3 - q1
        median = np.median(scores_arr)
        pass_thresh = min(0.9, q3 + 0.5 * iqr)
        review_thresh = max(0.2, q1 - 0.5 * iqr)
        fail_thresh = max(0.1, q1 - 1.5 * iqr)
        
    else:
        raise ValueError(f"Unknown method: {method}")
    
    return AdaptiveThresholds(
        pass_threshold=round(pass_thresh, 3),
        review_threshold=round(review_thresh, 3),
        fail_threshold=round(fail_thresh, 3),
        mean=round(float(np.mean(scores_arr)), 3),
        median=round(float(np.median(scores_arr)), 3),
        std=round(float(np.std(scores_arr)), 3),
        percentile_90=round(float(np.percentile(scores_arr, 90)), 3),
        sample_size=len(scores),
        computed_at=datetime.datetime.now().isoformat(),
    )


def classify_with_adaptive_thresholds(
    score: float,
    thresholds: AdaptiveThresholds,
) -> Dict[str, Any]:
    """
    Classify a candidate using adaptive thresholds.
    
    Returns:
        Dict with classification and reason
    """
    if score >= thresholds.pass_threshold:
        return {
            "classification": "PASS",
            "reason": f"Score {score:.2f} >= {thresholds.pass_threshold:.2f} (75th percentile)",
            "confidence": "high",
        }
    elif score >= thresholds.review_threshold:
        return {
            "classification": "REVIEW",
            "reason": f"Score {score:.2f} in middle 50% ({thresholds.review_threshold:.2f}-{thresholds.pass_threshold:.2f})",
            "confidence": "medium",
        }
    elif score >= thresholds.fail_threshold:
        return {
            "classification": "WEAK",
            "reason": f"Score {score:.2f} below 25th percentile",
            "confidence": "low",
        }
    else:
        return {
            "classification": "FAIL",
            "reason": f"Score {score:.2f} in bottom 10%",
            "confidence": "very_low",
        }


class ThresholdHistory:
    """Track threshold history for monitoring drift."""
    
    def __init__(self, max_history: int = 100):
        self.history: List[AdaptiveThresholds] = []
        self.max_history = max_history
    
    def add(self, thresholds: AdaptiveThresholds):
        """Add new threshold computation to history."""
        self.history.append(thresholds)
        if len(self.history) > self.max_history:
            self.history.pop(0)
    
    def detect_drift(self, window_size: int = 5) -> Optional[Dict[str, Any]]:
        """
        Detect if thresholds are drifting over time.
        
        Returns drift info if significant change detected.
        """
        if len(self.history) < window_size * 2:
            return None
        
        recent = self.history[-window_size:]
        older = self.history[-(window_size*2):-window_size]
        
        recent_pass = np.mean([t.pass_threshold for t in recent])
        older_pass = np.mean([t.pass_threshold for t in older])
        
        # Drift if change > 0.1
        drift = abs(recent_pass - older_pass)
        
        if drift > 0.1:
            return {
                "drift_detected": True,
                "magnitude": round(drift, 3),
                "recent_pass_threshold": round(recent_pass, 3),
                "older_pass_threshold": round(older_pass, 3),
                "recommendation": "Retrain calibration model",
            }
        
        return {"drift_detected": False, "magnitude": round(drift, 3)}


# Global threshold history (singleton pattern)
_threshold_history = ThresholdHistory()


def get_global_threshold_history() -> ThresholdHistory:
    """Get the global threshold history tracker."""
    return _threshold_history


def compute_and_store_thresholds(scores: List[float]) -> AdaptiveThresholds:
    """Compute thresholds and add to history."""
    thresholds = compute_adaptive_thresholds(scores)
    _threshold_history.add(thresholds)
    return thresholds


# =============================================================================
# USAGE EXAMPLES
# =============================================================================

if __name__ == "__main__":
    # Example: Compute thresholds from sample scores
    sample_scores = [0.85, 0.72, 0.68, 0.55, 0.48, 0.42, 0.35, 0.28, 0.15, 0.08]
    
    thresholds = compute_adaptive_thresholds(sample_scores, method="percentile")
    print(f"Pass threshold: {thresholds.pass_threshold}")
    print(f"Review threshold: {thresholds.review_threshold}")
    print(f"Sample size: {thresholds.sample_size}")
    
    # Classify a new candidate
    result = classify_with_adaptive_thresholds(0.75, thresholds)
    print(f"Classification: {result['classification']}")
    print(f"Reason: {result['reason']}")


"""
}
"""
""
"
