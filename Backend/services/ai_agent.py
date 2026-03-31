import os
import json
import time
import logging
from typing import Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
from google import genai
from dotenv import load_dotenv
from services.search import get_verification_context

load_dotenv()

logger = logging.getLogger(__name__)
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-2.5-flash")


def _get_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise Exception("GEMINI_API_KEY is not set.")
    return genai.Client(api_key=api_key)


def _generate(client: genai.Client, prompt: str, schema: dict | None = None) -> str:
    """Single Gemini call with automatic 429 retry."""
    config = {"response_mime_type": "application/json", "response_schema": schema} if schema else {}
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL_NAME,
                contents=prompt,
                config=config if config else None,
            )
            text = getattr(response, "text", None) or ""
            cleaned = text.strip()
            for marker in ["```json", "```"]:
                if cleaned.startswith(marker):
                    cleaned = cleaned[len(marker):]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            return cleaned.strip()
        except Exception as e:
            err = str(e)
            if "429" in err or "RESOURCE_EXHAUSTED" in err:
                wait = (attempt + 1) * 15
                logger.warning(f"Rate limit hit. Retrying in {wait}s...")
                if attempt < 2:
                    time.sleep(wait)
                else:
                    raise Exception("Gemini rate limit. Wait a minute and retry.")
            else:
                raise


_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "trustScore":       {"type": "integer", "minimum": 0, "maximum": 100},
        "factualAccuracy":  {"type": "string", "enum": ["High", "Medium", "Low"]},
        "biasRating":       {"type": "string", "enum": ["Left", "Right", "Neutral", "Mixed"]},
        "headline":         {"type": "string"},
        "headline_hi":      {"type": "string"},
        "headline_mr":      {"type": "string"},
        "summary":          {"type": "string"},
        "summary_hi":       {"type": "string"},
        "summary_mr":       {"type": "string"},
        "tags":             {"type": "array", "items": {"type": "string"}, "minItems": 3, "maxItems": 3},
        "crossReferences": {
            "type": "array", "maxItems": 3,
            "items": {
                "type": "object",
                "properties": {
                    "source":         {"type": "string"},
                    "sourceInitials": {"type": "string"},
                    "timeAgo":        {"type": "string"},
                    "trustColor":     {"type": "string", "enum": ["primary", "yellow", "red", "gray"]},
                    "url":            {"type": "string"},
                },
            },
        },
        "claimVerdict": {
            "type": "array", "maxItems": 3,
            "items": {
                "type": "object",
                "properties": {
                    "claim":     {"type": "string"},
                    "claim_hi":  {"type": "string"},
                    "claim_mr":  {"type": "string"},
                    "verdict":   {"type": "string", "enum": ["Verified", "False", "Unverified", "Misleading"]},
                    "reason":    {"type": "string"},
                    "reason_hi": {"type": "string"},
                    "reason_mr": {"type": "string"},
                },
            },
        },
    },
    "required": ["trustScore", "factualAccuracy", "biasRating", "headline", "headline_hi", "headline_mr", "summary",
                 "summary_hi", "summary_mr", "tags", "crossReferences", "claimVerdict"],
}


