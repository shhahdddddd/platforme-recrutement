"""
learned_calibration.py

Learned calibration model for P(hire) prediction.

Trains on actual hire/no-hire outcomes to learn:
P(hire) = f(features)

Where features include:
- match_score
- category_scores (skills, experience, education)
- gate_status
- degree_match_score
- category_variance
"""

import json
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path


@dataclass
class TrainingExample:
    """Single training example with outcome."""
    # Features
    match_score: float
    skills_score: float
    experience_score: float
    education_score: float
    gate_passed: bool
    gate_uncertainty: bool  # REVIEW status
    degree_match: float
    category_variance: float
    
    # Outcome (what actually happened)
    was_hired: bool  # 1 = hired, 0 = not hired
    
    # Metadata
    candidate_id: str
    job_id: str
    timestamp: str


@dataclass
class CalibrationModel:
    """Learned calibration model."""
    # Weights for logistic regression
    weights: Dict[str, float]
    bias: float
    
    # Performance metrics
    accuracy: float
    precision: float
    recall: float
    auc_roc: float
    
    # Training info
    training_samples: int
    positive_samples: int  # hired
    last_trained: str
    
    def predict(self, features: Dict[str, float]) -> float:
        """Predict P(hire) from features."""
        # Linear combination
        z = self.bias
        for feature, weight in self.weights.items():
            z += features.get(feature, 0) * weight
        
        # Sigmoid
        return 1 / (1 + np.exp(-z))


