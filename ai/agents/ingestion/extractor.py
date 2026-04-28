"""
extractor.py

Extracts raw text from PDF CV files.
Falls back to pdfplumber for complex layouts, and OCR (Tesseract) for scanned pages.

Only PDF files are accepted. Any other format is rejected upfront.
"""

from __future__ import annotations

import io
import os
import logging
from pathlib import Path

import fitz  # PyMuPDF
import pdfplumber
import pytesseract
from PIL import Image
from pdf2image import convert_from_path

from .language import detect_language

logger = logging.getLogger(__name__)

# Maximum pages to process.  Prevents runaway on very large documents.
_MAX_PAGES = 10


class PDFExtractor:
    """
    Extract raw text from PDF CVs using a 3-level fallback chain:
      Level 1: PyMuPDF (fast native extraction)
      Level 2: pdfplumber (structural/layout-aware extraction for columns/tables)
      Level 3: Tesseract OCR (scanned pages)
    """

    def extract(self, pdf_path: str) -> tuple[str, str]:
        """
        Read *pdf_path* and return (full_text, detected_language).
        """
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        if Path(pdf_path).suffix.lower() != ".pdf":
            raise ValueError("Only PDF files are accepted.")

        # --- Level 1: PyMuPDF ---
        text_fitz = ""
        try:
            with fitz.open(pdf_path) as doc:
                pages_fitz = list(doc)[:_MAX_PAGES]
                text_fitz = "\n".join(p.get_text("text") for p in pages_fitz).strip()
        except Exception as exc:
            logger.warning(f"PyMuPDF extraction failed for {pdf_path}: {exc}")

        # --- Level 2: pdfplumber (For complex layouts/columns) ---
        text_plumber = ""
        # Heuristic: If PyMuPDF returned little text or the layout is likely complex.
        if len(text_fitz) < 2000:
            try:
                with pdfplumber.open(pdf_path) as pdf:
                    pages_plumber = pdf.pages[:_MAX_PAGES]
                    text_plumber = "\n".join(p.extract_text() or "" for p in pages_plumber).strip()
            except Exception as exc:
                logger.warning(f"pdfplumber extraction failed for {pdf_path}: {exc}")

        # Prefer whichever extracted more content (heuristic for 'better' extraction)
        full_text = text_plumber if len(text_plumber) > len(text_fitz) else text_fitz

        # --- Level 3: OCR fallback for each page if still empty ---
        if len(full_text.strip()) < 50:
            full_text = ""
            try:
                images = convert_from_path(pdf_path, first_page=1, last_page=_MAX_PAGES)
                for img in images:
                    full_text += pytesseract.image_to_string(img, lang="fra+eng") + "\n"
            except Exception as exc:
                logger.warning(f"OCR fallback failed for {pdf_path}: {exc}")

        full_text = full_text.strip()
        if not full_text:
            raise ValueError("Could not extract any text from the PDF.")

        lang = detect_language(full_text[:2000])
        return full_text, lang
