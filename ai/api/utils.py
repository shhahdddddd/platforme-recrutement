import asyncio
import httpx
import json
import re
import nltk
import pickle
import redis
import numpy as np
import logging
import time
from threading import RLock
from typing import List, Dict
from django.conf import settings
from nltk.corpus import stopwords

logger = logging.getLogger(__name__)
_bm25_fallback_cache = {}
_KEY_TERM_MARKERS = (
    "experience with",
    "experienced with",
    "knowledge of",
    "proficient in",
    "proficiency in",
    "skilled in",
    "expertise in",
    "familiarity with",
    "good in",
    "using",
    "working with",
    "including",
    "such as",
    "knows",
    "know",
)
_KEY_TERM_BLOCKLIST = {
    "candidate",
    "candidates",
    "engineer",
    "engineering",
    "developer",
    "development",
    "role",
    "position",
    "team",
    "company",
    "project",
    "projects",
    "experience",
    "senior",
    "junior",
    "mid",
    "level",
    "fulltime",
    "full-time",
    "parttime",
    "part-time",
    "remote",
    "onsite",
    "hybrid",
}


def _normalize_company_cache_key(company_id):
    return str(company_id)


def normalize_seniority_level(value):
    normalized = (value or 'mid').strip().lower()
    if normalized in {'junior', 'entry', 'intern', 'internship'}:
        return 'junior'
    if normalized in {'senior', 'lead', 'principal', 'staff'}:
        return 'senior'
    return 'mid'


def _normalize_key_term(term: str) -> str:
    normalized = re.sub(r"\s+", " ", (term or "")).strip(" ,.;:-_")
    return normalized.lower()


def _looks_like_useful_key_term(term: str) -> bool:
    normalized = _normalize_key_term(term)
    if not normalized:
        return False

    tokens = normalized.split()
    if len(tokens) > 4:
        return False
    if all(token in _KEY_TERM_BLOCKLIST for token in tokens):
        return False

    stopword_set = get_technical_stopwords()
    meaningful_tokens = [token for token in tokens if token not in stopword_set and token not in _KEY_TERM_BLOCKLIST]
    if not meaningful_tokens:
        return False

    technical_signal = any(
        any(char.isdigit() for char in token)
        or any(char in token for char in "+#./-_")
        or len(token) > 3
        for token in meaningful_tokens
    )
    return technical_signal


def _score_key_term(term: str, source_text: str, title_text: str) -> tuple[int, int, int, str]:
    normalized = _normalize_key_term(term)
    if not normalized:
        return (0, 0, 0, normalized)

    occurrences = source_text.count(normalized)
    title_bonus = 2 if normalized in title_text else 0
    phrase_bonus = 1 if " " in normalized else 0
    return (occurrences + title_bonus + phrase_bonus, title_bonus, phrase_bonus, normalized)


def extract_job_key_terms(job_title: str, job_description: str, limit: int = 10) -> list[str]:
    title_text = _normalize_key_term(job_title)
    description_text = _normalize_key_term(job_description)
    source_text = f"{title_text}. {description_text}".strip(". ")
    if not source_text:
        return []

    candidates: list[str] = []

    for marker in _KEY_TERM_MARKERS:
        pattern = re.compile(rf"{re.escape(marker)}\s+([^.\n;:]+)", re.IGNORECASE)
        for match in pattern.finditer(f"{job_title}. {job_description}"):
            segment = match.group(1)
            for part in re.split(r",|/|;|\band\b|\bor\b", segment, flags=re.IGNORECASE):
                normalized = _normalize_key_term(part)
                if _looks_like_useful_key_term(normalized):
                    candidates.append(normalized)

    for phrase in re.findall(r"[A-Za-z0-9][A-Za-z0-9+#./-]*(?:\s+[A-Za-z0-9][A-Za-z0-9+#./-]*){0,2}", f"{job_title} {job_description}"):
        normalized = _normalize_key_term(phrase)
        if _looks_like_useful_key_term(normalized):
            candidates.append(normalized)

    scored = {}
    for candidate in candidates:
        score = _score_key_term(candidate, source_text, title_text)
        previous = scored.get(candidate)
        if previous is None or score > previous:
            scored[candidate] = score

    ordered = sorted(scored.items(), key=lambda item: item[1], reverse=True)
    return [term for term, _ in ordered[:limit]]


