"""
cache_manager.py

Manages cache invalidation for job-specific caches.
When a job is modified, all cached match results for that job should be invalidated.
"""

from __future__ import annotations

import json
import logging
from typing import Any
from pathlib import Path
import redis

logger = logging.getLogger(__name__)

# Redis settings
REDIS_HOST = "127.0.0.1"
REDIS_PORT = 6379
REDIS_PREFIX_JOB = "ai_match_job:"
REDIS_PREFIX_CV = "ai_match_cv:"
REDIS_PREFIX_CV_PROFILE = "ai_cv_prof:"
REDIS_PREFIX_SKILL_EMB = "ai_sk_emb:"
REDIS_PREFIX_MATCH = "ai_match_res:"


class MatchCacheManager:
    """
    Manages cache invalidation for AI matching results.
    Uses Redis for distributed cache with job-scoped invalidation.
    """
    
    def __init__(self):
        self.client = None
        try:
            self.client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                decode_responses=True,
                socket_timeout=2
            )
            self.client.ping()
            logger.info("MatchCacheManager connected to Redis")
        except Exception as e:
            logger.warning(f"Redis not available for cache manager: {e}")
            self.client = None
    
    def _job_cache_key(self, job_id: int | str) -> str:
        """Generate cache key for job match results."""
        return f"{REDIS_PREFIX_JOB}{job_id}"
    
    def _cv_job_cache_key(self, cv_path: str, job_id: int | str) -> str:
        """Generate cache key for specific CV-Job match."""
        import hashlib
        cv_hash_input = cv_path or ""
        try:
            path_obj = Path(cv_hash_input)
            if path_obj.is_file():
                hasher = hashlib.md5()
                with path_obj.open("rb") as file_obj:
                    while True:
                        chunk = file_obj.read(1024 * 1024)
                        if not chunk:
                            break
                        hasher.update(chunk)
                cv_hash = hasher.hexdigest()[:16]
            else:
                cv_hash = hashlib.md5(cv_hash_input.encode()).hexdigest()[:16]
        except Exception:
            cv_hash = hashlib.md5(cv_hash_input.encode()).hexdigest()[:16]
        return f"{REDIS_PREFIX_CV}{cv_hash}:{job_id}"
    
    def get_cached_match(self, cv_path: str, job_id: int | str) -> dict | None:
        """
        Retrieve cached match result for a CV-Job pair.
        Returns None if not found or cache is disabled.
        """
        if not self.client:
            return None
        
        try:
            key = self._cv_job_cache_key(cv_path, job_id)
            cached = self.client.get(key)
            if cached:
                data = json.loads(cached)
                # Check if job version matches
                job_version = self._get_job_version(job_id)
                if data.get("_job_version") == job_version:
                    logger.debug(f"Cache hit for {key}")
                    return data
                else:
                    logger.debug(f"Cache stale for {key} (job version mismatch)")
                    return None
        except Exception as e:
            logger.warning(f"Cache retrieval failed: {e}")
        
        return None
    
    def cache_match_result(
        self,
        cv_path: str,
        job_id: int | str,
        result: dict,
        ttl: int = 3600 * 24  # 24 hours default
    ) -> bool:
        """
        Cache a match result with job version tracking.
        Returns True if cached successfully.
        """
        if not self.client:
            return False
        
        try:
            # Add job version for invalidation tracking
            job_version = self._get_job_version(job_id)
            result_with_version = {
                **result,
                "_job_version": job_version,
                "_cv_path": cv_path,
                "_job_id": job_id,
            }
            
            key = self._cv_job_cache_key(cv_path, job_id)
            self.client.setex(key, ttl, json.dumps(result_with_version))
            
            # Track this CV under the job key for batch invalidation
            job_key = self._job_cache_key(job_id)
            self.client.sadd(job_key, key)
            
            logger.debug(f"Cached match result for {key}")
            return True
        except Exception as e:
            logger.warning(f"Cache store failed: {e}")
            return False
    
    def invalidate_job_cache(self, job_id: int | str) -> bool:
        """
        Invalidate all cached match results for a specific job.
        Called when job requirements are modified.
        """
        if not self.client:
            return False
        
        try:
            # Increment job version (this invalidates all existing caches)
            version_key = f"{REDIS_PREFIX_JOB}{job_id}:version"
            new_version = self.client.incr(version_key)
            
            # Optional: Clean up old keys
            job_key = self._job_cache_key(job_id)
            cached_keys = self.client.smembers(job_key)
            if cached_keys:
                self.client.delete(*cached_keys)
                self.client.delete(job_key)
            
            logger.info(f"Invalidated cache for job {job_id} (new version: {new_version})")
            return True
        except Exception as e:
            logger.warning(f"Cache invalidation failed: {e}")
            return False
    
    def _get_job_version(self, job_id: int | str) -> int:
        """Get current version number for a job."""
        if not self.client:
            return 0
        
        try:
            version_key = f"{REDIS_PREFIX_JOB}{job_id}:version"
            version = self.client.get(version_key)
            return int(version) if version else 0
        except Exception:
            return 0
    
    def get_cache_stats(self, job_id: int | str | None = None) -> dict:
        """
        Get cache statistics for monitoring.
        """
        if not self.client:
            return {"status": "disabled"}
        
        try:
            if job_id:
                job_key = self._job_cache_key(job_id)
                count = self.client.scard(job_key)
                return {
                    "status": "enabled",
                    "job_id": job_id,
                    "cached_matches": count,
                    "job_version": self._get_job_version(job_id),
                }
            else:
                # Global stats
                keys = self.client.keys(f"{REDIS_PREFIX_JOB}*")
                return {
                    "status": "enabled",
                    "total_cached_jobs": len([k for k in keys if ":version" not in k]),
                }
        except Exception as e:
            return {"status": "error", "error": str(e)}

    # --- CV and Embedding Caching ---

    def get_cached_cv_profile(self, cv_hash: str) -> dict | None:
        """cv:{id} -> parsed profile"""
        if not self.client: return None
        try:
            cached = self.client.get(f"{REDIS_PREFIX_CV_PROFILE}{cv_hash}")
            return json.loads(cached) if cached else None
        except Exception: return None

    def cache_cv_profile(self, cv_hash: str, profile: dict, ttl: int = 3600 * 24 * 7):
        if not self.client: return
        try:
            self.client.setex(f"{REDIS_PREFIX_CV_PROFILE}{cv_hash}", ttl, json.dumps(profile))
        except Exception: pass

    def get_cached_skill_embedding(self, skill_name: str) -> list[float] | None:
        """emb:{skill} -> vector"""
        if not self.client: return None
        try:
            cached = self.client.get(f"{REDIS_PREFIX_SKILL_EMB}{skill_name.lower()}")
            return json.loads(cached) if cached else None
        except Exception: return None

    def cache_skill_embedding(self, skill_name: str, embedding: list[float], ttl: int = 3600 * 24 * 30):
        if not self.client: return
        try:
            self.client.setex(f"{REDIS_PREFIX_SKILL_EMB}{skill_name.lower()}", ttl, json.dumps(embedding))
        except Exception: pass


# Singleton instance
_match_cache_manager: MatchCacheManager | None = None


def get_match_cache_manager() -> MatchCacheManager:
    """Get or create the singleton cache manager instance."""
    global _match_cache_manager
    if _match_cache_manager is None:
        _match_cache_manager = MatchCacheManager()
    return _match_cache_manager
