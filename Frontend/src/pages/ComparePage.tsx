import React, { useState } from 'react';
import { compareContent } from '../services/apiService';
import { CompareResult } from '../../types';

const ScoreBar = ({ label, score, color }: { label: string; score: number; color: string }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs">
      <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <span className={`font-bold ${color}`}>{score}%</span>
    </div>
    <div className="h-2 bg-slate-100 dark:bg-surface-dark rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${score >= 70 ? "bg-primary" : score >= 50 ? "bg-yellow-500" : "bg-red-500"} transition-all duration-1000`} style={{ width: `${score}%` }} />
    </div>
  </div>
);

const ComparePage: React.FC = () => {
  const [claimA, setClaimA] = useState('');
  const [claimB, setClaimB] = useState('');
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (!claimA.trim() || !claimB.trim()) {
      setError("Please enter both claims");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await compareContent(claimA.trim(), claimB.trim());
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed.");
    } finally {
      setLoading(false);
    }
  };

  const getWinnerColor = (w: string) => w === "Claim A" ? "text-blue-500" : w === "Claim B" ? "text-purple-500" : "text-yellow-500";

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
          <span className="material-symbols-outlined text-[14px]">compare_arrows</span>
          AI-Powered Comparison
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Claim Comparison</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-lg mx-auto">
          Enter two conflicting claims or headlines — our AI will analyze both against real evidence and determine which is more credible.
        </p>
      </div>

      {/* Input area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Claim A */}
        <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 text-xs font-black">A</div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Claim A</span>
          </div>
          <textarea
            value={claimA}
            onChange={(e) => setClaimA(e.target.value)}
            placeholder='e.g. "Global temperatures have risen 1.5°C since pre-industrial times"'
            className="w-full h-32 resize-none text-sm bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white rounded-xl p-4 placeholder:text-slate-400 border border-gray-200 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        {/* Claim B */}
        <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 text-xs font-black">B</div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Claim B</span>
          </div>
          <textarea
            value={claimB}
            onChange={(e) => setClaimB(e.target.value)}
            placeholder='e.g. "There has been no significant global warming in the last 20 years"'
            className="w-full h-32 resize-none text-sm bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white rounded-xl p-4 placeholder:text-slate-400 border border-gray-200 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
          />
        </div>
      </div>

      {/* Compare button */}
      <div className="flex justify-center">
        <button
          onClick={handleCompare}
          disabled={loading}
          className="flex items-center gap-3 px-10 py-3.5 bg-primary hover:bg-primary/90 text-background-dark font-bold rounded-full text-sm transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="size-4 border-2 border-background-dark/30 border-t-background-dark rounded-full animate-spin" />
              Analyzing Both Claims...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[20px]">compare_arrows</span>
              Compare Claims
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-300 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6 animate-fade-in">
          {/* Winner card */}
          <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 p-8 shadow-sm text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-primary to-purple-500" />
            <div className="flex flex-col items-center gap-3">
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-2xl">emoji_events</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                More Credible: <span className={getWinnerColor(result.winner)}>{result.winner}</span>
              </h2>
              <p className="text-xs text-slate-400">
                Confidence: <span className="font-bold text-primary">{result.confidence}%</span>
              </p>
            </div>
          </div>

          {/* Side by side scores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Claim A result */}
            <div className="bg-white dark:bg-card-dark rounded-2xl border-2 border-blue-500/20 p-6 shadow-sm relative">
              {result.winner === "Claim A" && (
                <div className="absolute -top-2 -right-2 size-6 rounded-full bg-primary flex items-center justify-center text-background-dark">
                  <span className="material-symbols-outlined text-[14px]">check</span>
                </div>
              )}
              <div className="flex items-center gap-2 mb-5">
                <div className="size-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 text-xs font-black">A</div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">Claim A</span>
              </div>
              <div className="space-y-4">
                <ScoreBar
                  label="Trust Score"
                  score={result.claim_a_score}
                  color={result.claim_a_score >= 70 ? "text-primary" : result.claim_a_score >= 50 ? "text-yellow-500" : "text-red-500"}
                />
                <div className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-surface-dark rounded-xl">
                  <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border ${
                    result.claim_a_verdict === "Verified" ? "bg-primary/10 text-primary border-primary/20" :
                    result.claim_a_verdict === "False" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                    "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                  }`}>
                    {result.claim_a_verdict}
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300">Claim A assessment</p>
                </div>
              </div>
            </div>

            {/* Claim B result */}
            <div className="bg-white dark:bg-card-dark rounded-2xl border-2 border-purple-500/20 p-6 shadow-sm relative">
              {result.winner === "Claim B" && (
                <div className="absolute -top-2 -right-2 size-6 rounded-full bg-primary flex items-center justify-center text-background-dark">
                  <span className="material-symbols-outlined text-[14px]">check</span>
                </div>
              )}
              <div className="flex items-center gap-2 mb-5">
                <div className="size-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 text-xs font-black">B</div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">Claim B</span>
              </div>
              <div className="space-y-4">
                <ScoreBar
                  label="Trust Score"
                  score={result.claim_b_score}
                  color={result.claim_b_score >= 70 ? "text-primary" : result.claim_b_score >= 50 ? "text-yellow-500" : "text-red-500"}
                />
                <div className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-surface-dark rounded-xl">
                  <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border ${
                    result.claim_b_verdict === "Verified" ? "bg-primary/10 text-primary border-primary/20" :
                    result.claim_b_verdict === "False" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                    "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                  }`}>
                    {result.claim_b_verdict}
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300">Claim B assessment</p>
                </div>
              </div>
            </div>
          </div>

          {/* Reasoning */}
          <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-primary">auto_stories</span>
              <h3 className="font-bold text-slate-900 dark:text-white">AI Reasoning</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{result.reasoning}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComparePage;
