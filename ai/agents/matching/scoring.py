"""
scoring.py

Experience-match scoring for regular jobs and internships.

For regular jobs the score is a hybrid of:
  - Year-based comparison (candidate years ÷ required years).
  - Seniority-level heuristics (Junior / Senior).

For internships a specialised scorer checks education alignment
(e.g. Master-2 students for 6-month PFE internships).
"""

from __future__ import annotations


def compute_experience_match(
    job_profile: dict, candidate_profile: dict
) -> float:
    """
    Return a score in [0.0, 1.0] reflecting how well the candidate's
    experience matches the job requirements.
    """
    if job_profile.get("is_internship", False):
        return _compute_internship_match(job_profile, candidate_profile)

    # ── Year-based score ──────────────────────────────────────────────
    required_years = job_profile.get("required_experience_years") or 0
    candidate_years = candidate_profile.get("total_experience_years") or 0

    year_score = 1.0
    if required_years > 0:
        year_score = min(float(candidate_years) / float(required_years), 1.0)

    # ── Level heuristics ──────────────────────────────────────────────
    target_levels = job_profile.get("experience_levels", [])
    if not target_levels:
        return year_score

    is_junior = any("junior" in str(lv).lower() for lv in target_levels)
    is_senior = any("senior" in str(lv).lower() for lv in target_levels)

    level_score = 1.0  # default — no specific level
    if is_junior and is_senior:
        level_score = 1.0  # broad requirement
    elif is_senior:
        if candidate_years >= 5:
            level_score = 1.0
        elif candidate_years >= 3:
            level_score = 0.5
        else:
            level_score = 0.1
    elif is_junior:
        level_score = 1.0 if candidate_years <= 4 else 0.8  # overqualified

    # Hybrid: years = baseline, level = multiplier/cap
    return round(year_score * 0.4 + level_score * 0.6, 4)


def _compute_internship_match(
    job_profile: dict, candidate_profile: dict
) -> float:
    """
    Specialised scoring for internships.

    Most student CVs don't list explicit availability, so we focus on
    whether they have a recent Master/Engineering education entry.
    """
    details = job_profile.get("internship_details", {})
    required_months = details.get("duration_months")

    education = candidate_profile.get("education", [])
    has_recent_master = any(
        "master" in str(e.get("degree", "")).lower() for e in education
    )

    if required_months and required_months >= 6 and not has_recent_master:
        # 6-month PFE usually implies Master-2.
        return 0.7

    return 1.0
