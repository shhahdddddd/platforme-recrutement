"""
llm_parser.py

Sends extracted CV / Job-description text to a local LLM (via Ollama) and
returns structured JSON.  The prompts are industry-agnostic and work
for IT, healthcare, finance, legal, education, hospitality, etc.

Flow:
  1. For CVs:   Split text into semantic sections and parse each section then merge.
  2. For Jobs:  Single-shot prompt on the entire description.
  3. Schema validation with retry on parse failures.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any
import asyncio

import httpx
import redis
import hashlib
from api.utils import call_llm

logger = logging.getLogger(__name__)

# Ollama connection settings
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_DEFAULT_MODEL = "mistral"
OLLAMA_TIMEOUT_SECONDS = 300.0
OLLAMA_MAX_OUTPUT_TOKENS = 1024
MAX_RETRIES = 2  # Retry parsing on schema validation failure

# Schema validation - required fields for each type
CV_SCHEMA = {
    "required_fields": ["skills", "experience", "education"],
    "optional_fields": ["full_name", "industry", "title", "summary", "total_experience_years"],
    "field_types": {
        "skills": list,
        "experience": list,
        "education": list,
        "full_name": (str, type(None)),
        "industry": (str, type(None)),
        "total_experience_years": (int, float, type(None)),
    }
}

JOB_SCHEMA = {
    "required_fields": ["skills", "title"],
    "optional_fields": ["industry", "experience_levels", "required_degrees", "required_experience_years", "is_internship"],
    "field_types": {
        "skills": list,
        "title": (str, type(None)),
        "required_experience_years": (int, float, type(None)),
        "is_internship": (bool, type(None)),
    }
}


def validate_schema(data: dict, schema: dict) -> tuple[bool, list[str], float]:
    """
    Validate parsed data against schema.
    Returns: (is_valid, missing_fields, confidence_score)
    Confidence is based on presence of required fields and correct types.
    """
    if not data:
        return False, ["empty_response"], 0.0
    
    missing = []
    type_errors = []
    confidence = 1.0
    
    # Check required fields
    for field in schema["required_fields"]:
        if field not in data or data[field] is None:
            missing.append(field)
            confidence -= 0.2
        elif field in schema["field_types"]:
            expected_type = schema["field_types"][field]
            if not isinstance(data[field], expected_type):
                type_errors.append(f"{field}_wrong_type")
                confidence -= 0.1
    
    # Check field types for present fields
    for field, expected_type in schema["field_types"].items():
        if field in data and data[field] is not None:
            if not isinstance(data[field], expected_type):
                if f"{field}_wrong_type" not in type_errors:
                    type_errors.append(f"{field}_wrong_type")
                    confidence -= 0.1
    
    is_valid = len(missing) == 0 and len(type_errors) == 0
    confidence = max(0.0, min(1.0, confidence))
    
    return is_valid, missing + type_errors, confidence

# ── System prompts (industry-agnostic) ────────────────────────────────────────
CV_SYSTEM_PROMPT = """\
You are a multilingual CV/Resume parser.
Extract structured information exactly as it appears in the document.

CRITICAL RULES:
1. Detect the primary Industry (IT, Healthcare, Finance, Marketing, Sales, Construction, etc.).
2. Do NOT assume the candidate is a software developer.
3. Keep domain-specific skills exactly as written (e.g. "Patient Triage", "Ultrasound").
4. Classify each skill into a Category (e.g., DevOps, Marketing, Accounting, Clinical) and Type (technical, soft, tool).
5. Extract skills from ALL sections (skills, projects, and work experience), not only the dedicated "Skills" block.
6. Include technical libraries/frameworks/tools/databases explicitly when mentioned (e.g., React.js, Node.js, Express.js, Axios, Docker).

Return ONLY a valid JSON object with this exact structure:
{
  "full_name": "string or null",
  "industry": "string",
  "title": "string or null",
  "summary": "string or null",
  "skills": [
    {"name": "string", "category": "string", "type": "technical/soft/tool"}
  ],
  "experience": [
    {
      "company": "string",
      "role": "string",
      "start_date": "YYYY-MM or YYYY",
      "end_date": "YYYY-MM or YYYY or null",
      "description": "string"
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field": "string",
      "start_date": "YYYY",
      "end_date": "YYYY"
    }
  ],
  "total_experience_years": number or null
}
"""

JOB_SYSTEM_PROMPT = """\
You are a job-description analyzer.
Extract the core requirements from the job post.

CRITICAL RULES:
1. Detect the primary Industry (IT, Healthcare, Finance, Marketing, Sales, etc.).
2. Classify each required skill into a Category and Type.
3. Identify importance for each skill (1.0 for mandatory, 0.5 for nice-to-have).

