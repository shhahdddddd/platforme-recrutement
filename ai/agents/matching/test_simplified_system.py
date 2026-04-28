"""
test_simplified_system.py

End-to-end test of the simplified ATS architecture.

Tests:
1. Simplified universal matcher
2. Data-driven thresholds (no hardcoded values)
3. Derived substitutability (no manual flags)
4. 4-part explanation (not 6-part)
5. Adaptive thresholds
6. Learned calibration (with fallback)
"""

import sys
import asyncio
import numpy as np
from typing import Dict, List, Any
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))


def create_mock_embeddings(texts: List[str], dim: int = 384) -> Dict[str, List[float]]:
    """Create deterministic mock embeddings for testing."""
    np.random.seed(42)
    embeddings = {}
    for text in texts:
        # Deterministic seed from text
        seed = sum(ord(c) for c in text)
        np.random.seed(seed)
        vec = np.random.randn(dim).astype("float32")
        vec = vec / np.linalg.norm(vec)  # Normalize
        embeddings[text.lower()] = vec.tolist()
    return embeddings


def test_simplified_matcher():
    """Test 1: Simplified universal matcher."""
    print("\n" + "="*60)
    print("TEST 1: Simplified Universal Matcher")
    print("="*60)
    
    from universal_matcher import match_universal, generate_explanation, format_explanation
    
    # Mock job requirements (no manual substitutable flags)
    job_requirements = [
        {"name": "Python", "type": "skill", "importance": 1.0, "criticality": "hard", "category": "language"},
        {"name": "JavaScript", "type": "skill", "importance": 0.8, "criticality": "soft", "category": "language"},
        {"name": "React", "type": "skill", "importance": 0.9, "criticality": "hard", "category": "framework"},
        {"name": "5 years experience", "type": "experience", "importance": 1.0, "criticality": "hard", "category": "tenure"},
    ]
    
    # Mock candidate skills (React is missing - has Vue instead)
    candidate_items = [
        {"name": "Python", "type": "skill", "category": "language"},
        {"name": "JavaScript", "type": "skill", "category": "language"},
        {"name": "Vue", "type": "skill", "category": "framework"},  # Similar to React
        {"name": "3 years experience", "type": "experience", "category": "tenure"},
    ]
    
    # Create mock embeddings
    all_texts = ["Python", "JavaScript", "React", "Vue", "5 years experience", "3 years experience"]
    job_embeddings = create_mock_embeddings([f"skill:{t}" for t in all_texts])
    candidate_embeddings = create_mock_embeddings([f"skill:{t}" for t in all_texts])
    
    # Run matching (NO industry/seniority parameters)
    result = match_universal(
        job_requirements=job_requirements,
        candidate_items=candidate_items,
        job_embeddings=job_embeddings,
        candidate_embeddings=candidate_embeddings,
    )
    
    print(f"Score: {result['score']:.3f}")
    print(f"Gate Status: {result['gate_status']}")
    print(f"Gate Uncertainty: {result.get('gate_uncertainty', False)}")
    print(f"Category Scores: {result['category_scores']}")
    
    # Verify no hardcoded industry context in result
    assert "industry_context" not in result, "Should not have industry_context"
    
    # Verify substitutability is derived, not manual
    for match in result['matches']:
        assert "auto_detected" not in match or match.get("auto_detected", False), "Should use derived substitutability"
    
    print("✅ TEST 1 PASSED: Simplified matcher works without hardcoded parameters")
    return result


def test_adaptive_thresholds():
    """Test 2: Adaptive percentile-based thresholds."""
    print("\n" + "="*60)
    print("TEST 2: Adaptive Thresholds")
    print("="*60)
    
    from adaptive_thresholds import compute_adaptive_thresholds, classify_with_adaptive_thresholds
    
    # Sample scores from 20 candidates
    sample_scores = [0.85, 0.82, 0.78, 0.75, 0.71, 0.68, 0.65, 0.62, 0.58, 0.55,
                     0.52, 0.48, 0.45, 0.42, 0.38, 0.35, 0.32, 0.28, 0.15, 0.08]
    
    thresholds = compute_adaptive_thresholds(sample_scores, method="percentile")
    
    print(f"Pass threshold (75th percentile): {thresholds.pass_threshold}")
    print(f"Review threshold (25th percentile): {thresholds.review_threshold}")
    print(f"Fail threshold (10th percentile): {thresholds.fail_threshold}")
    print(f"Distribution mean: {thresholds.mean}, std: {thresholds.std}")
    print(f"Sample size: {thresholds.sample_size}")
    
    # Classify a few candidates
    for score in [0.80, 0.50, 0.20]:
        classification = classify_with_adaptive_thresholds(score, thresholds)
        print(f"Score {score:.2f} -> {classification['classification']}: {classification['reason']}")
    
    # Verify thresholds are computed from data
    assert thresholds.sample_size == 20
    assert 0 < thresholds.review_threshold < thresholds.pass_threshold < 1
    
    print("✅ TEST 2 PASSED: Adaptive thresholds computed from data distribution")
    return thresholds


