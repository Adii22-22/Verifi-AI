import datetime as _dt
import html
import re
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from services.redis_cache import get_cached_news_feed, set_cached_news_feed

GOOGLE_NEWS_RSS = "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


def _clean_html(text: str) -> str:
    if not text:
        return ""
    text = html.unescape(text)
    return re.sub(r"<[^>]+>", "", text).strip()


def _fetch_og_image(url: str) -> str | None:
    """Fetch the og:image meta tag from an article page. Returns URL or None."""
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=4, allow_redirects=True)
        if resp.status_code != 200:
            return None
        match = re.search(
            r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
            resp.text,
            re.IGNORECASE,
        )
        if not match:
            match = re.search(
                r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
                resp.text,
                re.IGNORECASE,
            )
        return match.group(1) if match else None
    except Exception:
        return None


def fetch_top_news(max_items: int = 12) -> list:
    """
    Fetches top headlines from Google News RSS.
    Returns a list of dicts with {title, link, summary, published, image}.
    Uses Redis cache with a 10-minute TTL.
    """
    cached = get_cached_news_feed()
    if cached:
        return cached

    try:
        resp = requests.get(GOOGLE_NEWS_RSS, headers=_HEADERS, timeout=10)
        resp.raise_for_status()
    except Exception:
        return []

    try:
        root = ET.fromstring(resp.content)
    except Exception:
        return []

    channel = root.find("channel")
    if channel is None:
        return []

    items = channel.findall("item")[:max_items]

    # Parse basic article data first
    articles = []
    links_to_fetch = []
    for item in items:
        title = _clean_html(item.findtext("title", default=""))
        link = item.findtext("link", default="") or ""
        description = _clean_html(item.findtext("description", default=""))
        pub_date_raw = item.findtext("pubDate", default="") or ""

        published = pub_date_raw
        try:
            dt = _dt.datetime.strptime(pub_date_raw, "%a, %d %b %Y %H:%M:%S %Z")
            published = dt.strftime("%Y-%m-%d %H:%M")
        except Exception:
            pass

        articles.append({
            "title": title,
            "link": link,
            "summary": description,
            "published": published,
            "image": None,
        })

        # Only fetch og:image for non-Google-redirect links
        if link and not link.startswith("https://news.google.com"):
            links_to_fetch.append((len(articles) - 1, link))

    # Fetch og:image in parallel
    if links_to_fetch:
        with ThreadPoolExecutor(max_workers=6) as pool:
            futures = {
                pool.submit(_fetch_og_image, link): idx
                for idx, link in links_to_fetch
            }
            for future in as_completed(futures):
                idx = futures[future]
                try:
                    image_url = future.result()
                    if image_url:
                        articles[idx]["image"] = image_url
                except Exception:
                    pass

    # Update Redis cache (10 min TTL)
    if articles:
        set_cached_news_feed(articles, ttl_seconds=600)

    return articles
