"""
llm_extractor.py

LLM-based extraction of requirements and candidate evidence.
Works for ANY job domain.
"""

from __future__ import annotations

import json
import logging
from typing import Dict, List, Any, Optional

from api.utils import call_llm

logger = logging.getLogger(__name__)


class MatchingLLMExtractor:
    """Extract requirements and evidence using LLM for matching."""
    
    def __init__(self):
        pass  # No LLMParser needed, we use call_llm directly
    
    async def extract_job_requirements(
        self,
        job_description: str,
        job_profile: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """
        Extract all job requirements with importance scores.
        
        Works for ANY job type:
        - Developer: React, 5 years exp, Agile
        - Doctor: Surgery license, 3 years residency, Emergency
        - Marketer: SEO, Content strategy, Analytics
        """
        # Build context from job profile
        skills = job_profile.get("skills", [])
        exp_levels = job_profile.get("experience_levels", [])
        degrees = job_profile.get("required_degrees", [])
        
        prompt = f"""Extract ALL requirements from this job description for candidate matching.

Job Description:
{job_description[:2000]}

Extracted Skills: {json.dumps(skills)}
Experience Levels: {json.dumps(exp_levels)}
Degree Requirements: {json.dumps(degrees)}

Return a JSON array of requirements. For each requirement:
- name: the specific requirement
- type: skill|experience|education|certification|trait|language|tool
- importance: 0.0-1.0 (how critical is this)
- criticality: "hard" | "soft"
  * hard = Must have, blocking if missing (e.g., "React" for React dev job)
  * soft = Nice to have, preferred but not blocking (e.g., "TypeScript" when JS is fine)
- substitutable: true | false
  * true = Can be satisfied by similar skills (e.g., "React" can be satisfied by Angular, Vue)
  * false = Must be exact match, no substitutes (e.g., "AWS Certification" cannot be substituted)
- category: specific subcategory (e.g., "frontend_framework", "database", "cloud_platform", "programming_language")
  * Helps system understand skill relationships
- level_required: "entry" | "intermediate" | "expert" | null
  * What proficiency level is expected?
- industry: string (e.g., "IT", "Healthcare", "Finance") or null
  * Which industry context applies?

Guidelines:
- BE EXHAUSTIVE - extract every single requirement mentioned
- Importance 1.0 = Must-have, 0.5 = Nice-to-have, 0.1 = Minor preference
- CRITICALITY: If missing this would BLOCK hiring → "hard", otherwise "soft"
- SUBSTITUTABLE: Can similar skills satisfy this? Skills/frameworks = true, Certs/specific tools = false
- CATEGORY: Be specific. "React" → "frontend_framework", "PostgreSQL" → "database"
- LEVEL: Only specify if job mentions "expert", "senior", "junior", etc.
- INDUSTRY: Infer from job if mentioned, else null
- Include implicit requirements (e.g., "React developer" → HTML, CSS, JavaScript)
- Include experience years as separate requirement
- Include soft skills, languages, certifications

Example output:
[
  {{"name": "React", "type": "skill", "importance": 1.0, "criticality": "hard", "substitutable": true, "category": "frontend_framework", "level_required": "intermediate", "industry": "IT"}},
  {{"name": "HTML", "type": "skill", "importance": 0.8, "criticality": "hard", "substitutable": false, "category": "markup_language", "level_required": null, "industry": null}},
  {{"name": "TypeScript", "type": "skill", "importance": 0.6, "criticality": "soft", "substitutable": true, "category": "programming_language", "level_required": null, "industry": null}},
  {{"name": "AWS Certification", "type": "certification", "importance": 0.7, "criticality": "soft", "substitutable": false, "category": "cloud_certification", "level_required": null, "industry": "IT"}},
  {{"name": "5 years experience", "type": "experience", "importance": 0.9, "criticality": "hard", "substitutable": false, "category": "years_experience", "level_required": null, "industry": null}},
  {{"name": "Team leadership", "type": "trait", "importance": 0.5, "criticality": "soft", "substitutable": true, "category": "soft_skill", "level_required": null, "industry": null}}
]

Return ONLY the JSON array, nothing else."""

        try:
            response = await call_llm(prompt)
            
            # Parse JSON from response
            json_match = self._extract_json(response)
            if json_match:
                requirements = json.loads(json_match)
                if isinstance(requirements, list):
                    logger.info(f"Extracted {len(requirements)} job requirements")
                    return requirements
        except Exception as exc:
            logger.error(f"LLM requirement extraction failed: {exc}")
        
        # Fallback: build from structured data
        return self._fallback_requirements(job_profile)
    
    async def extract_job_context(
        self,
        job_profile: Dict[str, Any],
        job_description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Extract industry context from job.
        
        Returns:
        {
            "industry": "IT" | "Healthcare" | "Finance" | "Education" | "Engineering",
            "role_family": "Frontend" | "Backend" | "Clinical" | "Audit" | "Teaching",
            "seniority": "Junior" | "Mid" | "Senior" | "Lead",
            "degree_expectation": {"level": "Bachelor", "field": "Computer Science"},
        }
        """
        import json
        
        job_title = job_profile.get("title", "")
        job_desc = job_description or job_profile.get("description", "")
        
        prompt = f"""Analyze this job posting and extract contextual information.

Job Title: {job_title}
Job Description:
{job_desc[:1500]}

Return a JSON object with:
- industry: One of ["IT", "Healthcare", "Finance", "Education", "Engineering", "General"]
- role_family: One of ["Frontend", "Backend", "Fullstack", "DevOps", "Data", "Clinical", "Audit", "Teaching", "Management", "General"]
- seniority: One of ["Junior", "Mid", "Senior", "Lead", "Unknown"]
- degree_expectation: {{
    "level": "High School" | "Diploma" | "Bachelor" | "Master" | "PhD" | null,
    "field": string (e.g., "Computer Science", "Business", "Medicine") or null
  }}

Guidelines:
- Infer industry from keywords (software→IT, patient→Healthcare, finance→Finance, etc.)
- Infer role_family from title (Frontend Developer→Frontend, Nurse→Clinical)
- Infer seniority from title (Junior/Mid/Senior/Lead keywords)
- Degree expectation: only if explicitly mentioned

Example output:
{{
  "industry": "IT",
  "role_family": "Frontend",
  "seniority": "Senior",
  "degree_expectation": {{"level": "Bachelor", "field": "Computer Science"}}
}}

Return ONLY the JSON object, nothing else."""

        try:
            response = await call_llm(prompt)
            
            # Parse JSON from response
            json_match = self._extract_json(response)
            if json_match:
                context = json.loads(json_match)
                if isinstance(context, dict):
                    logger.info(f"Extracted job context: {context.get('industry', 'Unknown')}, {context.get('seniority', 'Unknown')}")
                    return context
        except Exception as exc:
            logger.error(f"Job context extraction failed: {exc}")
        
        # Fallback: infer from title
        return self._fallback_job_context(job_title, job_desc)
    
    def _fallback_job_context(self, title: str, description: str) -> Dict[str, Any]:
        """Infer job context from title when LLM fails."""
        title_lower = title.lower()
        desc_lower = description.lower()
        combined = title_lower + " " + desc_lower
        
        # Infer industry
        industry = "General"
        if any(k in combined for k in ["software", "developer", "engineer", "programming", "it ", "tech"]):
            industry = "IT"
        elif any(k in combined for k in ["nurse", "doctor", "patient", "medical", "health", "clinical"]):
            industry = "Healthcare"
        elif any(k in combined for k in ["finance", "accounting", "audit", "bank", "investment", "cfa", "cpa"]):
            industry = "Finance"
        elif any(k in combined for k in ["teacher", "education", "teaching", "school", "academic"]):
            industry = "Education"
        elif any(k in combined for k in ["mechanical", "electrical", "civil", "structural"]):
            industry = "Engineering"
        
        # Infer role family
        role_family = "General"
        if any(k in title_lower for k in ["frontend", "front-end", "ui ", "react", "angular", "vue"]):
            role_family = "Frontend"
        elif any(k in title_lower for k in ["backend", "back-end", "server", "api", "database"]):
            role_family = "Backend"
        elif any(k in title_lower for k in ["fullstack", "full-stack"]):
            role_family = "Fullstack"
        elif any(k in title_lower for k in ["devops", "sre", "infrastructure", "cloud"]):
            role_family = "DevOps"
        elif any(k in title_lower for k in ["data", "machine learning", "ml engineer", "ai"]):
            role_family = "Data"
        elif any(k in title_lower for k in ["nurse", "clinical", "caregiver"]):
            role_family = "Clinical"
        elif any(k in title_lower for k in ["audit", "auditor", "compliance"]):
            role_family = "Audit"
        elif any(k in title_lower for k in ["teacher", "instructor", "professor"]):
            role_family = "Teaching"
        elif any(k in title_lower for k in ["manager", "lead", "director", "head of"]):
            role_family = "Management"
        
        # Infer seniority
        seniority = "Unknown"
        if any(k in title_lower for k in ["junior", "jr", "entry", "associate", "trainee"]):
            seniority = "Junior"
        elif any(k in title_lower for k in ["senior", "sr", "staff", "principal"]):
            seniority = "Senior"
        elif any(k in title_lower for k in ["lead", "manager", "director", "head", "chief"]):
            seniority = "Lead"
        elif any(k in title_lower for k in ["mid", "intermediate"]):
            seniority = "Mid"
        else:
            # Default based on experience requirements
            if "5+ years" in combined or "5 years" in combined:
                seniority = "Senior"
            elif "3+ years" in combined or "3 years" in combined:
                seniority = "Mid"
            elif "1-2 years" in combined or "entry" in combined:
                seniority = "Junior"
            else:
                seniority = "Mid"  # Default assumption
        
        return {
            "industry": industry,
            "role_family": role_family,
            "seniority": seniority,
            "degree_expectation": {"level": None, "field": None},
        }
    
    async def extract_candidate_evidence(
        self,
        cv_text: str,
        candidate_profile: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """
        Extract ALL candidate evidence items.
        
        Includes:
        - Technical skills
        - Soft skills
        - Work experiences (with descriptions)
        - Projects
        - Certifications
        - Education
        - Achievements
        - Responsibilities
        """
        skills = candidate_profile.get("skills", [])
        experiences = candidate_profile.get("experience", [])
        education = candidate_profile.get("education", [])
        
        prompt = f"""Extract ALL candidate evidence items from this CV for job matching.

CV Text:
{cv_text[:3000]}

Extracted Skills: {json.dumps(skills)}
Experience Count: {len(experiences)}

Return a JSON array of evidence items. For each item:
- name: what the candidate has/offers
- type: skill|experience|education|certification|project|achievement|responsibility|trait
- details: brief description (for experience, include role + key achievements)
- years: number of years (for experience items)

Guidelines:
- Extract EVERY skill mentioned (even soft skills)
- Extract work experiences as individual items with key responsibilities
- Extract projects with technologies used
- Extract certifications
- Extract achievements/metrics
- Be specific: "React with Redux" not just "React"

Example output:
[
  {{"name": "React", "type": "skill", "details": "3 years experience"}},
  {{"name": "Senior Frontend Developer", "type": "experience", "details": "Built e-commerce platform with React", "years": 2}},
  {{"name": "AWS Certification", "type": "certification", "details": "Solutions Architect"}},
  {{"name": "Led team of 5 developers", "type": "responsibility", "details": "Agile team lead"}}
]

Return ONLY the JSON array, nothing else."""

        try:
            response = await call_llm(prompt)
            
            json_match = self._extract_json(response)
            if json_match:
                evidence = json.loads(json_match)
                if isinstance(evidence, list):
                    logger.info(f"Extracted {len(evidence)} candidate evidence items")
                    return evidence
        except Exception as exc:
            logger.error(f"LLM evidence extraction failed: {exc}")
        
        # Fallback: build from structured profile
        return self._fallback_evidence(candidate_profile)
    
    async def calculate_dynamic_weights(
        self,
        job_description: str,
    ) -> Dict[str, float]:
        """
        Calculate dynamic weights based on job type.
        
        Some jobs value skills more, others experience, etc.
        """
        prompt = f"""Analyze this job description and assign importance weights.

Job Description:
{job_description[:1500]}

Based on the job, assign weights to these categories (must sum to 1.0):
- skills: technical/professional capabilities
- experience: years and relevance
- education: degrees and certifications
- traits: soft skills, leadership, communication

Return ONLY a JSON object like:
{{"skills": 0.40, "experience": 0.30, "education": 0.20, "traits": 0.10}}

No other text."""

        default_weights = {
            "skills": 0.40,
            "experience": 0.30,
            "education": 0.20,
            "traits": 0.10,
        }
        
        try:
            response = await call_llm(prompt)
            json_match = self._extract_json(response)
            if json_match:
                weights = json.loads(json_match)
                if isinstance(weights, dict) and all(k in weights for k in default_weights):
                    # Normalize to sum to 1.0
                    total = sum(weights.values())
                    if total > 0:
                        return {k: v/total for k, v in weights.items()}
        except Exception as exc:
            logger.error(f"Dynamic weight calculation failed: {exc}")
        
        return default_weights
    
    def validate_weights(
        self,
        weights: Dict[str, float],
        min_floor: float = 0.10,
        max_ceiling: float = 0.60,
    ) -> Dict[str, float]:
        """
        Validate and constrain category weights.
        
        Constraints:
        - Sum must equal 1.0
        - Each weight must be >= min_floor (default 10%)
        - Each weight must be <= max_ceiling (default 60%)
        
        This prevents:
        - Over-reliance on one category (e.g., skills = 0.9)
        - Under-weighting critical categories (e.g., skills = 0.01)
        """
        categories = ["skills", "experience", "education", "traits"]
        
        # Ensure all categories exist
        for cat in categories:
            if cat not in weights:
                weights[cat] = 0.25
        
        # Apply floor constraint
        for cat in categories:
            weights[cat] = max(min_floor, weights[cat])
        
        # Apply ceiling constraint
        for cat in categories:
            weights[cat] = min(max_ceiling, weights[cat])
        
        # Normalize to sum to 1.0
        total = sum(weights[cat] for cat in categories)
        if total > 0:
            weights = {cat: weights[cat] / total for cat in categories}
        
        return weights
    
    async def generate_reasoning(
        self,
        job_description: str,
        cv_text: str,
        match_result: Dict[str, Any],
        final_score: float,
    ) -> str:
        """
        Generate grounded reasoning about the match.
        
        RULES:
        1. ONLY reference requirements and scores from match_result
        2. NO external knowledge or assumptions
        3. MUST mention specific requirements by name
        4. MUST tie conclusions to computed coverage values
        
        This ensures explanation is VALIDATED against actual matching data.
        """
        # Extract GROUNDED match info (only from computed results)
        matches = match_result.get("matches", [])
        
        # Strong matches (coverage >= 0.65)
        strong = [m for m in matches if m.get("coverage", 0) >= 0.65][:3]
        strong_names = [m["requirement"] for m in strong]
        
        # Partial matches (0.30 <= coverage < 0.65)
        partial = [m for m in matches if 0.30 <= m.get("coverage", 0) < 0.65][:2]
        partial_names = [m["requirement"] for m in partial]
        
        # Weak matches (coverage < 0.30)
        weak = [m for m in matches if m.get("coverage", 0) < 0.30][:2]
        weak_names = [m["requirement"] for m in weak]
        
        # Gate status
        gate_passed = match_result.get("gate_passed", True)
        failed_critical = match_result.get("failed_critical", [])
        
        # Counterfactual impacts
        counterfactuals = match_result.get("counterfactuals", {})
        top_impact = None
        if counterfactuals:
            top_cf = max(counterfactuals.items(), key=lambda x: x[1].get("impact", 0))
            if top_cf[1].get("impact", 0) > 0.05:
                top_impact = f"{top_cf[0]} ({top_cf[1]['impact_percent']:.0f}% impact)"
        
        # Build GROUNDED prompt
        prompt = f"""As a hiring expert, write ONE sentence explaining this match.

COMPUTED MATCH DATA (ONLY use these facts):
- Final Score: {final_score:.2f}
- Gate Status: {"PASS" if gate_passed else "FAIL"}
- Strong matches ({len(strong)}): {', '.join(strong_names) if strong_names else 'None'}
- Partial matches ({len(partial)}): {', '.join(partial_names) if partial_names else 'None'}
- Weak coverage ({len(weak)}): {', '.join(weak_names) if weak_names else 'None'}
- Failed critical: {', '.join([f.get('name', str(f)) for f in failed_critical[:2]]) if failed_critical else 'None'}
- Top impactful req: {top_impact or 'None calculated'}

CONSTRAINTS:
- Mention specific requirements BY NAME
- Reference actual coverage values
- Tie conclusion to the {final_score:.2f} score
- Max 25 words

Example: "Strong React and JavaScript alignment (0.82 coverage) drives 0.74 score despite HTML gap."

Your grounded explanation:"""

        try:
            response = await call_llm(prompt)
            # Clean up response
            reasoning = response.strip()
            # Remove quotes if present
            if reasoning.startswith('"') and reasoning.endswith('"'):
                reasoning = reasoning[1:-1]
            return reasoning[:300]  # Cap length
        except Exception as exc:
            logger.error(f"Reasoning generation failed: {exc}")
            return self._fallback_reasoning(final_score, len(top_matches), len(hard_missing))
    
    def _fallback_reasoning(self, score: float, matched: int, missing_hard: int) -> str:
        """Generate basic reasoning when LLM fails."""
        if score >= 0.75:
            return f"Strong candidate match with {matched} key requirements satisfied. Ready for interview."
        elif score >= 0.55:
            if missing_hard > 0:
                return f"Good overall fit with {matched} matches, though {missing_hard} critical gaps exist. Consider with development plan."
            return f"Solid candidate with {matched} requirements met. Recommend interview."
        elif score >= 0.35:
            return f"Partial match with {matched} requirements satisfied. Review specific gaps before proceeding."
        else:
            return f"Limited alignment with only {matched} requirements met. Consider other candidates."
    
    def _extract_json(self, text: str) -> Optional[str]:
        """Extract JSON from LLM response."""
        # Try to find JSON array or object
        text = text.strip()
        
        # Remove markdown code blocks
        if "```" in text:
            parts = text.split("```")
            for part in parts:
                if part.strip().startswith("[") or part.strip().startswith("{"):
                    text = part.strip()
                    break
        
        # Find JSON array
        if text.startswith("["):
            return text
        
        # Find JSON object
        if text.startswith("{"):
            return text
        
        # Try to find JSON in text
        start = text.find("[")
        if start != -1:
            # Find matching bracket
            count = 0
            for i, c in enumerate(text[start:]):
                if c == "[":
                    count += 1
                elif c == "]":
                    count -= 1
                    if count == 0:
                        return text[start:start+i+1]
        
        start = text.find("{")
        if start != -1:
            count = 0
            for i, c in enumerate(text[start:]):
                if c == "{":
                    count += 1
                elif c == "}":
                    count -= 1
                    if count == 0:
                        return text[start:start+i+1]
        
        return None
    
    def _fallback_requirements(self, job_profile: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Build requirements from structured profile when LLM fails."""
        requirements = []
        
        # Infer category from skill name
        def infer_category(name: str) -> str:
            name_lower = name.lower()
            if any(k in name_lower for k in ["react", "vue", "angular"]):
                return "frontend_framework"
            elif any(k in name_lower for k in ["python", "java", "javascript", "typescript", "go", "rust"]):
                return "programming_language"
            elif any(k in name_lower for k in ["postgresql", "mysql", "mongodb", "redis"]):
                return "database"
            elif any(k in name_lower for k in ["aws", "azure", "gcp", "cloud"]):
                return "cloud_platform"
            elif any(k in name_lower for k in ["docker", "kubernetes", "jenkins", "ci/cd"]):
                return "devops_tool"
            elif any(k in name_lower for k in ["cert", "certification"]):
                return "certification"
            else:
                return "skill"
        
        for skill in job_profile.get("skills", []):
            name = skill["name"] if isinstance(skill, dict) else skill
            is_required = skill.get("is_required", True) if isinstance(skill, dict) else True
            # Skills are substitutable, certifications are not
            is_cert = any(k in name.lower() for k in ["cert", "aws", "azure", "gcp"])
            requirements.append({
                "name": name,
                "type": "skill",
                "importance": 1.0 if is_required else 0.5,
                "criticality": "hard" if is_required else "soft",
                "substitutable": not is_cert,  # Certs not substitutable
                "category": infer_category(name),
                "level_required": None,
                "industry": None,
            })
        
        for level in job_profile.get("experience_levels", []):
            requirements.append({
                "name": level,
                "type": "experience",
                "importance": 0.7,
                "criticality": "hard",
                "substitutable": False,  # Experience years not substitutable
                "category": "years_experience",
                "level_required": None,
                "industry": None,
            })
        
        for degree in job_profile.get("required_degrees", []):
            requirements.append({
                "name": degree,
                "type": "education",
                "importance": 0.5,
                "criticality": "soft",
                "substitutable": False,  # Degrees not substitutable
                "category": "education",
                "level_required": None,
                "industry": None,
            })
        
        return requirements
    
    def _fallback_evidence(self, profile: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Build evidence from structured profile when LLM fails."""
        evidence = []
        
        for skill in profile.get("skills", []):
            name = skill["name"] if isinstance(skill, dict) else skill
            evidence.append({
                "name": name,
                "type": "skill",
                "details": "",
            })
        
        for exp in profile.get("experience", []):
            if isinstance(exp, dict):
                role = exp.get("role", "")
                company = exp.get("company", "")
                years = exp.get("years", 0) or exp.get("duration_years", 0)
                evidence.append({
                    "name": role,
                    "type": "experience",
                    "details": f"at {company}" if company else "",
                    "years": years,
                })
        
        for edu in profile.get("education", []):
            if isinstance(edu, dict):
                degree = edu.get("degree", "")
                evidence.append({
                    "name": degree,
                    "type": "education",
                    "details": "",
                })
        
        return evidence
