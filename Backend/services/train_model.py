"""
╔══════════════════════════════════════════════════════════════════════════════╗
║        Verifi.ai — Fake News Classifier: Training Pipeline                   ║
║                                                                              ║
║  A complete ML pipeline that downloads a real dataset, performs EDA,         ║
║  trains multiple classifiers, evaluates them with proper metrics,            ║
║  and generates all standard ML visualizations.                               ║
║                                                                              ║
║  Run:  python -m services.train_model                                        ║
║  Output: services/ml_artifacts/  (model, plots, report)                      ║
╚══════════════════════════════════════════════════════════════════════════════╝

This script can also be opened in VS Code as an "Interactive Python" file
(each # %% block becomes a notebook cell) or copied into Jupyter Notebook.
"""

# %% [markdown]
# # Verifi.ai — Fake News Detection Model
# ## 1. Setup & Imports

# %%
import os
import csv
import pickle
import logging
import urllib.request
import zipfile
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend (no GUI needed)
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
from collections import Counter

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import SGDClassifier, LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.model_selection import (
    train_test_split, cross_val_score, learning_curve
)
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report,
    roc_curve, auc, precision_recall_curve, average_precision_score,
    ConfusionMatrixDisplay, RocCurveDisplay, PrecisionRecallDisplay
)
from sklearn.pipeline import Pipeline

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("train")

# Paths
BASE = Path(__file__).parent
ARTIFACTS = BASE / "ml_artifacts"
DATASET_DIR = ARTIFACTS / "dataset"
PLOTS_DIR = ARTIFACTS / "plots"

# Create directories
ARTIFACTS.mkdir(parents=True, exist_ok=True)
DATASET_DIR.mkdir(parents=True, exist_ok=True)
PLOTS_DIR.mkdir(parents=True, exist_ok=True)

# Plot style
sns.set_theme(style="whitegrid", palette="muted", font_scale=1.1)
plt.rcParams["figure.figsize"] = (10, 6)
plt.rcParams["figure.dpi"] = 150

# %% [markdown]
# ## 2. Dataset Acquisition
# We use the **WELFake** dataset (72,134 articles) or fall back to the
# **ISOT Fake News** dataset format. The dataset contains real and fake
# news articles with title + text.

# %%
DATASET_CSV = DATASET_DIR / "fake_news_dataset.csv"

# Several publicly available fake news datasets (direct download links)
DATASET_URLS = [
    # George McIntire's Fake News Corpus (GitHub - direct CSV)
    "https://raw.githubusercontent.com/lutzhamel/fake-news/master/data/fake_or_real_news.csv",
]


def download_dataset():
    """Download a real fake news dataset from the internet."""
    if DATASET_CSV.exists():
        log.info(f"  Dataset already exists: {DATASET_CSV}")
        return True

    for url in DATASET_URLS:
        try:
            log.info(f"  Downloading dataset from:\n    {url}")
            urllib.request.urlretrieve(url, DATASET_CSV)
            # Verify it's a valid CSV
            df = pd.read_csv(DATASET_CSV, nrows=5)
            if len(df) > 0:
                log.info(f"  Downloaded successfully!")
                return True
        except Exception as e:
            log.warning(f"  Download failed: {e}")
            if DATASET_CSV.exists():
                DATASET_CSV.unlink()

    return False


