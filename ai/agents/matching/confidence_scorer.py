"""
confidence_scorer.py

Analyzes the parsing quality of a CV to determine how much we can trust the matching score.
Factors: skill count, date presence, education detection, text cleanliness.
"""
from typing import Dict, List, Any

class ConfidenceScorer:
    """Calculates a confidence score for CV parsing quality."""
    
    def __init__(self):
        self.version = "1.0.0"

    def calculate_confidence(self, profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyzes the candidate profile and returns a confidence score.
        """
        reasons = []
        score = 0.0
        
        # 1. Skills Count (Max 0.3)
        skills = profile.get("skills", [])
        if not isinstance(skills, list):
            skills = []
        
        skill_count = len(skills)
        if skill_count >= 12:
            score += 0.3
            reasons.append(f"CV contained {skill_count} explicit skills")
        elif skill_count >= 5:
            score += 0.2
            reasons.append(f"Found {skill_count} skills (moderate coverage)")
        else:
            reasons.append("Low number of skills detected")

        # 2. Work History & Dates (Max 0.3)
        experience = profile.get("experience", [])
        has_dates = True
        if not experience:
            has_dates = False
        else:
            for exp in experience:
                if not exp.get("start_date") or not exp.get("end_date"):
                    if not exp.get("is_current"):
                        has_dates = False
                        break
        
        if has_dates:
            score += 0.3
            reasons.append("Work history has clear dates")
        else:
            reasons.append("Some experience entries are missing dates")

        # 3. Education Section (Max 0.2)
        education = profile.get("education", [])
        if education and len(education) > 0:
            score += 0.2
            reasons.append("Education section fully parsed")
        else:
            reasons.append("Education section missing or not detected")

        # 4. Text Quality (Max 0.2)
        raw_text = profile.get("raw_text", "")
        if len(raw_text) > 500:
            # Simple heuristic for "clean text" vs "scanned image OCR"
            # (Checking for high density of special characters or very short lines could be better)
            score += 0.2
            reasons.append("CV text density is high (likely clean digital PDF)")
        else:
            reasons.append("CV text is short or sparse (potential OCR or parsing issue)")

        # Map score to label
        label = "LOW"
        if score >= 0.8:
            label = "HIGH"
        elif score >= 0.5:
            label = "MEDIUM"
            
        return {
            "confidence": label,
            "confidence_score": round(score, 2),
            "confidence_reasons": reasons
        }
