# Verifi.ai — AI-Powered News Credibility Platform

A full-stack news credibility analysis platform that uses a **hybrid ML architecture**: a local TF-IDF + SGD classifier blended with Google Gemini's LLM analysis to produce explainable, academically defensible trust scores.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite |
| **Backend** | Python 3.11 + FastAPI + Uvicorn |
| **Database** | PostgreSQL + SQLAlchemy + Alembic |
| **ML Model** | scikit-learn (TF-IDF + SGDClassifier) |
| **AI/LLM** | Google Gemini 2.5 Flash |
| **Extension** | Chrome Extension (Manifest V3) |
| **Auth** | JWT (python-jose + passlib/bcrypt) |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Vite + React)                │
│  Home │ History │ Compare │ Leaderboard │ Extension Page    │
│                      apiService.ts                          │
└───────────────────────┬─────────────────────────────────────┘
                        │ REST API (JWT auth)
┌───────────────────────▼─────────────────────────────────────┐
│                      BACKEND (FastAPI)                      │
│                                                             │
│  /analyze ──► Gemini AI ─────────┐                         │
│            ──► ML Scorer ────────┤  Ensemble Blending       │
│            ──► Source Reputation ┘  (0.70 + 0.20 + 0.10)   │
│                                                             │
│  /history  ──► PostgreSQL (CRUD + 30-day auto-delete)      │
│  /compare  ──► Gemini AI (side-by-side claim comparison)   │
│  /leaderboard ► Aggregated stats from all analyses         │
│  /news     ──► Live RSS feeds                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                CHROME EXTENSION (Manifest V3)               │
│  Floating panel on any webpage                              │
│  Reads JWT from chrome.storage.local for auth               │
│  Sends text/image to /analyze with Bearer token             │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL running locally
- Google Gemini API key

### 1. Backend
```bash
cd Backend

# Create .env file
# GEMINI_API_KEY=your_key_here
# GEMINI_MODEL_NAME=gemini-2.5-flash
# DATABASE_URL=postgresql://postgres:password@localhost:5432/verifi_ai
# JWT_SECRET=your_secret_key
# JWT_ALGORITHM=HS256
# JWT_EXPIRE_MINUTES=10080

pip install -r requirements.txt

# Train the ML model (downloads dataset + generates plots)
python -m services.train_model

# Start the server
uvicorn src.api:app --reload
# Backend runs at http://localhost:8000
```

### 2. Frontend
```bash
cd Frontend
npm install
npm run dev
# Frontend runs at http://localhost:5173
```

### 3. Chrome Extension (Optional)
1. Open `chrome://extensions/` in Chrome
2. Enable "Developer mode"
3. Click "Load unpacked" → select the `Extension/` folder
4. The Verifi.ai panel appears on any webpage

## ML Model Details

The local ML classifier is trained on the **George McIntire Fake News Corpus** (6,335 real articles from academic research).

**Pipeline:** `Raw Text → TF-IDF Vectorizer (10K features, bigrams) → SGD Classifier`

**Training produces:**
- `ml_artifacts/tfidf_vectorizer.pkl` — vocabulary & weights
- `ml_artifacts/sgd_classifier.pkl` — trained classifier
- `ml_artifacts/plots/` — 8 evaluation plots (confusion matrix, ROC curve, learning curve, etc.)
- `ml_artifacts/training_report.txt` — full metrics report

**Ensemble formula:** `Trust Score = (Gemini × 0.70) + (ML × 0.20) + (Source × 0.10)`

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/analyze` | Optional | Analyze text/URL for credibility |
| POST | `/analyze-image` | Optional | Analyze image for manipulation |
| POST | `/compare` | No | Compare two claims side-by-side |
| POST | `/register` | No | Create new user account |
| POST | `/login` | No | Login and get JWT token |
| GET | `/me` | Yes | Get current user profile |
| GET | `/history` | Yes | Get user's analysis history |
| DELETE | `/history/{id}` | Yes | Delete a history item |
| GET | `/leaderboard` | No | Platform-wide analysis stats |
| GET | `/news` | No | Live trending news feed |
| GET | `/health` | No | Health check |

## Project Structure

```
project2/
├── Backend/
│   ├── src/
│   │   └── api.py              # FastAPI app, all endpoints
│   ├── services/
│   │   ├── ai_agent.py         # Gemini AI integration
│   │   ├── ml_scorer.py        # Local ML model scorer
│   │   ├── train_model.py      # ML training pipeline
│   │   ├── source_reputation.py # Source credibility scoring
│   │   ├── scraper.py          # URL article text extraction
│   │   ├── search.py           # Web search for verification
│   │   ├── news_feed.py        # RSS news feed fetcher
│   │   ├── database.py         # SQLAlchemy DB setup
│   │   ├── models.py           # DB models (User, Analysis)
│   │   ├── auth.py             # JWT auth utilities
│   │   └── ml_artifacts/       # Trained model files + plots
│   ├── requirements.txt
│   └── .env
├── Frontend/
│   ├── src/
│   │   ├── components/         # Navbar, Dashboard, HeroSection, AuthModal, TrendingSection
│   │   ├── pages/              # HistoryPage, ComparePage, LeaderboardPage, ExtensionPage
│   │   └── services/           # apiService.ts
│   ├── types.ts
│   └── package.json
├── Extension/
│   ├── manifest.json           # Chrome MV3 manifest
│   ├── content.js              # Content script (floating panel)
│   ├── content.css             # Panel styles
│   ├── popup.html              # Extension popup
│   └── popup.js                # Popup logic
└── README.md
```

## Key Features
- **Hybrid ML Scoring** — Local TF-IDF + SGD model blended with Gemini LLM
- **Real-time News Analysis** — Text, URL, or image input
- **Cross-reference Verification** — Automated web search for corroborating sources
- **Source Reputation Scoring** — Known news source credibility database
- **Analysis History** — Saved per-user with search and delete
- **30-day Auto-cleanup** — Old analyses purged on server startup
- **Chrome Extension** — Analyze any webpage with a floating panel
- **Multi-language Summaries** — English, Hindi, Marathi
- **Claim Comparison** — Side-by-side credibility comparison

## Repository
https://github.com/Adii22-22/news-credibility-ai-full-stack