def load_dataset() -> pd.DataFrame:
    """
    Load the dataset into a DataFrame with columns: [text, label]
    label: 1 = REAL, 0 = FAKE
    """
    if not DATASET_CSV.exists():
        raise FileNotFoundError(
            f"Dataset not found at {DATASET_CSV}.\n"
            "Please download a fake news CSV dataset and place it there.\n"
            "Recommended: https://www.kaggle.com/datasets/clmentbisaillon/fake-and-real-news-dataset"
        )

    df = pd.read_csv(DATASET_CSV)

    # Auto-detect column format
    cols_lower = {c.lower(): c for c in df.columns}
    log.info(f"  Columns found: {list(df.columns)}")

    # This dataset has: id, title, text, label (FAKE/REAL)
    if "label" in cols_lower:
        label_col = cols_lower["label"]

        # Combine title + text for richer features (if both exist)
        if "title" in cols_lower and "text" in cols_lower:
            title_col = cols_lower["title"]
            text_col = cols_lower["text"]
            df["combined_text"] = df[title_col].fillna("").astype(str) + " " + df[text_col].fillna("").astype(str)
            df = df[["combined_text", label_col]].copy()
            df.columns = ["text", "label"]
        elif "text" in cols_lower:
            text_col = cols_lower["text"]
            df = df[[text_col, label_col]].copy()
            df.columns = ["text", "label"]
        elif "title" in cols_lower:
            title_col = cols_lower["title"]
            df = df[[title_col, label_col]].copy()
            df.columns = ["text", "label"]
        else:
            raise ValueError("Could not find 'text' or 'title' column in dataset")

        # Convert string labels to int
        if not pd.api.types.is_numeric_dtype(df["label"]):
            label_map = {"fake": 0, "real": 1, "FAKE": 0, "REAL": 1,
                         "Fake": 0, "Real": 1, "0": 0, "1": 1}
            df["label"] = df["label"].map(label_map)
            # Drop rows with unmapped labels
            df = df.dropna(subset=["label"])

    else:
        raise ValueError(f"No 'label' column found. Columns: {list(df.columns)}")

    # Clean up
    df = df.dropna(subset=["text", "label"])
    df["label"] = df["label"].astype(int)
    df["text"] = df["text"].astype(str)

    # Remove very short texts (less than 20 chars)
    df = df[df["text"].str.len() >= 20]

    return df.reset_index(drop=True)


# %% [markdown]
# ## 3. Exploratory Data Analysis (EDA)

# %%
def run_eda(df: pd.DataFrame):
    """Generate EDA visualizations and statistics."""
    log.info("\n" + "=" * 60)
    log.info("  EXPLORATORY DATA ANALYSIS")
    log.info("=" * 60)

    log.info(f"\n  Total samples:    {len(df):,}")
    log.info(f"  Real news:        {(df['label'] == 1).sum():,}")
    log.info(f"  Fake news:        {(df['label'] == 0).sum():,}")
    log.info(f"  Class balance:    {(df['label'] == 1).mean():.1%} Real / {(df['label'] == 0).mean():.1%} Fake")

    # --- Plot 1: Class Distribution ---
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # Bar chart
    counts = df["label"].value_counts().sort_index()
    colors = ["#ef4444", "#22c55e"]
    labels_map = {0: "FAKE", 1: "REAL"}
    bars = axes[0].bar(
        [labels_map[i] for i in counts.index], counts.values,
        color=colors, edgecolor="white", linewidth=2, width=0.5
    )
    for bar, val in zip(bars, counts.values):
        axes[0].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 50,
                     f"{val:,}", ha="center", fontweight="bold", fontsize=12)
    axes[0].set_title("Class Distribution", fontweight="bold", fontsize=14)
    axes[0].set_ylabel("Number of Articles")

    # Pie chart
    axes[1].pie(counts.values, labels=[labels_map[i] for i in counts.index],
                colors=colors, autopct="%1.1f%%", startangle=90,
                textprops={"fontweight": "bold", "fontsize": 12})
    axes[1].set_title("Class Proportion", fontweight="bold", fontsize=14)

    plt.tight_layout()
    plt.savefig(PLOTS_DIR / "01_class_distribution.png", bbox_inches="tight")
    plt.close()
    log.info("  Saved: 01_class_distribution.png")

    # --- Plot 2: Text Length Distribution ---
    df["text_length"] = df["text"].str.len()
    df["word_count"] = df["text"].str.split().str.len()

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    for label, color, name in [(0, "#ef4444", "FAKE"), (1, "#22c55e", "REAL")]:
        subset = df[df["label"] == label]
        axes[0].hist(subset["text_length"], bins=50, alpha=0.6, color=color,
                     label=name, edgecolor="white")
        axes[1].hist(subset["word_count"], bins=50, alpha=0.6, color=color,
                     label=name, edgecolor="white")

    axes[0].set_title("Character Length Distribution", fontweight="bold")
    axes[0].set_xlabel("Character Length")
    axes[0].set_ylabel("Frequency")
    axes[0].legend()
    axes[0].set_xlim(0, df["text_length"].quantile(0.95))

    axes[1].set_title("Word Count Distribution", fontweight="bold")
    axes[1].set_xlabel("Word Count")
    axes[1].set_ylabel("Frequency")
    axes[1].legend()
    axes[1].set_xlim(0, df["word_count"].quantile(0.95))

    plt.tight_layout()
    plt.savefig(PLOTS_DIR / "02_text_length_distribution.png", bbox_inches="tight")
    plt.close()
    log.info("  Saved: 02_text_length_distribution.png")

    # Print stats
    log.info(f"\n  Avg text length (REAL):  {df[df['label']==1]['text_length'].mean():.0f} chars")
    log.info(f"  Avg text length (FAKE):  {df[df['label']==0]['text_length'].mean():.0f} chars")
    log.info(f"  Avg word count (REAL):   {df[df['label']==1]['word_count'].mean():.0f} words")
    log.info(f"  Avg word count (FAKE):   {df[df['label']==0]['word_count'].mean():.0f} words")

    # --- Plot 3: Word Clouds ---
    try:
        from wordcloud import WordCloud

        fig, axes = plt.subplots(1, 2, figsize=(16, 6))

        for ax, label, title, cmap in [
            (axes[0], 0, "Most Common Words in FAKE News", "Reds"),
            (axes[1], 1, "Most Common Words in REAL News", "Greens")
        ]:
            text = " ".join(df[df["label"] == label]["text"].str.lower().values[:2000])
            wc = WordCloud(
                width=800, height=400, max_words=100,
                background_color="white", colormap=cmap,
                stopwords=set(["said", "would", "could", "also", "one", "new", "us", "like"])
            ).generate(text)
            ax.imshow(wc, interpolation="bilinear")
            ax.set_title(title, fontweight="bold", fontsize=13)
            ax.axis("off")

        plt.tight_layout()
        plt.savefig(PLOTS_DIR / "03_word_clouds.png", bbox_inches="tight")
        plt.close()
        log.info("  Saved: 03_word_clouds.png")
    except ImportError:
        log.warning("  wordcloud not installed — skipping word clouds")

    return df


