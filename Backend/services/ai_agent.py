import os
import re
import json
import logging
from typing import Dict, Any
from concurrent.futures import ThreadPoolExecutor
import requests
from dotenv import load_dotenv
from services.search import get_verification_context

load_dotenv()

logger = logging.getLogger(__name__)
GROQ_MODEL = os.getenv("GROQ_MODEL_NAME", "llama-3.3-70b-versatile")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Keep Gemini import only for image analysis (vision)
try:
    from google import genai
    GEMINI_MODEL = os.getenv("GEMINI_MODEL_NAME", "gemini-2.5-flash")
except ImportError:
    genai = None
    GEMINI_MODEL = None


# ─── Groq: single call, no retries ───────────────────────────────────────────

def _groq(prompt: str, schema: dict | None = None) -> str:
    """One Groq call. Fast. No retries."""
    if not GROQ_API_KEY:
        raise Exception("GROQ_API_KEY not set in .env")

    system = "You are a JSON-only AI. Respond ONLY with valid JSON, no markdown."
    if schema:
        system += f"\nSchema:\n{json.dumps(schema)}"

    resp = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
        json={
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 4096,
            "response_format": {"type": "json_object"},
        },
        timeout=30,
    )
    resp.raise_for_status()
    text = resp.json()["choices"][0]["message"]["content"]
    return _clean(text)


def _clean(text: str) -> str:
    c = text.strip()
    for m in ["```json", "```"]:
        if c.startswith(m): c = c[len(m):]
    if c.endswith("```"): c = c[:-3]
    return c.strip()


# ─── Local keyword extraction (replaces the old extra AI call) ────────────────

_STOP = {"the","a","an","is","are","was","were","be","been","being","have","has","had",
         "do","does","did","will","would","could","should","may","might","shall","can",
         "it","its","i","me","my","we","our","you","your","he","she","they","them","their",
         "this","that","these","those","in","on","at","to","for","of","with","by","from",
         "and","or","but","not","no","if","then","than","so","as","about","into","over",
         "after","before","between","under","during","also","just","very","too","more",
         "most","much","many","some","any","all","each","every","both","few","other",
         "new","old","said","says","like","get","got","go","went","made","make","take",
         "been","being","which","who","whom","what","when","where","how","why","up","out"}

def _extract_keywords(text: str, max_words: int = 6) -> str:
    """Fast local keyword extraction. No AI call needed."""
    words = re.findall(r'[A-Za-z]+', text[:500])
    keywords = []
    seen = set()
    for w in words:
        wl = w.lower()
        if wl not in _STOP and len(wl) > 2 and wl not in seen:
            keywords.append(w)
            seen.add(wl)
        if len(keywords) >= max_words:
            break
    return " ".join(keywords) if keywords else text[:100]


# ─── Schemas ──────────────────────────────────────────────────────────────────

_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "trustScore":       {"type": "integer"},
        "factualAccuracy":  {"type": "string"},
        "biasRating":       {"type": "string"},
        "headline":         {"type": "string"},
        "headline_hi":      {"type": "string"},
        "headline_mr":      {"type": "string"},
        "summary":          {"type": "string"},
        "summary_hi":       {"type": "string"},
        "summary_mr":       {"type": "string"},
        "tags":             {"type": "array", "items": {"type": "string"}},
        "crossReferences":  {"type": "array"},
        "claimVerdict":     {"type": "array"},
    },
    "required": ["trustScore", "factualAccuracy", "biasRating", "headline", "headline_hi",
                 "headline_mr", "summary", "summary_hi", "summary_mr", "tags",
                 "crossReferences", "claimVerdict"],
}

_IMAGE_SCHEMA = {
    "type": "object",
    "properties": {
        "extracted_text":     {"type": "string"},
        "is_manipulated":     {"type": "boolean"},
        "manipulation_signs": {"type": "array", "items": {"type": "string"}},
        "content_type":       {"type": "string"},
        "trustScore":         {"type": "integer"},
        "factualAccuracy":    {"type": "string"},
        "biasRating":         {"type": "string"},
        "headline":           {"type": "string"},
        "headline_hi":        {"type": "string"},
        "headline_mr":        {"type": "string"},
        "summary":            {"type": "string"},
        "summary_hi":         {"type": "string"},
        "summary_mr":         {"type": "string"},
        "tags":               {"type": "array", "items": {"type": "string"}},
        "claimVerdict":       {"type": "array"},
        "crossReferences":    {"type": "array"},
    },
    "required": ["extracted_text", "is_manipulated", "content_type", "trustScore",
                 "factualAccuracy", "biasRating", "headline", "headline_hi", "headline_mr",
                 "summary", "summary_hi", "summary_mr", "tags", "claimVerdict", "crossReferences"],
}


# ─── Public API ───────────────────────────────────────────────────────────────

def generate_search_query(text: str) -> str:
    """Fast local keyword extraction. No AI call."""
    return _extract_keywords(text)


