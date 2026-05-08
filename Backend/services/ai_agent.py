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
GROQ_MODEL = os.getenv("GROQ_MODEL_NAME", "llama-3.1-8b-instant")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Gemini only for image vision
try:
    from google import genai
    GEMINI_MODEL = os.getenv("GEMINI_MODEL_NAME", "gemini-2.5-flash")
except ImportError:
    genai = None
    GEMINI_MODEL = None


# ─── Groq call ────────────────────────────────────────────────────────────────

def _groq(prompt: str) -> str:
    """Single Groq call. No retries. Fast."""
    if not GROQ_API_KEY:
        raise Exception("GROQ_API_KEY not set in .env")

    resp = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
        json={
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": "You are a JSON-only AI. Respond with valid JSON only. No markdown fences. No extra text."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.3,
            "max_completion_tokens": 4096,
            "response_format": {"type": "json_object"},
        },
        timeout=30,
    )
    if resp.status_code != 200:
        body = resp.text[:300]
        raise Exception(f"Groq {resp.status_code}: {body}")
    text = resp.json()["choices"][0]["message"]["content"]
    return _clean(text)


def _clean(text: str) -> str:
    c = text.strip()
    for m in ["```json", "```"]:
        if c.startswith(m): c = c[len(m):]
    if c.endswith("```"): c = c[:-3]
    return c.strip()


# ─── Local keyword extraction ─────────────────────────────────────────────────

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


def generate_search_query(text: str) -> str:
    return _extract_keywords(text)


# ─── Main analysis ────────────────────────────────────────────────────────────

def analyze_credibility(article_text: str, search_query: str = None) -> Dict[str, Any]:
    query = search_query if search_query else article_text[:150]
    evidence = get_verification_context(query, max_results=4)
    if not evidence or evidence == "NO_EVIDENCE_FOUND":
        evidence = "No external evidence retrieved."

    prompt = f"""Analyze this news article/claim for credibility. Return a JSON object with these exact keys:

- "trustScore": integer 0-100 (80-100=well-supported, 60-79=mostly accurate, 40-59=mixed, 0-39=contradicted)
- "factualAccuracy": "High" or "Medium" or "Low"
- "biasRating": "Left" or "Right" or "Neutral" or "Mixed"
- "headline": one-line finding summary
- "headline_hi": Hindi translation of headline
- "headline_mr": Marathi translation of headline
- "summary": 2-3 sentence analysis. IMPORTANT: If the claim is FALSE or MISLEADING, you MUST state what the correct/actual fact is. For example: "This claim is false. In reality, [correct fact based on evidence]." Always provide the corrected version so the user learns the truth.
- "summary_hi": Hindi translation of summary
- "summary_mr": Marathi translation of summary
- "tags": array of exactly 3 topic tags
- "claimVerdict": array of up to 3 objects, each with "claim", "claim_hi", "claim_mr", "verdict" (Verified/False/Unverified/Misleading), "reason" (if verdict is False or Misleading, MUST include the corrected fact here), "reason_hi", "reason_mr"
- "crossReferences": array of up to 3 objects with "source", "sourceInitials", "timeAgo", "trustColor" (primary/yellow/red/gray), "url"

ARTICLE/CLAIM:
{article_text[:2500]}

EVIDENCE:
{evidence[:2500]}

Use actual URLs from evidence. Do NOT fabricate URLs. Be concise."""

    raw = _groq(prompt)
    try:
        result = json.loads(raw)
    except json.JSONDecodeError as e:
        raise Exception(f"JSON parse failed: {e}\nRaw: {raw[:300]}")

    # Defaults
    result.setdefault("summary_hi", result.get("summary", ""))
    result.setdefault("summary_mr", result.get("summary", ""))
    result.setdefault("headline_hi", result.get("headline", ""))
    result.setdefault("headline_mr", result.get("headline", ""))
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
    with ThreadPoolExecutor(max_workers=2) as pool:
        fa = pool.submit(get_verification_context, claim_a, 3)
        fb = pool.submit(get_verification_context, claim_b, 3)
        evidence_a = fa.result()
        evidence_b = fb.result()

    prompt = f"""Compare these two claims for credibility. Return JSON with:
- "winner": "claim_a" or "claim_b" or "tie"
- "confidence": "High" or "Medium" or "Low"
- "reasoning": 3-sentence explanation
- "claim_a_score": integer 0-100
- "claim_b_score": integer 0-100
- "claim_a_verdict": "Verified" or "False" or "Misleading" or "Unverified"
- "claim_b_verdict": "Verified" or "False" or "Misleading" or "Unverified"
- "summary": one-sentence summary

CLAIM A: {claim_a}
CLAIM B: {claim_b}
EVIDENCE A: {evidence_a[:1500] if evidence_a != 'NO_EVIDENCE_FOUND' else 'None.'}
EVIDENCE B: {evidence_b[:1500] if evidence_b != 'NO_EVIDENCE_FOUND' else 'None.'}"""

    raw = _groq(prompt)
    return json.loads(raw)


# ─── Image Analysis (Gemini Vision only) ──────────────────────────────────────

def analyze_image(image_b64: str, mime_type: str = "image/jpeg") -> Dict[str, Any]:
    if not genai:
        raise Exception("google-genai not installed")
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise Exception("GEMINI_API_KEY needed for image analysis")

    client = genai.Client(api_key=api_key)

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

    prompt = f"""Analyze this image for credibility. Return JSON with:
- "extracted_text": text found in image
- "is_manipulated": boolean
- "manipulation_signs": array of strings
- "content_type": "news_article" or "social_media_post" or "infographic" or "meme" or "screenshot" or "other"
- "trustScore": integer 0-100
- "factualAccuracy": "High" or "Medium" or "Low"
- "biasRating": "Left" or "Right" or "Neutral" or "Mixed"
- "headline": one-line summary
- "headline_hi": Hindi translation
- "headline_mr": Marathi translation
- "summary": 2-3 sentence analysis
- "summary_hi": Hindi translation
- "summary_mr": Marathi translation
- "tags": array of 3 topic tags
- "claimVerdict": array of up to 3 claim objects
- "crossReferences": array of up to 3 source objects

EXTRACTED TEXT: {extracted_text[:2500]}
EVIDENCE: {evidence[:2500]}
Use actual URLs from evidence."""

    config = {"response_mime_type": "application/json"}
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[{"text": prompt}, {"inline_data": {"mime_type": mime_type, "data": image_b64}}],
        config=config,
    )

    raw = _clean(getattr(response, "text", "") or "")
    result = json.loads(raw)

    result.setdefault("summary_hi", result.get("summary", ""))
    result.setdefault("summary_mr", result.get("summary", ""))
    result.setdefault("headline_hi", result.get("headline", ""))
    result.setdefault("headline_mr", result.get("headline", ""))
    result.setdefault("claimVerdict", [])
    result.setdefault("crossReferences", [])
    result.setdefault("manipulation_signs", [])
    tags = result.get("tags", [])
    while len(tags) < 3:
        tags.append("General")
    result["tags"] = tags[:3]
    return result