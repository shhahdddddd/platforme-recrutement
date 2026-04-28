"""
language.py

Lightweight language detection using ``langdetect``.
Returns an ISO 639-1 code (e.g. ``'fr'``, ``'en'``).
Defaults to ``'en'`` when detection fails.
"""

from __future__ import annotations

from langdetect import LangDetectException, detect


def detect_language(text: str) -> str:
    """Detect the dominant language of *text* (first 1 000 chars for speed)."""
    try:
        return detect(text[:1000])
    except LangDetectException:
        return "en"
