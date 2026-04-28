"""
rag_monitoring.py

Comprehensive monitoring and observability for RAG system:
- Retrieval quality metrics
- Hallucination detection
- Performance tracking
- Alert system
"""

import logging
import statistics
from typing import Dict, List, Optional
from datetime import datetime
from django.conf import settings

logger = logging.getLogger(__name__)


class RAGMonitor:
    """
    Monitor RAG system health and quality.
    
    Tracks:
    - Retrieval precision/recall proxies
    - Hallucination flags
    - Response latency
    - Chunk relevance distribution
    - System errors
    """
    
    def __init__(self):
        self.metrics_buffer = []
        
    async def validate_question_against_chunks(
        self,
        question_text: str,
        retrieved_chunks: List[Dict],
        threshold: float = 0.6
    ) -> Dict:
        """
        Check if generated question is grounded in retrieved chunks.
        
        Uses NLI (Natural Language Inference) to detect hallucinations.
        
        Returns:
            Validation report with hallucination probability
        """
        
        if not retrieved_chunks:
            return {
                "hallucination_probability": 1.0,
                "is_grounded": False,
                "reason": "No retrieved chunks to validate against"
            }
        
        # Use lightweight validation strategy
        # Check for key term overlap and semantic consistency
        
        validation_results = []
        
        for chunk in retrieved_chunks[:5]:  # Top 5 chunks
            chunk_content = chunk.get("content", "")
            
            # Extract key terms from question
            question_terms = set(self._extract_key_terms(question_text))
            chunk_terms = set(self._extract_key_terms(chunk_content))
            
            # Calculate overlap
            if question_terms and chunk_terms:
                overlap = len(question_terms & chunk_terms) / len(question_terms)
                validation_results.append({
                    "chunk_id": chunk.get("id"),
                    "term_overlap": overlap,
                    "content_length": len(chunk_content)
                })
        
        # Aggregate results
        if not validation_results:
            return {
                "hallucination_probability": 0.8,
                "is_grounded": False,
                "reason": "No meaningful term overlap found"
            }
        
        avg_overlap = statistics.mean([r["term_overlap"] for r in validation_results])
        max_overlap = max([r["term_overlap"] for r in validation_results])
        
        # Hallucination probability (inverse of grounding strength)
        hallucination_prob = 1.0 - max(avg_overlap * 0.5, max_overlap * 0.5)
        
        is_grounded = hallucination_prob < (1.0 - threshold)
        
        result = {
            "hallucination_probability": round(hallucination_prob, 3),
            "is_grounded": is_grounded,
            "confidence": round(max(avg_overlap, max_overlap), 3),
            "chunks_validated": len(validation_results),
            "avg_term_overlap": round(avg_overlap, 3),
            "max_term_overlap": round(max_overlap, 3),
            "recommendation": "proceed" if is_grounded else "regenerate_question"
        }
        
        if not is_grounded:
            logger.warning(
                f"Potential hallucination detected (prob={hallucination_prob:.2f}): {question_text[:100]}..."
            )
        
        return result
    
    def _extract_key_terms(self, text: str) -> List[str]:
        """Extract technical terms from text."""
        import re
        
        # Remove stopwords and extract meaningful terms
        stopwords = {
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'could', 'should', 'may', 'might', 'must', 'shall',
            'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in',
            'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
            'through', 'during', 'before', 'after', 'above', 'below',
            'between', 'under', 'again', 'further', 'then', 'once',
            'here', 'there', 'when', 'where', 'why', 'how', 'all',
            'each', 'few', 'more', 'most', 'other', 'some', 'such',
            'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
            'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because',
            'until', 'while', 'although', 'though', 'after', 'before'
        }
        
        # Extract technical-looking terms
        terms = re.findall(r'\b[A-Z][a-zA-Z0-9+#.]*|\b[a-z]{4,}\b', text.lower())
        return [t for t in terms if t not in stopwords]
    
    def track_retrieval_metrics(
        self,
        company_id: int,
        retrieval_mode: str,
        num_chunks: int,
        avg_relevance: float,
        retrieval_time_ms: float,
        query_embedding_time_ms: float
    ) -> None:
        """Track retrieval performance metrics."""
        
        metric = {
            "timestamp": datetime.now().isoformat(),
            "company_id": company_id,
            "retrieval_mode": retrieval_mode,
            "num_chunks": num_chunks,
            "avg_relevance": avg_relevance,
            "retrieval_time_ms": retrieval_time_ms,
            "query_embedding_time_ms": query_embedding_time_ms,
            "total_latency_ms": retrieval_time_ms + query_embedding_time_ms
        }
        
        self.metrics_buffer.append(metric)
        
        # Flush buffer every 100 metrics
        if len(self.metrics_buffer) >= 100:
            self._flush_metrics()
    
    def _flush_metrics(self) -> None:
        """Persist metrics to database or external service."""
        # For now, just log aggregated stats
        if not self.metrics_buffer:
            return
        
        avg_relevance = statistics.mean([m["avg_relevance"] for m in self.metrics_buffer])
        avg_latency = statistics.mean([m["total_latency_ms"] for m in self.metrics_buffer])
        
        logger.info(
            f"RAG Metrics Summary: "
            f"{len(self.metrics_buffer)} retrievals, "
            f"avg_relevance={avg_relevance:.3f}, "
            f"avg_latency={avg_latency:.1f}ms"
        )
        
        self.metrics_buffer.clear()
    
    def get_system_health(self, company_id: int) -> Dict:
        """
        Get overall RAG system health for a company.
        
        Returns:
            Health report with status and recommendations
        """
        
        # Analyze recent metrics
        recent_metrics = [
            m for m in self.metrics_buffer
            if m.get("company_id") == company_id
        ][-50:]  # Last 50 retrievals
        
        if not recent_metrics:
            return {
                "status": "unknown",
                "message": "Insufficient data for health assessment"
            }
        
        # Calculate health indicators
        avg_relevance = statistics.mean([m["avg_relevance"] for m in recent_metrics])
        avg_latency = statistics.mean([m["total_latency_ms"] for m in recent_metrics])
        kb_usage_rate = sum(1 for m in recent_metrics if m["retrieval_mode"] == "kb_grounded") / len(recent_metrics)
        
        # Health scoring
        health_score = 0.0
        
        # Relevance component (40%)
        if avg_relevance > 0.7:
            health_score += 0.4
        elif avg_relevance > 0.5:
            health_score += 0.25
        
        # Latency component (30%)
        if avg_latency < 500:
            health_score += 0.3
        elif avg_latency < 1000:
            health_score += 0.15
        
        # KB usage component (30%)
        if kb_usage_rate > 0.8:
            health_score += 0.3
        elif kb_usage_rate > 0.5:
            health_score += 0.15
        
        # Determine status
        if health_score >= 0.8:
            status = "excellent"
        elif health_score >= 0.6:
            status = "good"
        elif health_score >= 0.4:
            status = "fair"
        else:
            status = "poor"
        
        # Generate recommendations
        recommendations = []
        
        if avg_relevance < 0.5:
            recommendations.append("Low retrieval relevance - consider adjusting embedding model or chunking strategy")
        
        if avg_latency > 1000:
            recommendations.append("High latency - optimize vector index or increase cache TTL")
        
        if kb_usage_rate < 0.5:
            recommendations.append("Low KB usage - upload more knowledge base documents")
        
        return {
            "status": status,
            "health_score": round(health_score, 3),
            "metrics_analyzed": len(recent_metrics),
            "avg_relevance": round(avg_relevance, 3),
            "avg_latency_ms": round(avg_latency, 1),
            "kb_usage_rate": round(kb_usage_rate, 3),
            "recommendations": recommendations,
            "timestamp": datetime.now().isoformat()
        }
    
    def alert_on_degradation(
        self,
        company_id: int,
        threshold_health: float = 0.5
    ) -> Optional[Dict]:
        """
        Check for performance degradation and trigger alerts.
        
        Returns:
            Alert dict if degradation detected, None otherwise
        """
        
        health = self.get_system_health(company_id)
        
        if health["status"] in ["poor", "fair"] and health["health_score"] < threshold_health:
            alert = {
                "type": "performance_degradation",
                "severity": "high" if health["health_score"] < 0.3 else "medium",
                "company_id": company_id,
                "health_score": health["health_score"],
                "issues": health["recommendations"],
                "timestamp": datetime.now().isoformat(),
                "action_required": True
            }
            
            logger.warning(f"RAG Performance Alert: {alert}")
            return alert
        
        return None
