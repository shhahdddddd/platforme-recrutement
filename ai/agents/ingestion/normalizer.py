"""
normalizer.py

Post-processing utilities that clean, deduplicate, and canonicalize the
parsed CV/job profile before it enters the matching pipeline.

Key responsibilities:
  - Skill token canonicalization (aliases → canonical form).
  - Deduplication of skill lists while preserving insertion order.
  - Computing total experience years with overlapping-interval merging.
  - Merging regex-extracted fields with LLM-structured output.
"""

from __future__ import annotations

import re
from datetime import datetime


# ── Skill canonicalization table ──────────────────────────────────────────────
# Maps common aliases / abbreviations to a single canonical token.
# This covers IT *and* cross-industry terminology.

SKILL_ALIASES: dict[str, str] = {
    # Web Frameworks
    "next js": "nextjs",
    "next.js": "nextjs",
    "nuxt js": "nuxtjs",
    "nuxt.js": "nuxtjs",
    "nest js": "nestjs",
    "nest.js": "nestjs",
    "express js": "expressjs",
    "express.js": "expressjs",
    "tailwind css": "tailwind",
    "tailwindcss": "tailwind",
    # Databases
    "postgres": "postgresql",
    "postgre": "postgresql",
    "mongo": "mongodb",
    "mysql": "mysql",
    "mssql": "sql server",
    "sqlserver": "sql server",
    "oracle db": "oracle",
    # Languages
    "cpp": "c++",
    "golang": "go",
    # Clouds
    "gcp": "google cloud",
    "aws": "amazon web services",
    "azure": "microsoft azure",
    # Management
    "agile": "agile",
    "scrum": "scrum",
    "project mgmt": "project management",
    "pmp": "project management",
    # Languages (Human)
    "anglais": "english",
    "francais": "french",
    "français": "french",
    "arabe": "arabic",
}

# ── Degree canonicalization map ──────────────────────────────────────────────
# Maps varied academic names (especially French) to canonical levels.

DEGREE_MAP: dict[str, str] = {
    "bac +5": "Master / Engineer",
    "bac+5": "Master / Engineer",
    "master 2": "Master / Engineer",
    "m2": "Master / Engineer",
    "diplome d'ingenieur": "Master / Engineer",
    "diplôme d'ingénieur": "Master / Engineer",
    "cycle ingenieur": "Master / Engineer",
    "master 1": "Master 1 (Bac+4)",
    "m1": "Master 1 (Bac+4)",
    "bac +4": "Master 1 (Bac+4)",
    "bac+4": "Master 1 (Bac+4)",
    "bac +3": "Bachelor (Bac+3)",
    "bac+3": "Bachelor (Bac+3)",
    "licence": "Bachelor (Bac+3)",
    "l3": "Bachelor (Bac+3)",
    "bachelor": "Bachelor (Bac+3)",
    "bac +2": "Associate Degree (Bac+2)",
    "bac+2": "Associate Degree (Bac+2)",
    "bts": "Associate Degree (Bac+2)",
    "dut": "Associate Degree (Bac+2)",
    "deust": "Associate Degree (Bac+2)",
    "doctorat": "PhD / Doctorate",
    "phd": "PhD / Doctorate",
    "baccalaureat": "High School (Bac)",
    "bac": "High School (Bac)",
}

_NULLISH_STRINGS: frozenset[str] = frozenset(
    {"null", "none", "n/a", "na", "nil", "undefined", "unknown"}
)


def _clean_text_value(value: str | None) -> str | None:
    """Collapse whitespace and drop placeholder strings like ``null``."""
    if not isinstance(value, str):
        return value

    cleaned = re.sub(r"\s+", " ", value).strip()
    if not cleaned:
        return None
    if cleaned.lower() in _NULLISH_STRINGS:
        return None
    return cleaned


def _clean_string_list(values: list) -> list[str]:
    """Normalize a heterogeneous list down to meaningful strings only."""
    cleaned_values: list[str] = []
    for value in values:
        cleaned = _clean_text_value(value)
        if isinstance(cleaned, str):
            cleaned_values.append(cleaned)
    return cleaned_values