def build_weighted_bm25_tokens(query_text: str, key_terms: list[str] | None = None, extra_terms: list[str] | None = None, boost: int = 2) -> list[str]:
    tokens = tokenize_technical(query_text)

    for term_text in [*(key_terms or []), *(extra_terms or [])]:
        for term in tokenize_technical(term_text):
            tokens.extend([term] * max(boost, 1))

    return tokens


def _hydrate_bm25_payload(payload):
    if isinstance(payload, dict) and 'bm25' in payload:
        return {
            "bm25": payload.get('bm25'),
            "parent_ids": [str(parent_id) for parent_id in payload.get('parent_ids', [])],
        }
    return {"bm25": payload, "parent_ids": []}


class _SafeRedisLock:
    def __init__(self, wrapper, key, timeout=None):
        self.wrapper = wrapper
        self.key = key
        self.timeout = timeout
        self.remote_lock = None
        self.local_lock = None

    def __enter__(self):
        try:
            self.remote_lock = self.wrapper._client.lock(self.key, timeout=self.timeout)
            self.remote_lock.__enter__()
            return self
        except Exception as exc:
            self.wrapper._warn_once('lock', exc)
            self.local_lock = self.wrapper._get_local_lock(self.key)
            self.local_lock.acquire()
            return self

    def __exit__(self, exc_type, exc, tb):
        if self.remote_lock is not None:
            return self.remote_lock.__exit__(exc_type, exc, tb)

        if self.local_lock is not None:
            self.local_lock.release()

        return False


class SafeRedisClient:
    def __init__(self, host='127.0.0.1', port=6379, db=0):
        self._client = redis.StrictRedis(host=host, port=port, db=db)
        self._values = {}
        self._sets = {}
        self._expiries = {}
        self._locks = {}
        self._guard = RLock()
        self._warned_operations = set()

    def _warn_once(self, operation, exc):
        with self._guard:
            if operation in self._warned_operations:
                return
            self._warned_operations.add(operation)
        logger.warning("Redis unavailable for %s, using in-memory fallback: %s", operation, exc)

    def _encode(self, value):
        if isinstance(value, bytes):
            return value
        if isinstance(value, str):
            return value.encode('utf-8')
        return value

    def _purge_if_expired(self, key):
        expiry = self._expiries.get(key)
        if expiry is not None and expiry <= time.time():
            self._values.pop(key, None)
            self._sets.pop(key, None)
            self._expiries.pop(key, None)

    def _get_local_lock(self, key):
        with self._guard:
            if key not in self._locks:
                self._locks[key] = RLock()
            return self._locks[key]

    def set(self, key, value, ex=None):
        try:
            return self._client.set(key, value, ex=ex)
        except Exception as exc:
            self._warn_once('set', exc)
            with self._guard:
                self._values[key] = self._encode(value)
                self._expiries[key] = (time.time() + ex) if ex else None
            return True

    def get(self, key):
        try:
            return self._client.get(key)
        except Exception as exc:
            self._warn_once('get', exc)
            with self._guard:
                self._purge_if_expired(key)
                return self._values.get(key)

    def delete(self, key):
        try:
            return self._client.delete(key)
        except Exception as exc:
            self._warn_once('delete', exc)
            with self._guard:
                self._values.pop(key, None)
                self._sets.pop(key, None)
                self._expiries.pop(key, None)
            return 1

    def smembers(self, key):
        try:
            return self._client.smembers(key)
        except Exception as exc:
            self._warn_once('smembers', exc)
            with self._guard:
                self._purge_if_expired(key)
                return set(self._sets.get(key, set()))

    def sadd(self, key, *values):
        try:
            return self._client.sadd(key, *values)
        except Exception as exc:
            self._warn_once('sadd', exc)
            with self._guard:
                members = self._sets.setdefault(key, set())
                before = len(members)
                members.update(self._encode(value) for value in values)
                return len(members) - before

    def srem(self, key, *values):
        try:
            return self._client.srem(key, *values)
        except Exception as exc:
            self._warn_once('srem', exc)
            with self._guard:
                members = self._sets.setdefault(key, set())
                removed = 0
                for value in values:
                    encoded = self._encode(value)
                    if encoded in members:
                        members.remove(encoded)
                        removed += 1
                return removed

    def lock(self, key, timeout=None):
        return _SafeRedisLock(self, key, timeout=timeout)

    def ping(self):
        """Health check - returns True if Redis is available."""
        try:
            return self._client.ping()
        except Exception as exc:
            self._warn_once('ping', exc)
            return False

