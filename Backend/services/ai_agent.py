import os
import json
import logging
from typing import Dict, Any
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
            "max_completion_tokens": 2048,
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


# ─── Main analysis ────────────────────────────────────────────────────────────

def analyze_credibility(article_text: str, search_query: str = None) -> Dict[str, Any]:
    query = search_query if search_query else article_text[:150]
    evidence = get_verification_context(query, max_results=5)
    if not evidence or evidence == "NO_EVIDENCE_FOUND":
        evidence = "No external evidence retrieved."

    prompt = f"""Analyze this news article/claim for credibility. Return a JSON object with these exact keys:

- "trustScore": integer 0-100 (80-100=well-supported, 60-79=mostly accurate, 40-59=mixed, 0-39=contradicted)
- "factualAccuracy": "High" or "Medium" or "Low"
- "biasRating": "Left" or "Right" or "Neutral" or "Mixed"
- "headline": one-line finding summary
- "summary": 2-3 sentence analysis. IMPORTANT: If the claim is FALSE or MISLEADING, you MUST state what the correct/actual fact is. For example: "This claim is false. In reality, [correct fact based on evidence]." Always provide the corrected version so the user learns the truth.
- "tags": array of exactly 3 topic tags
- "claimVerdict": array of up to 3 objects, each with "claim", "verdict" (Verified/False/Unverified/Misleading), "reason" (if verdict is False or Misleading, MUST include the corrected fact)
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
    result.setdefault("claimVerdict", [])
    result.setdefault("crossReferences", [])
    if not result.get("headline"):
        result["headline"] = article_text.split("\n")[0][:100]
    tags = result.get("tags", [])
    while len(tags) < 3:
        tags.append("General")
    result["tags"] = tags[:3]
    return result


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
    evidence = get_verification_context(search_text, max_results=5)
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
- "summary": 2-3 sentence analysis
- "tags": array of 3 topic tags
- "claimVerdict": array of up to 3 claim objects with "claim", "verdict", "reason"
- "crossReferences": array of up to 3 source objects with "source", "sourceInitials", "timeAgo", "trustColor", "url"

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

    result.setdefault("claimVerdict", [])
    result.setdefault("crossReferences", [])
    result.setdefault("manipulation_signs", [])
    tags = result.get("tags", [])
    while len(tags) < 3:
        tags.append("General")
    result["tags"] = tags[:3]
    return result