# %% [markdown]
# ## 4. Text Preprocessing & Feature Engineering

# %%
def preprocess_and_split(df: pd.DataFrame):
    """Preprocess text and split into train/test sets."""
    log.info("\n" + "=" * 60)
    log.info("  TEXT PREPROCESSING & FEATURE ENGINEERING")
    log.info("=" * 60)

    X = df["text"].values
    y = df["label"].values

    # Train/Test split (80/20, stratified)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    log.info(f"\n  Train set: {len(X_train):,} samples")
    log.info(f"  Test set:  {len(X_test):,} samples")

    # TF-IDF Vectorization
    log.info("\n  Building TF-IDF vocabulary...")
    vectorizer = TfidfVectorizer(
        max_features=10000,        # Top 10,000 features
        ngram_range=(1, 2),        # Unigrams + Bigrams
        stop_words="english",
        min_df=3,                  # Must appear in ≥3 documents
        max_df=0.95,               # Ignore terms in >95% of docs
        sublinear_tf=True,         # Apply log normalization
        strip_accents="unicode",
    )
    X_train_tfidf = vectorizer.fit_transform(X_train)
    X_test_tfidf = vectorizer.transform(X_test)

    log.info(f"  Vocabulary size: {len(vectorizer.vocabulary_):,} features")
    log.info(f"  TF-IDF matrix (train): {X_train_tfidf.shape}")
    log.info(f"  TF-IDF matrix (test):  {X_test_tfidf.shape}")

    return vectorizer, X_train_tfidf, X_test_tfidf, y_train, y_test


# %% [markdown]
# ## 5. Model Training & Comparison

