from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
load_dotenv()

import os
import re
import sys
import hashlib
import base64
import logging
from pathlib import Path
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.scraper import scrape_article_text
from services.search import get_verification_context
from services.ai_agent import analyze_credibility, compare_claims, analyze_image
from services.news_feed import fetch_top_news
from services.source_reputation import get_source_reputation, blend_scores
from services.database import get_db, init_db, SessionLocal
from services.models import User, Analysis
from services.ml_scorer import get_ml_score
from services.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user_id, require_auth
)


app = FastAPI(title="Verifi.ai — AI News Credibility Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",  # Allow Chrome extension origin
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


logger = logging.getLogger("verifi")


@app.on_event("startup")
def startup():
    init_db()
    # Auto-delete analyses older than 30 days
    _cleanup_old_analyses()


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class AnalysisRequest(BaseModel):
    text: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str

class LoginRequest(BaseModel):
    email: str
    password: str

class CompareRequest(BaseModel):
    claim_a: str
    claim_b: str


# ─── Smart Fuzzy Cache ──────────────────────────────────────────────────────
# Two layers:
#   1. In-memory dict (fast, but resets on restart)
#   2. PostgreSQL DB fallback (persists forever)
# Uses aggressive text normalization + SequenceMatcher for fuzzy matching
# so slight wording changes still return cached results instantly.

FUZZY_THRESHOLD = 0.85  # 85% similarity = cache hit

_cache: dict[str, dict] = {}           # hash → result
_cache_texts: dict[str, str] = {}      # hash → normalized text (for fuzzy scan)


def _normalize(text: str) -> str:
    """Aggressively normalize: lowercase, strip punctuation, collapse whitespace."""
    t = text.strip().lower()
    t = re.sub(r'[^\w\s]', '', t)       # remove all punctuation
    t = re.sub(r'\s+', ' ', t).strip()  # collapse whitespace
    return t


def _cache_key(text: str) -> str:
    return hashlib.sha256(_normalize(text).encode()).hexdigest()[:16]


def _check_cache(text: str, db: Session = None) -> dict | None:
    """Check in-memory cache (exact + fuzzy), then fall back to DB."""
    norm = _normalize(text)
    key = _cache_key(text)

    # 1. Exact hash match in memory
    if key in _cache:
        return _cache[key]

    # 2. Fuzzy scan in-memory cache (compare against recent entries)
    for cached_key, cached_norm in _cache_texts.items():
        ratio = SequenceMatcher(None, norm, cached_norm).ratio()
        if ratio >= FUZZY_THRESHOLD:
            return _cache[cached_key]

    # 3. DB fallback — check recent analyses for similar input
    if db:
        try:
            recent = (
                db.query(Analysis)
                .filter(Analysis.full_result.isnot(None))
                .order_by(desc(Analysis.created_at))
                .limit(100)
                .all()
            )
            for row in recent:
                row_norm = _normalize(row.input_text or "")
                if not row_norm:
                    continue
                ratio = SequenceMatcher(None, norm, row_norm).ratio()
                if ratio >= FUZZY_THRESHOLD and row.full_result:
                    # Warm the in-memory cache with this DB hit
                    rkey = hashlib.sha256(row_norm.encode()).hexdigest()[:16]
                    _cache[rkey] = row.full_result
                    _cache_texts[rkey] = row_norm
                    return row.full_result
        except Exception:
            pass  # DB errors shouldn't block the analysis

    return None


def _store_cache(text: str, result: dict):
    """Store in in-memory cache."""
    norm = _normalize(text)
    key = _cache_key(text)
    _cache[key] = result
    _cache_texts[key] = norm
    # Keep cache bounded (trim oldest if too large)
    if len(_cache) > 500:
        oldest_key = next(iter(_cache))
        del _cache[oldest_key]
        _cache_texts.pop(oldest_key, None)


# ─── Auto-Delete Old Analyses (30-day TTL) ───────────────────────────────────

def _cleanup_old_analyses():
    """Delete analyses older than 30 days. Runs on server startup."""
    try:
        db = SessionLocal()
        cutoff = datetime.utcnow() - timedelta(days=30)
        deleted = db.query(Analysis).filter(Analysis.created_at < cutoff).delete()
        db.commit()
        db.close()
        if deleted > 0:
            logger.info(f"Auto-cleanup: deleted {deleted} analyses older than 30 days.")
    except Exception as e:
        logger.error(f"Auto-cleanup failed: {e}")


# ─── Auth endpoints ───────────────────────────────────────────────────────────

@app.post("/register", status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        name=req.name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "email": user.email, "name": user.name}}


