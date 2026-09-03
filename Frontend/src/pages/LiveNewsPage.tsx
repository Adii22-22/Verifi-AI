import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingArticle } from "../../types";
import { fetchTrendingNews } from "../services/apiService";

interface LiveNewsPageProps {
  onAnalyze: (headline: string) => void;
}

const LiveNewsPage: React.FC<LiveNewsPageProps> = ({ onAnalyze }) => {
  const [articles, setArticles] = useState<TrendingArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setIsLoading(true);
    fetchTrendingNews()
      .then(setArticles)
      .catch(() => setArticles([]))
      .finally(() => setIsLoading(false));
  }, []);

  const handleClick = (headline: string) => {
    navigate("/");
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      onAnalyze(headline);
    }, 100);
  };

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 opacity-0 animate-fade-in-up">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary animate-bounce-subtle">
            <span className="material-symbols-outlined text-2xl">newspaper</span>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Live Headlines
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Tap any headline to run an AI fact-check instantly
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
          <span className="size-2.5 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-bold text-primary">Live</span>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className="h-40 bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 shimmer-bg opacity-0 animate-scale-in"
            />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 animate-fade-in">
          <span className="material-symbols-outlined text-6xl mb-4 animate-float">newspaper</span>
          <p className="text-lg font-bold">No headlines available</p>
          <p className="text-sm mt-1">Check back in a few minutes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {articles.map((item) => (
            <button
              key={item.id}
              onClick={() => handleClick(item.headline)}
              className="opacity-0 animate-slide-up w-full text-left bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 p-5 card-hover group relative overflow-hidden"
            >
              {/* Hover accent line */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              {/* Hover glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/[0.02] group-hover:to-emerald-500/[0.02] transition-all duration-500 rounded-2xl" />

              <div className="relative">
                {/* Source + meta */}
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`size-6 rounded-full ${item.sourceColor} flex items-center justify-center text-white text-[10px] font-black shrink-0 shadow-sm`}
                  >
                    {item.sourceInitial}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                    {item.source}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
                  <span className="text-xs text-slate-400">{item.timeAgo}</span>
                </div>

                {/* Headline */}
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug group-hover:text-primary transition-colors duration-300 line-clamp-3 mb-4">
                  {item.headline}
                </h3>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-white/5">
                  <span className="text-[10px] font-semibold text-slate-400 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-surface-dark">
                    {item.category}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 group-hover:text-primary transition-colors duration-300">
                    <span className="material-symbols-outlined text-[16px] group-hover:animate-bounce-subtle">fact_check</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">Fact-check →</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  );
};

export default LiveNewsPage;
