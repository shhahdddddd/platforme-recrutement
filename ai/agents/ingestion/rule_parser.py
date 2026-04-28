"""
rule_parser.py

Fast, regex-based extraction of commonly-structured CV fields.
These run *before* the LLM and provide a safety net when the model
fails to identify obvious structured data (email, phone, LinkedIn, …).
"""

from __future__ import annotations

import re
from typing import Optional


def extract_email(text: str) -> Optional[str]:
    """Return the first email address found, lower-cased."""
    match = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text)
    return match.group(0).lower() if match else None


def extract_phone(text: str) -> Optional[str]:
    """Return the first phone-number-like string."""
    match = re.search(
        r"(\+?\d{1,3}[\s-]?)?\(?\d{2,3}\)?[\s-]?\d{3}[\s-]?\d{4}", text
    )
    return match.group(0) if match else None


def extract_linkedin(text: str) -> Optional[str]:
    """Return a normalised LinkedIn profile URL if present."""
    match = re.search(
        r"(?:linkedin\.com/in/)([a-zA-Z0-9\-_]+)/?", text, re.IGNORECASE
    )
    return f"https://www.linkedin.com/in/{match.group(1)}" if match else None


def extract_github(text: str) -> Optional[str]:
    """Return a normalised GitHub profile URL if present."""
    match = re.search(
        r"(?:github\.com/)([a-zA-Z0-9\-_]+)/?", text, re.IGNORECASE
    )
    return f"https://github.com/{match.group(1)}" if match else None


def extract_full_name(text: str) -> Optional[str]:
    """
    We no longer use naive line-checking heuristics for names.
    If the LLM fails to extract a name, it's safer to return None
    and flag for human review than to guess from the text.
    """
    return None


def extract_job_title(text: str) -> Optional[str]:
    """
    We no longer use naive line-checking heuristics for job titles.
    If the LLM fails to extract a title, return None.
    """
    return None


def extract_location(text: str) -> Optional[str]:
    """Simple regex for common "City, Country" location patterns."""
    match = re.search(
        r"([A-Z][a-z]+(?:[\s-][A-Z][a-z]+)*),\s*"
        r"([A-Z][a-z]+(?:[\s-][A-Z][a-z]+)*)",
        text,
    )
    return match.group(0).strip() if match else None


def extract_portfolio(text: str) -> Optional[str]:
    """Regex for common portfolio sites (Behance, Dribbble, github.io)."""
    match = re.search(
        r"(?:behance\.net|dribbble\.com|portfolio\.[\w]{2,}|"
        r"[a-zA-Z0-9.-]+\.github\.io)/[a-zA-Z0-9\-_/]+",
        text,
    )
    return match.group(0) if match else None


# ── Main entry point ──────────────────────────────────────────────────────────

def extract_basic_fields(text: str) -> dict:
    """Run all regex extractors and return a flat dict of results."""
    return {
        "full_name": extract_full_name(text),
        "title": extract_job_title(text),
        "email": extract_email(text),
        "phone": extract_phone(text),
        "location": extract_location(text),
        "linkedin": extract_linkedin(text),
        "github": extract_github(text),
        "portfolio": extract_portfolio(text),
    }
