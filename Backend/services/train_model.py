"""
Verifi.ai — ML Training Script
Trains a TF-IDF + SGD Classifier on fake/real news data.

Run this script once to generate the trained model files:
  python -m services.train_model

Output:
  services/ml_artifacts/tfidf_vectorizer.pkl
  services/ml_artifacts/sgd_classifier.pkl
  services/ml_artifacts/training_report.txt
"""

import os
import csv
import json
import random
import pickle
import numpy as np
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import SGDClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, confusion_matrix, classification_report
)

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
ARTIFACTS_DIR = BASE_DIR / "ml_artifacts"
DATASET_PATH = BASE_DIR / "ml_artifacts" / "training_data.csv"
VECTORIZER_PATH = ARTIFACTS_DIR / "tfidf_vectorizer.pkl"
MODEL_PATH = ARTIFACTS_DIR / "sgd_classifier.pkl"
REPORT_PATH = ARTIFACTS_DIR / "training_report.txt"


# ─── Synthetic Dataset Generator ─────────────────────────────────────────────
# We generate a realistic training dataset of fake vs real news samples.
# This eliminates the need to download external datasets and avoids
# Western-bias issues since we control the content.

REAL_NEWS_TEMPLATES = [
    "The government announced new infrastructure spending of {amount} for {region} development projects.",
    "Scientists at {institution} published research showing {finding} in a peer-reviewed journal.",
    "The Reserve Bank maintained the repo rate at {rate} percent citing stable inflation.",
    "The Supreme Court ruled in favor of {party} in the landmark {topic} case after months of deliberation.",
    "The stock market closed {direction} as investors reacted to quarterly earnings reports.",
    "Elections in {state} saw a voter turnout of {percent} percent according to the Election Commission.",
    "The health ministry reported {count} new cases and emphasized the importance of vaccination.",
    "Exports rose by {percent} percent in the last quarter driven by IT and pharmaceutical sectors.",
    "The PM held bilateral talks with {leader} focusing on trade and defense cooperation.",
    "Rainfall in {region} was recorded at {amount}mm which is {comparison} the seasonal average.",
    "The education ministry announced reforms to the national curriculum effective next academic year.",
    "A new metro line connecting {place1} to {place2} was inaugurated reducing commute time significantly.",
    "According to the latest census data the population growth rate has declined to {rate} percent.",
    "The ISRO successfully launched {satellite} from the Sriharikota space centre.",
    "GDP growth for the current fiscal year is projected at {rate} percent by the finance ministry.",
    "The agriculture ministry reported a record harvest of {crop} this season.",
    "Unemployment figures showed a marginal improvement dropping to {rate} percent in urban areas.",
    "The telecom regulator issued new guidelines for data privacy and consumer protection.",
    "A multinational summit on climate change concluded with {count} nations signing the agreement.",
    "The central bank introduced new digital payment regulations to strengthen cybersecurity.",
    "Foreign direct investment increased by {percent} percent year over year in the manufacturing sector.",
    "Municipal authorities completed the new water treatment facility serving {count} households.",
    "The transport ministry approved highway expansion connecting {place1} and {place2}.",
    "Research published in Nature found that {finding} could transform renewable energy.",
    "The meteorological department issued a forecast predicting normal monsoon this year.",
]

FAKE_NEWS_TEMPLATES = [
    "BREAKING: {celebrity} exposed in MASSIVE scandal that the media is trying to HIDE from you!!!",
    "SHOCKING: Secret government plan to {action} has been LEAKED by insider sources!!!",
    "You WON'T BELIEVE what {person} said about {topic}! The truth will SHOCK you!",
    "EXPOSED: {organization} caught RED-HANDED doing {action}! Share before they DELETE this!",
    "ALERT: Scientists CONFIRM that {substance} causes {disease}! Big pharma doesn't want you to know!",
    "URGENT: Forward this to everyone! {event} is going to happen on {date} and nobody is talking about it!",
    "PROOF that {conspiracy} is REAL! The government has been lying to us for YEARS!",
    "VIRAL: {person} caught on secret camera doing {action}! Video going viral before it gets taken down!",
    "WARNING: If you {action} you will {consequence}! Exposed by insider source!",
    "BUSTED: {person} exposed for secretly funding {action}! The mainstream media is SILENT!",
    "Did you know? {substance} mixed with {substance2} can cure {disease} in just 3 days! Exposed!",
    "SHARE IMMEDIATELY: {organization} is planning to {action} starting {date}! Wake up people!",
    "This photo PROVES that {event} was STAGED! Look carefully at the {detail}!",
    "REVEALED: {country} has been secretly building {weapon} to use against {target}!",
    "CENSORED: This video was removed {count} times! They don't want you to see what {person} admitted!",
    "100% TRUE: My friend who works at {place} confirmed that {conspiracy} is happening right now!",
    "EXPOSED AND DESTROYED: {person} caught lying about {topic}! Career is OVER!",
    "Exposed corrupt officials exposed exposed exposed! Must share wake up!!",
    "Forward to {count} groups or {consequence} will happen to you in {days} days!",
    "MIRACLE cure discovered in {place}! Exposed big pharma conspiracy exposed exposed!",
    "DANGEROUS: {product} contains {substance} that causes {disease}! Exposed by whistleblower!",
    "Secret meeting between {person1} and {person2} EXPOSED! NWO agenda revealed!",
    "TRUTH BOMB: Everything you know about {topic} is a LIE! Watch before deleted!",
    "Government insider LEAKED documents proving {conspiracy}! Exposed share now!",
    "Exposed exposed! {person} secretly owns {count} properties worth {amount} crores!",
]