# %%
def train_models(X_train, X_test, y_train, y_test):
    """Train multiple classifiers and compare their performance."""
    log.info("\n" + "=" * 60)
    log.info("  MODEL TRAINING & COMPARISON")
    log.info("=" * 60)

    models = {
        "SGD Classifier": SGDClassifier(
            loss="modified_huber",     # Outputs probability estimates
            alpha=1e-4,
            max_iter=1000,
            tol=1e-3,
            random_state=42,
            class_weight="balanced",
            penalty="l2",
        ),
        "Multinomial NB": MultinomialNB(alpha=0.1),
        "Logistic Regression": LogisticRegression(
            max_iter=1000,
            random_state=42,
            class_weight="balanced",
            C=1.0,
        ),
    }

    results = {}
    best_model = None
    best_score = 0.0

    for name, model in models.items():
        log.info(f"\n  Training {name}...")
        model.fit(X_train, y_train)

        # Predictions
        y_pred = model.predict(X_test)
        y_proba = model.predict_proba(X_test)[:, 1] if hasattr(model, "predict_proba") else None

        # Metrics
        acc = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred)
        rec = recall_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)

        # Cross-validation (5-fold)
        cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring="f1")

        results[name] = {
            "model": model,
            "accuracy": acc,
            "precision": prec,
            "recall": rec,
            "f1": f1,
            "cv_mean": cv_scores.mean(),
            "cv_std": cv_scores.std(),
            "y_pred": y_pred,
            "y_proba": y_proba,
        }

        log.info(f"    Accuracy:    {acc:.4f} ({acc*100:.1f}%)")
        log.info(f"    Precision:   {prec:.4f}")
        log.info(f"    Recall:      {rec:.4f}")
        log.info(f"    F1 Score:    {f1:.4f}")
        log.info(f"    CV F1 (5-fold): {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

        if f1 > best_score:
            best_score = f1
            best_model = name

    log.info(f"\n  ★ Best Model: {best_model} (F1 = {best_score:.4f})")

    # --- Plot 4: Model Comparison Bar Chart ---
    model_names = list(results.keys())
    metrics = ["accuracy", "precision", "recall", "f1"]
    metric_labels = ["Accuracy", "Precision", "Recall", "F1 Score"]

    fig, ax = plt.subplots(figsize=(12, 6))
    x = np.arange(len(model_names))
    width = 0.2
    colors = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444"]

    for i, (metric, label, color) in enumerate(zip(metrics, metric_labels, colors)):
        values = [results[m][metric] for m in model_names]
        bars = ax.bar(x + i * width, values, width, label=label, color=color, edgecolor="white")
        for bar, val in zip(bars, values):
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.005,
                    f"{val:.3f}", ha="center", fontsize=8, fontweight="bold")

    ax.set_xlabel("Model")
    ax.set_ylabel("Score")
    ax.set_title("Model Comparison — All Metrics", fontweight="bold", fontsize=14)
    ax.set_xticks(x + width * 1.5)
    ax.set_xticklabels(model_names)
    ax.legend(loc="lower right")
    ax.set_ylim(0, 1.08)
    ax.grid(axis="y", alpha=0.3)

    plt.tight_layout()
    plt.savefig(PLOTS_DIR / "04_model_comparison.png", bbox_inches="tight")
    plt.close()
    log.info("  Saved: 04_model_comparison.png")

    return results, best_model


# %% [markdown]
# ## 6. Detailed Evaluation of Best Model