class LearnedCalibration:
    """
    Calibration system that learns from actual outcomes.
    
    Usage:
        1. Collect training data: score → hire/no-hire
        2. Train model periodically
        3. Use model for P(hire) prediction
        4. Retrain when drift detected
    """
    
    def __init__(self, model_path: Optional[str] = None):
        self.model: Optional[CalibrationModel] = None
        self.training_data: List[TrainingExample] = []
        self.model_path = model_path or "calibration_model.json"
    
    def add_outcome(
        self,
        match_result: Dict[str, Any],
        was_hired: bool,
        candidate_id: str,
        job_id: str,
    ):
        """
        Record actual outcome for learning.
        
        Call this when you know if candidate was hired or not.
        """
        import datetime
        
        category_scores = match_result.get("category_scores", {})
        
        example = TrainingExample(
            match_score=match_result.get("score", 0),
            skills_score=category_scores.get("skills", 0),
            experience_score=category_scores.get("experience", 0),
            education_score=category_scores.get("education", 0),
            gate_passed=match_result.get("gate_passed", True),
            gate_uncertainty=match_result.get("gate_uncertainty", False),
            degree_match=match_result.get("degree_match", {}).get("score", 0.5),
            category_variance=np.std(list(category_scores.values())) if category_scores else 0,
            was_hired=was_hired,
            candidate_id=candidate_id,
            job_id=job_id,
            timestamp=datetime.datetime.now().isoformat(),
        )
        
        self.training_data.append(example)
    
    def train(self, min_samples: int = 50) -> Optional[CalibrationModel]:
        """
        Train calibration model on collected outcomes.
        
        Uses simple logistic regression.
        
        Args:
            min_samples: Minimum training samples required
        
        Returns:
            Trained model or None if insufficient data
        """
        if len(self.training_data) < min_samples:
            print(f"Insufficient data: {len(self.training_data)} < {min_samples}")
            return None
        
        # Prepare features and labels
        X = []
        y = []
        
        for ex in self.training_data:
            X.append([
                ex.match_score,
                ex.skills_score,
                ex.experience_score,
                ex.education_score,
                1.0 if ex.gate_passed else 0.0,
                1.0 if ex.gate_uncertainty else 0.0,
                ex.degree_match,
                ex.category_variance,
            ])
            y.append(1.0 if ex.was_hired else 0.0)
        
        X = np.array(X)
        y = np.array(y)
        
        # Simple gradient descent
        weights = self._fit_logistic_regression(X, y, learning_rate=0.01, epochs=1000)
        
        # Calculate metrics
        predictions = self._predict_batch(X, weights)
        metrics = self._calculate_metrics(y, predictions)
        
        # Create model
        import datetime
        self.model = CalibrationModel(
            weights={
                "match_score": weights[0],
                "skills_score": weights[1],
                "experience_score": weights[2],
                "education_score": weights[3],
                "gate_passed": weights[4],
                "gate_uncertainty": weights[5],
                "degree_match": weights[6],
                "category_variance": weights[7],
            },
            bias=weights[-1],
            accuracy=metrics["accuracy"],
            precision=metrics["precision"],
            recall=metrics["recall"],
            auc_roc=metrics["auc_roc"],
            training_samples=len(self.training_data),
            positive_samples=int(sum(y)),
            last_trained=datetime.datetime.now().isoformat(),
        )
        
        self._save_model()
        return self.model
    
    def predict(self, match_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict P(hire) for a candidate.
        
        Falls back to sigmoid heuristic if no model trained.
        """
        if self.model is None:
            self._load_model()
        
        if self.model is None:
            # Fallback: simple sigmoid on score
            score = match_result.get("score", 0)
            P_hire = 1 / (1 + np.exp(-5 * (score - 0.5)))
            return {
                "P_hire": round(P_hire, 3),
                "P_hire_range": [round(max(0, P_hire - 0.15), 3), round(min(1, P_hire + 0.15), 3)],
                "uncertainty": 0.15,
                "model_used": "fallback_sigmoid",
                "note": "Train model with outcomes for better calibration",
            }
        
        category_scores = match_result.get("category_scores", {})
        
        features = {
            "match_score": match_result.get("score", 0),
            "skills_score": category_scores.get("skills", 0),
            "experience_score": category_scores.get("experience", 0),
            "education_score": category_scores.get("education", 0),
            "gate_passed": 1.0 if match_result.get("gate_passed", True) else 0.0,
            "gate_uncertainty": 1.0 if match_result.get("gate_uncertainty", False) else 0.0,
            "degree_match": match_result.get("degree_match", {}).get("score", 0.5),
            "category_variance": np.std(list(category_scores.values())) if category_scores else 0,
        }
        
        P_hire = self.model.predict(features)
        
        # Uncertainty from model performance
        uncertainty = 0.1 + (1 - self.model.accuracy) * 0.2
        
        return {
            "P_hire": round(P_hire, 3),
            "P_hire_range": [
                round(max(0, P_hire - 1.96 * uncertainty), 3),
                round(min(1, P_hire + 1.96 * uncertainty), 3),
            ],
            "uncertainty": round(uncertainty, 3),
            "model_used": "learned",
            "model_accuracy": self.model.accuracy,
            "model_samples": self.model.training_samples,
        }
    
    def _fit_logistic_regression(
        self, X: np.ndarray, y: np.ndarray, learning_rate: float, epochs: int
    ) -> np.ndarray:
        """Fit logistic regression with gradient descent."""
        n_samples, n_features = X.shape
        
        # Add bias term
        X_bias = np.column_stack([X, np.ones(n_samples)])
        
        # Initialize weights
        weights = np.zeros(n_features + 1)
        
        # Gradient descent
        for _ in range(epochs):
            # Forward pass
            z = X_bias @ weights
            predictions = 1 / (1 + np.exp(-z))
            
            # Gradient
            gradient = X_bias.T @ (predictions - y) / n_samples
            
            # Update
            weights -= learning_rate * gradient
        
        return weights
    
    def _predict_batch(self, X: np.ndarray, weights: np.ndarray) -> np.ndarray:
        """Batch prediction."""
        X_bias = np.column_stack([X, np.ones(X.shape[0])])
        z = X_bias @ weights
        return 1 / (1 + np.exp(-z))
    
    def _calculate_metrics(self, y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
        """Calculate classification metrics."""
        y_pred_binary = (y_pred > 0.5).astype(int)
        
        # Accuracy
        accuracy = np.mean(y_pred_binary == y_true)
        
        # Precision and recall
        true_positives = np.sum((y_pred_binary == 1) & (y_true == 1))
        false_positives = np.sum((y_pred_binary == 1) & (y_true == 0))
        false_negatives = np.sum((y_pred_binary == 0) & (y_true == 1))
        
        precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0
        recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0
        
        # AUC-ROC (simple approximation)
        sorted_indices = np.argsort(y_pred)[::-1]
        y_true_sorted = y_true[sorted_indices]
        
        # Trapezoidal rule for AUC
        n_pos = np.sum(y_true == 1)
        n_neg = np.sum(y_true == 0)
        
        if n_pos == 0 or n_neg == 0:
            auc_roc = 0.5
        else:
            cumsum = np.cumsum(y_true_sorted)
            auc_roc = np.sum(cumsum[y_true_sorted == 0]) / (n_pos * n_neg)
            auc_roc = 1 - auc_roc  # Convert to standard AUC
        
        return {
            "accuracy": round(float(accuracy), 3),
            "precision": round(float(precision), 3),
            "recall": round(float(recall), 3),
            "auc_roc": round(float(auc_roc), 3),
        }
    
    def _save_model(self):
        """Save model to disk."""
        if self.model is None:
            return
        
        path = Path(self.model_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, "w") as f:
            json.dump(asdict(self.model), f, indent=2)
    
    def _load_model(self):
        """Load model from disk."""
        path = Path(self.model_path)
        if not path.exists():
            return
        
        with open(path, "r") as f:
            data = json.load(f)
        
        self.model = CalibrationModel(**data)


# Singleton instance
_calibration_instance: Optional[LearnedCalibration] = None


def get_calibration(model_path: Optional[str] = None) -> LearnedCalibration:
    """Get or create global calibration instance."""
    global _calibration_instance
    if _calibration_instance is None:
        _calibration_instance = LearnedCalibration(model_path)
    return _calibration_instance


def record_outcome(
    match_result: Dict[str, Any],
    was_hired: bool,
    candidate_id: str,
    job_id: str,
):
    """Convenience function to record outcome."""
    cal = get_calibration()
    cal.add_outcome(match_result, was_hired, candidate_id, job_id)


def predict_hire_probability(match_result: Dict[str, Any]) -> Dict[str, Any]:
    """Convenience function to predict P(hire)."""
    cal = get_calibration()
    return cal.predict(match_result)


# =============================================================================
# USAGE EXAMPLE
# =============================================================================

if __name__ == "__main__":
    # Example: Train on synthetic data
    cal = LearnedCalibration()
    
    # Add some synthetic training examples
    for i in range(100):
        score = np.random.beta(2, 2)  # Random score 0-1
        was_hired = score > 0.6  # Synthetic: hired if score > 0.6
        
        match_result = {
            "score": score,
            "category_scores": {
                "skills": score * 0.9,
                "experience": score * 0.8,
                "education": score * 0.7,
            },
            "gate_passed": score > 0.3,
            "gate_uncertainty": 0.3 <= score <= 0.5,
        }
        
        cal.add_outcome(
            match_result=match_result,
            was_hired=was_hired,
            candidate_id=f"cand_{i}",
            job_id="job_001",
        )
    
    # Train model
    model = cal.train(min_samples=50)
    if model:
        print(f"Model trained: accuracy={model.accuracy:.2%}")
        
        # Predict
        test_result = {
            "score": 0.75,
            "category_scores": {"skills": 0.8, "experience": 0.7, "education": 0.6},
            "gate_passed": True,
            "gate_uncertainty": False,
        }
        pred = cal.predict(test_result)
        print(f"P(hire): {pred['P_hire']:.1%}")

""
"
}
"