def _clean_skill_list(values: list) -> list:
    """
    Normalize heterogeneous skill entries (strings or dict objects).

    Preserves dict metadata (category/type/importance) while sanitizing the
    ``name`` field and dropping empty/placeholder entries.
    """
    cleaned_values: list = []

    for value in values:
        if isinstance(value, str):
            cleaned = _clean_text_value(value)
            if isinstance(cleaned, str):
                cleaned_values.append(cleaned)
            continue

        if not isinstance(value, dict):
            continue

        raw_name = _clean_text_value(value.get("name")) if "name" in value else None
        if not isinstance(raw_name, str):
            continue

        cleaned_record: dict = {}
        for key, item in value.items():
            if isinstance(item, str):
                cleaned_item = _clean_text_value(item)
                if cleaned_item is not None:
                    cleaned_record[key] = cleaned_item
            else:
                cleaned_record[key] = item

        cleaned_record["name"] = raw_name
        cleaned_values.append(cleaned_record)

    return cleaned_values


def _clean_record_list(values: list) -> list[dict]:
    """Remove null-like placeholders from list-of-dict profile sections."""
    cleaned_records: list[dict] = []
    for value in values:
        if not isinstance(value, dict):
            continue

        cleaned_record: dict = {}
        for key, item in value.items():
            if isinstance(item, str):
                cleaned_record[key] = _clean_text_value(item)
            else:
                cleaned_record[key] = item

        has_meaningful_value = any(
            item is not None and (not isinstance(item, str) or item.strip())
            for item in cleaned_record.values()
        )
        if has_meaningful_value:
            cleaned_records.append(cleaned_record)

    return cleaned_records


def _normalize_skill_token(skill: str) -> str:
    """Lower-case, collapse whitespace, resolve aliases."""
    normalised = skill.strip().lower()
    normalised = normalised.replace("/", " ").replace("-", " ")
    normalised = re.sub(r"\s+", " ", normalised).strip()
    return SKILL_ALIASES.get(normalised, normalised)


def normalize_skills(skills: list) -> list:
    """Canonicalize and deduplicate a raw skill list (strings or objects)."""
    seen: set[str] = set()
    result: list = []
    for skill in skills:
        if isinstance(skill, str):
            token = _normalize_skill_token(skill)
            if token and token not in seen:
                seen.add(token)
                result.append(token)
        elif isinstance(skill, dict) and "name" in skill:
            token = _normalize_skill_token(skill["name"])
            if token and token not in seen:
                seen.add(token)
                new_skill = skill.copy()
                new_skill["name"] = token
                result.append(new_skill)
    return result


def normalize_degrees(degrees: list) -> list[str]:
    """Canonicalize degree names to ensure consistent matching."""
    result: list[str] = []
    for deg in degrees:
        if not deg or not isinstance(deg, str):
            continue
        
        # Lowercase, strip, and remove dots for easier matching
        raw = deg.lower().strip().replace(".", "")
        # Resolve from map or keep original
        canonical = DEGREE_MAP.get(raw, deg.strip())
        
        if canonical not in result:
            result.append(canonical)
    return result


# ── Date helpers ──────────────────────────────────────────────────────────────

def _parse_year_month(value: str | None) -> datetime | None:
    """Try to parse a date string as YYYY-MM, YYYY/MM, or YYYY."""
    if not value or not isinstance(value, str):
        return None

    raw = value.strip()
    for fmt in ("%Y-%m", "%Y/%m", "%Y"):
        try:
            parsed = datetime.strptime(raw, fmt)
            if fmt == "%Y":
                return datetime(parsed.year, 1, 1)
            return parsed
        except ValueError:
            continue
    return None


def _months_between(start: datetime, end: datetime) -> int:
    """Inclusive month count between two dates."""
    if end < start:
        return 0
    return (end.year - start.year) * 12 + (end.month - start.month) + 1