@app.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "email": user.email, "name": user.name}}


@app.get("/me")
def get_me(user_id: str = Depends(require_auth), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user.id, "email": user.email, "name": user.name}


# ─── Analyze (text) ──────────────────────────────────────────────────────────

@app.post("/analyze")
def analyze_news(
    req: AnalysisRequest,
    db: Session = Depends(get_db),
    user_id: str | None = Depends(get_current_user_id),
):
    user_input = req.text.strip()
    if not user_input:
        raise HTTPException(status_code=400, detail="Empty input")

    # ── Check cache first for instant results (fuzzy match + DB fallback) ──
    cached = _check_cache(user_input, db=db)
    if cached:
        # Still save to DB for logged-in users
        if user_id:
            analysis_row = Analysis(
                user_id=user_id,
                input_text=user_input[:500],
                trust_score=cached["trustScore"],
                bias_rating=cached["biasRating"],
                factual_accuracy=cached["factualAccuracy"],
                headline=cached["headline"],
                summary=cached["summary"],
                tags=cached["tags"],
                full_result=cached,
            )
            db.add(analysis_row)
            db.commit()
        return {"status": "success", "input": user_input, "cached": True, **cached}

    try:
        is_url = user_input.startswith(("http://", "https://"))

        if is_url:
            article_text = scrape_article_text(user_input)
            if article_text.startswith("ERROR"):
                raise HTTPException(status_code=400, detail=article_text)
        else:
            article_text = f"User Claim: {user_input}"

        # AI analysis (3-step pipeline)
        result = analyze_credibility(article_text)

        # ── Local ML Model scoring (runs in ~0.001s) ──
        ml_result = get_ml_score(user_input)
        result["mlScore"] = ml_result

        # Source reputation
        reputation = get_source_reputation(user_input if is_url else "", result.get("headline", ""))
        result["sourceReputation"] = reputation

        # ── Ensemble Blending Formula ──
        # Final = (Gemini * 0.70) + (ML * 0.20) + (Source * 0.10)
        gemini_score = result["trustScore"]
        ml_score = ml_result["ml_score"]
        source_score = reputation["score"] if reputation["score"] != -1 else gemini_score
        blended = int(round(
            (gemini_score * 0.70) + (ml_score * 0.20) + (source_score * 0.10)
        ))
        result["trustScore"] = max(0, min(100, blended))

        # Store in cache for future instant results
        _store_cache(user_input, result)

        # Save to DB if user is authenticated
        if user_id:
            analysis_row = Analysis(
                user_id=user_id,
                input_text=user_input[:500],
                trust_score=result["trustScore"],
                bias_rating=result["biasRating"],
                factual_accuracy=result["factualAccuracy"],
                headline=result["headline"],
                summary=result["summary"],
                tags=result["tags"],
                full_result=result,
            )
            db.add(analysis_row)
            db.commit()

        return {"status": "success", "input": user_input, "cached": False, **result}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# ─── Analyze (image) ─────────────────────────────────────────────────────────

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