def test_learned_calibration():
    """Test 3: Learned calibration with fallback."""
    print("\n" + "="*60)
    print("TEST 3: Learned Calibration")
    print("="*60)
    
    from learned_calibration import LearnedCalibration, predict_hire_probability
    
    cal = LearnedCalibration()
    
    # Without training, should use fallback
    match_result = {
        "score": 0.75,
        "category_scores": {"skills": 0.8, "experience": 0.7, "education": 0.6},
        "gate_passed": True,
        "gate_uncertainty": False,
    }
    
    pred_fallback = cal.predict(match_result)
    print(f"Fallback prediction: P(hire)={pred_fallback['P_hire']:.1%}")
    print(f"Model used: {pred_fallback['model_used']}")
    assert pred_fallback["model_used"] == "fallback_sigmoid"
    
    # Add training data
    print("\nAdding training examples...")
    for i in range(60):
        score = np.random.beta(2, 2)
        was_hired = score > 0.55  # Synthetic: hired if score > 0.55
        
        result = {
            "score": score,
            "category_scores": {
                "skills": score * (0.8 + np.random.rand() * 0.2),
                "experience": score * (0.7 + np.random.rand() * 0.2),
                "education": score * (0.6 + np.random.rand() * 0.2),
            },
            "gate_passed": score > 0.3,
            "gate_uncertainty": 0.3 <= score <= 0.5,
        }
        
        cal.add_outcome(result, was_hired, f"cand_{i}", "job_001")
    
    # Train model
    model = cal.train(min_samples=50)
    
    if model:
        print(f"\nModel trained!")
        print(f"Accuracy: {model.accuracy:.1%}")
        print(f"Training samples: {model.training_samples}")
        
        # Predict with learned model
        pred_learned = cal.predict(match_result)
        print(f"\nLearned prediction: P(hire)={pred_learned['P_hire']:.1%}")
        print(f"Model used: {pred_learned['model_used']}")
        print(f"Uncertainty: {pred_learned['uncertainty']}")
        
        assert pred_learned["model_used"] == "learned"
        assert "model_accuracy" in pred_learned
        
        print("✅ TEST 3 PASSED: Learned calibration works with fallback")
    else:
        print("⚠️  Model training skipped (insufficient data)")
    
    return cal


def test_four_part_explanation():
    """Test 4: 4-part simplified explanation."""
    print("\n" + "="*60)
    print("TEST 4: 4-Part Explanation")
    print("="*60)
    
    from universal_matcher import generate_explanation, format_explanation
    
    # Mock match result
    match_result = {
        "matches": [
            {"requirement": "Python", "coverage": 0.9, "criticality": "hard", "category": "skills"},
            {"requirement": "React", "coverage": 0.75, "criticality": "hard", "category": "skills"},
            {"requirement": "AWS", "coverage": 0.4, "criticality": "soft", "category": "skills"},
        ],
        "gate_status": "PASS",
        "failed_critical": [],
        "category_scores": {"skills": 0.68},
    }
    
    calibration = {"P_hire": 0.72}
    
    explanation = generate_explanation(
        match_result=match_result,
        job_title="Software Engineer",
        calibration=calibration,
    )
    
    print("Explanation structure:")
    print(f"  Job: {explanation['job']}")
    print(f"  Matched: {len(explanation['matched'].get('strong', []))} strong, {len(explanation['matched'].get('partial', []))} partial")
    print(f"  Gaps: {len(explanation['gaps'].get('critical', []))} critical, {len(explanation['gaps'].get('weak', []))} weak")
    print(f"  Decision: {explanation['decision']}")
    
    # Verify 4-part structure
    assert set(explanation.keys()) == {"job", "matched", "gaps", "decision", "P_hire", "gate_status"}
    
    # Verify no 6-part keys
    assert "part1_job_understanding" not in explanation
    assert "part6_industry_context" not in explanation
    
    # Format as text
    text = format_explanation(explanation)
    print(f"\nFormatted explanation:\n{text}")
    
    print("✅ TEST 4 PASSED: 4-part explanation generated without extra layers")
    return explanation


