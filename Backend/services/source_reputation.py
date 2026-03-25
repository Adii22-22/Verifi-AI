"""
Source Reputation Engine
Scores a domain's trustworthiness based on a curated list and heuristic checks.
Returns a score from 0-100 that is blended into the final trust score.
"""
import re
from urllib.parse import urlparse

# Tier 1: Highly trusted international news organizations
TRUSTED_SOURCES = {
    "reuters.com": 95, "apnews.com": 94, "bbc.com": 92, "bbc.co.uk": 92,
    "theguardian.com": 88, "nytimes.com": 87, "washingtonpost.com": 86,
    "bloomberg.com": 88, "economist.com": 90, "nature.com": 95,
    "science.org": 95, "who.int": 96, "un.org": 90, "nasa.gov": 97,
    "thehindu.com": 82, "ndtv.com": 78, "hindustantimes.com": 76,
    "timesofindia.indiatimes.com": 75, "indianexpress.com": 80,
    "aljazeera.com": 78, "dw.com": 85, "france24.com": 84,
    "abc.net.au": 88, "cbc.ca": 87, "npr.org": 88,
    "propublica.org": 90, "theatlantic.com": 80, "time.com": 78,
    "forbes.com": 74, "businessinsider.com": 70, "techcrunch.com": 72,
    "wired.com": 78, "arstechnica.com": 82, "theverge.com": 75,
}

# Known unreliable / satire / misinformation sources
UNRELIABLE_SOURCES = {
    "naturalnews.com": 5, "infowars.com": 3, "breitbart.com": 20,
    "worldnewsdailyreport.com": 2, "theonion.com": 10,  # satire
    "babylonbee.com": 10,  # satire
    "nationalreport.net": 3, "empirenews.net": 2, "abcnews.com.co": 2,
    "newslo.com": 5, "huzlers.com": 4, "worldtruth.tv": 5,
    "beforeitsnews.com": 8, "yournewswire.com": 6,
}

# Clickbait pattern signals that lower the score
CLICKBAIT_PATTERNS = [
    r"\b(SHOCKING|BREAKING|EXPOSED|LEAKED|SECRET|BANNED|CENSORED)\b",
    r"you won't believe",
    r"this is why",
    r"doctors hate",
    r"\d+ things .*(never|always)",
    r"!!+",
]


def _extract_domain(url_or_text: str) -> str | None:
    """Extract domain from a URL string."""
    try:
        if not url_or_text.startswith(("http://", "https://")):
            return None
        parsed = urlparse(url_or_text)
        domain = parsed.netloc.lower().replace("www.", "")
        return domain if domain else None
    except Exception:
        return None


def _clickbait_penalty(headline: str) -> int:
    """Returns a penalty (0-20) based on clickbait signals."""
    penalty = 0
    headline_upper = headline.upper()
    # Penalize excessive caps
    caps_ratio = sum(1 for c in headline if c.isupper()) / max(len(headline), 1)
    if caps_ratio > 0.5:
        penalty += 15
    elif caps_ratio > 0.3:
        penalty += 8

    for pattern in CLICKBAIT_PATTERNS:
        if re.search(pattern, headline, re.IGNORECASE):
            penalty += 5

    return min(penalty, 20)


def get_source_reputation(url_or_text: str, headline: str = "") -> dict:
    """
    Returns a dict with:
      - score (0-100): reputation score for the source
      - label: human-readable tier
      - domain: the domain extracted (or None)
    """
    domain = _extract_domain(url_or_text)

    if domain and domain in UNRELIABLE_SOURCES:
        base_score = UNRELIABLE_SOURCES[domain]
        return {"score": base_score, "label": "Unreliable Source", "domain": domain}

    if domain and domain in TRUSTED_SOURCES:
        base_score = TRUSTED_SOURCES[domain]
    elif domain:
        # Unknown domain — neutral baseline, slight advantage for HTTPS (which is implicit from https://)
        base_score = 55
    else:
        # It's a text claim, not a URL — skip source check
        return {"score": -1, "label": "Text Claim", "domain": None}

    # Apply clickbait penalty on headline
    penalty = _clickbait_penalty(headline)
    final_score = max(0, base_score - penalty)

    if final_score >= 85:
        label = "Highly Trusted"
    elif final_score >= 70:
        label = "Reputable"
    elif final_score >= 50:
        label = "Unverified"
    else:
        label = "Low Credibility"

    return {"score": final_score, "label": label, "domain": domain}


def blend_scores(ai_score: int, source_score: int, weight: float = 0.2) -> int:
    """
    Blend AI score (80%) with source reputation (20%).
    If source_score is -1 (text claim), return ai_score unchanged.
    """
    if source_score == -1:
        return ai_score
    blended = round(ai_score * (1 - weight) + source_score * weight)
    return max(0, min(100, blended))