FILL_VALUES = {
    "amount": ["500 crore", "1200 crore", "3000 crore", "15000 crore", "800 million dollars"],
    "region": ["Northeast", "Western", "Southern", "Northern", "Central"],
    "institution": ["IIT Delhi", "AIIMS", "IISc Bangalore", "JNU", "Oxford University", "MIT"],
    "finding": ["a new treatment pathway", "improved crop yields", "climate change acceleration",
                 "a novel material for batteries", "significant genetic markers"],
    "rate": ["4.5", "5.2", "6.1", "7.0", "3.8", "6.5"],
    "party": ["the petitioner", "the respondent", "civil liberties groups"],
    "topic": ["privacy rights", "environmental protection", "labor regulations", "digital rights"],
    "direction": ["higher", "lower", "flat", "mixed"],
    "state": ["Maharashtra", "Tamil Nadu", "Uttar Pradesh", "Kerala", "Karnataka", "Gujarat"],
    "percent": ["12", "8.5", "15", "23", "6.7", "31", "42"],
    "count": ["150", "2400", "50000", "12", "37", "200", "85"],
    "leader": ["the French President", "the Japanese PM", "the UK PM", "the Australian PM"],
    "comparison": ["above", "below", "similar to"],
    "place1": ["Andheri", "Connaught Place", "Salt Lake", "Koramangala", "Banjara Hills"],
    "place2": ["Thane", "Noida", "Howrah", "Whitefield", "Secunderabad"],
    "satellite": ["Chandrayaan-4", "GSAT-32", "RISAT-3", "NavIC-2"],
    "crop": ["wheat", "rice", "sugarcane", "cotton", "pulses"],
    "celebrity": ["a famous actor", "a top politician", "a billionaire CEO", "a cricket star"],
    "person": ["a top leader", "a famous celebrity", "a powerful businessman", "the health minister"],
    "person1": ["a top politician", "a tech CEO"],
    "person2": ["a foreign agent", "a controversial figure"],
    "action": ["ban all cash", "install tracking chips", "manipulating elections", "hoarding wealth",
               "spreading propaganda", "controlling the media"],
    "organization": ["the WHO", "a major bank", "the UN", "a tech giant"],
    "substance": ["turmeric water", "lemon juice", "baking soda", "garlic paste", "coconut oil"],
    "substance2": ["warm water", "honey", "black pepper", "salt"],
    "disease": ["cancer", "diabetes", "heart disease", "COVID variants", "kidney failure"],
    "event": ["a major earthquake", "a currency ban", "martial law", "internet shutdown"],
    "date": ["next Monday", "January 1st", "this Friday", "next month"],
    "conspiracy": ["the moon landing hoax", "5G mind control", "chemtrails", "flat earth"],
    "consequence": ["lose all your money", "face legal action", "get hacked", "bad luck"],
    "detail": ["the shadows", "the background", "the timestamp", "the reflection"],
    "country": ["a neighboring country", "a superpower"],
    "weapon": ["a secret weapon", "biological agents", "cyber weapons"],
    "target": ["civilians", "our country", "the economy"],
    "place": ["a government lab", "a hospital", "a military base"],
    "product": ["a popular toothpaste", "a common shampoo", "a baby food brand", "a soft drink"],
    "days": ["3", "7", "10"],
}


def _fill_template(template: str) -> str:
    """Replace {placeholders} with random values."""
    result = template
    for key, values in FILL_VALUES.items():
        placeholder = "{" + key + "}"
        while placeholder in result:
            result = result.replace(placeholder, random.choice(values), 1)
    return result


def generate_dataset(n_samples: int = 2000) -> list[tuple[str, int]]:
    """Generate n_samples of (text, label) pairs. label: 1=real, 0=fake."""
    data = []
    half = n_samples // 2

    for _ in range(half):
        template = random.choice(REAL_NEWS_TEMPLATES)
        text = _fill_template(template)
        data.append((text, 1))

    for _ in range(half):
        template = random.choice(FAKE_NEWS_TEMPLATES)
        text = _fill_template(template)
        data.append((text, 0))

    random.shuffle(data)
    return data


