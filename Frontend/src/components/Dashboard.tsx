import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AnalysisResult, ClaimVerdict } from '../../types';

interface DashboardProps {
  data: AnalysisResult;
  language: "en" | "hi" | "mr";
}

const VERDICT_STYLE: Record<string, string> = {
  Verified: "text-primary bg-primary/10 border-primary/20",
  False: "text-red-500 bg-red-500/10 border-red-500/20",
  Misleading: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
  Unverified: "text-slate-400 bg-slate-100 dark:bg-surface-dark border-gray-200 dark:border-white/5",
};

const BIAS_COLOR: Record<string, string> = {
  Left: "text-blue-400",
  Right: "text-red-400",
  Neutral: "text-primary",
  Mixed: "text-yellow-400",
};

const getTrustLabel = (score: number) => {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Caution";
  if (score >= 25) return "Poor";
  return "Unreliable";
};

const getTrustRingColor = (score: number) => {
  if (score >= 70) return "text-primary";
  if (score >= 50) return "text-yellow-500";
  return "text-red-500";
};

const getColorClass = (colorType: string) => {
  switch (colorType) {
    case 'primary': return 'bg-primary';
    case 'yellow': return 'bg-yellow-500';
    case 'red': return 'bg-red-500';
    default: return 'bg-slate-400';
  }
};

// ─── Typing animation hook ───────────────────────────────────────────────────
const useTypingEffect = (text: string, speed: number = 15) => {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    if (!text) return;

    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayed, done };
};

// ─── Animated counter ────────────────────────────────────────────────────────
const AnimatedScore = ({ target }: { target: number }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 1200;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.round(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);

  return <>{count}</>;
};

