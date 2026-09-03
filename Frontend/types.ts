export interface CrossReference {
  source: string;
  sourceInitials: string;
  timeAgo: string;
  trustColor: "primary" | "yellow" | "red" | "gray";
  url?: string;
}

export interface ClaimVerdict {
  claim: string;
  verdict: "Verified" | "False" | "Misleading" | "Unverified";
  reason: string;
}

export interface AnalysisResult {
  trustScore: number;
  factualAccuracy: string;
  biasRating: string;
  headline: string;
  summary: string;
  tags: string[];
  crossReferences: CrossReference[];
  claimVerdict: ClaimVerdict[];
  // Image analysis fields (optional — only present for image uploads)
  extracted_text?: string;
  is_manipulated?: boolean;
  manipulation_signs?: string[];
  content_type?: string;
}

export interface TrendingArticle {
  id: string;
  image: string;
  source: string;
  sourceColor: string;
  sourceInitial: string;
  timeAgo: string;
  headline: string;
  category: string;
}

export interface HistoryItem {
  id: string;
  created_at: string;
  input_text: string;
  trust_score: number;
  bias_rating: string;
  factual_accuracy: string;
  headline: string;
  tags: string[];
}

export interface User {
  id: string;
  email: string;
  name: string;
}