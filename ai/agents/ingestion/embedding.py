"""
embedding.py

Generates L2-normalised vector embeddings using a local Ollama model
(default: ``nomic-embed-text``).

The resulting vectors have unit norm so that dot-product ≡ cosine similarity
— this is important because the ChromaDB cosine space expects it.
"""

from __future__ import annotations

import json
import logging
import os
import asyncio
import hashlib
from pathlib import Path
from typing import Optional

import httpx
import numpy as np
from dotenv import load_dotenv

# Import redis with fallback
try:
    import redis
except ImportError:
    redis = None

logger = logging.getLogger(__name__)

# Load from multiple possible .env locations
# Priority: backend/.env > ai/.env
_backend_env = Path(__file__).parent.parent.parent.parent / "backend" / ".env"
_ai_env = Path(__file__).parent.parent.parent / ".env"

if _backend_env.exists():
    load_dotenv(_backend_env)
    logger.info(f"Loaded env from: {_backend_env}")
elif _ai_env.exists():
    load_dotenv(_ai_env)
    logger.info(f"Loaded env from: {_ai_env}")
else:
    logger.warning("No .env file found in backend/ or ai/ directories")

OLLAMA_EMBED_URL = "http://localhost:11434/api/embeddings"
OLLAMA_EMBED_MODEL = "nomic-embed-text"
OLLAMA_EMBED_TIMEOUT = 120.0

# Gemini embedding (primary - much faster than Ollama)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_EMBED_MODEL = "text-embedding-004"  # Google's fast embedding model
GEMINI_EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"

# Fallback embedding configuration (OpenRouter - no HuggingFace)
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/embeddings"
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_EMBED_MODEL = "text-embedding-3-small"  # OpenAI compatible
EMBED_DIMENSION = 768  # nomic-embed-text produces 768-dim vectors
MAX_RETRIES = 2

# Redis settings from ENV
REDIS_HOST = os.getenv("REDIS_HOST", "127.0.0.1")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)
if REDIS_PASSWORD == "null" or not REDIS_PASSWORD:
    REDIS_PASSWORD = None

# Cache settings
REDIS_PREFIX_SKILL = "ai_skill_embed:"
REDIS_PREFIX_TEXT = "ai_text_embed:"

# Persistent cache for skill embeddings to avoid redundant LLM calls
_CACHE_DIR = Path(__file__).parent / ".cache"
_SKILL_CACHE_PATH = _CACHE_DIR / "skill_embeddings.json"
_TEXT_CACHE_PATH = _CACHE_DIR / "text_embeddings.json"

# In-memory module-level cache for session speed
_skill_cache: dict[str, list[float]] = {}
_text_cache: dict[str, list[float]] = {}

# Protect Ollama from request bursts.
_EMBED_PARALLELISM = 6


class RedisManager:
    """Helper to manage Redis connectivity."""

    def __init__(self):
        self.client = None
        if redis:
            try:
                self.client = redis.Redis(
                    host=REDIS_HOST,
                    port=REDIS_PORT,
                    password=REDIS_PASSWORD,
                    decode_responses=True,
                    socket_timeout=2
                )
                # Test connection
                self.client.ping()
            except Exception as e:
                logger.debug(f"Redis not available: {e}")
                self.client = None

    def _get_vector(self, key: str) -> Optional[list[float]]:
        if not self.client:
            return None
        try:
            val = self.client.get(key)
            if val:
                return json.loads(val)
        except Exception:
            pass
        return None

    def _set_vector(self, key: str, embedding: list[float], ttl_seconds: int = 604800):
        if not self.client:
            return
        try:
            self.client.setex(key, ttl_seconds, json.dumps(embedding))
        except Exception:
            pass

    def get_skill_embedding(self, skill: str) -> Optional[list[float]]:
        return self._get_vector(f"{REDIS_PREFIX_SKILL}{skill}")

    def set_skill_embedding(self, skill: str, embedding: list[float], ttl_seconds: int = 604800):
        self._set_vector(f"{REDIS_PREFIX_SKILL}{skill}", embedding, ttl_seconds)

    def get_text_embedding(self, text_hash: str) -> Optional[list[float]]:
        return self._get_vector(f"{REDIS_PREFIX_TEXT}{text_hash}")

    def set_text_embedding(self, text_hash: str, embedding: list[float], ttl_seconds: int = 604800):
        self._set_vector(f"{REDIS_PREFIX_TEXT}{text_hash}", embedding, ttl_seconds)