const Dashboard: React.FC<DashboardProps> = ({ data, language }) => {
  const [copied, setCopied] = useState(false);

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (data.trustScore / 100) * circumference;

  const displaySummary =
    language === "hi" ? data.summary_hi
    : language === "mr" ? data.summary_mr
    : data.summary;

  const { displayed: typedSummary, done: typingDone } = useTypingEffect(displaySummary, 12);

  const handleCopy = () => {
    const text = `Verifi.ai Analysis\n\nHeadline: ${data.headline}\n\nTrust Score: ${data.trustScore}%\nFactual Accuracy: ${data.factualAccuracy}\nBias: ${data.biasRating}\n\nSummary:\n${data.summary}\n\nTags: ${data.tags.join(', ')}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    const text = `I just fact-checked this on Verifi.ai — Trust Score: ${data.trustScore}%\n"${data.headline}"`;
    if (navigator.share) {
      navigator.share({ title: "Verifi.ai Analysis", text, url: window.location.href });
    } else {
      navigator.clipboard.writeText(`${text}\n${window.location.href}`);
    }
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full animate-fade-in">

      {/* Trust Score Card */}
      <div className="lg:col-span-4 xl:col-span-3">
        <div className="glass-panel h-full rounded-2xl p-6 flex flex-col items-center justify-between text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

          <div className="w-full flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Trust Score</h3>
            <span className="material-symbols-outlined text-primary">verified</span>
          </div>

          <div className="relative size-48 flex items-center justify-center mb-6">
            <svg className="size-full transform -rotate-90" viewBox="0 0 100 100">
              <circle className="text-slate-200 dark:text-white/5" strokeWidth="6" stroke="currentColor" fill="transparent" r={radius} cx="50" cy="50" />
              <circle
                className={`${getTrustRingColor(data.trustScore)} progress-ring__circle`}
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r={radius}
                cx="50"
                cy="50"
                style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
                <AnimatedScore target={data.trustScore} />
              </span>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">{getTrustLabel(data.trustScore)}</span>
            </div>
          </div>

          <div className="w-full space-y-3">
            {[
              { label: "Factual Accuracy", value: data.factualAccuracy, color: data.factualAccuracy === "High" ? "text-primary" : data.factualAccuracy === "Medium" ? "text-yellow-500" : "text-red-500" },
              { label: "Bias Rating", value: data.biasRating, color: BIAS_COLOR[data.biasRating] || "text-slate-400" },
              ...(data.sourceReputation && data.sourceReputation.score !== -1
                ? [{ label: "Source Rep.", value: `${data.sourceReputation.score}% · ${data.sourceReputation.label}`, color: data.sourceReputation.score >= 70 ? "text-primary" : "text-yellow-500" }]
                : []),
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center text-sm p-3 bg-white/50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-300">{label}</span>
                <span className={`font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Analysis Card — with typing effect */}
      <div className="lg:col-span-8 xl:col-span-6">
        <div className="bg-white dark:bg-card-dark h-full rounded-2xl p-8 border border-gray-200 dark:border-white/5 shadow-sm relative flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                <span className="material-symbols-outlined">auto_stories</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">AI Analysis</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="p-2 text-slate-400 hover:text-primary transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-white/5"
                title="Copy report"
              >
                <span className="material-symbols-outlined text-[20px]">{copied ? "check_circle" : "content_copy"}</span>
              </button>
              <button
                onClick={handleShare}
                className="p-2 text-slate-400 hover:text-primary transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-white/5"
                title="Share"
              >
                <span className="material-symbols-outlined text-[20px]">share</span>
              </button>
            </div>
          </div>

          <div className="prose dark:prose-invert max-w-none flex-1">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3 leading-snug">{data.headline}</h3>

            {/* Image analysis: manipulation warning */}
            {data.content_type && (
              <div className="mb-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-surface-dark text-slate-500 border border-gray-200 dark:border-white/5">
                    {data.content_type.replace(/_/g, " ")}
                  </span>
                  {data.is_manipulated ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">warning</span>
                      Manipulation Detected
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">verified</span>
                      No Manipulation Detected
                    </span>
                  )}
                </div>
                {data.manipulation_signs && data.manipulation_signs.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl p-3 text-xs">
                    <p className="font-bold text-red-600 dark:text-red-400 mb-1">⚠ Manipulation Signs:</p>
                    <ul className="list-disc list-inside text-red-500 dark:text-red-300 space-y-0.5">
                      {data.manipulation_signs.map((sign, i) => <li key={i}>{sign}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6 whitespace-pre-wrap">
              {typedSummary}
              {!typingDone && <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse" />}
            </p>
          </div>

          {/* Claim verdicts */}
          {typingDone && data.claimVerdict && data.claimVerdict.length > 0 && (
            <div className="space-y-2 mb-6 animate-fade-in">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Claim Verification</h4>
              {data.claimVerdict.map((cv: ClaimVerdict, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-surface-dark rounded-xl">
                  <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border ${VERDICT_STYLE[cv.verdict] || VERDICT_STYLE.Unverified}`}>
                    {cv.verdict}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 line-clamp-1">{cv.claim}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{cv.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-auto pt-4 border-t border-gray-100 dark:border-white/5 flex gap-3 flex-wrap">
            {data.tags.map((tag, idx) => (
              <span key={idx} className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-surface-dark text-slate-600 dark:text-slate-300 text-xs font-medium border border-gray-200 dark:border-white/5">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Cross Reference Sidebar — clickable links */}
      <div className="lg:col-span-12 xl:col-span-3 flex flex-col gap-6">
        <div className="bg-white dark:bg-card-dark flex-1 rounded-2xl p-6 border border-gray-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cross-Reference</h3>
            <span className="material-symbols-outlined text-slate-400 text-[18px]">open_in_new</span>
          </div>
          {data.crossReferences.length === 0 ? (
            <p className="text-sm text-slate-400">No sources found for this analysis.</p>
          ) : (
            <div className="space-y-4">
              {data.crossReferences.map((ref, idx) => {
                const inner = (
                  <div className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 p-2 rounded-xl transition-colors -mx-2">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center">
                        <span className="font-serif font-bold text-xs">{ref.sourceInitials}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                          {ref.source}
                        </span>
                        <span className="text-xs text-slate-500">{ref.timeAgo}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${getColorClass(ref.trustColor)}`} />
                      {ref.url && (
                        <span className="material-symbols-outlined text-[14px] text-slate-400 group-hover:text-primary transition-colors">open_in_new</span>
                      )}
                    </div>
                  </div>
                );

                return (
                  <div key={idx}>
                    {ref.url ? (
                      <a href={ref.url} target="_blank" rel="noopener noreferrer" className="block no-underline">
                        {inner}
                      </a>
                    ) : (
                      inner
                    )}
                    {idx < data.crossReferences.length - 1 && (
                      <div className="h-px bg-gray-100 dark:bg-white/5 w-full my-2" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Extension promo */}
        <div className="bg-primary/10 rounded-2xl p-6 border border-primary/20 relative overflow-hidden">
          <div className="size-10 rounded-full bg-primary flex items-center justify-center text-background-dark mb-3">
            <span className="material-symbols-outlined">extension</span>
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white mb-1">Browser Extension</h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">Verify news directly on any website.</p>
          <Link to="/extension" className="text-xs font-bold text-primary hover:underline">Install Now →</Link>
        </div>
      </div>
    </section>
  );
};

export default Dashboard;