# Ensure NLTK resources are available
try:
    stopwords.words('english')
except LookupError:
    nltk.download('stopwords')

# Redis connection for BM25
redis_client = SafeRedisClient(host=getattr(settings, 'REDIS_HOST', '127.0.0.1'), port=6379, db=0)

# --- CHUNK VECTOR CACHE ---
# Pre-loads all parent chunks for a company (with decoded embeddings) into Redis
# so every parallel question task can skip the DB entirely during KNN retrieval.

_CHUNK_CACHE_TTL = 3600  # 1 hour


def preload_company_chunks(company_id) -> int:
    """Load all ready parent chunks for a company, pre-decode their embeddings,
    and cache the result in Redis. Intended to be called ONCE before a quiz
    generation group is dispatched. Returns the number of chunks cached (0 if
    already cached)."""
    from .models import ParentChunk

    cache_key = f"chunks:company:{company_id}"

    # Skip if already cached (another session for same company recently ran)
    if redis_client.get(cache_key):
        return 0

    chunks = list(
        ParentChunk.objects.filter(company_id=company_id, document__status='ready')
    )
    chunk_dicts = []
    for chunk in chunks:
        if not chunk.embedding:
            continue
        try:
            vector = pickle.loads(chunk.embedding)
            chunk_dicts.append({
                'id': str(chunk.id),
                'content': chunk.content,
                'vector': vector,             # numpy array — already decoded
                'seniority_junior': chunk.seniority_junior,
                'seniority_mid': chunk.seniority_mid,
                'seniority_senior': chunk.seniority_senior,
            })
        except Exception as exc:
            logger.warning("Skipping chunk %s during preload: %s", chunk.id, exc)

    if chunk_dicts:
        try:
            redis_client.set(cache_key, pickle.dumps(chunk_dicts), ex=_CHUNK_CACHE_TTL)
            logger.info(
                "Preloaded %d chunks for company %s into Redis cache",
                len(chunk_dicts), company_id,
            )
        except Exception as exc:
            logger.warning("Chunk cache write failed for company %s: %s", company_id, exc)

    return len(chunk_dicts)


def get_company_chunks_cached(company_id) -> list | None:
    """Return pre-decoded parent chunk dicts from Redis cache.
    Returns None on cache miss — callers should fall back to the DB."""
    cache_key = f"chunks:company:{company_id}"
    try:
        data = redis_client.get(cache_key)
        if data:
            return pickle.loads(data)
    except Exception as exc:
        logger.warning("Chunk cache read error for company %s: %s", company_id, exc)
    return None


