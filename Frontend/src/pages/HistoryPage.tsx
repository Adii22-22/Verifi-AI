import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HistoryItem, User } from "../../types";
import { fetchHistory, deleteHistoryItem } from "../services/apiService";
import AuthModal from "../components/AuthModal";

interface HistoryPageProps {
  user: User | null;
  onAuthSuccess: (user: User, token: string) => void;
}

const getTrustColor = (score: number) => {
  if (score >= 80) return "text-primary";
  if (score >= 60) return "text-yellow-500";
  return "text-red-500";
};

const getTrustBg = (score: number) => {
  if (score >= 80) return "bg-primary/10 border-primary/20";
  if (score >= 60) return "bg-yellow-500/10 border-yellow-500/20";
  return "bg-red-500/10 border-red-500/20";
};

const getBiasColor = (bias: string) => {
  switch (bias) {
    case "Left": return "text-blue-400";
    case "Right": return "text-red-400";
    case "Neutral": return "text-primary";
    default: return "text-yellow-400";
  }
};

const HistoryPage: React.FC<HistoryPageProps> = ({ user, onAuthSuccess }) => {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchHistory();
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      load();
    } else {
      setLoading(false);
    }
  }, [user]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteHistoryItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setTotal((t) => t - 1);
      if (selectedItem?.id === id) setSelectedItem(null);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.headline.toLowerCase().includes(q) ||
      item.input_text.toLowerCase().includes(q) ||
      (item.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  });

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-4xl">history</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Your Analysis History</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm">
            Login to save and view all your past fact-checks in one place.
          </p>
        </div>
        <button
          onClick={() => setShowAuth(true)}
          className="px-8 py-3 bg-primary hover:bg-primary/90 text-background-dark font-bold rounded-full transition-all shadow-lg shadow-primary/20"
        >
          Login to View History
        </button>
        {showAuth && (
          <AuthModal
            onClose={() => setShowAuth(false)}
            onSuccess={(u, t) => { onAuthSuccess(u, t); setShowAuth(false); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analysis History</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {total} fact-check{total !== 1 ? "s" : ""} saved
          </p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-semibold rounded-full text-sm transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Analysis
        </button>
      </div>

      {/* Search bar */}
      {items.length > 0 && (
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search history by headline, text, or tag..."
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white dark:bg-card-dark border border-gray-200 dark:border-white/5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 animate-pulse" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20 text-slate-500 dark:text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-4 block">search_off</span>
          <p className="font-semibold">{searchQuery ? "No matching results." : "No analyses yet."}</p>
          <p className="text-sm mt-1">{searchQuery ? "Try a different search term." : "Analyze a news article or claim to get started."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="w-full text-left group bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 p-5 hover:border-primary/30 transition-all shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-white leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {item.headline}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 truncate">
                    {item.input_text}
                  </p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold ${getTrustBg(item.trust_score)} ${getTrustColor(item.trust_score)}`}>
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      {item.trust_score}%
                    </span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-surface-dark ${getBiasColor(item.bias_rating)}`}>
                      {item.bias_rating}
                    </span>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-surface-dark text-slate-500 dark:text-slate-400">
                      {item.factual_accuracy} accuracy
                    </span>
                    {item.tags?.slice(0, 2).map((tag, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-surface-dark text-slate-500 dark:text-slate-400">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3 shrink-0">
                  <span className="text-xs text-slate-400">
                    {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <div
                    role="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                  >
                    {deletingId === item.id ? (
                      <span className="material-symbols-outlined animate-spin text-[18px]">refresh</span>
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-white dark:bg-card-dark rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 shadow-2xl border border-gray-200 dark:border-white/10 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="space-y-5">
              {/* Trust Score */}
              <div className="flex items-center gap-4">
                <div className={`size-16 rounded-2xl flex items-center justify-center ${getTrustBg(selectedItem.trust_score)}`}>
                  <span className={`text-2xl font-black ${getTrustColor(selectedItem.trust_score)}`}>
                    {selectedItem.trust_score}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                    {selectedItem.headline}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(selectedItem.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>

              {/* Original input */}
              <div className="bg-slate-50 dark:bg-surface-dark rounded-xl p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Original Input</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 break-words">{selectedItem.input_text}</p>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 dark:bg-surface-dark rounded-xl p-3 text-center">
                  <p className={`text-lg font-black ${getTrustColor(selectedItem.trust_score)}`}>{selectedItem.trust_score}%</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Trust Score</p>
                </div>
                <div className="bg-slate-50 dark:bg-surface-dark rounded-xl p-3 text-center">
                  <p className={`text-lg font-black ${getBiasColor(selectedItem.bias_rating)}`}>{selectedItem.bias_rating}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Bias</p>
                </div>
                <div className="bg-slate-50 dark:bg-surface-dark rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-slate-700 dark:text-slate-200">{selectedItem.factual_accuracy}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Accuracy</p>
                </div>
              </div>

              {/* Tags */}
              {selectedItem.tags && selectedItem.tags.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Tags</p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedItem.tags.map((tag, i) => (
                      <span key={i} className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-surface-dark text-slate-600 dark:text-slate-300 text-xs font-medium border border-gray-200 dark:border-white/5">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(`Trust: ${selectedItem.trust_score}% | ${selectedItem.headline} | Bias: ${selectedItem.bias_rating}`); }}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-slate-100 dark:bg-surface-dark text-slate-600 dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">content_copy</span>
                  Copy Report
                </button>
                <button
                  onClick={() => { handleDelete(selectedItem.id); }}
                  className="py-2.5 px-4 text-sm font-semibold rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
