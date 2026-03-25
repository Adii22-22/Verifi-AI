import React, { useState, useEffect } from 'react';
import { TrendingArticle } from '../../types';
import { fetchTrendingNews } from '../services/apiService';

interface TrendingSectionProps {
  onCardClick: (headline: string) => void;
}

const TrendingSection: React.FC<TrendingSectionProps> = ({ onCardClick }) => {
  const [trendingData, setTrendingData] = useState<TrendingArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTrendingNews()
      .then(setTrendingData)
      .catch(() => setTrendingData([]))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <section className="flex flex-col gap-5 opacity-0 animate-[fadeIn_0.5s_ease-out_0.6s_forwards]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-lg">newspaper</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Live Headlines</h2>
            <p className="text-xs text-slate-400 mt-0.5">Tap any headline to run an AI fact-check</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="size-2 rounded-full bg-primary animate-pulse" />
          Live
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 animate-pulse" />
          ))}
        </div>
      ) : trendingData.length === 0 ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <span className="material-symbols-outlined text-4xl mb-2 block">newspaper</span>
          <p>No headlines available right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {trendingData.map((item, index) => (
            <button
              key={item.id}
              onClick={() => onCardClick(item.headline)}
              className="group text-left bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 p-4 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 flex flex-col justify-between min-h-[120px] relative overflow-hidden"
            >
              {/* Subtle gradient top */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              {/* Source + meta */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`size-5 rounded-full ${item.sourceColor} flex items-center justify-center text-white text-[9px] font-black shrink-0`}>
                  {item.sourceInitial}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">{item.source}</span>
                <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
                <span className="text-xs text-slate-400">{item.timeAgo}</span>
              </div>

              {/* Headline */}
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug group-hover:text-primary transition-colors line-clamp-3 flex-1">
                {item.headline}
              </h3>

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-white/5">
                <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-surface-dark">
                  {item.category}
                </span>
                <div className="flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[14px]">fact_check</span>
                  <span className="hidden group-hover:inline">Verify</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default TrendingSection;