"""
feedback_loop.py

RAG feedback system to continuously improve retrieval quality:
- Track quiz performance metrics
- Adjust retrieval weights based on outcomes
- A/B testing framework for retrieval strategies
- Drift detection for embedding models
"""

import json
import logging
import statistics
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from django.conf import settings
from django.db.models import Avg, Count, Q

logger = logging.getLogger(__name__)


class RAGFeedbackTracker:
    """
    Track and analyze feedback from quiz outcomes to optimize retrieval.
    
    Features:
    - Performance tracking per question/session
    - Weight adjustment based on candidate scores
    - Retrieval strategy A/B testing
    - Trend analysis and drift detection
    """
    
    def __init__(self):
        self.metrics_cache = {}
        
    def record_question_outcome(
        self,
        session_id: str,
        question_id: str,
        retrieval_mode: str,
        retrieved_chunks_count: int,
        avg_relevance_score: float,
        candidate_score: float,
        time_spent_seconds: int,
        difficulty: str
    ) -> None:
        """
        Record outcome for a single question.
        
        This data is used to:
        1. Adjust retrieval weights
        2. Detect off-topic questions
        3. Optimize difficulty calibration
        """
        
        from .models import QuizReport
        
        # Store in database for long-term analysis
        try:
            QuizReport.objects.create(
                session_id=session_id,
                question_id=question_id,
                metadata={
                    "retrieval_mode": retrieval_mode,
                    "chunks_retrieved": retrieved_chunks_count,
                    "avg_relevance": avg_relevance_score,
                    "candidate_score": candidate_score,
                    "time_spent": time_spent_seconds,
                    "difficulty": difficulty,
                    "recorded_at": datetime.now().isoformat()
                }
            )
            logger.debug(f"Recorded question outcome for {question_id}")
        except Exception as exc:
            logger.error(f"Failed to record question outcome: {exc}")
    
    async def adjust_retrieval_weights(
        self,
        company_id: int,
        lookback_days: int = 7,
        min_sessions: int = 10
    ) -> Dict[str, float]:
        """
        Analyze recent quiz performance and adjust retrieval weights.
        
        Returns:
            Optimized weights dict: {"bm25_weight": 0.4, "knn_weight": 0.6}
        """
        
        from .models import QuizSession, QuizQuestion
        
        cutoff_date = datetime.now() - timedelta(days=lookback_days)
        
        # Get recent sessions with completed quizzes
        sessions = QuizSession.objects.filter(
            company_id=company_id,
            status='completed',
            created_at__gte=cutoff_date
        ).select_related('quiz_questions')
        
        if sessions.count() < min_sessions:
            logger.info(f"Insufficient data ({sessions.count()} sessions) for weight optimization")
            return {"bm25_weight": 0.3, "knn_weight": 0.7}  # Default
        
        # Analyze performance by retrieval mode
        kb_grounded_scores = []
        jd_fallback_scores = []
        
        for session in sessions:
            questions = session.quiz_questions.all()
            for q in questions:
                metadata = q.metadata or {}
                retrieval_mode = metadata.get("retrieval_mode", "unknown")
                score = self._calculate_question_effectiveness(q)
                
                if retrieval_mode == "kb_grounded":
                    kb_grounded_scores.append(score)
                elif retrieval_mode == "job_description_fallback":
                    jd_fallback_scores.append(score)
        
        # Calculate averages
        kb_avg = statistics.mean(kb_grounded_scores) if kb_grounded_scores else 0
        jd_avg = statistics.mean(jd_fallback_scores) if jd_fallback_scores else 0
        
        logger.info(f"KB-grounded avg effectiveness: {kb_avg:.3f}, JD-fallback: {jd_avg:.3f}")
        
        # Adjust weights based on performance
        if kb_avg > 0.7 and kb_avg > jd_avg:
            # KB working well, increase semantic weight
            weights = {"bm25_weight": 0.25, "knn_weight": 0.75}
        elif kb_avg < 0.5:
            # KB not performing well, increase BM25 (lexical) weight
            weights = {"bm25_weight": 0.60, "knn_weight": 0.40}
        else:
            # Balanced approach
            weights = {"bm25_weight": 0.35, "knn_weight": 0.65}
        
        # Cache optimized weights
        await self._cache_optimized_weights(company_id, weights)
        
        logger.info(f"Optimized retrieval weights for company {company_id}: {weights}")
        return weights
    
    def _calculate_question_effectiveness(self, question) -> float:
        """
        Calculate how effective a question was at discriminating candidates.
        
        Combines:
        - Candidate score (inverse - lower score = harder question)
        - Time spent (normalized)
        - Difficulty alignment
        """
        metadata = question.metadata or {}
        
        candidate_score = metadata.get("candidate_score", 0.5)
        time_spent = metadata.get("time_spent", 60)
        difficulty = metadata.get("difficulty", "medium")
        
        # Expected time by difficulty
        expected_times = {"easy": 30, "medium": 60, "hard": 120}
        expected_time = expected_times.get(difficulty, 60)
        
        # Score components
        score_component = 1.0 - candidate_score  # Harder questions = higher score
        time_component = min(1.0, time_spent / expected_time)
        
        # Weighted combination
        effectiveness = (score_component * 0.6) + (time_component * 0.4)
        
        return min(1.0, max(0.0, effectiveness))
    
    async def _cache_optimized_weights(self, company_id: int, weights: Dict) -> None:
        """Cache optimized weights in Redis."""
        try:
            from .utils import redis_client
            
            cache_key = f"rag:weights:company:{company_id}"
            payload = {
                **weights,
                "updated_at": datetime.now().isoformat(),
                "valid_until": (datetime.now() + timedelta(days=7)).isoformat()
            }
            
            redis_client.setex(cache_key, 604800, json.dumps(payload))  # 7 days
            logger.debug(f"Cached optimized weights for company {company_id}")
        except Exception as exc:
            logger.warning(f"Failed to cache weights: {exc}")
    
    async def get_optimized_weights(self, company_id: int) -> Dict[str, float]:
        """Retrieve cached optimized weights."""
        try:
            from .utils import redis_client
            
            cache_key = f"rag:weights:company:{company_id}"
            cached = redis_client.get(cache_key)
            
            if cached:
                payload = json.loads(cached)
                valid_until = datetime.fromisoformat(payload.get("valid_until", ""))
                
                if datetime.now() < valid_until:
                    logger.debug(f"Using cached weights for company {company_id}")
                    return {
                        "bm25_weight": payload.get("bm25_weight", 0.3),
                        "knn_weight": payload.get("knn_weight", 0.7)
                    }
        except Exception as exc:
            logger.warning(f"Failed to retrieve cached weights: {exc}")
        
        # Fallback to default
        return {"bm25_weight": 0.3, "knn_weight": 0.7}
    
    def detect_embedding_drift(
        self,
        company_id: int,
        baseline_period_days: int = 30
    ) -> Dict:
        """
        Detect if embedding quality has drifted over time.
        
        Compares recent retrieval scores to historical baseline.
        """
        
        from .models import QuizQuestion
        
        cutoff = datetime.now() - timedelta(days=baseline_period_days)
        
        # Get historical relevance scores
        questions = QuizQuestion.objects.filter(
            metadata__retrieval_mode="kb_grounded",
            created_at__gte=cutoff
        )
        
        if questions.count() < 50:
            return {"drift_detected": False, "confidence": "low_data"}
        
        # Split into early and recent periods
        all_questions = list(questions.order_by('created_at'))
        midpoint = len(all_questions) // 2
        
        early_scores = [
            (q.metadata or {}).get("avg_relevance", 0.5)
            for q in all_questions[:midpoint]
        ]
        recent_scores = [
            (q.metadata or {}).get("avg_relevance", 0.5)
            for q in all_questions[midpoint:]
        ]
        
        early_avg = statistics.mean(early_scores) if early_scores else 0
        recent_avg = statistics.mean(recent_scores) if recent_scores else 0
        
        drift = abs(recent_avg - early_avg)
        
        result = {
            "drift_detected": drift > 0.15,  # 15% threshold
            "drift_magnitude": drift,
            "early_avg_relevance": early_avg,
            "recent_avg_relevance": recent_avg,
            "recommendation": "retrain_embeddings" if drift > 0.15 else "monitoring"
        }
        
        logger.info(f"Drift analysis: {drift:.3f} change in relevance scores")
        return result
    
    def run_ab_test(
        self,
        company_id: int,
        variant_a: Dict,
        variant_b: Dict,
        duration_days: int = 7
    ) -> Dict:
        """
        Run A/B test between two retrieval strategies.
        
        Args:
            variant_a: e.g., {"bm25_weight": 0.3, "knn_weight": 0.7}
            variant_b: e.g., {"bm25_weight": 0.6, "knn_weight": 0.4}
            
        Returns:
            Test results with winner recommendation
        """
        
        # Implementation would randomly assign sessions to variants
        # and compare performance metrics
        # For now, return placeholder
        
        return {
            "test_id": f"ab_{company_id}_{datetime.now().strftime('%Y%m%d')}",
            "status": "running",
            "variant_a": variant_a,
            "variant_b": variant_b,
            "duration_days": duration_days,
            "message": "A/B test framework - implement randomization logic"
        }