def analyze_credibility(article_text: str) -> Dict[str, Any]:
    """
    Fast single-step pipeline:
      1. One DuckDuckGo search for the article/claim
      2. One Gemini call that extracts claims, verifies, and synthesizes verdict
    """
    client = _get_client()

    # Single search — use 4 results for speed (not 6)
    evidence = get_verification_context(article_text[:150], max_results=4)
    if not evidence or evidence == "NO_EVIDENCE_FOUND":
        evidence = "No external evidence retrieved."

    prompt = f"""You are an expert AI News Analyst specializing in fact-checking, bias detection, and credibility assessment.

TASK: Produce a comprehensive credibility report for the article/claim below.

--- ARTICLE / CLAIM ---
{article_text[:3000]}

--- VERIFICATION EVIDENCE (from news search) ---
{evidence[:3000]}

INSTRUCTIONS:
1. TRUST SCORE (0–100): Score based on evidence support, source quality, factual consistency.
   - 80–100 = Well-supported by evidence
   - 60–79 = Mostly accurate, minor issues
   - 40–59 = Mixed evidence, proceed with caution
   - 0–39 = Contradicted by evidence or lacks support
2. FACTUAL ACCURACY: "High" / "Medium" / "Low"
3. BIAS RATING: "Left" / "Right" / "Neutral" / "Mixed"
4. HEADLINE: One-line concise summary of your finding.
5. SUMMARY: 2–3 sentences analyzing the content. If false, state the correction clearly.
6. CLAIM VERDICT: Identify up to 3 key factual claims from the text. For each: verdict (Verified/False/Unverified/Misleading) + one-sentence reason based on evidence.
7. TAGS: Exactly 3 topic tags (e.g. Technology, Politics, Health).
8. CROSS-REFERENCES: Up to 3 sources from the evidence section.
9. _hi fields: Provide Hindi (हिंदी) translations for headline, summary, claim, and reason.
10. _mr fields: Provide Marathi (मराठी) translations for headline, summary, claim, and reason.

IMPORTANT: For cross-references, use the actual URLs from the LINK fields in the evidence section above. Do NOT fabricate URLs.

Be objective, evidence-based, and concise."""

    raw = _generate(client, prompt, schema=_ANALYSIS_SCHEMA)

    try:
        result = json.loads(raw)
    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse AI response: {e}\nRaw: {raw[:300]}")

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
    """Compare two claims — single Gemini call."""
    client = _get_client()

    # Run BOTH searches in parallel — cuts search time in HALF
    with ThreadPoolExecutor(max_workers=2) as pool:
        future_a = pool.submit(get_verification_context, claim_a, 3)
        future_b = pool.submit(get_verification_context, claim_b, 3)
        evidence_a = future_a.result()
        evidence_b = future_b.result()

    schema = {
        "type": "object",
        "properties": {
            "winner":          {"type": "string", "enum": ["claim_a", "claim_b", "tie"]},
            "confidence":      {"type": "string", "enum": ["High", "Medium", "Low"]},
            "reasoning":       {"type": "string"},
            "claim_a_score":   {"type": "integer", "minimum": 0, "maximum": 100},
            "claim_b_score":   {"type": "integer", "minimum": 0, "maximum": 100},
            "claim_a_verdict": {"type": "string", "enum": ["Verified", "False", "Misleading", "Unverified"]},
            "claim_b_verdict": {"type": "string", "enum": ["Verified", "False", "Misleading", "Unverified"]},
            "summary":         {"type": "string"},
        },
        "required": ["winner", "confidence", "reasoning", "claim_a_score", "claim_b_score",
                     "claim_a_verdict", "claim_b_verdict", "summary"],
    }

    prompt = f"""Compare these two claims for credibility. Use evidence to determine which is better supported.

CLAIM A: {claim_a}
CLAIM B: {claim_b}

EVIDENCE FOR CLAIM A:
{evidence_a[:2000] if evidence_a != 'NO_EVIDENCE_FOUND' else 'No evidence found.'}

EVIDENCE FOR CLAIM B:
{evidence_b[:2000] if evidence_b != 'NO_EVIDENCE_FOUND' else 'No evidence found.'}

Provide credibility scores, verdicts, and a 3-sentence reasoning."""

    raw = _generate(client, prompt, schema=schema)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse compare response: {e}")


# ─── Image / Photo Analysis ───────────────────────────────────────────────────

_IMAGE_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "extracted_text":   {"type": "string"},
        "is_manipulated":   {"type": "boolean"},
        "manipulation_signs": {"type": "array", "items": {"type": "string"}, "maxItems": 5},
        "content_type":     {"type": "string", "enum": ["news_article", "social_media_post", "infographic", "meme", "screenshot", "other"]},
        "trustScore":       {"type": "integer", "minimum": 0, "maximum": 100},
        "factualAccuracy":  {"type": "string", "enum": ["High", "Medium", "Low"]},
        "biasRating":       {"type": "string", "enum": ["Left", "Right", "Neutral", "Mixed"]},
        "headline":         {"type": "string"},
        "headline_hi":      {"type": "string"},
        "headline_mr":      {"type": "string"},
        "summary":          {"type": "string"},
        "summary_hi":       {"type": "string"},
        "summary_mr":       {"type": "string"},
        "tags":             {"type": "array", "items": {"type": "string"}, "minItems": 3, "maxItems": 3},
        "claimVerdict": {
            "type": "array", "maxItems": 3,
            "items": {
                "type": "object",
                "properties": {
                    "claim":     {"type": "string"},
                    "claim_hi":  {"type": "string"},
                    "claim_mr":  {"type": "string"},
                    "verdict":   {"type": "string", "enum": ["Verified", "False", "Unverified", "Misleading"]},
                    "reason":    {"type": "string"},
                    "reason_hi": {"type": "string"},
                    "reason_mr": {"type": "string"},
                },
            },
        },
        "crossReferences": {
            "type": "array", "maxItems": 3,
            "items": {
                "type": "object",
                "properties": {
                    "source":         {"type": "string"},
                    "sourceInitials": {"type": "string"},
                    "timeAgo":        {"type": "string"},
                    "trustColor":     {"type": "string", "enum": ["primary", "yellow", "red", "gray"]},
                    "url":            {"type": "string"},
                },
            },
        },
    },
    "required": ["extracted_text", "is_manipulated", "content_type", "trustScore",
                 "factualAccuracy", "biasRating", "headline", "headline_hi", "headline_mr", "summary",
                 "summary_hi", "summary_mr", "tags", "claimVerdict", "crossReferences"],
}


