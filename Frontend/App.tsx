import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./src/components/Navbar";
import HeroSection from "./src/components/HeroSection";
import Dashboard from "./src/components/Dashboard";
import TrendingSection from "./src/components/TrendingSection";
import HistoryPage from "./src/pages/HistoryPage";
import LeaderboardPage from "./src/pages/LeaderboardPage";
import ComparePage from "./src/pages/ComparePage";
import ExtensionPage from "./src/pages/ExtensionPage";
import { AnalysisResult, User } from "./types";
import { analyzeContent, analyzeImage as analyzeImageApi, loginUser, registerUser, getMe } from "./src/services/apiService";

// ─── Toast system ─────────────────────────────────────────────────────────────
type Toast = { id: number; message: string; type: "success" | "error" | "info" };
let toastId = 0;

const ToastContainer = ({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) => (
  <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
    {toasts.map((t) => (
      <div
        key={t.id}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border animate-fade-in backdrop-blur-md text-sm font-medium ${
          t.type === "success"
            ? "bg-primary/10 border-primary/20 text-primary"
            : t.type === "error"
            ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-300"
            : "bg-white dark:bg-card-dark border-gray-200 dark:border-white/10 text-slate-700 dark:text-slate-200"
        }`}
      >
        <span className="material-symbols-outlined text-[18px]">
          {t.type === "success" ? "check_circle" : t.type === "error" ? "error" : "info"}
        </span>
        <span className="flex-1">{t.message}</span>
        <button onClick={() => onDismiss(t.id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    ))}
  </div>
);

// ─── Analysis Progress Steps ──────────────────────────────────────────────────
const STEPS = ["Searching evidence", "Analyzing with AI", "Computing trust score"];

const STEP_ICONS = ["search", "psychology", "score"];
const STEP_MESSAGES = [
  "Searching trusted sources for evidence...",
  "AI is analyzing credibility and bias...",
  "Computing final trust score...",
];

const AnalysisStepper = ({ currentStep }: { currentStep: number }) => (
  <div className="flex flex-col items-center py-16 gap-8 animate-fade-in">
    {/* Current step message */}
    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium animate-pulse">
      {STEP_MESSAGES[Math.min(currentStep, 2)]}
    </p>

    {/* Stepper */}
    <div className="flex items-center gap-0 w-full max-w-lg">
      {STEPS.map((label, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-2 relative z-10">
            <div
              className={`size-10 rounded-full flex items-center justify-center transition-all duration-700 ${
                i < currentStep
                  ? "bg-primary text-background-dark shadow-lg shadow-primary/20"
                  : i === currentStep
                  ? "bg-primary/20 text-primary ring-4 ring-primary/10"
                  : "bg-slate-200 dark:bg-white/10 text-slate-400"
              }`}
            >
              {i < currentStep ? (
                <span className="material-symbols-outlined text-[18px]">check</span>
              ) : (
                <span className="material-symbols-outlined text-[18px]">{STEP_ICONS[i]}</span>
              )}
            </div>
            <span
              className={`text-xs font-medium text-center transition-colors whitespace-nowrap ${
                i <= currentStep ? "text-primary" : "text-slate-400"
              }`}
            >
              {label}
            </span>
          </div>
          {/* Connecting line */}
          {i < STEPS.length - 1 && (
            <div className="flex-1 h-0.5 mx-2 bg-slate-200 dark:bg-white/10 rounded-full relative overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700"
                style={{ width: i < currentStep ? "100%" : "0%" }}
              />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>

    {/* Loading spinner */}
    <div className="size-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
  </div>
);

// ─── Home page with analysis flow ────────────────────────────────────────────
const HomePage = ({
  onAnalyze,
  onAnalyzeImage,
  analysisResult,
  isLoading,
  error,
  language,
  analysisStep,
}: {
  onAnalyze: (input: string) => void;
  onAnalyzeImage: (file: File) => void;
  analysisResult: AnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  language: "en" | "hi" | "mr";
  analysisStep: number;
}) => {
  const handleTrendingClick = (headline: string) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    onAnalyze(headline);
  };

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-12 flex flex-col gap-12 mb-12">
      <HeroSection onAnalyze={onAnalyze} onAnalyzeImage={onAnalyzeImage} isLoading={isLoading} />

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {isLoading && !analysisResult && <AnalysisStepper currentStep={analysisStep} />}

      {analysisResult && !isLoading && <Dashboard data={analysisResult} language={language} />}

      <TrendingSection onCardClick={handleTrendingClick} />
    </main>
  );
};

// ─── Root App ─────────────────────────────────────────────────────────────────
const App = () => {
  const [language, setLanguage] = useState<"en" | "hi" | "mr">("en");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("verifi_dark") !== "false";
  });
  const [analysisStep, setAnalysisStep] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: Toast["type"] = "info") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem("verifi_token");
    if (token) {
      getMe().then((u) => { if (u) setUser(u); });
    }
  }, []);

  // Apply dark mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("verifi_dark", String(darkMode));
  }, [darkMode]);

  const handleAnalyze = async (input: string) => {
    if (!input.trim()) {
      addToast("Please enter a headline, URL, or claim to analyze", "error");
      return;
    }
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    setAnalysisStep(0);

    const stepTimer1 = setTimeout(() => setAnalysisStep(1), 2000);
    const stepTimer2 = setTimeout(() => setAnalysisStep(2), 6000);

    try {
      const result = await analyzeContent(input.trim());
      setAnalysisResult(result);
      setAnalysisStep(3);
      addToast("Analysis complete!", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please ensure the backend is running.");
      addToast("Analysis failed", "error");
    } finally {
      setIsLoading(false);
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
    }
  };

  const handleAnalyzeImage = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    setAnalysisStep(0);

    const stepTimer1 = setTimeout(() => setAnalysisStep(1), 2000);
    const stepTimer2 = setTimeout(() => setAnalysisStep(2), 6000);

    try {
      const result = await analyzeImageApi(file);
      setAnalysisResult(result);
      setAnalysisStep(3);
      addToast("Image analysis complete!", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image analysis failed.");
      addToast("Image analysis failed", "error");
    } finally {
      setIsLoading(false);
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
    }
  };

  const handleAuthSuccess = (u: User, _token: string) => {
    setUser(u);
    addToast(`Welcome back, ${u.name}!`, "success");
  };

  const handleLogout = () => {
    localStorage.removeItem("verifi_token");
    setUser(null);
    addToast("Logged out successfully", "info");
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-background-light dark:bg-background-dark font-display">
        <Navbar
          setLanguage={setLanguage}
          user={user}
          onAuthSuccess={handleAuthSuccess}
          onLogout={handleLogout}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />

        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                onAnalyze={handleAnalyze}
                onAnalyzeImage={handleAnalyzeImage}
                analysisResult={analysisResult}
                isLoading={isLoading}
                error={error}
                language={language}
                analysisStep={analysisStep}
              />
            }
          />
          <Route
            path="/history"
            element={
              <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12">
                <HistoryPage user={user} onAuthSuccess={handleAuthSuccess} />
              </main>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12">
                <LeaderboardPage />
              </main>
            }
          />
          <Route
            path="/compare"
            element={
              <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-12">
                <ComparePage />
              </main>
            }
          />
          <Route
            path="/extension"
            element={
              <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12">
                <ExtensionPage />
              </main>
            }
          />
        </Routes>

        <footer className="w-full border-t border-gray-200 dark:border-white/5 mt-auto bg-background-light dark:bg-background-dark py-8">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-lg">verified_user</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Verifi.ai</p>
                <p className="text-xs text-slate-400">AI-powered news credibility · © 2026</p>
              </div>
            </div>
            <div className="flex gap-6 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">bolt</span> Real-time Analysis</span>
              <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">public</span> Global Sources</span>
              <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">lock</span> Private & Secure</span>
            </div>
            <div className="flex gap-4 text-xs text-slate-400">
              <span className="hover:text-primary cursor-pointer transition-colors">About</span>
              <span className="hover:text-primary cursor-pointer transition-colors">Privacy</span>
              <span className="hover:text-primary cursor-pointer transition-colors">Contact</span>
            </div>
          </div>
        </footer>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </BrowserRouter>
  );
};

export default App;
