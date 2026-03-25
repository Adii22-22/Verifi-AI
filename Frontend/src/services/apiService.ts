import { AnalysisResult, TrendingArticle, HistoryItem, CompareResult } from "../../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("verifi_token");
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const registerUser = async (email: string, password: string, name: string) => {
  const res = await fetch(`${API_BASE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Registration failed");
  }
  return res.json();
};

export const loginUser = async (email: string, password: string) => {
  const res = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Login failed");
  }
  return res.json();
};

export const getMe = async () => {
  const res = await fetch(`${API_BASE_URL}/me`, { headers: getAuthHeaders() });
  if (!res.ok) return null;
  return res.json();
};

// ─── Analyze ──────────────────────────────────────────────────────────────────

export const analyzeContent = async (text: string): Promise<AnalysisResult> => {
  const res = await fetch(`${API_BASE_URL}/analyze`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error: ${res.statusText}`);
  }
  const data = await res.json();
  return {
    trustScore: data.trustScore,
    factualAccuracy: data.factualAccuracy,
    biasRating: data.biasRating,
    headline: data.headline,
    summary: data.summary,
    summary_hi: data.summary_hi,
    summary_mr: data.summary_mr,
    tags: data.tags,
    crossReferences: data.crossReferences,
    claimVerdict: data.claimVerdict || [],
    sourceReputation: data.sourceReputation || null,
  };
};

// ─── Analyze Image ────────────────────────────────────────────────────────────

export const analyzeImage = async (file: File): Promise<AnalysisResult> => {
  const formData = new FormData();
  formData.append("file", file);

  const token = localStorage.getItem("verifi_token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/analyze-image`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Image analysis failed: ${res.statusText}`);
  }
  const data = await res.json();
  return {
    trustScore: data.trustScore,
    factualAccuracy: data.factualAccuracy,
    biasRating: data.biasRating,
    headline: data.headline,
    summary: data.summary,
    summary_hi: data.summary_hi,
    summary_mr: data.summary_mr,
    tags: data.tags,
    crossReferences: data.crossReferences || [],
    claimVerdict: data.claimVerdict || [],
    sourceReputation: data.sourceReputation || null,
    // Image-specific fields
    extracted_text: data.extracted_text,
    is_manipulated: data.is_manipulated,
    manipulation_signs: data.manipulation_signs || [],
    content_type: data.content_type,
  };
};

// ─── History ──────────────────────────────────────────────────────────────────

export const fetchHistory = async (limit = 20, offset = 0): Promise<{ total: number; items: HistoryItem[] }> => {
  const res = await fetch(`${API_BASE_URL}/history?limit=${limit}&offset=${offset}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
};

export const deleteHistoryItem = async (id: string): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/history/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete history item");
};

// ─── Compare ─────────────────────────────────────────────────────────────────

export const compareContent = async (claim_a: string, claim_b: string): Promise<CompareResult> => {
  const res = await fetch(`${API_BASE_URL}/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claim_a, claim_b }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Comparison failed");
  }
  return res.json();
};

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export const fetchLeaderboard = async () => {
  const res = await fetch(`${API_BASE_URL}/leaderboard`);
  if (!res.ok) throw new Error("Failed to fetch leaderboard");
  return res.json();
};

// ─── News feed ────────────────────────────────────────────────────────────────

export const fetchTrendingNews = async (): Promise<TrendingArticle[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/news`);
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    const data = await res.json();

    return data.articles.slice(0, 12).map((article: any, idx: number) => {
      const sourceMatch = article.link?.match(/https?:\/\/(?:www\.)?([^\/]+)/);
      const sourceDomain = sourceMatch ? sourceMatch[1].replace("www.", "") : "Unknown";
      const sourceName = sourceDomain.split(".")[0];
      const sourceInitial = sourceName.charAt(0).toUpperCase();

      const sourceColors: Record<string, string> = {
        reuters: "bg-[#0056B3]", bbc: "bg-[#BB0000]", cnn: "bg-[#CC0000]",
        bloomberg: "bg-black", wsj: "bg-[#0056B3]", ndtv: "bg-[#E31E24]",
        thehindu: "bg-[#1A237E]", hindustan: "bg-[#FF6B35]",
      };
      const sourceColor = sourceColors[sourceName.toLowerCase()] || "bg-slate-600";

      // Use consistent picsum seed (not random) as fallback for missing og:image
      const image = article.image || `https://picsum.photos/seed/${encodeURIComponent(article.title.slice(0, 20))}/400/300`;

      const categories = ["Technology", "Finance", "Politics", "Science", "Health", "Sports", "Entertainment", "World"];
      const category =
        categories.find((cat) =>
          article.title.toLowerCase().includes(cat.toLowerCase()) ||
          (article.summary || "").toLowerCase().includes(cat.toLowerCase())
        ) || "World";

      let timeAgo = "Recent";
      try {
        const pubDate = new Date(article.published);
        const diffHours = Math.floor((Date.now() - pubDate.getTime()) / 3_600_000);
        if (diffHours < 1) timeAgo = "Just now";
        else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
        else timeAgo = `${Math.floor(diffHours / 24)}d ago`;
      } catch (_) {}

      return {
        id: `trending-${idx}`,
        image,
        trustScore: 0, // not analyzed yet — no fake score
        source: sourceName.charAt(0).toUpperCase() + sourceName.slice(1),
        sourceColor,
        sourceInitial,
        timeAgo,
        headline: article.title,
        category,
      };
    });
  } catch (error) {
    console.error("Failed to fetch trending news:", error);
    return [];
  }
};