class EmbeddingService:
    """Generate embeddings with priority: Gemini (fast) → Ollama (slow) → OpenRouter.
    
    Uses multi-level caching (Memory → Redis → Disk) to avoid redundant API calls.
    """

    def __init__(self) -> None:
        global _skill_cache, _text_cache
        self.redis = RedisManager()
        if not _skill_cache:
            _skill_cache = self._load_cache_file(_SKILL_CACHE_PATH, "skill")
        if not _text_cache:
            _text_cache = self._load_cache_file(_TEXT_CACHE_PATH, "text")

    @staticmethod
    def _text_cache_key(text: str) -> str:
        normalized_text = " ".join((text or "").split())
        return hashlib.sha256(normalized_text.encode("utf-8")).hexdigest()

    async def _generate_with_ollama(self, text: str) -> list[float]:
        """Generate embedding using local Ollama."""
        async with httpx.AsyncClient(timeout=OLLAMA_EMBED_TIMEOUT) as client:
            resp = await client.post(
                OLLAMA_EMBED_URL,
                json={"model": OLLAMA_EMBED_MODEL, "prompt": text},
            )
            resp.raise_for_status()
            embedding = resp.json().get("embedding", [])
        return embedding

    async def _generate_with_openrouter(self, text: str) -> list[float]:
        """
        Fallback: Generate embedding using OpenRouter API (OpenAI compatible).
        Requires OPENROUTER_API_KEY environment variable.
        """
        if not OPENROUTER_API_KEY:
            raise RuntimeError("No OpenRouter API key available for fallback")
        
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                OPENROUTER_API_URL,
                headers=headers,
                json={
                    "model": OPENROUTER_EMBED_MODEL,
                    "input": text
                },
            )
            resp.raise_for_status()
            data = resp.json()
            # OpenAI/OpenRouter format: data.embedding contains the vector
            embedding = data.get("data", [{}])[0].get("embedding", [])
        return embedding

    async def _generate_with_gemini(self, text: str) -> list[float]:
        """
        Primary: Generate embedding using Gemini API (fast, low latency).
        Returns 768-dimensional vector compatible with nomic-embed-text.
        """
        if not GEMINI_API_KEY:
            raise RuntimeError("No Gemini API key available")
        
        url = f"{GEMINI_EMBED_URL}?key={GEMINI_API_KEY}"
        headers = {"Content-Type": "application/json"}
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                url,
                headers=headers,
                json={
                    "model": f"models/{GEMINI_EMBED_MODEL}",
                    "content": {"parts": [{"text": text}]},
                    "outputDimensionality": EMBED_DIMENSION  # Force 768-dim for compatibility
                },
            )
            resp.raise_for_status()
            data = resp.json()
            # Gemini format: embedding.values contains the vector
            embedding = data.get("embedding", {}).get("values", [])
            if not embedding:
                raise RuntimeError("Empty embedding from Gemini")
        return embedding

    def _normalize_vector(self, vec: list[float]) -> list[float]:
        """L2-normalize vector for cosine similarity."""
        arr = np.array(vec, dtype="float32")
        norm = np.linalg.norm(arr)
        if norm > 1e-6:
            arr = arr / norm
        return arr.tolist()

    async def generate_embedding(self, text: str) -> list[float]:
        """
        Generate embedding with FAST priority chain:
        1. Try Gemini API first (fast cloud, ~100-500ms)
        2. Fallback to Ollama (local, ~7s - slow!)
        3. Fallback to OpenRouter API
        """
        global _text_cache
        text = (text or "").strip()
        if not text:
            return []

        text_hash = self._text_cache_key(text)

        # Level 1: In-memory cache
        mem_vec = _text_cache.get(text_hash)
        if mem_vec:
            return mem_vec

        # Level 2: Redis cache
        redis_vec = self.redis.get_text_embedding(text_hash)
        if redis_vec:
            _text_cache[text_hash] = redis_vec
            return redis_vec

        last_error = None
        
        # Priority 1: Gemini (FAST - ~100-500ms)
        if GEMINI_API_KEY:
            try:
                logger.debug("Trying Gemini embedding...")
                embedding = await self._generate_with_gemini(text)
                if len(embedding) > 0:
                    logger.debug("Gemini embedding succeeded")
                    normalized = self._normalize_vector(embedding)
                    _text_cache[text_hash] = normalized
                    self.redis.set_text_embedding(text_hash, normalized)
                    self._save_text_cache()
                    return normalized
            except Exception as exc:
                logger.warning("Gemini embedding failed: %s", exc)
                last_error = exc
        
        # Priority 2: Ollama (SLOW - ~7s per request!)
        for attempt in range(MAX_RETRIES + 1):
            try:
                logger.debug("Trying Ollama embedding (attempt %d)...", attempt + 1)
                embedding = await self._generate_with_ollama(text)
                if len(embedding) > 0:
                    logger.debug("Ollama embedding succeeded")
                    normalized = self._normalize_vector(embedding)
                    _text_cache[text_hash] = normalized
                    self.redis.set_text_embedding(text_hash, normalized)
                    self._save_text_cache()
                    return normalized
            except Exception as exc:
                last_error = exc
                logger.warning("Ollama embedding failed (attempt %d): %s", attempt + 1, exc)
            
            # Priority 3: OpenRouter fallback
            if attempt == 0 and OPENROUTER_API_KEY:
                try:
                    logger.info("Trying OpenRouter fallback for embedding...")
                    embedding = await self._generate_with_openrouter(text)
                    if len(embedding) > 0:
                        logger.info("OpenRouter fallback succeeded")
                        normalized = self._normalize_vector(embedding)
                        _text_cache[text_hash] = normalized
                        self.redis.set_text_embedding(text_hash, normalized)
                        self._save_text_cache()
                        return normalized
                except Exception as exc:
                    logger.warning("OpenRouter fallback failed: %s", exc)
        
        # All attempts failed
        logger.error("All embedding methods failed after %d attempts", MAX_RETRIES + 1)
        raise RuntimeError(
            f"Embedding generation failed for '{text[:30]}...': {last_error}"
        )

    async def embed_skill_list(self, skills: list[str]) -> dict[str, list[float]]:
        """
        Generate embeddings for a list of skills in parallel using a
        multi-level cache (Memory -> Redis -> Disk).
        
        Uses plain skill names - embeddings naturally capture relationships.
        """
        global _skill_cache
        if not skills:
            return {}

        results: dict[str, list[float]] = {}
        to_fetch: list[str] = []  # Just the normalized skill keys

        for skill in skills:
            if not skill or not isinstance(skill, str) or not skill.strip():
                continue
            
            skill_key = skill.strip().lower()
            
            # Level 1: In-memory
            if skill_key in _skill_cache:
                results[skill] = _skill_cache[skill_key]
                continue
                
            # Level 2: Redis
            redis_vec = self.redis.get_skill_embedding(skill_key)
            if redis_vec:
                _skill_cache[skill_key] = redis_vec
                results[skill] = redis_vec
                continue
            
            # Level 3: Not in cache, mark for fetching
            to_fetch.append(skill_key)

        if not to_fetch:
            return results

        # Dispatch all required embeddings in parallel with individual fallback
        
        async def embed_with_fallback(key: str) -> tuple[str, list[float] | None]:
            """Generate embedding with fallback for a single skill."""
            try:
                # Use plain skill name - embeddings naturally capture relationships
                vec = await self.generate_embedding(key)
                return key, vec
            except Exception as exc:
                logger.error("Failed to embed '%s': %s", key, exc)
                return key, None
        
        sem = asyncio.Semaphore(_EMBED_PARALLELISM)

        async def bounded_embed(key: str) -> tuple[str, list[float] | None]:
            async with sem:
                return await embed_with_fallback(key)

        tasks = [bounded_embed(k) for k in to_fetch]
        
        # Gather results and handle failures gracefully
        completed = await asyncio.gather(*tasks)
        
        success_count = 0
        failure_count = 0
        
        for key, vec in completed:
            if vec is not None:
                # Update Level 1 (Memory)
                _skill_cache[key] = vec
                results[key] = vec
                # Update Level 2 (Redis)
                self.redis.set_skill_embedding(key, vec)
                success_count += 1
            else:
                failure_count += 1
        
        if failure_count > 0:
            logger.warning(
                "Embedding batch completed: %d succeeded, %d failed",
                success_count, failure_count
            )
        
        # Update Level 3 (Disk) only if we had successes
        if success_count > 0:
            self._save_skill_cache()

        return results

    # ------------------------------------------------------------------
    # Cache management
    # ------------------------------------------------------------------

    def _load_cache_file(self, path: Path, cache_type: str) -> dict[str, list[float]]:
        """Load a cache map from disk."""
        if not path.exists():
            return {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as exc:
            logger.warning("Could not load %s embedding cache: %s", cache_type, exc)
            return {}

    def _save_skill_cache(self) -> None:
        """Persist internal skill cache to disk."""
        global _skill_cache
        try:
            _CACHE_DIR.mkdir(parents=True, exist_ok=True)
            with open(_SKILL_CACHE_PATH, "w", encoding="utf-8") as f:
                json.dump(_skill_cache, f)
        except Exception as exc:
            logger.warning("Could not save skill cache: %s", exc)

    def _save_text_cache(self) -> None:
        """Persist internal text embedding cache to disk."""
        global _text_cache
        try:
            _CACHE_DIR.mkdir(parents=True, exist_ok=True)
            with open(_TEXT_CACHE_PATH, "w", encoding="utf-8") as f:
                json.dump(_text_cache, f)
        except Exception as exc:
            logger.warning("Could not save text embedding cache: %s", exc)
