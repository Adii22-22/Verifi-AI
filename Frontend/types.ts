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

export interface SourceReputation {
  score: number;
  label: string;
  domain: string | null;
}

export interface AnalysisResult {
  trustScore: number;
  factualAccuracy: string;
  biasRating: string;
  headline: string;
  summary: string;
  summary_hi: string;
  summary_mr: string;
  tags: string[];
  crossReferences: CrossReference[];
  claimVerdict: ClaimVerdict[];
  sourceReputation: SourceReputation | null;
  // Image analysis fields (optional — only present for image uploads)
  extracted_text?: string;
  is_manipulated?: boolean;
  manipulation_signs?: string[];
  content_type?: string;
}

export interface TrendingArticle {
  id: string;
  image: string;
  trustScore: number;
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

export interface CompareResult {
  status: string;
  winner: "claim_a" | "claim_b" | "tie";
  confidence: "High" | "Medium" | "Low";
  reasoning: string;
  claim_a_score: number;
  claim_b_score: number;
  claim_a_verdict: string;
  claim_b_verdict: string;
  summary: string;
}