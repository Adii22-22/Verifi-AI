from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
load_dotenv()

import os
import re
import sys
import hashlib
import asyncio
import base64
import logging
from pathlib import Path
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.scraper import scrape_article_text, scrape_article_data
from services.search import get_verification_context
from services.ai_agent import analyze_credibility, analyze_image
from services.news_feed import fetch_top_news
from services.database import get_db, init_db, SessionLocal
from services.models import User, Analysis
from services.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user_id, require_auth
)
from services.redis_cache import (
    get_cached_analysis, set_cached_analysis,
    record_trending_topic, get_top_trending,
    check_rate_limit, is_redis_connected
)

logger = logging.getLogger("verifi")


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _cleanup_old_analyses()
    yield


app = FastAPI(title="Verifi.ai — AI News Credibility Agent", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://verifi-ai-one.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


# ─── Cache Key Helper ─────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    """Normalize text for consistent cache key generation."""
    t = text.strip().lower()
    t = re.sub(r'[^\w\s]', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def _cache_key(text: str) -> str:
    return hashlib.sha256(_normalize(text).encode()).hexdigest()[:24]


# ─── Auto-Delete Old Analyses (30-day TTL in DB) ─────────────────────────────

def _cleanup_old_analyses():
    """Delete analyses older than 30 days. Runs on server startup."""
    try:
        db = SessionLocal()
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(days=30)
            deleted = db.query(Analysis).filter(Analysis.created_at < cutoff).delete()
            db.commit()
            if deleted > 0:
                logger.info(f"Auto-cleanup: deleted {deleted} analyses older than 30 days.")
        finally:
            db.close()
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
async def analyze_news(
    req: AnalysisRequest,
    request: Request,
    db: Session = Depends(get_db),
    user_id: str | None = Depends(get_current_user_id),
):
    # Rate limit check (max 30 requests per minute per IP)
    client_ip = request.client.host if request.client else "127.0.0.1"
    if not check_rate_limit(client_ip, limit=30, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many analysis requests. Please wait a minute.")

    user_input = req.text.strip()
    if not user_input:
        raise HTTPException(status_code=400, detail="Empty input")

    # 1. Check Redis cache first (sub-millisecond)
    cache_k = _cache_key(user_input)
    cached = get_cached_analysis(cache_k)
    if cached:
        logger.info(f"⚡ Redis cache hit for: '{user_input[:40]}'")
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
            scraped = await asyncio.to_thread(scrape_article_data, user_input)
            if "error" in scraped:
                raise HTTPException(status_code=400, detail=scraped["error"])
            article_text = scraped["text"]
            search_query = scraped["title"] or user_input
        else:
            article_text = f"User Claim: {user_input}"
            search_query = user_input[:150]

        # AI analysis (runs in thread pool to not block event loop)
        result = await asyncio.to_thread(analyze_credibility, article_text, search_query)

        # 2. Store in Redis cache (48h TTL)
        set_cached_analysis(cache_k, result, ttl_hours=48)

        # 3. Track trending topics in Redis
        for tag in result.get("tags", []):
            record_trending_topic(tag)

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
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: str | None = Depends(get_current_user_id),
):
    # Rate limit check
    client_ip = request.client.host if request.client else "127.0.0.1"
    if not check_rate_limit(client_ip, limit=15, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many image analysis requests. Please wait a minute.")

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {file.content_type}. Use JPEG, PNG, WebP, or GIF.")

    try:
        image_bytes = await file.read()
        if len(image_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image too large. Maximum 10MB.")

        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        result = await asyncio.to_thread(analyze_image, image_b64, file.content_type)

        # Track trending topics in Redis
        for tag in result.get("tags", []):
            record_trending_topic(tag)

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


# ─── News feed ────────────────────────────────────────────────────────────────

@app.get("/news")
def get_news():
    articles = fetch_top_news()
    return {"articles": articles}


# ─── Live Trending Topics (Redis-Powered) ─────────────────────────────────────

@app.get("/trending")
def get_trending(limit: int = 10):
    return {"trending": get_top_trending(limit=limit)}


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/")
def home():
    return {"message": "Verifi.ai API is running", "version": "4.0", "redis_connected": is_redis_connected()}

@app.get("/health")
def health():
    return {"status": "ok", "redis": is_redis_connected()}