# %%
def evaluate_best_model(results, best_model_name, y_test):
    """Generate detailed evaluation plots for the best model."""
    log.info("\n" + "=" * 60)
    log.info(f"  DETAILED EVALUATION: {best_model_name}")
    log.info("=" * 60)

    r = results[best_model_name]
    y_pred = r["y_pred"]
    y_proba = r["y_proba"]

    # --- Classification Report ---
    report = classification_report(y_test, y_pred, target_names=["FAKE", "REAL"])
    log.info(f"\n{report}")

    # --- Plot 5: Confusion Matrix ---
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    cm = confusion_matrix(y_test, y_pred)
    disp = ConfusionMatrixDisplay(cm, display_labels=["FAKE", "REAL"])
    disp.plot(ax=axes[0], cmap="Blues", values_format="d")
    axes[0].set_title("Confusion Matrix (Counts)", fontweight="bold", fontsize=13)

    # Normalized confusion matrix
    cm_norm = confusion_matrix(y_test, y_pred, normalize="true")
    disp2 = ConfusionMatrixDisplay(cm_norm, display_labels=["FAKE", "REAL"])
    disp2.plot(ax=axes[1], cmap="Greens", values_format=".2%")
    axes[1].set_title("Confusion Matrix (Normalized)", fontweight="bold", fontsize=13)

    plt.tight_layout()
    plt.savefig(PLOTS_DIR / "05_confusion_matrix.png", bbox_inches="tight")
    plt.close()
    log.info("  Saved: 05_confusion_matrix.png")

    if y_proba is not None:
        # --- Plot 6: ROC Curve ---
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))

        fpr, tpr, _ = roc_curve(y_test, y_proba)
        roc_auc = auc(fpr, tpr)
        axes[0].plot(fpr, tpr, color="#3b82f6", lw=2.5, label=f"ROC (AUC = {roc_auc:.4f})")
        axes[0].plot([0, 1], [0, 1], "k--", alpha=0.3, label="Random Baseline")
        axes[0].fill_between(fpr, tpr, alpha=0.1, color="#3b82f6")
        axes[0].set_xlabel("False Positive Rate")
        axes[0].set_ylabel("True Positive Rate")
        axes[0].set_title(f"ROC Curve (AUC = {roc_auc:.4f})", fontweight="bold", fontsize=13)
        axes[0].legend(loc="lower right")
        axes[0].grid(alpha=0.3)

        # --- Precision-Recall Curve ---
        precision_vals, recall_vals, _ = precision_recall_curve(y_test, y_proba)
        avg_prec = average_precision_score(y_test, y_proba)
        axes[1].plot(recall_vals, precision_vals, color="#22c55e", lw=2.5,
                     label=f"PR (AP = {avg_prec:.4f})")
        axes[1].fill_between(recall_vals, precision_vals, alpha=0.1, color="#22c55e")
        axes[1].set_xlabel("Recall")
        axes[1].set_ylabel("Precision")
        axes[1].set_title(f"Precision-Recall Curve (AP = {avg_prec:.4f})", fontweight="bold", fontsize=13)
        axes[1].legend(loc="lower left")
        axes[1].grid(alpha=0.3)

        plt.tight_layout()
        plt.savefig(PLOTS_DIR / "06_roc_pr_curves.png", bbox_inches="tight")
        plt.close()
        log.info("  Saved: 06_roc_pr_curves.png")

    return cm, report


# %% [markdown]
# ## 7. Learning Curve

# %%
def plot_learning_curve(model, X_train, y_train):
    """Plot learning curve to check for overfitting/underfitting."""
    log.info("\n  Generating learning curve (this may take a minute)...")

    train_sizes, train_scores, val_scores = learning_curve(
        model, X_train, y_train,
        cv=5,
        scoring="f1",
        train_sizes=np.linspace(0.1, 1.0, 10),
        n_jobs=-1,
        random_state=42,
    )

    train_mean = train_scores.mean(axis=1)
    train_std = train_scores.std(axis=1)
    val_mean = val_scores.mean(axis=1)
    val_std = val_scores.std(axis=1)

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.fill_between(train_sizes, train_mean - train_std, train_mean + train_std, alpha=0.1, color="#3b82f6")
    ax.fill_between(train_sizes, val_mean - val_std, val_mean + val_std, alpha=0.1, color="#ef4444")
    ax.plot(train_sizes, train_mean, "o-", color="#3b82f6", lw=2, label="Training F1")
    ax.plot(train_sizes, val_mean, "o-", color="#ef4444", lw=2, label="Validation F1")
    ax.set_xlabel("Training Set Size", fontsize=12)
    ax.set_ylabel("F1 Score", fontsize=12)
    ax.set_title("Learning Curve — Bias/Variance Analysis", fontweight="bold", fontsize=14)
    ax.legend(loc="lower right", fontsize=11)
    ax.grid(alpha=0.3)
    ax.set_ylim(0.5, 1.05)

    plt.tight_layout()
    plt.savefig(PLOTS_DIR / "07_learning_curve.png", bbox_inches="tight")
    plt.close()
    log.info("  Saved: 07_learning_curve.png")


# %% [markdown]
# ## 8. Feature Importance (Top Predictive Words)

