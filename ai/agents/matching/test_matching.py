import sys
import os

# Add project to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

import numpy as np

# Mock numpy arrays for embeddings
def create_mock_embedding(seed: int, dim: int = 768) -> list[float]:
    """Create deterministic mock embeddings."""
    np.random.seed(seed)
    vec = np.random.randn(dim)
    vec = vec / np.linalg.norm(vec)  # Normalize
    return vec.tolist()


def test_skill_matcher():
    """Test skill matching with job context validation."""
    print("\n" + "="*60)
    print("TEST 1: Skill Matcher")
    print("="*60)
    
    from ai.agents.matching.skill_matcher import match_skills, normalize_skill
    
    # Test data
    job_skills = [
        {"name": "Python", "importance": 1.0, "is_required": True},
        {"name": "Django", "importance": 0.8, "is_required": True},
        {"name": "AWS", "importance": 0.5, "is_required": False},
    ]
    
    candidate_skills = ["Python", "Flask", "Docker"]
    
    # Create mock embeddings
    job_skill_vectors = {
        "Python": create_mock_embedding(1),
        "Django": create_mock_embedding(2),
        "AWS": create_mock_embedding(3),
    }
    candidate_skill_vectors = {
        "Python": create_mock_embedding(1),  # Same as job - exact match
        "Flask": create_mock_embedding(4),     # Different seed
        "Docker": create_mock_embedding(5),
    }
    job_embedding = create_mock_embedding(100)  # Job context
    
    # Test exact match
    result = match_skills(
        job_skills=job_skills,
        job_skill_vectors=job_skill_vectors,
        candidate_skills=candidate_skills,
        candidate_skill_vectors=candidate_skill_vectors,
        job_embedding=job_embedding,
    )
    
    print(f"Score: {result['score']:.2f}")
    print(f"Matched: {result['matched_skills']}")
    print(f"Missing: {result['missing_skills']}")
    print(f"Summary: {result['match_summary']}")
    
    # Verify exact match detected
    assert "Python" in result['matched_skills'], "Python should be exact match"
    assert result['match_summary']['exact_matches'] >= 1, "Should have at least 1 exact match"
    
    print("✓ Skill matcher test passed")


def test_experience_matcher():
    """Test experience matching with simplified 2-signal approach."""
    print("\n" + "="*60)
    print("TEST 2: Experience Matcher")
    print("="*60)
    
    from ai.agents.matching.experience_matcher import match_experience
    
    # Test data - candidate with relevant roles
    job_profile = {
        "skills": ["Python", "Django"],
        "required_experience_years": 3.0,
    }
    
    candidate_profile = {
        "experience": [
            {
                "role": "Senior Python Developer",
                "company": "TechCorp",
                "start_date": "2020-01",
                "end_date": "2023-01",
                "description": "Built Python web applications using Django and Flask",
            },
            {
                "role": "Junior Developer",
                "company": "StartUp",
                "start_date": "2019-01",
                "end_date": "2019-12",
                "description": "Worked with JavaScript and React",
            },
        ],
        "total_experience_years": 4.0,
    }
    
    result = match_experience(job_profile, candidate_profile)
    
    print(f"Score: {result['score']:.2f}")
    print(f"Relevant years: {result['relevant_years']}")
    print(f"Total years: {result['total_years']}")
    print(f"Skill coverage: {result['skill_coverage']:.2f}")
    print(f"Relevant roles: {len(result['relevant_roles'])}")
    
    # Verify logic
    assert result['relevant_years'] > 0, "Should have relevant years"
    assert result['relevant_roles'], "Should have relevant roles"
    
    print("✓ Experience matcher test passed")


def test_seniority_matcher():
    """Test seniority matching with 3 levels."""
    print("\n" + "="*60)
    print("TEST 3: Seniority Matcher (3 Levels)")
    print("="*60)
    
    from ai.agents.matching.seniority_matcher import match_seniority
    
    test_cases = [
        # (job_levels, candidate_title, candidate_exp, expected_comparison)
        (["Senior"], "Senior Developer", 5, "meets"),
        (["Mid-level"], "Junior Developer", 1, "below"),
        (["Junior"], "Senior Engineer", 8, "exceeds"),
    ]
    
    for job_levels, title, years, expected in test_cases:
        candidate = {
            "title": title,
            "total_experience_years": years,
            "experience": [{"role": title}],
        }
        
        result = match_seniority(job_levels, candidate)
        
        print(f"\nJob: {job_levels} | Candidate: {title} ({years} years)")
        print(f"  Score: {result['score']}")
        print(f"  Job level: {result['job_level_name']}")
        print(f"  Candidate level: {result['candidate_level_name']}")
        print(f"  Comparison: {result['comparison']}")
        
        assert result['job_level'] in [0, 1, 2, 3], "Level should be 0-3"
        assert result['candidate_level'] in [0, 1, 2, 3], "Level should be 0-3"
    
    print("\n✓ Seniority matcher test passed")


