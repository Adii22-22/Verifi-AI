import trafilatura
import json
from services.redis_cache import get_cached_article, set_cached_article


def scrape_article_data(url: str) -> dict:
    """
    Scrapes and extracts main article data (title and text) from a URL.
    Uses Redis cache with 7-day TTL to avoid re-scraping viral articles.
    """
    cached = get_cached_article(url)
    if cached:
        return cached

    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return {"error": "ERROR: Failed to download article."}

        extracted_json = trafilatura.extract(downloaded, output_format="json")
        if not extracted_json:
            return {"error": "ERROR: Article content too short or unreadable."}
            
        data = json.loads(extracted_json)
        text = data.get("text", "")
        title = data.get("title", "")
        
        if not text or len(text.strip()) < 300:
            return {"error": "ERROR: Article content too short or unreadable."}

        result = {"title": title.strip() if title else "", "text": text.strip()}
        set_cached_article(url, result, ttl_days=7)
        return result

    except Exception as e:
        return {"error": f"ERROR: Scraping failed ({e})"}


def scrape_article_text(url: str) -> str:
    """
    Scrapes and extracts main article text from a URL.
    Always returns a string.
    """
    data = scrape_article_data(url)
    if "error" in data:
        return data["error"]
    return data["text"]