# %%
def plot_feature_importance(vectorizer, model, model_name):
    """Show which words the model considers most indicative of Fake vs Real."""
    log.info("\n" + "=" * 60)
    log.info("  FEATURE IMPORTANCE (Top Predictive Words)")
    log.info("=" * 60)

    if not hasattr(model, "coef_"):
        log.info("  Model does not expose coefficients — skipping feature importance")
        return

    feature_names = vectorizer.get_feature_names_out()
    coefs = model.coef_[0] if len(model.coef_.shape) > 1 else model.coef_

    # Top 20 FAKE indicators (most negative coefficients)
    top_fake_idx = np.argsort(coefs)[:20]
    # Top 20 REAL indicators (most positive coefficients)
    top_real_idx = np.argsort(coefs)[-20:][::-1]

    log.info("\n  Top 20 FAKE news indicator words:")
    for idx in top_fake_idx:
        log.info(f"    ✗ {feature_names[idx]:30s}  (weight: {coefs[idx]:.4f})")

    log.info("\n  Top 20 REAL news indicator words:")
    for idx in top_real_idx:
        log.info(f"    ✓ {feature_names[idx]:30s}  (weight: {coefs[idx]:.4f})")

    # --- Plot 8: Feature Importance ---
    fig, axes = plt.subplots(1, 2, figsize=(16, 8))

    # Fake words
    fake_words = [feature_names[i] for i in top_fake_idx]
    fake_weights = [abs(coefs[i]) for i in top_fake_idx]
    axes[0].barh(range(len(fake_words)), fake_weights, color="#ef4444", edgecolor="white")
    axes[0].set_yticks(range(len(fake_words)))
    axes[0].set_yticklabels(fake_words, fontsize=10)
    axes[0].set_title("Top 20 FAKE News Indicators", fontweight="bold", fontsize=13, color="#ef4444")
    axes[0].set_xlabel("Absolute Coefficient Weight")
    axes[0].invert_yaxis()

    # Real words
    real_words = [feature_names[i] for i in top_real_idx]
    real_weights = [coefs[i] for i in top_real_idx]
    axes[1].barh(range(len(real_words)), real_weights, color="#22c55e", edgecolor="white")
    axes[1].set_yticks(range(len(real_words)))
    axes[1].set_yticklabels(real_words, fontsize=10)
    axes[1].set_title("Top 20 REAL News Indicators", fontweight="bold", fontsize=13, color="#22c55e")
    axes[1].set_xlabel("Coefficient Weight")
    axes[1].invert_yaxis()

    plt.tight_layout()
    plt.savefig(PLOTS_DIR / "08_feature_importance.png", bbox_inches="tight")
    plt.close()
    log.info("  Saved: 08_feature_importance.png")


# %% [markdown]
# ## 9. Save Model & Generate Report

# %%
def save_model(vectorizer, model, model_name, results, cm, report_text, df):
    """Save the trained model, vectorizer, and a comprehensive report."""
    log.info("\n" + "=" * 60)
    log.info("  SAVING MODEL & REPORT")
    log.info("=" * 60)

    # Save vectorizer
    vec_path = ARTIFACTS / "tfidf_vectorizer.pkl"
    with open(vec_path, "wb") as f:
        pickle.dump(vectorizer, f)
    log.info(f"  Saved: {vec_path} ({vec_path.stat().st_size / 1024:.1f} KB)")

    # Save model
    model_path = ARTIFACTS / "sgd_classifier.pkl"
    with open(model_path, "wb") as f:
        pickle.dump(model, f)
    log.info(f"  Saved: {model_path} ({model_path.stat().st_size / 1024:.1f} KB)")

    # Generate comprehensive report
    r = results[model_name]
    report_content = f"""
╔══════════════════════════════════════════════════════════════╗
║          VERIFI.AI — ML MODEL TRAINING REPORT               ║
╚══════════════════════════════════════════════════════════════╝

DATASET INFORMATION
═══════════════════
  Source:             Real fake news dataset (from academic research)
  Total Samples:      {len(df):,}
  Real News:          {(df['label']==1).sum():,} ({(df['label']==1).mean():.1%})
  Fake News:          {(df['label']==0).sum():,} ({(df['label']==0).mean():.1%})
  Train/Test Split:   80% / 20% (stratified)

FEATURE ENGINEERING
═══════════════════
  Method:             TF-IDF Vectorization
  Max Features:       10,000
  N-gram Range:       (1, 2) — Unigrams + Bigrams
  Stop Words:         English
  Min Doc Frequency:  3
  Max Doc Frequency:  95%
  Sublinear TF:       Yes (log normalization)

MODELS COMPARED
═══════════════
"""
    for name, res in results.items():
        marker = " ★ BEST" if name == model_name else ""
        report_content += f"""
  {name}{marker}
  ├─ Accuracy:     {res['accuracy']:.4f} ({res['accuracy']*100:.1f}%)
  ├─ Precision:    {res['precision']:.4f}
  ├─ Recall:       {res['recall']:.4f}
  ├─ F1 Score:     {res['f1']:.4f}
  └─ CV F1 (5x):   {res['cv_mean']:.4f} ± {res['cv_std']:.4f}
"""

    report_content += f"""
BEST MODEL: {model_name}
═══════════════════════
{report_text}

CONFUSION MATRIX
════════════════
                Predicted
                FAKE    REAL
  Actual FAKE   {cm[0][0]:5d}   {cm[0][1]:5d}
  Actual REAL   {cm[1][0]:5d}   {cm[1][1]:5d}

  True Positives:  {cm[1][1]:,}  (correctly identified REAL news)
  True Negatives:  {cm[0][0]:,}  (correctly identified FAKE news)
  False Positives: {cm[0][1]:,}  (FAKE news wrongly labeled REAL)
  False Negatives: {cm[1][0]:,}  (REAL news wrongly labeled FAKE)

GENERATED ARTIFACTS
═══════════════════
  Model files:
    • tfidf_vectorizer.pkl      — TF-IDF vocabulary & weights
    • sgd_classifier.pkl        — Trained SGD classifier

  Plots:
    • 01_class_distribution.png — Dataset class balance
    • 02_text_length_distribution.png — Text length analysis
    • 03_word_clouds.png        — Most common words (Fake vs Real)
    • 04_model_comparison.png   — Multi-model metric comparison
    • 05_confusion_matrix.png   — Confusion matrix (counts + normalized)
    • 06_roc_pr_curves.png      — ROC curve + Precision-Recall curve
    • 07_learning_curve.png     — Bias/Variance analysis
    • 08_feature_importance.png — Top predictive words
"""

    report_path = ARTIFACTS / "training_report.txt"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_content)
    log.info(f"  Saved: {report_path}")


