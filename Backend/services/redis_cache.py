import os
import json
import time
import hashlib
import logging
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("verifi.redis")

_redis_client = None
_is_connected = False
_mem_cache: Dict[str, Any] = {}
_mem_expiry: Dict[str, float] = {}
_mem_trending: Dict[str, int] = {}


def _init_redis():
    global _redis_client, _is_connected
    if _redis_client is not None:
        return _is_connected

    redis_url = os.getenv("REDIS_URL")
    redis_host = os.getenv("REDIS_HOST", "localhost")
    redis_port = int(os.getenv("REDIS_PORT", 6379))
    redis_password = os.getenv("REDIS_PASSWORD", None)

    try:
        import redis
        if redis_url:
            _redis_client = redis.from_url(
                redis_url,
                decode_responses=True,
                socket_timeout=1.5,
                socket_connect_timeout=1.5,
            )
        else:
            _redis_client = redis.Redis(
                host=redis_host,
                port=redis_port,
                password=redis_password,
                decode_responses=True,
                socket_timeout=1.5,
                socket_connect_timeout=1.5,
            )
        
        # Test connection
        _redis_client.ping()
        _is_connected = True
        logger.info("⚡ Redis connected successfully. Caching and rate-limiting active.")
    except Exception as e:
        _redis_client = None
        _is_connected = False
        logger.info(f"Redis offline ({e}). Using in-memory fallback cache.")

    return _is_connected


# Initialize on import
_init_redis()


def is_redis_connected() -> bool:
    global _is_connected
    return _is_connected


def _clean_mem_cache():
    """Purge expired in-memory keys."""
    now = time.time()
    expired = [k for k, exp in _mem_expiry.items() if exp <= now]
    for k in expired:
        _mem_cache.pop(k, None)
        _mem_expiry.pop(k, None)


# ─── 1. Analysis Result Caching ──────────────────────────────────────────────

def get_cached_analysis(cache_key: str) -> Optional[Dict[str, Any]]:
    full_key = f"verifi:analysis:{cache_key}"
    if _is_connected and _redis_client:
        try:
            val = _redis_client.get(full_key)
            if val:
                return json.loads(val)
        except Exception as e:
            logger.warning(f"Redis get_analysis error: {e}")

    _clean_mem_cache()
    return _mem_cache.get(full_key)


def set_cached_analysis(cache_key: str, data: Dict[str, Any], ttl_hours: int = 48):
    full_key = f"verifi:analysis:{cache_key}"
    ttl_sec = ttl_hours * 3600
    if _is_connected and _redis_client:
        try:
            _redis_client.setex(full_key, ttl_sec, json.dumps(data))
            return
        except Exception as e:
            logger.warning(f"Redis set_analysis error: {e}")

    _mem_cache[full_key] = data
    _mem_expiry[full_key] = time.time() + ttl_sec


# ─── 2. Tavily Search Evidence Caching ───────────────────────────────────────

def get_cached_search(query: str) -> Optional[str]:
    h = hashlib.sha256(query.strip().lower().encode()).hexdigest()[:20]
    full_key = f"verifi:search:{h}"
    if _is_connected and _redis_client:
        try:
            return _redis_client.get(full_key)
        except Exception as e:
            logger.warning(f"Redis get_search error: {e}")

    _clean_mem_cache()
    return _mem_cache.get(full_key)


def set_cached_search(query: str, evidence: str, ttl_hours: int = 24):
    h = hashlib.sha256(query.strip().lower().encode()).hexdigest()[:20]
    full_key = f"verifi:search:{h}"
    ttl_sec = ttl_hours * 3600
    if _is_connected and _redis_client:
        try:
            _redis_client.setex(full_key, ttl_sec, evidence)
            return
        except Exception as e:
            logger.warning(f"Redis set_search error: {e}")

    _mem_cache[full_key] = evidence
    _mem_expiry[full_key] = time.time() + ttl_sec


# ─── 3. Article Web Scraper Caching ──────────────────────────────────────────

def get_cached_article(url: str) -> Optional[Dict[str, Any]]:
    h = hashlib.sha256(url.strip().encode()).hexdigest()[:20]
    full_key = f"verifi:article:{h}"
    if _is_connected and _redis_client:
        try:
            val = _redis_client.get(full_key)
            if val:
                return json.loads(val)
        except Exception as e:
            logger.warning(f"Redis get_article error: {e}")

    _clean_mem_cache()
    return _mem_cache.get(full_key)


def set_cached_article(url: str, article_data: Dict[str, Any], ttl_days: int = 7):
    h = hashlib.sha256(url.strip().encode()).hexdigest()[:20]
    full_key = f"verifi:article:{h}"
    ttl_sec = ttl_days * 86400
    if _is_connected and _redis_client:
        try:
            _redis_client.setex(full_key, ttl_sec, json.dumps(article_data))
            return
        except Exception as e:
            logger.warning(f"Redis set_article error: {e}")

    _mem_cache[full_key] = article_data
    _mem_expiry[full_key] = time.time() + ttl_sec


# ─── 4. Live News Feed Caching ────────────────────────────────────────────────

def get_cached_news_feed() -> Optional[List[Dict[str, Any]]]:
    full_key = "verifi:news:top"
    if _is_connected and _redis_client:
        try:
            val = _redis_client.get(full_key)
            if val:
                return json.loads(val)
        except Exception as e:
            logger.warning(f"Redis get_news_feed error: {e}")

    _clean_mem_cache()
    return _mem_cache.get(full_key)


def set_cached_news_feed(articles: List[Dict[str, Any]], ttl_seconds: int = 600):
    full_key = "verifi:news:top"
    if _is_connected and _redis_client:
        try:
            _redis_client.setex(full_key, ttl_seconds, json.dumps(articles))
            return
        except Exception as e:
            logger.warning(f"Redis set_news_feed error: {e}")

    _mem_cache[full_key] = articles
    _mem_expiry[full_key] = time.time() + ttl_seconds


# ─── 5. Real-Time Trending Topics ─────────────────────────────────────────────

def record_trending_topic(topic: str):
    if not topic or len(topic) < 2:
        return
    t = topic.strip().title()
    full_key = "verifi:trending:topics"
    if _is_connected and _redis_client:
        try:
            _redis_client.zincrby(full_key, 1, t)
            return
        except Exception as e:
            logger.warning(f"Redis record_trending error: {e}")

    _mem_trending[t] = _mem_trending.get(t, 0) + 1


def get_top_trending(limit: int = 5) -> List[Dict[str, Any]]:
    full_key = "verifi:trending:topics"
    if _is_connected and _redis_client:
        try:
            res = _redis_client.zrevrange(full_key, 0, limit - 1, withscores=True)
            return [{"topic": t, "count": int(score)} for t, score in res]
        except Exception as e:
            logger.warning(f"Redis get_top_trending error: {e}")

    sorted_mem = sorted(_mem_trending.items(), key=lambda x: x[1], reverse=True)[:limit]
    return [{"topic": t, "count": cnt} for t, cnt in sorted_mem]


# ─── 6. Rate Limiting ─────────────────────────────────────────────────────────

def check_rate_limit(client_id: str, limit: int = 20, window_seconds: int = 60) -> bool:
    """
    Returns True if request is ALLOWED, False if limit exceeded.
    """
    full_key = f"verifi:ratelimit:{client_id}"
    if _is_connected and _redis_client:
        try:
            count = _redis_client.incr(full_key)
            if count == 1:
                _redis_client.expire(full_key, window_seconds)
            return count <= limit
        except Exception as e:
            logger.warning(f"Redis rate_limit error: {e}")
            return True

    return True
