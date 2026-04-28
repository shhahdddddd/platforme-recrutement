# =============================================================================
# RecrutiTN AI Microservice - Production Dockerfile
# =============================================================================
# This Dockerfile builds the Django AI API with Daphne ASGI server
# Optimized for: RAG chatbot, CV matching, OCR, quiz generation
# =============================================================================

FROM python:3.11-slim-bookworm AS base

# -----------------------------------------------------------------------------
# Build Arguments & Environment
# -----------------------------------------------------------------------------
ARG DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONFAULTHANDLER=1 \
    PYTHONHASHSEED=random

# -----------------------------------------------------------------------------
# System Dependencies Layer
# -----------------------------------------------------------------------------
# Tesseract: OCR for CV text extraction
# Poppler: PDF processing
# libpq: PostgreSQL client
# curl: Health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-fra \
    poppler-utils \
    libpq-dev \
    gcc \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# -----------------------------------------------------------------------------
# Python Dependencies Layer (Cached separately)
# -----------------------------------------------------------------------------
WORKDIR /app

# Install dependencies first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Download NLTK data for text processing
RUN python -c "import nltk; nltk.download('punkt', quiet=True); nltk.download('stopwords', quiet=True)"

# -----------------------------------------------------------------------------
# Application Layer
# -----------------------------------------------------------------------------
COPY . .

# Create media directories with proper permissions
RUN mkdir -p /app/media /app/kb_documents /app/logs && \
    chmod -R 755 /app/media /app/kb_documents

# -----------------------------------------------------------------------------
# Security: Run as non-root user
# -----------------------------------------------------------------------------
RUN groupadd -r appgroup && useradd -r -g appgroup appuser && \
    chown -R appuser:appgroup /app
USER appuser

# -----------------------------------------------------------------------------
# Health Check
# -----------------------------------------------------------------------------
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8002/health/ || exit 1

# -----------------------------------------------------------------------------
# Expose & Run
# -----------------------------------------------------------------------------
EXPOSE 8002

# Daphne ASGI server for Django Channels (supports WebSockets)
CMD ["daphne", "-b", "0.0.0.0", "-p", "8002", "ai.asgi:application"]