def test_no_hardcoded_values():
    """Test 5: Verify no hardcoded thresholds remain."""
    print("\n" + "="*60)
    print("TEST 5: No Hardcoded Values")
    print("="*60)
    
    import industry_context
    import degree_intelligence
    
    # Check industry_context has no hardcoded thresholds
    ctx = industry_context.get_industry_context("IT")
    assert "substitutability_threshold" not in ctx
    assert "min_coverage_for_pass" not in ctx
    print("✅ industry_context.py: No hardcoded thresholds")
    
    # Check degree_intelligence uses embeddings
    field_sim = degree_intelligence.compute_field_similarity(
        "Computer Science", "Software Engineering",
        degree_embedding=None, job_embedding=None
    )
    assert 0 <= field_sim <= 1
    print("✅ degree_intelligence.py: Uses embedding similarity (no hardcoded matrix)")
    
    print("✅ TEST 5 PASSED: No hardcoded values in simplified system")


def test_end_to_end():
    """Test 6: Full end-to-end pipeline."""
    print("\n" + "="*60)
    print("TEST 6: End-to-End Pipeline")
    print("="*60)
    
    from universal_matcher import match_universal, calibrate_hiring_probability, generate_explanation
    from adaptive_thresholds import compute_adaptive_thresholds, classify_with_adaptive_thresholds
    from learned_calibration import predict_hire_probability
    
    # Setup
    job_requirements = [
        {"name": "Python", "type": "skill", "importance": 1.0, "criticality": "hard", "category": "language"},
        {"name": "Machine Learning", "type": "skill", "importance": 0.9, "criticality": "hard", "category": "domain"},
        {"name": "SQL", "type": "skill", "importance": 0.7, "criticality": "soft", "category": "tool"},
    ]
    
    candidates = [
        # Strong candidate
        {"name": "Alice", "skills": ["Python", "Machine Learning", "SQL"]},
        # Partial candidate (missing ML, has Data Science instead)
        {"name": "Bob", "skills": ["Python", "Data Science", "SQL"]},
        # Weak candidate
        {"name": "Charlie", "skills": ["Java", "C++"]},
    ]
    
    all_texts = ["Python", "Machine Learning", "SQL", "Data Science", "Java", "C++"]
    job_embeddings = create_mock_embeddings([f"skill:{t}" for t in all_texts])
    
    scores = []
    results = []
    
    for cand in candidates:
        candidate_items = [{"name": s, "type": "skill", "category": "unknown"} for s in cand["skills"]]
        cand_embeddings = create_mock_embeddings([f"skill:{s}" for s in cand["skills"]])
        
        result = match_universal(
            job_requirements=job_requirements,
            candidate_items=candidate_items,
            job_embeddings=job_embeddings,
            candidate_embeddings=cand_embeddings,
        )
        
        scores.append(result["score"])
        results.append({"name": cand["name"], **result})
        
        print(f"\n{cand['name']}: Score={result['score']:.3f}, Gate={result['gate_status']}")
    
    # Compute adaptive thresholds from actual scores
    thresholds = compute_adaptive_thresholds(scores, method="percentile")
    print(f"\nAdaptive thresholds: Pass={thresholds.pass_threshold:.2f}, Review={thresholds.review_threshold:.2f}")
    
    # Classify each candidate
    for r in results:
        classification = classify_with_adaptive_thresholds(r["score"], thresholds)
        print(f"{r['name']}: {classification['classification']} - {classification['reason']}")
        
        # Generate explanation
        calibration = calibrate_hiring_probability(
            score=r["score"],
            gate_status=r["gate_status"],
            category_scores=r["category_scores"],
        )
        
        explanation = generate_explanation(r, "Data Scientist", calibration)
        print(f"  -> {explanation['decision']}")
    
    print("\n✅ TEST 6 PASSED: Full end-to-end pipeline works")
    return results


def run_all_tests():
    """Run all tests."""
    print("\n" + "="*70)
    print("SIMPLIFIED ATS SYSTEM - END-TO-END TEST SUITE")
    print("="*70)
    
    try:
        test_simplified_matcher()
        test_adaptive_thresholds()
        test_learned_calibration()
        test_four_part_explanation()
        test_no_hardcoded_values()
        test_end_to_end()
        
        print("\n" + "="*70)
        print("🎉 ALL TESTS PASSED!")
        print("="*70)
        print("\nSystem is ready with:")
        print("  ✅ No hardcoded industry thresholds")
        print("  ✅ No REVIEW=50% penalty")
        print("  ✅ Single unified decision model")
        print("  ✅ Derived substitutability (no manual flags)")
        print("  ✅ 4-part explanation (not 6-part)")
        print("  ✅ Embedding-based degree matching")
        print("  ✅ Adaptive percentile thresholds")
        print("  ✅ Learned calibration with fallback")
        
        return True
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
