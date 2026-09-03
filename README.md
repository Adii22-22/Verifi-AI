# Verifi.ai — Automated News Credibility & Verification Engine

<div align="center">

![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7.0-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)

**An asynchronous intelligence system for real-time news credibility assessment, multimodal claim verification, and evidence synthesis.**

[Overview](#overview) • [System Architecture](#system-architecture) • [Core Capabilities](#core-capabilities) • [Tech Stack](#tech-stack) • [Installation & Setup](#installation--setup) • [Browser Extension](#browser-extension) • [Production Deployment](#production-deployment)

</div>

---

## Overview

**Verifi.ai** is an automated news credibility platform engineered to verify assertions, breaking headlines, complete web articles, and image screenshots in under five seconds.

The platform integrates real-time search extraction against verified news publications with high-throughput inference models and a multi-tier Redis caching layer. Rather than operating as an ungrounded generative wrapper, the system cross-references claims against active press reporting to evaluate factual accuracy, perspective bias, and manipulation markers.

---

## System Architecture

```
                                  ┌────────────────────────┐
                                  │      Client Layer      │
                                  │  Web App & Side Panel  │
                                  └───────────┬────────────┘
                                              │ HTTP / JSON
                                  ┌───────────▼────────────┐
                                  │   FastAPI Application  │
                                  │  Asynchronous Pipeline │
                                  └─────┬───────┬─────┬────┘
                                        │       │     │
                 ┌──────────────────────┘       │     └─────────────────────┐
                 │                              │                           │
        ┌────────▼────────┐            ┌────────▼────────┐         ┌────────▼────────┐
        │   Redis Cache   │            │  Inference Layer│         │ Persistence DB  │
        │  (Sub-ms Read)  │            │                 │         │                 │
        │ • Analysis Cache│            │ • Tavily Search │         │ • PostgreSQL    │
        │ • Scraper Cache │            │ • Groq Llama3.1 │         │ • JWT Sessions  │
        │ • Live RSS Feed │            │ • Gemini Vision │         │ • Search History│
        │ • Rate Limiting │            │ • Trafilatura   │         │ • 30-Day TTL    │
        └─────────────────┘            └─────────────────┘         └─────────────────┘
```

---

## Core Capabilities

* **Evidence-Grounded Claim Verification**: Synthesizes verified press coverage using the Tavily Search API constrained to news sources and recent temporal windows (7-day recency), processed through Groq's high-speed inference engine (`openai/gpt-oss-20b`).
* **Multimodal Image Forensics**: Evaluates screenshots, visual claims, and document images for manipulation markers, synthetic artifacts, and contextual mismatches using Google Gemini 2.5 Flash.
* **Full-Text Article Extraction**: Extracts main article bodies from raw URLs via Trafilatura, stripping boilerplate, ads, and navigation structures before analysis.
* **Five-Tier Redis Caching Infrastructure**:
  * **Analysis Cache**: Stores processed analyses for identical queries with a 48-hour TTL, serving repeated claims in under 1 millisecond.
  * **Search Context Cache**: Caches external news search queries with a 24-hour TTL to reduce outbound search API consumption.
  * **Article Scraper Cache**: Retains extracted article text for 7 days to eliminate redundant network crawls on viral links.
  * **Live News Feed Cache**: Retains parsed RSS feeds and metadata for 10 minutes to minimize external feed calls.
  * **Rate Limiting & Real-Time Aggregation**: Employs atomic Redis operations for client IP rate limiting and trending claim analytics with zero database overhead.
  * *Includes automatic fallback to an in-memory TTL structure if Redis is unreachable.*
* **Continuous Live Headlines Feed**: Real-time aggregation of top global news headlines with one-click direct verification.
* **Chrome Side Panel (Manifest V3)**: Integrated side panel adhering to Google Chrome's native side panel specifications, featuring high-contrast Black and White themes, active-tab extraction, and targeted visual region capture.
* **Session Management & History**: Token-based authentication (JWT) with PostgreSQL persistence, user-isolated records, and a 30-day automated record cleanup task.

---

## Tech Stack

| Layer | Component | Description |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS | Single-page application with responsive layouts and persistent state handling |
| **Backend** | Python 3.11, FastAPI, Uvicorn | Asynchronous REST service handling concurrency and payload processing |
| **Search Engine** | Tavily AI News Search | Specialized news index search with temporal boundaries and domain filters |
| **Inference** | Groq (`llama-3.1-8b-instant`) | Low-latency inference providing structured JSON evaluations |
| **Vision Model** | Google Gemini 2.5 Flash | Multimodal vision model for optical character recognition and artifact analysis |
| **Caching Layer**| Redis 7 (or cloud Upstash) | Sub-millisecond distributed cache with automatic in-memory fallback |
| **Database** | PostgreSQL + SQLAlchemy | Relational storage for user authentication and historical analysis logs |
| **Extension** | Chrome Side Panel (Manifest V3) | Native browser side panel for background tab and selection analysis |
| **DevOps** | Docker Compose, Nginx, GitHub Actions | Multi-container composition and automated continuous integration testing |

---

## Installation & Setup

### Prerequisites
* Python 3.11 or higher
* Node.js 20 or higher
* API Keys:
  * Groq API Key (Inference)
  * Tavily API Key (Search)
  * Gemini API Key (Optional, for image forensics)

---

### Local Development Environment

#### 1. Backend Service
```bash
cd Backend

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env   # Or create Backend/.env
```

Configure `Backend/.env`:
```env
GROQ_API_KEY=your_groq_api_key
TAVILY_API_KEY=your_tavily_api_key
GEMINI_API_KEY=your_gemini_api_key
DATABASE_URL=sqlite:///./verifi.db   # Or PostgreSQL connection string
JWT_SECRET=your_jwt_secret_key
# Optional: REDIS_URL=redis://localhost:6379/0 (falls back to memory if omitted)
```

Launch the FastAPI application:
```bash
uvicorn src.api:app --reload --port 8000
```
* API Server: `http://localhost:8000`
* Interactive Documentation: `http://localhost:8000/docs`

#### 2. Frontend Application
In a separate terminal:
```bash
cd Frontend

# Install packages
npm install

# Start Vite development server
npm run dev
```
* Application Interface: `http://localhost:5173`

---

### Containerized Environment (Docker Compose)

The repository provides a multi-container Docker configuration linking Redis, FastAPI, and an Nginx-served React frontend:

```bash
docker compose up --build
```

* Frontend Interface: `http://localhost:3000` (or `http://localhost:80`)
* Backend API Documentation: `http://localhost:8000/docs`
* Redis Service: `localhost:6379`

To terminate containers:
```bash
docker compose down
```

---

## Browser Extension

The Chrome extension utilizes Chrome's native Side Panel API:

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the upper right corner.
3. Select **Load unpacked** and choose the [`extension/`](file:///c:/Users/adina/Desktop/project2/extension) directory.
4. Click the Verifi.ai icon in the browser toolbar to open the side panel.
   * **Analyze Active Page**: Automatically extracts the current tab URL and evaluates credibility.
   * **Snip Area**: Enables an on-page crosshair tool to crop and evaluate a specific image or region.
   * **Theme Switcher**: Toggles between high-contrast Black and White visual modes.

---

## Production Deployment

### Continuous Integration (GitHub Actions)
Every push or pull request to `main` executes [`.github/workflows/ci.yml`](file:///c:/Users/adina/Desktop/project2/.github/workflows/ci.yml):
* **Backend Job**: Syntax verification and module import tests on Python 3.11.
* **Frontend Job**: TypeScript type checks (`tsc --noEmit`) and Vite production bundle compilation.
* **Docker Job**: End-to-end container build verification across all compose services.

### Single-Host Deployment (Amazon EC2)
The containerized configuration permits deployment to an Amazon EC2 instance (Ubuntu 24.04 LTS, `t3.small` or Free Tier `t2.micro`):

```bash
# Prepare the EC2 instance
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER && newgrp docker

# Clone repository and deploy
git clone https://github.com/Adii22-22/Verifi-AI.git
cd Verifi-AI
nano Backend/.env   # Configure production keys
docker compose up -d --build
```

This deployment architecture provides 24/7 uptime without cold start delays, encapsulates Redis on the local loopback interface, and unifies routing through Nginx.

---

## License

This project is licensed under the MIT License.