# Setup Instructions

This guide will help you set up and run the full stack of **Verifi.ai**, including the backend, frontend, and Chrome extension.

## Prerequisites

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **Python** (v3.11 or higher recommended) - [Download here](https://www.python.org/downloads/)
- **PostgreSQL** running locally (or hosted)

## 1. Backend Setup (FastAPI + Python)

1. **Navigate to the backend directory:**
   ```bash
   cd Backend
   ```

2. **Create and activate a virtual environment (recommended):**
   - **Windows:**
     ```bash
     python -m venv .venv
     .venv\Scripts\activate
     ```
   - **macOS/Linux:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Create a `.env` file in the `Backend` directory:**
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL_NAME=gemini-2.5-flash
   DATABASE_URL=postgresql://postgres:password@localhost:5432/verifi_ai
   JWT_SECRET=your_secret_key_here
   JWT_ALGORITHM=HS256
   JWT_EXPIRE_MINUTES=10080
   ```
   *Get your Gemini API key from: [Google AI Studio](https://aistudio.google.com/app/apikey)*

5. **Train the local ML Model (One-time setup):**
   ```bash
   python -m services.train_model
   ```
   *This downloads the fake news dataset, trains the local classifier, and saves the `.pkl` models to `services/ml_artifacts/`.*

6. **Run the backend server:**
   ```bash
   uvicorn src.api:app --reload
   ```
   The backend API will be available at: `http://localhost:8000`

## 2. Frontend Setup (React/TypeScript/Vite)

1. **Navigate to the Frontend directory:**
   ```bash
   cd Frontend
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Create a `.env` file in the `Frontend` directory (optional):**
   ```env
   VITE_API_URL=http://localhost:8000
   ```
   *Note: It defaults to `http://localhost:8000` if not provided.*

4. **Run the developer server:**
   ```bash
   npm run dev
   ```
   The frontend UI will be available at: `http://localhost:5173`

## 3. Chrome Extension Setup

1. Open Chrome and go to `chrome://extensions/`
2. Turn on **Developer mode** (toggle in the top right corner).
3. Click on **Load unpacked**.
4. Select the `extension` folder from this repository.
5. The Verifi.ai extension icon will now appear in your browser, providing a floating analysis panel on any webpage.

## How to Test the Entire Flow

1. **Terminal 1:** Run backend (`uvicorn src.api:app --reload` inside `Backend/`)
2. **Terminal 2:** Run frontend (`npm run dev` inside `Frontend/`)
3. Open `http://localhost:5173` in your browser.
4. Click **Login** / **Register** to create an account.
5. Analyze a piece of text or URL in the main search bar. Note the explanation given by the dual ensemble models.
6. Check your history at `/history` or via the top nav.
7. Click the Chrome Extension, log in there (it syncs automatically if you log into the web app in the same browser session using `chrome.storage`), and analyze any text on any third-party page.