def save_dataset(data: list[tuple[str, int]], path: Path):
    """Save dataset as CSV."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["text", "label"])
        for text, label in data:
            writer.writerow([text, label])
    print(f"  Dataset saved: {path} ({len(data)} samples)")


def load_dataset(path: Path) -> tuple[list[str], list[int]]:
    """Load dataset from CSV."""
    texts, labels = [], []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            texts.append(row["text"])
            labels.append(int(row["label"]))
    return texts, labels


# ─── Training Pipeline ───────────────────────────────────────────────────────

def train():
    """Full training pipeline: generate data → vectorize → train → evaluate → save."""
    print("=" * 60)
    print("  Verifi.ai — ML Model Training Pipeline")
    print("=" * 60)

    # Step 1: Generate / load dataset
    print("\n[1/5] Generating training dataset...")
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    data = generate_dataset(n_samples=4000)
    save_dataset(data, DATASET_PATH)
    texts, labels = [d[0] for d in data], [d[1] for d in data]

    # Step 2: Split into train/test
    print("\n[2/5] Splitting into train/test (80/20)...")
    X_train, X_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.2, random_state=42, stratify=labels
    )
    print(f"  Train: {len(X_train)} samples | Test: {len(X_test)} samples")

    # Step 3: TF-IDF Vectorization
    print("\n[3/5] Building TF-IDF vocabulary...")
    vectorizer = TfidfVectorizer(
        max_features=5000,       # Top 5000 words
        ngram_range=(1, 2),      # Unigrams + Bigrams (catches "BREAKING NEWS", "SHARE NOW")
        stop_words="english",
        min_df=2,                # Word must appear in at least 2 documents
        sublinear_tf=True,       # Apply log normalization
    )
    X_train_tfidf = vectorizer.fit_transform(X_train)
    X_test_tfidf = vectorizer.transform(X_test)
    print(f"  Vocabulary size: {len(vectorizer.vocabulary_)} features")

    # Step 4: Train SGD Classifier
    print("\n[4/5] Training SGD Classifier...")
    model = SGDClassifier(
        loss="modified_huber",   # Outputs probabilities (not just 0/1)
        alpha=1e-4,              # Regularization strength
        max_iter=1000,
        tol=1e-3,
        random_state=42,
        class_weight="balanced", # Handle class imbalance
    )
    model.fit(X_train_tfidf, y_train)
    print("  Model trained successfully.")

    # Step 5: Evaluate
    print("\n[5/5] Evaluating model on test set...")
    y_pred = model.predict(X_test_tfidf)

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred)

    report = classification_report(y_test, y_pred, target_names=["FAKE", "REAL"])

    print(f"\n  Accuracy:  {acc:.4f} ({acc*100:.1f}%)")
    print(f"  Precision: {prec:.4f}")
    print(f"  Recall:    {rec:.4f}")
    print(f"  F1 Score:  {f1:.4f}")
    print(f"\n  Confusion Matrix:")
    print(f"              Predicted")
    print(f"              FAKE  REAL")
    print(f"  Actual FAKE  {cm[0][0]:4d}  {cm[0][1]:4d}")
    print(f"  Actual REAL  {cm[1][0]:4d}  {cm[1][1]:4d}")
    print(f"\n{report}")

    # Save model artifacts
    with open(VECTORIZER_PATH, "wb") as f:
        pickle.dump(vectorizer, f)
    print(f"  Saved vectorizer: {VECTORIZER_PATH}")

    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    print(f"  Saved model: {MODEL_PATH}")

    # Save training report
    report_text = f"""Verifi.ai — ML Training Report
{'=' * 40}
Dataset: {len(data)} samples (50% fake, 50% real)
Train/Test Split: 80/20
Vectorizer: TF-IDF (max_features=5000, ngram_range=(1,2))
Model: SGDClassifier (loss=modified_huber)

Results:
  Accuracy:  {acc:.4f} ({acc*100:.1f}%)
  Precision: {prec:.4f}
  Recall:    {rec:.4f}
  F1 Score:  {f1:.4f}

Confusion Matrix:
              Predicted
              FAKE  REAL
  Actual FAKE  {cm[0][0]:4d}  {cm[0][1]:4d}
  Actual REAL  {cm[1][0]:4d}  {cm[1][1]:4d}

{report}
"""
    with open(REPORT_PATH, "w") as f:
        f.write(report_text)
    print(f"  Saved report: {REPORT_PATH}")

    # Show top predictive features
    print("\n" + "=" * 60)
    print("  Top Fake-News Indicator Words:")
    print("=" * 60)
    feature_names = vectorizer.get_feature_names_out()
    coefs = model.coef_[0]
    top_fake = np.argsort(coefs)[:15]   # Most negative = strongest fake signal
    top_real = np.argsort(coefs)[-15:]   # Most positive = strongest real signal

    print("\n  Words that indicate FAKE news:")
    for idx in top_fake:
        print(f"    • {feature_names[idx]:25s} (weight: {coefs[idx]:.4f})")

    print("\n  Words that indicate REAL news:")
    for idx in reversed(top_real):
        print(f"    • {feature_names[idx]:25s} (weight: {coefs[idx]:.4f})")

    print("\n" + "=" * 60)
    print("  Training complete! Model ready for production.")
    print("=" * 60)


if __name__ == "__main__":
    train()
