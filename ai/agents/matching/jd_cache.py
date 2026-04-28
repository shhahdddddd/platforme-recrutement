"""
JD CACHE MANAGER
Caches parsed job descriptions to avoid re-parsing.

Key: f"jd:{job_id}"
Storage: Redis + PostgreSQL (JobDescription model)
"""
import hashlib
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from asgiref.sync import sync_to_async

logger = logging.getLogger(__name__)


class JDCacheManager:
    """
    Manages Job Description caching.
    
    Cache Strategy:
    - L1: Redis (fast, 1 hour TTL)
    - L2: PostgreSQL JobDescription table (persistent)
    """
    
    def __init__(self):
        self.redis_client = None
        self._db_cache_enabled = True
        self._init_redis()
    
    def _init_redis(self):
        """Initialize Redis connection."""
        try:
            import redis
            self.redis_client = redis.Redis(
                host='localhost', 
                port=6379, 
                db=0,
                decode_responses=True
            )
            self.redis_client.ping()
            logger.info("JD Cache: Redis connected")
        except Exception as e:
            logger.warning(f"JD Cache: Redis unavailable: {e}")
            self.redis_client = None
    
    def _make_cache_key(self, job_id: int, content_hash: str = None) -> str:
        """Create cache key."""
        if content_hash:
            return f"jd:{job_id}:{content_hash}"
        return f"jd:{job_id}"
    
    def _compute_content_hash(self, job_description: str) -> str:
        """Compute hash for job content."""
        return hashlib.md5(job_description.encode('utf-8')).hexdigest()[:16]
    
    @sync_to_async
    def _get_from_db(self, job_id: int) -> Optional[Dict[str, Any]]:
        """Get cached JD from PostgreSQL."""
        if not self._db_cache_enabled:
            return None
        try:
            from api.models import JobDescription
            jd = JobDescription.objects.filter(job_id=job_id).first()
            if jd and jd.parsed_profile:
                return {
                    "job_id": job_id,
                    "content_hash": jd.content_hash,
                    "parsed_profile": jd.parsed_profile,
                    "requirements": jd.parsed_profile.get("requirements", []),
                    "embedding": jd.parsed_profile.get("embedding", None),
                    "created_at": jd.created_at.isoformat() if hasattr(jd, 'created_at') else None,
                }
        except Exception as e:
            self._handle_db_error(e, action="get")
        return None
    
    @sync_to_async
    def _save_to_db(self, job_id: int, job_description: str, parsed_data: Dict[str, Any]) -> bool:
        """Save parsed JD to PostgreSQL."""
        if not self._db_cache_enabled:
            return False
        try:
            from api.models import JobDescription
            content_hash = self._compute_content_hash(job_description)
            
            # Create or update
            JobDescription.objects.update_or_create(
                job_id=job_id,
                defaults={
                    'content': job_description,
                    'content_hash': content_hash,
                    'parsed_profile': parsed_data,
                }
            )
            return True
        except Exception as e:
            self._handle_db_error(e, action="save")
            return False

    def _handle_db_error(self, exc: Exception, action: str) -> None:
        """
        Downgrade missing-table errors to a single warning and disable DB cache.
        """
        message = str(exc).lower()
        missing_table = (
            "job_descriptions" in message
            and ("does not exist" in message or "no such table" in message)
        )

        if missing_table:
            if self._db_cache_enabled:
                logger.warning(
                    "JD Cache: table job_descriptions is missing; disabling DB cache. "
                    "Run migrations to re-enable persistent JD caching."
                )
            self._db_cache_enabled = False
            return

        logger.error(f"Failed to {action} JD in DB: {exc}")
    
    def _get_from_redis(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get from Redis cache."""
        if not self.redis_client:
            return None
        try:
            data = self.redis_client.get(cache_key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.warning(f"Redis get failed: {e}")
        return None
    
    def _save_to_redis(self, cache_key: str, data: Dict[str, Any], ttl: int = 3600) -> bool:
        """Save to Redis cache with TTL."""
        if not self.redis_client:
            return False
        try:
            self.redis_client.setex(cache_key, ttl, json.dumps(data))
            return True
        except Exception as e:
            logger.warning(f"Redis save failed: {e}")
            return False
    
    async def get_cached_jd(
        self,
        job_id: int,
        job_description: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached JD if available and content hasn't changed.
        
        Returns:
            Cached data with parsed_profile, requirements, embedding
            or None if not cached or content changed
        """
        if not job_id:
            return None
        
        content_hash = self._compute_content_hash(job_description)
        cache_key = self._make_cache_key(job_id, content_hash)
        
        # Try L1: Redis first (fastest)
        cached = self._get_from_redis(cache_key)
        if cached:
            logger.info(f"JD cache HIT (Redis) for job {job_id}")
            return cached
        
        # Try L2: PostgreSQL
        db_cached = await self._get_from_db(job_id)
        if db_cached:
            # Verify content hash matches
            if db_cached.get("content_hash") == content_hash:
                # Promote to Redis for faster access
                self._save_to_redis(cache_key, db_cached)
                logger.info(f"JD cache HIT (DB -> Redis) for job {job_id}")
                return db_cached
            else:
                logger.info(f"JD cache MISS (content changed) for job {job_id}")
        
        return None
    
    async def cache_jd(
        self,
        job_id: int,
        job_description: str,
        parsed_data: Dict[str, Any]
    ) -> bool:
        """
        Cache parsed JD in both Redis and PostgreSQL.
        
        Args:
            job_id: Job offer ID
            job_description: Raw job description text
            parsed_data: Parsed profile with requirements, embedding, etc.
        
        Returns:
            True if saved successfully
        """
        if not job_id:
            return False
        
        content_hash = self._compute_content_hash(job_description)
        cache_key = self._make_cache_key(job_id, content_hash)
        
        # Add metadata
        cache_data = {
            "job_id": job_id,
            "content_hash": content_hash,
            "parsed_profile": parsed_data,
            "requirements": parsed_data.get("requirements", []),
            "embedding": parsed_data.get("embedding", None),
            "cached_at": datetime.utcnow().isoformat(),
        }
        
        # Save to Redis (L1 - fast)
        redis_ok = self._save_to_redis(cache_key, cache_data)
        
        # Save to PostgreSQL (L2 - persistent)
        db_ok = await self._save_to_db(job_id, job_description, parsed_data)
        
        if redis_ok or db_ok:
            logger.info(f"JD cached for job {job_id}")
            return True
        return False
    
    async def invalidate_jd(self, job_id: int) -> bool:
        """
        Invalidate JD cache when job description changes.
        
        Args:
            job_id: Job offer ID to invalidate
        
        Returns:
            True if invalidated successfully
        """
        if not job_id:
            return False
        
        # Invalidate Redis
        if self.redis_client:
            try:
                # Delete all keys matching jd:{job_id}:*
                pattern = f"jd:{job_id}:*"
                keys = self.redis_client.keys(pattern)
                if keys:
                    self.redis_client.delete(*keys)
            except Exception as e:
                logger.warning(f"Redis invalidation failed: {e}")
        
        # Note: PostgreSQL entry is kept but will be overwritten
        # on next parse (content_hash will differ)
        
        logger.info(f"JD cache invalidated for job {job_id}")
        return True
    
    def get_jd_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        stats = {
            "redis_connected": self.redis_client is not None,
            "redis_keys": 0,
        }
        
        if self.redis_client:
            try:
                keys = self.redis_client.keys("jd:*")
                stats["redis_keys"] = len(keys)
            except Exception as e:
                logger.warning(f"Failed to get Redis stats: {e}")
        
        return stats


# Singleton instance
_jd_cache_manager: Optional[JDCacheManager] = None


def get_jd_cache_manager() -> JDCacheManager:
    """Get singleton JD cache manager."""
    global _jd_cache_manager
    if _jd_cache_manager is None:
        _jd_cache_manager = JDCacheManager()
    return _jd_cache_manager