# %% [markdown]
# ## 10. Main Execution

# %%
def main():
    """Run the complete training pipeline."""
    print()
    print("╔" + "═" * 58 + "╗")
    print("║  Verifi.ai — Fake News Classifier Training Pipeline     ║")
    print("╚" + "═" * 58 + "╝")
    print()

    # Step 1: Download dataset
    log.info("[1/8] Acquiring dataset...")
    downloaded = download_dataset()
    if not downloaded:
        log.error("  ✗ Failed to download dataset automatically.")
        log.error("  Please manually download a fake news CSV dataset to:")
        log.error(f"    {DATASET_CSV}")
        log.error("  Recommended datasets:")
        log.error("    • https://www.kaggle.com/datasets/clmentbisaillon/fake-and-real-news-dataset")
        log.error("    • https://www.kaggle.com/datasets/saurabhshahane/fake-news-classification")
        return

    # Step 2: Load dataset
    log.info("\n[2/8] Loading dataset...")
    df = load_dataset()
    log.info(f"  Loaded {len(df):,} articles ({(df['label']==1).sum():,} real, {(df['label']==0).sum():,} fake)")

    # Step 3: EDA
    log.info("\n[3/8] Running Exploratory Data Analysis...")
    df = run_eda(df)

    # Step 4: Preprocessing
    log.info("\n[4/8] Preprocessing & Feature Engineering...")
    vectorizer, X_train, X_test, y_train, y_test = preprocess_and_split(df)

    # Step 5: Train models
    log.info("\n[5/8] Training & comparing models...")
    results, best_model_name = train_models(X_train, X_test, y_train, y_test)

    # Step 6: Evaluate best model
    log.info("\n[6/8] Evaluating best model...")
    cm, report_text = evaluate_best_model(results, best_model_name, y_test)

    # Step 7: Learning curve
    log.info("\n[7/8] Generating learning curve...")
    best_model = results[best_model_name]["model"]
    plot_learning_curve(best_model, X_train, y_train)

    # Step 8: Feature importance
    log.info("\n[8/8] Analyzing feature importance...")
    plot_feature_importance(vectorizer, best_model, best_model_name)

    # Save everything
    save_model(vectorizer, best_model, best_model_name, results, cm, report_text, df)

    print()
    print("╔" + "═" * 58 + "╗")
    print("║  ✓ Training complete! All artifacts saved to:           ║")
    print(f"║    {str(ARTIFACTS)[:54]:54s} ║")
    print("╚" + "═" * 58 + "╝")
    print()


if __name__ == "__main__":
    main()