# Ollama Embedding Proxy with Batch Processing
def get_embeddings(texts: List[str], batch_size: int = 32) -> List[List[float]]:
    """
    Generate embeddings for multiple texts with batching and caching.
    
    Args:
        texts: List of texts to embed
        batch_size: Number of texts to process in one request (default: 32)
        
    Returns:
        List of embedding vectors
        
    Features:
        - Batch processing for efficiency
        - Redis caching for repeated texts
        - Graceful fallback on errors
    """
    if not texts:
        return []
    
    url = getattr(settings, 'OLLAMA_EMBED_URL', "http://127.0.0.1:11434/api/embed")
    all_embeddings = []
    
    # Try to load from cache first
    cached_map = _get_cached_embeddings(texts)
    
    # Process in batches
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        batch_indices = list(range(i, min(i + batch_size, len(texts))))
        
        # Check which texts need embedding (not cached)
        texts_to_embed = []
        index_map = {}  # Maps batch index back to original index
        
        for j, text in enumerate(batch):
            text_hash = hashlib.md5(text.encode()).hexdigest()
            if text_hash in cached_map:
                # Use cached embedding
                all_embeddings.append((batch_indices[j], cached_map[text_hash]))
            else:
                # Need to embed
                texts_to_embed.append(text)
                index_map[len(texts_to_embed) - 1] = batch_indices[j]
        
        # Embed uncached texts
        if texts_to_embed:
            try:
                import httpx
                payload = {
                    "model": "nomic-embed-text",
                    "input": texts_to_embed,
                    "truncate": True  # Let Ollama handle long texts
                }
                
                with httpx.Client(timeout=60.0) as client:
                    response = client.post(url, json=payload)
                    
                    if response.status_code == 200:
                        embeddings = response.json().get('embeddings', [])
                        
                        # Store results and cache
                        for j, embedding in enumerate(embeddings):
                            original_idx = index_map[j]
                            all_embeddings.append((original_idx, embedding))
                            
                            # Cache this embedding
                            text_hash = hashlib.md5(texts_to_embed[j].encode()).hexdigest()
                            _cache_embedding(text_hash, embedding)
                    else:
                        logger.error(f"Ollama Embed Error: {response.status_code}")
                        # Fallback to zero vectors
                        for _ in texts_to_embed:
                            all_embeddings.append((
                                index_map[len(all_embeddings) - len([e for e in all_embeddings if e[0] in batch_indices])],
                                [0.0] * 768
                            ))
            except Exception as e:
                logger.error(f"Ollama Embed Connection Failed: {e}")
                # Fallback to zero vectors
                for _ in texts_to_embed:
                    all_embeddings.append((
                        index_map[len(all_embeddings)],
                        [0.0] * 768
                    ))
    
    # Sort by original index and extract embeddings
    all_embeddings.sort(key=lambda x: x[0])
    return [emb for _, emb in all_embeddings]


def _get_cached_embeddings(texts: List[str]) -> Dict[str, List[float]]:
    """Retrieve cached embeddings from Redis."""
    try:
        from .utils import redis_client
        
        cached = {}
        pipe = redis_client.pipeline()
        
        for text in texts:
            text_hash = hashlib.md5(text.encode()).hexdigest()
            pipe.get(f"embedding:{text_hash}")
        
        results = pipe.execute()
        
        for i, result in enumerate(results):
            if result:
                text_hash = hashlib.md5(texts[i].encode()).hexdigest()
                cached[text_hash] = json.loads(result)
        
        return cached
    except Exception as exc:
        logger.warning(f"Failed to retrieve cached embeddings: {exc}")
        return {}


def _cache_embedding(text_hash: str, embedding: List[float]) -> None:
    """Cache a single embedding in Redis."""
    try:
        from .utils import redis_client
        
        # Cache for 7 days (embeddings are stable)
        redis_client.setex(
            f"embedding:{text_hash}",
            604800,  # 7 days
            json.dumps(embedding)
        )
    except Exception as exc:
        logger.warning(f"Failed to cache embedding: {exc}")


import nltk
import pickle
import redis
import numpy as np
import logging
import time
import hashlib
from threading import RLock
from typing import List, Dict, Any, Optional
from django.conf import settings
from nltk.corpus import stopwords

# LLM Provider SDKs
try:
    from google import genai as google_genai
    from google.genai import types as google_genai_types
