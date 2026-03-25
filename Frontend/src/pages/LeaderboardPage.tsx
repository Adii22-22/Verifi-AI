import React, { useState, useEffect } from 'react';
import { fetchLeaderboard } from '../services/apiService';

interface LeaderboardData {
  total_analyses: number;
  average_trust_score: number;
  top_topics: { tag: string; count: number }[];
  bias_distribution: Record<string, number>;
  accuracy_distribution: Record<string, number>;
  analyzed_sources: { source: string; avg_score: number; total_analyses: number }[];
}

const BIAS_COLOR: Record<string, string> = {
  Neutral: "bg-primary",
  Left: "bg-blue-500",
  Right: "bg-red-500",
  Mixed: "bg-yellow-500",
};

const ScoreBar = ({ score }: { score: number }) => (
  <div className="h-2 w-20 bg-slate-100 dark:bg-surface-dark rounded-full overflow-hidden">
    <div
      className={`h-full rounded-full transition-all duration-700 ${
        score >= 70 ? "bg-primary" : score >= 50 ? "bg-yellow-500" : "bg-red-500"
      }`}
      style={{ width: `${score}%` }}
    />
  </div>
);

const LeaderboardPage: React.FC = () => {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  let totalBias = 0;
  if (data) {
    for (const v of Object.values(data.bias_distribution)) totalBias += Number(v);
  }

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
          <span className="material-symbols-outlined text-[14px]">leaderboard</span>
          Platform Analytics
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Platform Insights</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-lg mx-auto">
          Real-time analytics from all analyses performed on Verifi.ai — no hardcoded data.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 animate-pulse" />
          ))}
        </div>
      ) : !data || data.total_analyses === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5">
          <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-4 block">query_stats</span>
          <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">No Data Yet</h2>
          <p className="text-slate-400 max-w-sm mx-auto">
            Start analyzing news articles and claims — the leaderboard will populate with real insights from your analyses.
          </p>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 p-6 text-center shadow-sm">
              <p className="text-3xl font-black text-primary">{data.total_analyses}</p>
              <p className="text-xs text-slate-400 font-medium mt-1">Total Analyses</p>
            </div>
            <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 p-6 text-center shadow-sm">
              <p className={`text-3xl font-black ${data.average_trust_score >= 70 ? "text-primary" : data.average_trust_score >= 50 ? "text-yellow-500" : "text-red-500"}`}>
                {data.average_trust_score}%
              </p>
              <p className="text-xs text-slate-400 font-medium mt-1">Avg Trust Score</p>
            </div>
            <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 p-6 text-center shadow-sm">
              <p className="text-3xl font-black text-slate-800 dark:text-white">{data.analyzed_sources.length}</p>
              <p className="text-xs text-slate-400 font-medium mt-1">Sources Analyzed</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Analyzed Sources */}
            <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">domain</span>
                Source Trust Rankings
              </h3>
              {data.analyzed_sources.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No source data yet — analyze some articles!</p>
              ) : (
                <div className="space-y-3">
                  {data.analyzed_sources.slice(0, 10).map((src, i) => (
                    <div key={i} className="flex items-center justify-between group p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-bold text-slate-400 w-5 text-right">{i + 1}</span>
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-black shrink-0">
                          {src.source.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{src.source}</p>
                          <p className="text-[10px] text-slate-400">{src.total_analyses} {src.total_analyses === 1 ? "analysis" : "analyses"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <ScoreBar score={src.avg_score} />
                        <span className={`text-sm font-bold min-w-[3rem] text-right ${
                          src.avg_score >= 70 ? "text-primary" : src.avg_score >= 50 ? "text-yellow-500" : "text-red-500"
                        }`}>
                          {src.avg_score}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Top Topics */}
              <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">trending_up</span>
                  Top Topics
                </h3>
                {data.top_topics.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-2">No topics yet</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.top_topics.map((t, i) => (
                      <span key={i} className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-surface-dark text-slate-700 dark:text-slate-300 text-xs font-medium border border-gray-200 dark:border-white/5">
                        {t.tag} <span className="text-slate-400 ml-1">({t.count})</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bias Distribution */}
              <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">balance</span>
                  Bias Distribution
                </h3>
                {totalBias === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-2">No bias data yet</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(data.bias_distribution).map(([bias, rawCount]) => {
                      const count = Number(rawCount);
                      return (
                      <div key={bias} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-600 dark:text-slate-300">{bias}</span>
                          <span className="text-slate-400">{count} ({Math.round(count / totalBias * 100)}%)</span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-surface-dark rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${BIAS_COLOR[bias] || "bg-slate-400"} transition-all duration-700`}
                            style={{ width: `${(count / totalBias) * 100}%` }}
                          />
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Accuracy Distribution */}
              <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">fact_check</span>
                  Accuracy Distribution
                </h3>
                {Object.keys(data.accuracy_distribution).length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-2">No accuracy data yet</p>
                ) : (
                  <div className="flex gap-3">
                    {Object.entries(data.accuracy_distribution).map(([level, count]) => (
                      <div key={level} className="flex-1 text-center p-3 bg-slate-50 dark:bg-surface-dark rounded-xl">
                        <p className={`text-xl font-black ${level === "High" ? "text-primary" : level === "Medium" ? "text-yellow-500" : "text-red-500"}`}>{count}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{level}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LeaderboardPage;