Return ONLY a valid JSON object with this exact structure:
{
  "title": "string or null",
  "industry": "string",
  "skills": [
    {"name": "string", "category": "string", "type": "technical/soft/tool", "importance": 1.0}
  ],
  "experience_levels": ["Junior", "Senior"],
  "required_degrees": ["Master", "Engineer"],
  "required_experience_years": number or null,
  "is_internship": boolean,
  "internship_details": {
    "duration_months": number or null,
    "type": "PFE / Summer / Observation or null"
  },
  "benefits": ["Remote", "Bonus"]
}
"""


class LLMParser:
    """Parses raw text into structured JSON using a local Ollama LLM."""

    async def parse(
        self,
        text: str,
        model: str = OLLAMA_DEFAULT_MODEL,
        is_job: bool = False,
        language: str | None = None,
    ) -> dict[str, Any]:
        """
        Parse *text* into a structured profile dict.

        For CVs the text is split into semantic sections (experience, education,
        skills, header) and each section is parsed independently, then merged.
        For job descriptions a single-shot prompt is used.
        """
        if is_job:
            # Jobs are usually short, but we increase length to avoid missing benefits at the end
            return await self._call_llm(
                text[:10000], JOB_SYSTEM_PROMPT, "JOB DESCRIPTION", model, language, is_job=True
            )

        # ── Redis Cache Check ─────────────────────────────────────────────
        cache_key = f"cv_parse:{hashlib.md5(text.encode()).hexdigest()}"
        try:
            r = redis.Redis(host='localhost', port=6379, db=0)
            cached = r.get(cache_key)
            if cached:
                logger.info("Found cached CV parse result in Redis.")
                return json.loads(cached)
        except Exception as e:
            logger.warning(f"Redis cache check failed: {e}")

        # ── CV: section-aware parsing ─────────────────────────────────────
        chunks = self._split_sections(text)
        merged: dict[str, Any] = {
            "full_name": None,
            "industry": None,
            "title": None,
            "summary": None,
            "skills": [],
            "experience": [],
            "education": [],
            "total_experience_years": None,
        }

        # Dispatched each chunk to Ollama in parallel to maximize performance
        tasks = [
            self._call_llm(text, CV_SYSTEM_PROMPT, "CV CHUNK", model, language, is_job=False)
            for text in chunks
        ]
        
        # Gather results concurrently
        all_chunks = await asyncio.gather(*tasks)
        
        # Merge individual extractions into the final profile
        parsing_confidences = []
        for chunk in all_chunks:
            self._merge_results(merged, chunk)
            if "_parsing_confidence" in chunk:
                parsing_confidences.append(chunk["_parsing_confidence"])
        
        # Calculate overall parsing confidence
        if parsing_confidences:
            merged["_parsing_confidence"] = sum(parsing_confidences) / len(parsing_confidences)
            merged["_validation_failed"] = any(chunk.get("_validation_failed", False) for chunk in all_chunks)
        else:
            merged["_parsing_confidence"] = 0.5  # Default medium confidence

        # ── Cache Result ──
        try:
            r.setex(cache_key, 3600 * 24, json.dumps(merged)) # Cache for 24h
        except:
            pass

        return merged

    # ------------------------------------------------------------------
    # Section splitting
    # ------------------------------------------------------------------

    _SECTION_PATTERNS: dict[str, str] = {
        "experience": (
            r"(experience|expérience|work|history|employment|parcours|emplois|career)"
        ),
        "education": (
            r"(education|éducation|formation|diplômes?|academic|university|"
            r"université|scolarité)"
        ),
        "skills": (
            r"(skills|compétences|expertises|hard\s*skills|technical|"
            r"technologies|tools|outils)"
        ),
    }

    def _split_sections(self, text: str) -> list[str]:
        """
        Split text into chunks for LLM processing.
        1. Attempt semantic keyword section headers.
        2. Fallback to structural headers (short lines with no punctuation).
        3. Fallback to character-count slicing along line breaks.
        """
        markers: list[tuple[int, str]] = []
        
        # Pass 1: Try finding known keywords
        for name, pattern in self._SECTION_PATTERNS.items():
            matches = list(re.finditer(pattern, text, re.IGNORECASE))
            if matches:
                # Need to verify this match looks like a header (e.g., small line)
                for idx, m in enumerate(matches):
                    # Check context around the match to ensure it's a header
                    line_start = text.rfind('\n', 0, m.start()) + 1
                    line_end = text.find('\n', m.end())
                    if line_end == -1: line_end = len(text)
                    line_len = line_end - line_start
                    
                    if line_len < 50:
                        markers.append((m.start(), name))
                        break # Found a valid header for this section

        markers.sort()
        chunks: list[str] = []

        if not markers:
            # Pass 2: Look for structural headers (e.g., ALL CAPS or Title Case short lines)
            structural_pattern = r"(?m)^(?:[A-Z][A-Z\s]+|[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)$"
            struct_matches = list(re.finditer(structural_pattern, text))
            
            for m in struct_matches:
                if len(m.group(0).strip()) > 3 and len(m.group(0).strip()) < 40:
                    markers.append((m.start(), "structural"))
                    
        markers.sort()

        if not markers:
            # Pass 3: Fallback: Sliding window of 3500 characters, respecting line breaks
            win_size = 3500
            start = 0
            while start < len(text):
                end = start + win_size
                if end < len(text):
                    # Backtrack to the nearest line break
                    last_break = text.rfind('\n', start, end)
                    if last_break != -1 and last_break > start + 500:
                        end = last_break
                
                chunks.append(text[start:end])
                start = end
        else:
            # Header-based splitting
            # 1. Header chunk (text before first section)
            header_text = text[: markers[0][0]].strip()
            if header_text:
                chunks.append(header_text)
            
            # 2. Section chunks
            for i, (start, name) in enumerate(markers):
                end = markers[i + 1][0] if i + 1 < len(markers) else len(text)
                section_text = text[start:end].strip()
                if section_text:
                    chunks.append(section_text)

        # Final filtering: Ensure decent sized chunks but skip noise
        filtered = [c for c in chunks if len(c.strip()) >= 50]
        # Limit to max 3 chunks to reduce LLM calls (speed optimization)
        if len(filtered) > 3:
            # Merge smaller chunks together
            filtered = filtered[:2] + ["\n\n".join(filtered[2:])]
        return filtered

    # ------------------------------------------------------------------
    # Merging
    # ------------------------------------------------------------------

    @staticmethod
    def _merge_results(base: dict, new_data: dict) -> None:
        """Merge *new_data* into *base* without losing existing values."""
        for field in ("full_name", "title", "summary", "industry"):
            if new_data.get(field) and not base.get(field):
                base[field] = new_data[field]

        if isinstance(new_data.get("skills"), list):
            seen_skills = {s["name"].lower() for s in base["skills"] if isinstance(s, dict) and "name" in s}
            for skill in new_data["skills"]:
                if not isinstance(skill, dict) or "name" not in skill:
                    continue
                if skill["name"].lower() not in seen_skills:
                    base["skills"].append(skill)
                    seen_skills.add(skill["name"].lower())

        if isinstance(new_data.get("experience"), list):
            base["experience"].extend(new_data["experience"])

        if isinstance(new_data.get("education"), list):
            base["education"].extend(new_data["education"])

    # ------------------------------------------------------------------
    # Ollama API call
    # ------------------------------------------------------------------

    async def _call_llm(
        self,
        text: str,
        system_prompt: str,
        label: str,
        model: str,
        language: str | None = None,
        is_job: bool = False,
    ) -> dict[str, Any]:
        """
        Call the LLM chain and return parsed JSON dict with retry logic.
        
        Includes:
        - Schema validation
        - Retry with stricter prompt on validation failure
        - Confidence scoring based on parsing quality
        """
        lang_full = "French" if language == "fra" or language == "fr" else "English"
        sys_prompt = f"Analyze the following {lang_full} document carefully. {system_prompt}"
        
        schema = JOB_SCHEMA if is_job else CV_SCHEMA
        best_result = {}
        best_confidence = 0.0
        
        for attempt in range(MAX_RETRIES + 1):
            try:
                # Use stricter prompt on retry
                current_prompt = sys_prompt
                if attempt > 0:
                    current_prompt = f"""CRITICAL: Previous parsing attempt failed validation.