except ImportError:
    google_genai = None
    google_genai_types = None

logger = logging.getLogger(__name__)


async def call_llm(prompt: str, system_prompt: Optional[str] = None, temperature: float = 0.7, model: Optional[str] = None) -> str:
    # 1. Gemini Cloud (Primary for CV parsing - best structured extraction)
    if settings.GEMINI_API_KEY and google_genai and google_genai_types:
        try:
            config_kwargs = {"temperature": temperature}
            if system_prompt:
                config_kwargs["system_instruction"] = system_prompt

            # Use the sync client in a worker thread to avoid local async transport issues.
            def _generate_with_gemini():
                client = google_genai.Client(api_key=settings.GEMINI_API_KEY)
                try:
                    return client.models.generate_content(
                        model=settings.GEMINI_MODEL,
                        contents=prompt,
                        config=google_genai_types.GenerateContentConfig(**config_kwargs),
                    )
                finally:
                    client.close()

            response = await asyncio.wait_for(asyncio.to_thread(_generate_with_gemini), timeout=30.0)
            if response.text:
                return response.text.strip()
        except asyncio.TimeoutError:
            logger.warning("Gemini timed out after 30s. Falling back to Groq...")
        except Exception as e:
            logger.warning(f"Gemini failed: {e}. Falling back to Groq...")
    elif settings.GEMINI_API_KEY:
        logger.warning("google-genai is not installed; skipping Gemini and falling back to Groq.")

    # 2. Groq (Secondary - fastest and most reliable)
    if hasattr(settings, 'GROQ_API_KEY') and settings.GROQ_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                headers = {
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json"
                }
                messages = []
                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})
                messages.append({"role": "user", "content": prompt})
                
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    json={
                        "model": getattr(settings, 'GROQ_MODEL', 'llama-3.3-70b-versatile'),
                        "messages": messages,
                        "temperature": temperature,
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                    if content:
                        return content.strip()
        except Exception as e:
            logger.warning(f"Groq failed: {e}. Falling back to OpenRouter...")

    # 3. OpenRouter (Tertiary - free tier available)
    if hasattr(settings, 'OPENROUTER_API_KEY') and settings.OPENROUTER_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                headers = {
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": getattr(settings, 'BACKEND_URL', 'http://localhost:8001'),
                    "X-Title": "RecrutiTN AI"
                }
                messages = []
                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})
                messages.append({"role": "user", "content": prompt})
                
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json={
                        "model": getattr(settings, 'OPENROUTER_MODEL', 'meta-llama/llama-3.3-70b-instruct:free'),
                        "messages": messages,
                        "temperature": temperature,
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                    if content:
                        return content.strip()
        except Exception as e:
            logger.warning(f"OpenRouter failed: {e}. Falling back to Ollama...")

    # 4. Ollama Fallback (Local - last resort)
    return await call_ollama(prompt, system_prompt, temperature, model)


async def call_ollama(prompt, system_prompt=None, temperature=0.7, model=None):
    if model is None:
        model = settings.OLLAMA_FAST_MODEL
    url = settings.OLLAMA_URL
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "model": model,
                "prompt": prompt,
                "stream": False,
                "keep_alive": 0,
                "options": {"temperature": temperature},
                "format": "json" if "JSON" in prompt or "json" in prompt.lower() else ""
            }
            if system_prompt:
                payload["system"] = system_prompt

            response = await client.post(url, json=payload)
            if response.status_code == 200:
                return response.json().get('response', '')
            
            logger.error(f"Ollama error: {response.status_code}")
    except Exception as e:
        logger.error(f"Ollama connection failed: {e}")
    return ""


# --- BM25 INDEX OFFICE ---

def get_technical_stopwords():
    langs = ['english', 'french', 'arabic']
    sw = set()
    for l in langs:
        try: sw.update(stopwords.words(l))
        except: pass
    sw.update(['the', 'et', 'and', 'with', 'using', 'implémentation', 'use', 'how', 'to'])
    return sw