def analyze_credibility(article_text: str, search_query: str = None) -> Dict[str, Any]:
    """DuckDuckGo search + single Groq call. Fast."""
    query = search_query if search_query else article_text[:150]
    evidence = get_verification_context(query, max_results=4)
    if not evidence or evidence == "NO_EVIDENCE_FOUND":
        evidence = "No external evidence retrieved."

    prompt = f"""You are an expert AI News Analyst. Produce a credibility report.

--- ARTICLE / CLAIM ---
{article_text[:3000]}

--- EVIDENCE ---
{evidence[:3000]}

INSTRUCTIONS:
1. trustScore (0-100): 80-100=well-supported, 60-79=mostly accurate, 40-59=mixed, 0-39=contradicted
2. factualAccuracy: "High" / "Medium" / "Low"
3. biasRating: "Left" / "Right" / "Neutral" / "Mixed"
4. headline: one-line summary
5. summary: 2-3 sentences
6. claimVerdict: up to 3 claims, each with claim, claim_hi, claim_mr, verdict (Verified/False/Unverified/Misleading), reason, reason_hi, reason_mr
7. tags: exactly 3 topic tags
8. crossReferences: up to 3 sources from evidence with source, sourceInitials, timeAgo, trustColor (primary/yellow/red/gray), url
9. headline_hi, summary_hi: Hindi translations
10. headline_mr, summary_mr: Marathi translations

Use actual URLs from evidence. Do NOT fabricate URLs. Be concise."""

    raw = _groq(prompt, schema=_ANALYSIS_SCHEMA)
    result = json.loads(raw)

    # Defaults
    result.setdefault("summary_hi", result.get("summary", ""))
    result.setdefault("summary_mr", result.get("summary", ""))
    result.setdefault("claimVerdict", [])
    result.setdefault("crossReferences", [])
    if not result.get("headline"):
        result["headline"] = article_text.split("\n")[0][:100]
    tags = result.get("tags", [])
    while len(tags) < 3:
        tags.append("General")
    result["tags"] = tags[:3]
    return result


def compare_claims(claim_a: str, claim_b: str) -> Dict[str, Any]:
    """Parallel search + single Groq call."""
    with ThreadPoolExecutor(max_workers=2) as pool:
        fa = pool.submit(get_verification_context, claim_a, 3)
        fb = pool.submit(get_verification_context, claim_b, 3)
        evidence_a = fa.result()
        evidence_b = fb.result()

    schema = {
        "type": "object",
        "properties": {
            "winner": {"type": "string"}, "confidence": {"type": "string"},
            "reasoning": {"type": "string"},
            "claim_a_score": {"type": "integer"}, "claim_b_score": {"type": "integer"},
            "claim_a_verdict": {"type": "string"}, "claim_b_verdict": {"type": "string"},
            "summary": {"type": "string"},
        },
        "required": ["winner", "confidence", "reasoning", "claim_a_score", "claim_b_score",
                     "claim_a_verdict", "claim_b_verdict", "summary"],
    }

    prompt = f"""Compare these two claims for credibility using the evidence.

CLAIM A: {claim_a}
CLAIM B: {claim_b}

EVIDENCE A: {evidence_a[:2000] if evidence_a != 'NO_EVIDENCE_FOUND' else 'None.'}
EVIDENCE B: {evidence_b[:2000] if evidence_b != 'NO_EVIDENCE_FOUND' else 'None.'}

Return winner (claim_a/claim_b/tie), confidence, scores, verdicts, and 3-sentence reasoning."""

    raw = _groq(prompt, schema=schema)
    return json.loads(raw)


# ─── Image Analysis (Gemini Vision — only provider with vision) ───────────────

def analyze_image(image_b64: str, mime_type: str = "image/jpeg") -> Dict[str, Any]:
    """Image analysis uses Gemini Vision (Groq has no vision API)."""
    if not genai:
        raise Exception("google-genai not installed — needed for image analysis")

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise Exception("GEMINI_API_KEY needed for image analysis")

    client = genai.Client(api_key=api_key)

    # Extract text
    extract_resp = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[
            {"text": "Extract ALL visible text from this image. Return only the text."},
            {"inline_data": {"mime_type": mime_type, "data": image_b64}},
        ],
    )
    extracted_text = getattr(extract_resp, "text", "") or ""

    search_text = extracted_text[:150] if extracted_text.strip() else "news image"
    evidence = get_verification_context(search_text, max_results=4)
    if not evidence or evidence == "NO_EVIDENCE_FOUND":
        evidence = "No external evidence."

    prompt = f"""Analyze this image for credibility.

EXTRACTED TEXT: {extracted_text[:3000]}
EVIDENCE: {evidence[:3000]}

Check for manipulation, classify content type, provide trust score, fact-check claims.
Include Hindi (_hi) and Marathi (_mr) translations.
Use actual URLs from evidence for crossReferences."""

    config = {"response_mime_type": "application/json", "response_schema": _IMAGE_SCHEMA}
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[{"text": prompt}, {"inline_data": {"mime_type": mime_type, "data": image_b64}}],
        config=config,
    )

    raw = _clean(getattr(response, "text", "") or "")
    result = json.loads(raw)

    result.setdefault("summary_hi", result.get("summary", ""))
    result.setdefault("summary_mr", result.get("summary", ""))
    result.setdefault("claimVerdict", [])
    result.setdefault("crossReferences", [])
    result.setdefault("manipulation_signs", [])
    tags = result.get("tags", [])
    while len(tags) < 3:
        tags.append("General")
    result["tags"] = tags[:3]
    return result