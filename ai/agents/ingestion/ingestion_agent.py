"""
ingestion_agent.py

Orchestrates the full CV / Job-description ingestion pipeline:

  PDF → Text → Language Detection → Regex Pre-extraction → LLM Parse
      → Merge & Normalize → Confidence → Embedding

The agent is stateless — create one instance and call ``process_cv()``
or ``process_job()`` as many times as needed.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
import time
import unicodedata
from typing import Any

from .confidence import compute_confidence
from .embedding import EmbeddingService
from .extractor import PDFExtractor
from .language import detect_language
from .llm_parser import LLMParser
from .normalizer import merge_basic_with_structured, normalize_profile
from .rule_parser import extract_basic_fields

logger = logging.getLogger(__name__)

# Minimum embedding-text length that is considered usable.
_MIN_EMBEDDING_LENGTH = 10
_INGESTION_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days
# Bump cache namespace when ingestion logic changes to avoid stale parses.
_INGESTION_CACHE_PREFIX = "ai_ingest:v2:"
_ingestion_cache: dict[str, dict[str, Any]] = {}


class IngestionAgent:
    """
    Orchestrates the full CV ingestion pipeline:
      PDF → Text → LLM Parse → Normalize → Confidence → Embedding
    """

    def __init__(self) -> None:
        self.extractor = PDFExtractor()
        self.llm_parser = LLMParser()
        self.embedder = EmbeddingService()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def process_cv(self, pdf_path: str) -> dict[str, Any]:
        """Process one CV PDF and return profile, confidence, embedding, and raw text."""
        cv_hash = self._hash_file(pdf_path)
        cache_key = f"{_INGESTION_CACHE_PREFIX}cv:{cv_hash}"
        cached_result = self._get_cached_payload(cache_key)
        if cached_result:
            if not cached_result.get("cv_hash"):
                cached_result["cv_hash"] = cv_hash
            logger.info("CV ingestion cache hit for hash=%s", cv_hash[:12])
            return cached_result

        text, lang = self.extractor.extract(pdf_path)

        # Step 3 — Fast regex pre-extraction (email, phone, name, etc.)
        basic_fields = extract_basic_fields(text)

        # Step 4–8 are wrapped in a try/except so that partial results are
        # still returned when the LLM or embedding service is unavailable.
        try:
            profile = await self._parse_and_build_profile(
                text, basic_fields, lang
            )
            
            # Check for absolute failure of extraction
            if (not profile.get("skills") and 
                not profile.get("experience") and 
                not profile.get("education") and 
                not profile.get("full_name")):
                 raise ValueError("Empty profile — LLM extraction failed completely")

            conf_data = compute_confidence(profile)
            confidence = conf_data["score"]

            # Step 8 — Generate embedding
            embedding_text = self._build_embedding_text(profile)
            if len(embedding_text.strip()) < _MIN_EMBEDDING_LENGTH:
                raise ValueError(
                    "Parsed profile is too empty to generate a reliable embedding."
                )

            skills_list = profile.get("skills", [])
            embedding_task = asyncio.create_task(
                self.embedder.generate_embedding(embedding_text)
            )
            skill_task = None
            if skills_list:
                skill_names = [s["name"] if isinstance(s, dict) else s for s in skills_list]
                skill_task = asyncio.create_task(
                    self.embedder.embed_skill_list(skill_names)
                )

            embedding = await embedding_task
            if skill_task:
                profile["skill_embeddings"] = await skill_task
            else:
                profile["skill_embeddings"] = {}

        except Exception as exc:
            logger.warning("Primary CV pipeline failed, using fallback: %s", exc)
            fallback = await self._fallback_result(text, basic_fields, lang)
            fallback["cv_hash"] = cv_hash
            self._set_cached_payload(cache_key, fallback)
            return fallback

        result = {
            "profile": profile,
            "confidence": confidence,
            "embedding": embedding,
            "raw_text": text,
            "cv_hash": cv_hash,
        }
        self._set_cached_payload(cache_key, result)
        return result

    async def process_job(
        self,
        job_description: str,
        requirements: dict | None = None,
    ) -> dict[str, Any]:
        """
        Parse a job description and optionally merge with structured
        requirements from the database.

        Database requirements (skills, degrees, levels) take priority over
        LLM extractions.
        """
        job_hash = self._hash_job_payload(job_description, requirements)
        cache_key = f"{_INGESTION_CACHE_PREFIX}job:{job_hash}"
        cached_result = self._get_cached_payload(cache_key)
        if cached_result:
            logger.info("Job ingestion cache hit for hash=%s", job_hash[:12])
            return cached_result

        lang = detect_language(job_description)
        structured = await self.llm_parser.parse(
            job_description, is_job=True, language=lang
        )

        # Ground LLM-extracted skills in the actual job description text
        if isinstance(structured.get("skills"), list):
            structured["skills"] = self._filter_skills_in_text(
                structured["skills"], job_description
            )

        profile = normalize_profile(structured)
        profile["detected_language"] = lang

        # Merge with authoritative DB requirements
        if requirements:
            self._merge_db_requirements(profile, requirements)
            # Re-normalize after DB merge to canonicalize any injected skills.
            profile = normalize_profile(profile)
            profile["detected_language"] = lang

        # Safety fallback: if no job skills were extracted, try heuristic extraction
        # from the raw job description to avoid a false "no-skill-required" signal.
        if not profile.get("skills"):
            fallback_job_skills = self._extract_fallback_skills(job_description)
            if fallback_job_skills:
                profile["skills"] = fallback_job_skills
                profile = normalize_profile(profile)
                profile["detected_language"] = lang

        # Build embedding text from the final merged profile
        embedding_text = self._build_embedding_text(profile)
        if len(embedding_text.strip()) < 20:
            embedding_text = job_description[:1000]

        skills_list = profile.get("skills", [])
        embedding_task = asyncio.create_task(
            self.embedder.generate_embedding(embedding_text)
        )
        skill_task = None
        if skills_list:
            skill_names = [s["name"] if isinstance(s, dict) else s for s in skills_list]
            skill_task = asyncio.create_task(
                self.embedder.embed_skill_list(skill_names)
            )

        embedding = await embedding_task
        if skill_task:
            profile["skill_embeddings"] = await skill_task
        else:
            profile["skill_embeddings"] = {}

        result = {"profile": profile, "embedding": embedding}
        self._set_cached_payload(cache_key, result)
        return result

    # ------------------------------------------------------------------
    # Cache helpers
    # ------------------------------------------------------------------

    def _get_cached_payload(self, cache_key: str) -> dict[str, Any] | None:
        now = time.time()

        # Level 1: process memory
        entry = _ingestion_cache.get(cache_key)
        if entry and entry.get("expires_at", 0) > now:
            return entry.get("value")
        if entry:
            _ingestion_cache.pop(cache_key, None)

        # Level 2: Redis
        redis_client = getattr(self.embedder.redis, "client", None)
        if not redis_client:
            return None

        try:
            raw = redis_client.get(cache_key)
            if not raw:
                return None
            payload = json.loads(raw)
            expires_at = float(payload.get("expires_at", 0))
            value = payload.get("value")
            if expires_at <= now or not isinstance(value, dict):
                return None
            _ingestion_cache[cache_key] = {"expires_at": expires_at, "value": value}
            return value
        except Exception as exc:
            logger.debug("Ingestion cache read failed for %s: %s", cache_key, exc)
            return None

    def _set_cached_payload(self, cache_key: str, value: dict[str, Any]) -> None:
        expires_at = time.time() + _INGESTION_CACHE_TTL_SECONDS
        payload = {"expires_at": expires_at, "value": value}
        _ingestion_cache[cache_key] = payload

        redis_client = getattr(self.embedder.redis, "client", None)
        if not redis_client:
            return

        try:
            redis_client.setex(
                cache_key,
                _INGESTION_CACHE_TTL_SECONDS,
                json.dumps(payload),
            )
        except Exception as exc:
            logger.debug("Ingestion cache write failed for %s: %s", cache_key, exc)

    @staticmethod
    def _hash_file(file_path: str) -> str:
        hasher = hashlib.sha256()
        with open(file_path, "rb") as file_obj:
            while True:
                chunk = file_obj.read(1024 * 1024)
                if not chunk:
                    break
                hasher.update(chunk)
        return hasher.hexdigest()

    @staticmethod
    def _hash_job_payload(job_description: str, requirements: dict | None = None) -> str:
        canonical = json.dumps(
            {
                "job_description": (job_description or "").strip(),
                "requirements": requirements or {},
            },
            sort_keys=True,
            ensure_ascii=True,
            default=str,
        )
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _parse_and_build_profile(
        self,
        text: str,
        basic_fields: dict,
        lang: str,
    ) -> dict:
        """Run the LLM parser, merge with regex fields, and normalize with strict bounds."""
        structured = await self.llm_parser.parse(text, language=lang)
        
        # ── Fix 4: Output Validation (Treat LLM as untrusted input) ──
        if not isinstance(structured, dict):
            logger.warning("LLM returned non-dict structure. Falling back.")
            structured = {}
            
        # Ensure minimum required keys exist in the structure
        expected_keys = ["skills", "experience", "education", "soft_skills"]
        for key in expected_keys:
            if key not in structured or not isinstance(structured[key], list):
                structured[key] = []
                
        if isinstance(structured.get("skills"), list):
            structured["skills"] = self._filter_skills_in_text(
                structured["skills"], text
            )
        profile = merge_basic_with_structured(basic_fields, structured)
        profile = normalize_profile(profile)
        profile["detected_language"] = lang

        fallback_education = self._extract_fallback_education(text)
        if fallback_education:
            existing_education = profile.get("education", [])
            seen_degrees = {
                str(item.get("degree", "")).strip().lower()
                for item in existing_education
                if isinstance(item, dict) and str(item.get("degree", "")).strip()
            }
            merged_education = list(existing_education)
            for item in fallback_education:
                degree = str(item.get("degree", "")).strip().lower()
                if degree and degree not in seen_degrees:
                    merged_education.append(item)
                    seen_degrees.add(degree)

            profile["education"] = merged_education
            profile = normalize_profile(profile)
            profile["detected_language"] = lang

        # Always supplement LLM skills with heuristic-based extraction for safety
        llm_skills = profile.get("skills", [])
        fallback_skills = self._extract_fallback_skills(text)
        
        # Merge and deduplicate
        combined_skills = self._merge_skill_entries(llm_skills, fallback_skills)
        if combined_skills:
            profile["skills"] = combined_skills
            profile = normalize_profile(profile)
            profile["detected_language"] = lang
            
        profile["llm_fallback_used"] = len(llm_skills) == 0 and len(fallback_skills) > 0

        return profile

    async def _fallback_result(
        self, text: str, basic_fields: dict, lang: str
    ) -> dict[str, Any]:
        """Build a minimal result when the primary pipeline fails."""
        profile = normalize_profile(basic_fields)
        profile["detected_language"] = lang
        profile["needs_manual_review"] = True
        profile["llm_error"] = True
        profile["llm_fallback_used"] = True
        profile["skills"] = self._extract_fallback_skills(text)
        profile["education"] = self._extract_fallback_education(text)
        profile = normalize_profile(profile)
        profile["detected_language"] = lang
        profile["needs_manual_review"] = True
        profile["llm_error"] = True
        profile["llm_fallback_used"] = True

        confidence = compute_confidence(profile)

        # Try to generate an embedding from whatever text we have
        embedding = None
        embedding_text = self._build_embedding_text(profile)
        if len(embedding_text.strip()) < _MIN_EMBEDDING_LENGTH:
            embedding_text = text[:1000]

        if len(embedding_text.strip()) >= _MIN_EMBEDDING_LENGTH:
            try:
                embedding = await self.embedder.generate_embedding(embedding_text)
            except Exception as embed_exc:
                logger.warning("Fallback embedding failed: %s", embed_exc)
                profile["embedding_error"] = str(embed_exc)

        return {
            "profile": profile,
            "confidence": confidence,
            "embedding": embedding,
            "raw_text": text,
        }

    @staticmethod
    def _merge_db_requirements(profile: dict, db_reqs: dict) -> None:
        """
        Merge database-authoritative requirements into *profile* in place.
        Database fields prioritize over LLM guesses.
        """
        # Skills: If DB provides required skills, use ONLY those (they are authoritative).
        # This prevents the LLM from hallucinating skills (e.g. "React.js") that
        # are not actually required by the job offer.
        db_skills = db_reqs.get("required_skills") or db_reqs.get("skills") or []
        if db_skills:
            deduped: list[Any] = []
            seen: set[str] = set()
            for skill in db_skills:
                if isinstance(skill, dict):
                    raw_name = str(skill.get("name", "") or "").strip()
                    if not raw_name:
                        continue
                    key = re.sub(r"\s+", " ", raw_name.lower())
                    if key in seen:
                        continue
                    seen.add(key)
                    deduped.append(skill)
                else:
                    raw_name = str(skill or "").strip()
                    if not raw_name:
                        continue
                    key = re.sub(r"\s+", " ", raw_name.lower())
                    if key in seen:
                        continue
                    seen.add(key)
                    deduped.append(raw_name)
            profile["skills"] = deduped
        # else: keep whatever the LLM extracted from the job description

        # Hard criteria: Direct override for consistency
        if db_reqs.get("required_degrees"):
            profile["required_degrees"] = db_reqs["required_degrees"]

        if db_reqs.get("experience_levels"):
            profile["experience_levels"] = db_reqs["experience_levels"]

        if db_reqs.get("required_experience_years") is not None:
            profile["required_experience_years"] = db_reqs[
                "required_experience_years"
            ]

        if db_reqs.get("is_internship") is not None:
            profile["is_internship"] = db_reqs["is_internship"]

        if db_reqs.get("internship_details"):
            profile.setdefault("internship_details", {}).update(
                db_reqs["internship_details"]
            )

        if db_reqs.get("offer_type"):
            profile["offer_type"] = db_reqs["offer_type"]


    # ------------------------------------------------------------------
    # Embedding-text builder
    # ------------------------------------------------------------------

    @staticmethod
    def _build_embedding_text(profile: dict) -> str:
        """
        Construct a concise text string that captures the semantic essence
        of a profile for vector embedding generation.
        """
        parts: list[str] = []

        # 1. Main identifier
        title = profile.get("title") or profile.get("full_name")
        if title:
            parts.append(f"Position: {title}")

        # 2. Skills
        raw_skills = profile.get("skills", [])
        skill_names = [s["name"] if isinstance(s, dict) else s for s in raw_skills]
        skills_str = ", ".join(skill_names)
        if skills_str:
            parts.append(f"Skills: {skills_str}")

        # 3. Experience
        if profile.get("experience"):
            exp_lines = " | ".join(
                f"{e.get('role', '')} at {e.get('company', '')}"
                for e in profile["experience"]
            )
            parts.append(f"Work Experience: {exp_lines}")
        elif profile.get("experience_levels"):
            parts.append(
                "Required Experience Levels: "
                + ", ".join(profile["experience_levels"])
            )

        # 4. Education
        if profile.get("education"):
            edu_lines = " | ".join(
                f"{e.get('degree', '')} at {e.get('institution', '')}"
                for e in profile["education"]
            )
            parts.append(f"Education: {edu_lines}")
        elif profile.get("required_degrees"):
            parts.append(
                "Required Degrees: " + ", ".join(profile["required_degrees"])
            )

        # 5. Internship metadata
        if profile.get("is_internship"):
            details = profile.get("internship_details", {})
            typ = details.get("type") or "Internship"
            dur = details.get("duration_months")
            suffix = f" (Duration: {dur} months)" if dur else ""
            parts.append(f"Internship: {typ}{suffix}")

        return "\n".join(parts)

    # ------------------------------------------------------------------
    # Skill grounding helpers (anti-hallucination)
    # ------------------------------------------------------------------

    _SKILL_NOISE_TOKENS: frozenset[str] = frozenset(
        {
            "and",
            "or",
            "of",
            "in",
            "with",
            "to",
            "for",
            "the",
            "a",
            "an",
            "skill",
            "skills",
            "knowledge",
            "experience",
            "expertise",
            "framework",
            "programming",
            "development",
            "developer",
            "proficiency",
            "familiarity",
            "good",
            "strong",
            "excellent",
            "advanced",
            "basic",
            "intermediate",
            "required",
        }
    )

    @staticmethod
    def _normalize_text_for_skill_match(text: str) -> str:
        """Normalize text for robust skill token matching."""
        text = unicodedata.normalize("NFKD", text)
        text = "".join(ch for ch in text if not unicodedata.combining(ch))
        return re.sub(r"\s+", " ", text.lower())

    @staticmethod
    def _skill_entry_name(skill: Any) -> str:
        """Extract a skill name from string/dict entries."""
        if isinstance(skill, dict):
            return str(skill.get("name", "") or "").strip()
        return str(skill or "").strip()

    @staticmethod
    def _match_skill_token(skill: str, text: str) -> str | None:
        """
        Return a grounded skill token if *skill* appears in *text*.
        Falls back to the most specific meaningful token.
        """
        if not skill or not isinstance(skill, str):
            return None

        s = skill.strip().lower()
        if not s:
            return None

        parts = [p for p in re.split(r"[\s\.\-_/]+", s) if p]
        if not parts:
            return None

        if len(parts) == 1:
            token = re.escape(parts[0])
        else:
            sep = r"[\s\.\-_/]*"
            token = sep.join(re.escape(p) for p in parts)

        pattern = rf"(?<![a-z0-9]){token}(?![a-z0-9])"
        if re.search(pattern, text) is not None:
            return s

        # Fallback: accept any meaningful token in a multi-word skill phrase.
        if len(parts) > 1:
            for part in parts:
                if len(part) < 3 or part in IngestionAgent._SKILL_NOISE_TOKENS:
                    continue
                part_pat = rf"(?<![a-z0-9]){re.escape(part)}(?![a-z0-9])"
                if re.search(part_pat, text) is not None:
                    return part

        return None

    def _filter_skills_in_text(self, skills: list[Any], text: str) -> list[Any]:
        """Keep only skills that appear in the source text."""
        if not skills or not text:
            return []

        norm_text = self._normalize_text_for_skill_match(text)
        filtered: list[Any] = []
        seen: set[str] = set()
        for skill in skills:
            skill_name = self._skill_entry_name(skill)
            token = self._match_skill_token(skill_name, norm_text)
            if token and token not in seen:
                seen.add(token)
                if isinstance(skill, dict):
                    grounded = skill.copy()
                    grounded["name"] = token
                    filtered.append(grounded)
                else:
                    filtered.append(token)
        return filtered

    def _merge_skill_entries(self, primary: list[Any], secondary: list[Any]) -> list[Any]:
        """Merge two skill lists while preserving order and metadata."""
        merged: list[Any] = []
        seen: set[str] = set()

        for source in (primary or [], secondary or []):
            for item in source:
                name = self._skill_entry_name(item)
                if not name:
                    continue
                key = re.sub(r"\s+", " ", name.lower()).strip()
                if not key or key in seen:
                    continue
                seen.add(key)
                merged.append(item)

        return merged

    # ------------------------------------------------------------------
    # Fallback skill extraction (regex-based, no LLM)
    # ------------------------------------------------------------------

    _SKILL_HEADING_RE = re.compile(
        r"^(skills?|core skills?|key skills?|competenc(?:y|ies)|comp[eé]tences?|"
        r"expertise|aptitudes?|savoir[- ]?faire|tools?|technologies?|logiciels?|"
        r"technical skills?|professional skills?)\b",
        re.IGNORECASE,
    )

    _STOP_HEADING_RE = re.compile(
        r"^(experience|exp[eé]rience|work history|education|formation|formations?|summary|"
        r"profil|projects?|projets?|certifications?|languages?|langues?|interests?|"
        r"hobbies|contact)\b",
        re.IGNORECASE,
    )

    _IGNORE_TOKENS: frozenset[str] = frozenset(
        {
            "skills",
            "skill",
            "competences",
            "compétences",
            "competencies",
            "frameworks",
            "outils",
            "tools",
            "technologies",
            "langages de programmation",
            "programming languages",
            "bases de données",
            "databases",
        }
    )

    _SKILL_CONTACT_RE = re.compile(
        r"@|https?://|www\.|(?:\+?\d[\d \-]{6,}\d)",
        re.IGNORECASE,
    )

    _SKILL_DATE_RE = re.compile(
        r"\b(?:"
        r"jan(?:vier)?|f[ée]v(?:rier)?|mars|avr(?:il)?|mai|juin|juillet|"
        r"ao[uû]t|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|d[ée]c(?:embre)?|"
        r"january|february|march|april|may|june|july|august|september|"
        r"october|november|december|20\d{2}"
        r")\b",
        re.IGNORECASE,
    )

    _SPACED_HEADING_RE = re.compile(
        r"^(?:[a-zà-ÿ]\s+){3,}[a-zà-ÿ]$",
        re.IGNORECASE,
    )

    # Dense skills line support (space-separated skills without commas).
    _DENSE_SKILL_PATTERN_RE = re.compile(
        r"(?:[A-Z]{2,}|[A-Z][a-zA-Z0-9+#]*)(?:\.[A-Za-z0-9+#]+)*"
        r"(?:\s+(?:[A-Z]{2,}|[A-Z][a-zA-Z0-9+#]*)(?:\.[A-Za-z0-9+#]+)*)?",
        re.UNICODE,
    )

    _NON_SKILL_PREFIX_RE = re.compile(
        r"^(?:de|des|du|d'|la|le|les|un|une|et|avec|pour|sur|en)\b",
        re.IGNORECASE,
    )

    _DATE_SECTION_RE = re.compile(
        r"^(?:de|from)\b.*\b(?:19|20)\d{2}\b",
        re.IGNORECASE,
    )

    _EDUCATION_SECTION_RE = re.compile(
        r"^(education|[ée]ducation|formation|formations|academic|university|"
        r"universit[ée]|scolarit[ée]|dipl[oô]mes?)\b",
        re.IGNORECASE,
    )

    _EDUCATION_STOP_RE = re.compile(
        r"^(experience|exp[eÃ©]rience|work history|projects?|skills?|"
        r"comp[eÃ©]tences?|certifications?|languages?|langues?|contact|summary|profil)\b",
        re.IGNORECASE,
    )

    _EDUCATION_HINT_RE = re.compile(
        r"\b("
        r"bachelor|master|licence|license|engineering|engineer|ingenieur|ingénieur|"
        r"phd|doctorate|doctorat|diploma|degree|bac|bts|dut|deust|mba|m1|m2"
        r")\b",
        re.IGNORECASE,
    )

    _EDUCATION_IGNORE_RE = re.compile(
        r"\b(driving license|driving licence|driving|permis|certification|"
        r"training|course|coursera|udemy|scrum master)\b",
        re.IGNORECASE,
    )

    def _extract_fallback_skills(self, text: str) -> list[str]:
        """
        Extract skills from text using section-header heuristics and
        bullet-point parsing.  Works for any industry — the method
        identifies a "skills" block and tokenises its content.
        """
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if not lines:
            return []

        in_skill_block = False
        candidates: list[str] = []

        for line in lines:
            normalised = self._normalize_section_marker(line)

            if self._SKILL_HEADING_RE.search(normalised):
                in_skill_block = True
                if ":" in line:
                    candidates.extend(
                        self._split_skill_line(line.split(":", 1)[1])
                    )
                continue

            if (
                in_skill_block
                and (
                    self._STOP_HEADING_RE.search(normalised)
                    or self._DATE_SECTION_RE.search(normalised)
                )
                and not line.startswith(("•", "-", "*"))
            ):
                in_skill_block = False
                continue

            if in_skill_block:
                candidates.extend(self._split_skill_line(line))

        # Deduplicate while preserving order
        seen: set[str] = set()
        result: list[str] = []
        for token in candidates:
            if token not in seen:
                seen.add(token)
                result.append(token)
        return result

    def _extract_fallback_education(self, text: str) -> list[dict[str, str]]:
        """
        Extract likely education lines when the LLM misses academic history.
        Only the degree text is needed for downstream degree matching.
        """
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        education: list[dict[str, str]] = []
        seen: set[str] = set()
        in_education_block = False

        for line in lines:
            normalised = self._normalize_section_marker(line)

            if self._EDUCATION_SECTION_RE.search(normalised):
                in_education_block = True
                continue

            if (
                in_education_block
                and self._EDUCATION_STOP_RE.search(normalised)
                and not line.startswith(("â€¢", "-", "*"))
            ):
                in_education_block = False

            if self._EDUCATION_IGNORE_RE.search(line):
                continue
            if not in_education_block and not self._EDUCATION_HINT_RE.search(line):
                continue
            if not self._EDUCATION_HINT_RE.search(line):
                continue

            degree = line[:140].strip()
            if not degree:
                continue

            key = degree.lower()
            if key in seen:
                continue

            seen.add(key)
            education.append({"degree": degree})

            if len(education) >= 5:
                break

        return education

    @classmethod
    def _normalize_section_marker(cls, line: str) -> str:
        """Normalize regular and spaced headings into a comparable form."""
        collapsed = re.sub(r"\s+", " ", line).strip().lower()
        if cls._SPACED_HEADING_RE.match(collapsed):
            return collapsed.replace(" ", "")
        return collapsed

    def _split_skill_line(self, raw_line: str) -> list[str]:
        """Tokenise a single skill-section line into individual skill strings."""
        line = re.sub(r"^[\-\*\u2022]+\s*", "", raw_line).strip()
        if not line:
            return []

        # Strip sub-header labels like "Languages:" or "Frameworks:"
        if ":" in line:
            left, right = line.split(":", 1)
            if len(left.split()) <= 5:
                line = right.strip()

        dense_tokens = self._split_dense_skill_line(line)
        if dense_tokens:
            return dense_tokens

        items = re.split(r"[,;/|]", line)
        tokens: list[str] = []

        for item in items:
            token = re.sub(r"\s+", " ", item).strip(" .:-").lower()
            if not token or token.isdigit():
                continue
            if len(token) < 2 or len(token) > 50:
                continue
            if token in self._IGNORE_TOKENS:
                continue
            if not self._is_plausible_skill_token(token):
                continue
            tokens.append(token)

        return tokens

    @classmethod
    def _split_dense_skill_line(cls, line: str) -> list[str]:
        """
        Split dense lines like:
        "Android Studio React.js React Native Expo Redux Axios"
        """
        if not line or any(sep in line for sep in [",", ";", "/", "|"]):
            return []
        if len(line.split()) < 4:
            return []

        raw_chunks = [m.group(0).strip() for m in cls._DENSE_SKILL_PATTERN_RE.finditer(line)]
        if len(raw_chunks) < 3:
            return []

        tokens: list[str] = []
        seen: set[str] = set()
        for chunk in raw_chunks:
            token = re.sub(r"\s+", " ", chunk).strip(" .:-").lower()
            if not token or token in cls._IGNORE_TOKENS:
                continue
            if not cls._is_plausible_skill_token(token):
                continue
            if token in seen:
                continue
            seen.add(token)
            tokens.append(token)

        return tokens

    @classmethod
    def _is_plausible_skill_token(cls, token: str) -> bool:
        """Filter out headings, dates, contacts, and long prose fragments."""
        if not token:
            return False
        if cls._SPACED_HEADING_RE.match(token):
            return False
        if cls._SKILL_CONTACT_RE.search(token):
            return False
        if cls._SKILL_DATE_RE.search(token) and len(token.split()) > 1:
            return False
        if cls._NON_SKILL_PREFIX_RE.match(token) and len(token.split()) > 2:
            return False
        if re.search(r"[.!?]", token):
            return False
        if len(token.split()) > 5:
            return False
        if token.count("(") != token.count(")"):
            return False
        return True