def analyze_image(image_b64: str, mime_type: str = "image/jpeg") -> Dict[str, Any]:
    """
    Analyze a news image/screenshot using Gemini Vision.
    Extracts text, detects manipulation, and fact-checks claims.
    """
    client = _get_client()

    # First: extract text from image with Gemini Vision
    extract_response = client.models.generate_content(
        model=GEMINI_MODEL_NAME,
        contents=[
            {"text": "Extract ALL text visible in this image. Return only the extracted text, nothing else."},
            {"inline_data": {"mime_type": mime_type, "data": image_b64}},
        ],
    )
    extracted_text = getattr(extract_response, "text", "") or ""

    # Search for evidence CONCURRENTLY while we have the extracted text
    # Use first 150 chars of extracted text for faster search
    search_text = extracted_text[:150] if extracted_text.strip() else "news image analysis"
    evidence = get_verification_context(search_text, max_results=4)
    if not evidence or evidence == "NO_EVIDENCE_FOUND":
        evidence = "No external evidence retrieved."

    # Full analysis with image + extracted text + evidence
    prompt = f"""You are an expert AI Image and News Analyst specializing in detecting misinformation, image manipulation, and propaganda in visual media.

TASK: Analyze this image for credibility. The image appears to be a news-related image (screenshot, social media post, infographic, meme, etc.).

--- EXTRACTED TEXT FROM IMAGE ---
{extracted_text[:3000]}

--- VERIFICATION EVIDENCE (from news search) ---
{evidence[:3000]}

INSTRUCTIONS:
1. EXTRACTED TEXT: Confirm and refine the text extracted from the image.
2. IS MANIPULATED: Check for signs of image manipulation (cropped context, edited text, doctored photos, misleading framing).
3. MANIPULATION SIGNS: List any specific signs of manipulation found (empty list if none).
4. CONTENT TYPE: Classify the image (news_article, social_media_post, infographic, meme, screenshot, other).
5. TRUST SCORE (0-100): Based on the claims in the image and evidence support.
6. FACTUAL ACCURACY, BIAS RATING, HEADLINE, SUMMARY: Same as text analysis.
7. CLAIM VERDICT: Fact-check up to 3 claims found in the image.
8. CROSS-REFERENCES: Up to 3 sources with URLs from the evidence.
9. summary_hi: Hindi translation. summary_mr: Marathi translation.
10. TAGS: 3 topic tags.

IMPORTANT: For cross-references, use actual URLs from the evidence LINK fields. Do NOT fabricate URLs.
Be especially vigilant about propaganda, out-of-context images, and misleading infographics."""

    # Use vision API with image + text prompt
    config = {"response_mime_type": "application/json", "response_schema": _IMAGE_ANALYSIS_SCHEMA}
    response = client.models.generate_content(
        model=GEMINI_MODEL_NAME,
        contents=[
            {"text": prompt},
            {"inline_data": {"mime_type": mime_type, "data": image_b64}},
        ],
        config=config,
    )

    raw = getattr(response, "text", "") or ""
    cleaned = raw.strip()
    for marker in ["```json", "```"]:
        if cleaned.startswith(marker):
            cleaned = cleaned[len(marker):]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]

    try:
        result = json.loads(cleaned.strip())
    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse image analysis response: {e}\nRaw: {raw[:300]}")

    # Defaults
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