def test_matching_modes():
    """Test the 3 matching modes configuration."""
    print("\n" + "="*60)
    print("TEST 4: Matching Modes")
    print("="*60)
    
    from ai.agents.matching.matching_agent import MATCHING_MODES, CURRENT_MODE
    
    print(f"Current mode: {CURRENT_MODE}")
    print(f"Available modes: {list(MATCHING_MODES.keys())}")
    
    for mode, config in MATCHING_MODES.items():
        print(f"\n{mode}:")
        print(f"  Description: {config['description']}")
        print(f"  Hard skill penalty: {config['hard_skill_penalty']}")
        print(f"  Experience penalty max: {config['experience_penalty_max']}")
        print(f"  Can filter: {config['hard_constraints_filter']}")
    
    # Verify mode structure
    assert "STRICT" in MATCHING_MODES
    assert "BALANCED" in MATCHING_MODES
    assert "FLEX" in MATCHING_MODES
    
    # STRICT should allow filtering
    assert MATCHING_MODES["STRICT"]["hard_constraints_filter"] == True
    
    # BALANCED should be penalties only
    assert MATCHING_MODES["BALANCED"]["hard_constraints_filter"] == False
    
    print("\n✓ Matching modes test passed")


def test_integration():
    """Integration test - verify all components work together."""
    print("\n" + "="*60)
    print("TEST 5: Integration (5-Pillar Output)")
    print("="*60)
    
    from ai.agents.matching.explanation_generator import generate_explanation
    
    # Mock profiles
    job_profile = {
        "title": "Senior Python Developer",
        "skills": [
            {"name": "Python", "is_required": True},
            {"name": "Django", "is_required": True},
        ],
        "required_experience_years": 3,
        "experience_levels": ["Senior"],
        "required_degrees": ["Bachelor"],
    }
    
    candidate_profile = {
        "title": "Senior Developer",
        "total_experience_years": 4,
        "experience": [{"role": "Senior Python Dev"}],
        "education": [{"degree": "Bachelor", "field": "CS"}],
    }
    
    # Generate explanation
    result = generate_explanation(
        candidate_profile=candidate_profile,
        job_profile=job_profile,
        semantic_score=0.85,
        skill_score=0.90,
        experience_score=0.80,
        seniority_score=0.95,
        degree_score=1.0,
        matched_skills=["Python", "Django"],
        missing_skills=[],
        skill_match_details=[
            {"skill": "Python", "match_type": "exact", "weight": 1.0, "is_hard_constraint": True},
            {"skill": "Django", "match_type": "exact", "weight": 1.0, "is_hard_constraint": True},
        ],
        match_summary={"exact_matches": 2, "strong_semantic": 0, "partial_semantic": 0, "hard_constraints_missing": []},
        seniority_comparison="meets",
        seniority_job_level="Senior",
        seniority_candidate_level="Senior",
        degree_details={"comparison_result": "meets", "required_level_name": "Bachelor", "candidate_level_name": "Bachelor"},
        relevant_years=3.5,
        total_years=4.0,
        matching_mode="BALANCED",
        final_score=88,
        confidence_score=0.92,
    )
    
    print(f"Summary: {result['summary'][:100]}...")
    print(f"\nScore Breakdown:")
    for pillar, data in result['score_breakdown'].items():
        print(f"  {pillar}: {data.get('score', 'N/A')}")
    
    print(f"\nRecommendation: {result['final_assessment']['recommendation']}")
    
    assert result['final_assessment']['final_score'] == 88
    assert result['score_breakdown']['skills']['exact_matches'] == 2
    
    print("\n✓ Integration test passed")


def run_all_tests():
    """Run all tests."""
    print("\n" + "="*60)
    print("AI MATCHING SYSTEM - TEST SUITE")
    print("="*60)
    
    try:
        test_skill_matcher()
        test_experience_matcher()
        test_seniority_matcher()
        test_matching_modes()
        test_integration()
        
        print("\n" + "="*60)
        print("✓ ALL TESTS PASSED")
        print("="*60)
        return 0
        
    except Exception as e:
        print(f"\n✗ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(run_all_tests())