@app.post("/analyze-image")
async def analyze_image_endpoint(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: str | None = Depends(get_current_user_id),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {file.content_type}. Use JPEG, PNG, WebP, or GIF.")

    try:
        image_bytes = await file.read()
        if len(image_bytes) > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(status_code=400, detail="Image too large. Maximum 10MB.")

        # Base64 encode for Gemini Vision API
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        result = analyze_image(image_b64, mime_type=file.content_type)

        # Source reputation (use extracted headline)
        reputation = get_source_reputation("", result.get("headline", ""))
        if reputation["score"] != -1:
            blended = blend_scores(result["trustScore"], reputation["score"])
            result["trustScore"] = blended
        result["sourceReputation"] = reputation

        # Save to DB if authenticated
        if user_id:
            analysis_row = Analysis(
                user_id=user_id,
                input_text=f"[IMAGE] {result.get('headline', 'Image analysis')}"[:500],
                trust_score=result["trustScore"],
                bias_rating=result["biasRating"],
                factual_accuracy=result["factualAccuracy"],
                headline=result["headline"],
                summary=result["summary"],
                tags=result["tags"],
                full_result=result,
            )
            db.add(analysis_row)
            db.commit()

        return {"status": "success", "input": f"[Image: {file.filename}]", **result}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image analysis failed: {str(e)}")


# ─── History ──────────────────────────────────────────────────────────────────

@app.get("/history")
def get_history(
    limit: int = 20,
    offset: int = 0,
    user_id: str = Depends(require_auth),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Analysis)
        .filter(Analysis.user_id == user_id)
        .order_by(desc(Analysis.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    total = db.query(func.count(Analysis.id)).filter(Analysis.user_id == user_id).scalar()
    return {
        "total": total,
        "items": [
            {
                "id": r.id,
                "created_at": r.created_at.isoformat(),
                "input_text": r.input_text,
                "trust_score": r.trust_score,
                "bias_rating": r.bias_rating,
                "factual_accuracy": r.factual_accuracy,
                "headline": r.headline,
                "tags": r.tags,
            }
            for r in rows
        ],
    }


@app.delete("/history/{analysis_id}", status_code=204)
def delete_history_item(
    analysis_id: str,
    user_id: str = Depends(require_auth),
    db: Session = Depends(get_db),
):
    row = db.query(Analysis).filter(Analysis.id == analysis_id, Analysis.user_id == user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found")
    db.delete(row)
    db.commit()


# ─── Compare ─────────────────────────────────────────────────────────────────

@app.post("/compare")
def compare(req: CompareRequest):
    if not req.claim_a.strip() or not req.claim_b.strip():
        raise HTTPException(status_code=400, detail="Both claims are required")
    try:
        result = compare_claims(req.claim_a.strip(), req.claim_b.strip())
        return {"status": "success", **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")


# ─── Leaderboard (dynamic from real analyses) ────────────────────────────────

@app.get("/leaderboard")
def leaderboard(db: Session = Depends(get_db)):
    """Returns platform-wide stats from ALL stored analyses (not just one user)."""
    rows = db.query(Analysis).order_by(desc(Analysis.created_at)).limit(500).all()

    # Aggregate stats
    tag_counts: dict[str, int] = {}
    bias_counts: dict[str, int] = {}
    accuracy_counts: dict[str, int] = {}
    source_scores: dict[str, list[int]] = {}  # source domain → list of trust scores

    for row in rows:
        for tag in (row.tags or []):
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
        bias_counts[row.bias_rating] = bias_counts.get(row.bias_rating, 0) + 1
        accuracy_counts[row.factual_accuracy] = accuracy_counts.get(row.factual_accuracy, 0) + 1

        # Extract source from full_result cross-references
        full = row.full_result or {}
        for xref in full.get("crossReferences", []):
            src_name = xref.get("source", "")
            if src_name:
                source_scores.setdefault(src_name, []).append(row.trust_score)

        # Also use headline to identify sources
        headline = (row.headline or "").lower()
        input_text = (row.input_text or "").lower()
        for domain in ["reuters", "bbc", "cnn", "ap news", "nyt", "washington post", "fox news", "ndtv"]:
            if domain in headline or domain in input_text:
                source_scores.setdefault(domain.title(), []).append(row.trust_score)

    # Build analyzed sources ranking
    analyzed_sources = []
    for src, scores in sorted(source_scores.items(), key=lambda x: sum(x[1]) / len(x[1]), reverse=True):
        if len(scores) >= 1:
            avg = round(sum(scores) / len(scores), 1)
            analyzed_sources.append({
                "source": src,
                "avg_score": avg,
                "total_analyses": len(scores),
            })

    top_topics = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    total_analyses = len(rows)
    avg_trust = round(sum(r.trust_score for r in rows) / max(total_analyses, 1), 1)

    return {
        "total_analyses": total_analyses,
        "average_trust_score": avg_trust,
        "top_topics": [{"tag": t, "count": c} for t, c in top_topics],
        "bias_distribution": bias_counts,
        "accuracy_distribution": accuracy_counts,
        "analyzed_sources": analyzed_sources[:20],
    }


# ─── News feed ────────────────────────────────────────────────────────────────

@app.get("/news")
def get_news():
    articles = fetch_top_news()
    return {"articles": articles}


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/")
def home():
    return {"message": "Verifi.ai API is running", "version": "3.0"}

@app.get("/health")
def health():
    return {"status": "ok"}
