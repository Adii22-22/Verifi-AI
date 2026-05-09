import trafilatura
import json


def scrape_article_data(url: str) -> dict:
    """
    Scrapes and extracts main article data (title and text) from a URL.
    Returns a dict with 'title', 'text' or 'error'.
    """
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

        return {"title": title.strip() if title else "", "text": text.strip()}

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