You MUST return valid JSON with ALL required fields.
Missing fields will cause rejection.

{sys_prompt}"""
                
                raw = await call_llm(
                    prompt=f"{label}:\n{text}",
                    system_prompt=current_prompt,
                    model=model
                )
                
                if not raw or not raw.strip():
                    continue
                    
                parsed = self._safe_parse(raw)
                if not parsed:
                    continue
                
                # Validate schema
                is_valid, errors, confidence = validate_schema(parsed, schema)
                
                if is_valid:
                    parsed["_parsing_confidence"] = confidence
                    parsed["_parse_attempts"] = attempt + 1
                    return parsed
                
                # Track best result even if invalid
                if confidence > best_confidence:
                    best_confidence = confidence
                    best_result = parsed.copy()
                
                logger.warning(
                    "Schema validation failed for [%s] (attempt %d): %s. Confidence: %.2f",
                    label, attempt + 1, errors, confidence
                )
                
            except Exception as exc:
                logger.warning("LLM chain failed for [%s] (attempt %d): %s", label, attempt + 1, exc)
        
        # Return best effort result with confidence score
        if best_result:
            best_result["_parsing_confidence"] = best_confidence
            best_result["_parse_attempts"] = MAX_RETRIES + 1
            best_result["_validation_failed"] = True
            logger.warning("Returning best-effort parse for [%s] with confidence %.2f", label, best_confidence)
        
        return best_result

    # ------------------------------------------------------------------
    # Safe JSON parsing
    # ------------------------------------------------------------------

    @staticmethod
    def _safe_parse(raw: str) -> dict:
        """
        Attempt to parse a JSON object from the LLM response.

        Handles markdown fences, leading/trailing noise, and partial JSON.
        """
        cleaned = (
            raw.strip()
            .removeprefix("```json")
            .removeprefix("```")
            .removesuffix("```")
            .strip()
        )

        # Attempt 1 — full payload
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

        # Attempt 2 — extract the first complete JSON object block
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end > start:
            candidate = cleaned[start: end + 1]
            try:
                parsed = json.loads(candidate)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass

        logger.debug("Could not parse JSON from LLM output: %s…", raw[:200])
        return {}