def compute_total_experience_years(profile: dict) -> float:
    """
    Compute total professional experience in years.

    Overlapping intervals are merged (standard sweep-line) so that
    concurrent roles are not double-counted.
    """
    experiences = profile.get("experience", [])
    if not isinstance(experiences, list):
        return 0.0

    now = datetime.utcnow()
    intervals: list[tuple[datetime, datetime]] = []

    for exp in experiences:
        if not isinstance(exp, dict):
            continue
        start = _parse_year_month(exp.get("start_date"))
        end = _parse_year_month(exp.get("end_date")) or now
        if start:
            intervals.append((start, end))

    if not intervals:
        return 0.0

    # Sort + merge overlapping intervals
    intervals.sort()
    merged: list[tuple[datetime, datetime]] = [intervals[0]]
    for next_start, next_end in intervals[1:]:
        curr_start, curr_end = merged[-1]
        if next_start <= curr_end:
            merged[-1] = (curr_start, max(curr_end, next_end))
        else:
            merged.append((next_start, next_end))

    total_months = sum(_months_between(s, e) for s, e in merged)
    return round(max(total_months / 12.0, 0.0), 2)


# ── Profile normalizer ───────────────────────────────────────────────────────

def normalize_profile(profile: dict) -> dict:
    """
    Ensure every expected field is present, correctly typed, and normalised.

    This function is safe to call on both candidate profiles and job profiles.
    """
    list_fields = (
        "experience",
        "education",
        "certifications",
        "languages",
        "skills",
        "soft_skills",
        "experience_levels",
        "required_degrees",
        "benefits",
    )
    for field in list_fields:
        if not isinstance(profile.get(field), list):
            profile[field] = []

    for field, value in list(profile.items()):
        if isinstance(value, str):
            profile[field] = _clean_text_value(value)

    # Ensure internship_details is a dict
    if not isinstance(profile.get("internship_details"), dict):
        profile["internship_details"] = {"duration_months": None, "type": None}
    else:
        profile["internship_details"] = {
            key: _clean_text_value(val) if isinstance(val, str) else val
            for key, val in profile["internship_details"].items()
        }

    profile["experience"] = _clean_record_list(profile.get("experience", []))
    profile["education"] = _clean_record_list(profile.get("education", []))
    profile["certifications"] = _clean_string_list(profile.get("certifications", []))
    profile["languages"] = _clean_string_list(profile.get("languages", []))
    profile["experience_levels"] = _clean_string_list(profile.get("experience_levels", []))
    profile["required_degrees"] = _clean_string_list(profile.get("required_degrees", []))
    profile["benefits"] = _clean_string_list(profile.get("benefits", []))

    # Canonicalize + deduplicate skills (preserve dict entries from LLM parsing).
    profile["skills"] = normalize_skills(_clean_skill_list(profile.get("skills", [])))
    profile["soft_skills"] = normalize_skills(_clean_skill_list(profile.get("soft_skills", [])))

    # Canonicalize degrees (education levels)
    if profile.get("education"):
        for edu in profile["education"]:
            if isinstance(edu, dict) and edu.get("degree"):
                norm_deg = normalize_degrees([edu["degree"]])
                if norm_deg:
                    edu["degree"] = norm_deg[0]
                    
    # Also normalize required degrees for job profiles
    if profile.get("required_degrees"):
        profile["required_degrees"] = normalize_degrees(profile["required_degrees"])

    # Clean up name casing
    if profile.get("full_name"):
        profile["full_name"] = str(profile["full_name"]).strip().title()

    # Compute total experience for candidate profiles
    if profile.get("experience"):
        profile["total_experience_years"] = compute_total_experience_years(profile)

    # Ensure numeric fields
    if "required_experience_years" in profile:
        try:
            profile["required_experience_years"] = float(
                profile["required_experience_years"]
            )
        except (ValueError, TypeError):
            profile["required_experience_years"] = 0.0

    return profile


# ── Merging ───────────────────────────────────────────────────────────────────

def merge_basic_with_structured(basic: dict, structured: dict) -> dict:
    """
    Merge regex-extracted *basic* fields into the LLM-*structured* profile.

    LLM output is authoritative — basic fields only fill gaps where the LLM
    returned ``None`` or an empty value.
    """
    for key, value in basic.items():
        if value is None:
            continue
        # Only fill if the LLM left the field empty / missing
        existing = structured.get(key)
        if existing is None or (isinstance(existing, str) and not existing.strip()):
            structured[key] = value

    return structured
