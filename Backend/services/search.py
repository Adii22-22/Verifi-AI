import os
import logging
from tavily import TavilyClient
from dotenv import load_dotenv
from services.redis_cache import get_cached_search, set_cached_search

load_dotenv()
logger = logging.getLogger(__name__)

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

_client = None

def _get_client() -> TavilyClient:
    """Lazy-init Tavily client."""
    global _client
    if _client is None:
        if not TAVILY_API_KEY:
            raise RuntimeError("TAVILY_API_KEY not set in .env")
        _client = TavilyClient(api_key=TAVILY_API_KEY)
    return _client


def get_verification_context(query: str, max_results: int = 5) -> str:
    """
    Search for evidence using Tavily (AI-optimized search).
    Filters to news sources only, recent results (last 7 days).
    Uses Redis caching (24h TTL) to save API credits on repeated queries.
    """
    # 1. Check Redis cache first
    cached_evidence = get_cached_search(query)
    if cached_evidence:
        logger.info(f"⚡ Tavily search cache hit for query: '{query[:40]}'")
        return cached_evidence

    try:
        client = _get_client()
        response = client.search(
            query=query,
            max_results=max_results,
            search_depth="basic",
            include_answer=False,
            topic="news",
            days=7,
            exclude_domains=["youtube.com", "youtu.be", "reddit.com", "twitter.com", "x.com", "facebook.com", "tiktok.com", "instagram.com"],
        )

        results = response.get("results", [])
        if not results:
            return "NO_EVIDENCE_FOUND"

        context = []
        for i, r in enumerate(results):
            title = r.get("title", "")
            url = r.get("url", "")
            content = r.get("content", "")
            context.append(
                f"SOURCE {i+1}: {title}\n"
                f"SNIPPET: {content}\n"
                f"LINK: {url}\n"
            )

        evidence = "\n".join(context).strip()
        # 2. Store in Redis cache
        set_cached_search(query, evidence, ttl_hours=24)
        return evidence

    except Exception as e:
        logger.error(f"Tavily search failed: {e}")
        return "NO_EVIDENCE_FOUND"