# Computed once at module load — avoids NLTK reload on every tokenize call
_TECHNICAL_STOPWORDS: set = get_technical_stopwords()

def tokenize_technical(text):
    tokens = re.findall(r'[\w\u0600-\u06FF]+', text.lower())
    return [t for t in tokens if t not in _TECHNICAL_STOPWORDS]

def update_bm25_index(company_id):
    from .models import ChildChunk
    cache_key = _normalize_company_cache_key(company_id)
    key = f"bm25:company:{cache_key}"
    chunk_rows = list(
        ChildChunk.objects
        .filter(company_id=company_id, document__status='ready')
        .order_by('id')
        .values_list('content', 'parent_id')
    )
    corpus = [tokenize_technical(content) for content, _ in chunk_rows]
    if not corpus:
        _bm25_fallback_cache.pop(cache_key, None)
        try:
            redis_client.delete(key)
        except Exception as exc:
            logger.warning("BM25 redis delete unavailable for company %s: %s", company_id, exc)
        return
    
    from rank_bm25 import BM25Okapi
    bm25 = BM25Okapi(corpus)
    payload = {
        "bm25": bm25,
        "parent_ids": [str(parent_id) for _, parent_id in chunk_rows],
    }
    _bm25_fallback_cache[cache_key] = payload

    try:
        redis_client.set(key, pickle.dumps(payload), ex=3600*24*30)
    except Exception as exc:
        logger.warning("BM25 redis cache unavailable for company %s: %s", company_id, exc)

def get_bm25_index_data(company_id):
    cache_key = _normalize_company_cache_key(company_id)
    if cache_key in _bm25_fallback_cache:
        return _hydrate_bm25_payload(_bm25_fallback_cache[cache_key])

    key = f"bm25:company:{cache_key}"
    try:
        data = redis_client.get(key)
    except Exception as exc:
        logger.warning("BM25 redis lookup unavailable for company %s: %s", company_id, exc)
        data = None

    if data:
        payload = _hydrate_bm25_payload(pickle.loads(data))
        _bm25_fallback_cache[cache_key] = payload
        return payload

    update_bm25_index(company_id)
    return _hydrate_bm25_payload(_bm25_fallback_cache.get(cache_key))


def get_bm25_index(company_id):
    return get_bm25_index_data(company_id).get("bm25")

# --- SCORING SIGNALS ---

def calculate_rouge(candidate, reference):
    c_words = set(tokenize_technical(candidate))
    r_words = set(tokenize_technical(reference))
    if not r_words: return 0
    return (len(c_words.intersection(r_words)) / len(r_words)) * 100

def calculate_bert_score(candidate, reference):
    # Proxy semantic overlap using filtered tokens
    return calculate_rouge(candidate, reference) # Placeholder for BERTScore

async def llm_judge_score(question, candidate, reference):
    prompt = f"Question: {question}\nCandidate: {candidate}\nReference: {reference}\nRate answer 0-100. JSON: {{'score': int, 'reasoning': str}}"
    res = await call_llm(prompt, model=settings.OLLAMA_SYNTH_MODEL)
    try:
        return json.loads(re.search(r'\{.*\}', res, re.DOTALL).group())
    except:
        return {"score": 0, "reasoning": "Judge parse failure"}

def calculate_rrf(rank_list1, rank_list2, k=60, top_k=10):
    scores = {}
    for rank, doc_id in enumerate(rank_list1):
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
    for rank, doc_id in enumerate(rank_list2):
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
    return sorted(scores.keys(), key=lambda x: scores[x], reverse=True)[:top_k]

def aggregate_scores(rouge, bert, cosine, judge):
    """15% Lexical, 25% BERT, 20% Vector, 40% Judge."""
    return (rouge * 0.15) + (bert * 0.25) + (cosine * 100 * 0.20) + (judge * 0.40)

def cosine_similarity(v1, v2):
    a = np.array(v1, dtype=float)
    b = np.array(v2, dtype=float)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)
