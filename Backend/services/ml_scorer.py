"""
Verifi.ai — ML Scorer Module
Loads the pre-trained TF-IDF + SGD model and scores incoming text.

Usage:
    from services.ml_scorer import get_ml_score
    score = get_ml_score("Some news text here")
    # Returns: {"ml_score": 72, "ml_label": "REAL", "ml_confidence": 0.72, "top_signals": [...]}
"""

import pickle
import logging
import numpy as np
from pathlib import Path

logger = logging.getLogger(__name__)

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
VECTORIZER_PATH = BASE_DIR / "ml_artifacts" / "tfidf_vectorizer.pkl"
MODEL_PATH = BASE_DIR / "ml_artifacts" / "sgd_classifier.pkl"

# ─── Global model cache (loaded once on first call) ──────────────────────────
_vectorizer = None
_model = None
_loaded = False


def _load_model():
    """Load model artifacts from disk. Called once on first request."""
    global _vectorizer, _model, _loaded

    if _loaded:
        return

    if not VECTORIZER_PATH.exists() or not MODEL_PATH.exists():
        logger.warning("ML model not found. Run 'python -m services.train_model' first.")
        _loaded = True  # Don't retry every request
        return

    try:
        with open(VECTORIZER_PATH, "rb") as f:
            _vectorizer = pickle.load(f)
        with open(MODEL_PATH, "rb") as f:
            _model = pickle.load(f)
        logger.info("ML model loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load ML model: {e}")

    _loaded = True


def get_ml_score(text: str) -> dict:
    """
    Score a piece of text using the local ML model.

    Returns:
        {
            "ml_score": int (0-100, higher = more likely real/credible),
            "ml_label": "REAL" or "FAKE",
            "ml_confidence": float (0.0 - 1.0),
            "top_signals": list of top 5 words that influenced the decision
        }
    """
    _load_model()

    # If model not available, return neutral score
    if _vectorizer is None or _model is None:
        return {
            "ml_score": 50,
            "ml_label": "UNKNOWN",
            "ml_confidence": 0.0,
            "top_signals": [],
        }

    try:
        # Vectorize the input text
        X = _vectorizer.transform([text])

        # Get probability scores
        probas = _model.predict_proba(X)[0]
        # probas[0] = P(FAKE), probas[1] = P(REAL)
        real_prob = float(probas[1])
        fake_prob = float(probas[0])

        # Convert to 0-100 score (higher = more credible)
        ml_score = int(round(real_prob * 100))
        ml_label = "REAL" if real_prob >= 0.5 else "FAKE"
        ml_confidence = float(max(real_prob, fake_prob))

        # Extract top signals (which words influenced the decision most)
        feature_names = _vectorizer.get_feature_names_out()
        coefs = _model.coef_[0]

        # Get the TF-IDF values for this specific text
        tfidf_values = X.toarray()[0]
        # Multiply by model coefficients to get per-feature contribution
        contributions = tfidf_values * coefs

        # Get top 5 most influential features (positive = real, negative = fake)
        top_indices = np.argsort(np.abs(contributions))[-5:][::-1]
        top_signals = []
        for idx in top_indices:
            if tfidf_values[idx] > 0:  # Only include words actually in the text
                word = feature_names[idx]
                weight = float(contributions[idx])
                direction = "credible" if weight > 0 else "suspicious"
                top_signals.append({
                    "word": word,
                    "weight": round(abs(weight), 4),
                    "direction": direction,
                })

        return {
            "ml_score": ml_score,
            "ml_label": ml_label,
            "ml_confidence": round(ml_confidence, 4),
            "top_signals": top_signals[:5],
        }

    except Exception as e:
        logger.error(f"ML scoring failed: {e}")
        return {
            "ml_score": 50,
            "ml_label": "UNKNOWN",
            "ml_confidence": 0.0,
            "top_signals": [],
        }
