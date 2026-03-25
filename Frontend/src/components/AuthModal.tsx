import React, { useState } from "react";
import { loginUser, registerUser } from "../services/apiService";
import { User } from "../../types";

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (user: User, token: string) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data =
        mode === "login"
          ? await loginUser(email, password)
          : await registerUser(email, password, name);
      localStorage.setItem("verifi_token", data.access_token);
      // Bridge token to Chrome extension's storage so extension searches are saved
      try {
        const w = window as any;
        if (w.chrome?.storage?.local) {
          w.chrome.storage.local.set({ verifi_token: data.access_token });
        }
      } catch (_) {}
      onSuccess(data.user, data.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-card-dark rounded-2xl w-full max-w-md p-8 shadow-2xl border border-gray-200 dark:border-white/10 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 transition-colors"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-background-dark">
            <span className="material-symbols-outlined">verified_user</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {mode === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {mode === "login" ? "Login to save your analysis history" : "Save and track your fact-checks"}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-surface-dark rounded-xl mb-6">
          {(["login", "register"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setMode(tab); setError(null); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === tab
                  ? "bg-white dark:bg-card-dark text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
              }`}
            >
              {tab === "login" ? "Login" : "Register"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="mt-1 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-surface-dark border border-gray-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-surface-dark border border-gray-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-surface-dark border border-gray-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary hover:bg-primary/90 text-background-dark font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin text-[20px]">refresh</span>
            ) : (
              <span className="material-symbols-outlined text-[20px]">login</span>
            )}
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-4">
          You can also{" "}
          <button onClick={onClose} className="text-primary hover:underline">
            continue as guest
          </button>{" "}
          — analyses won't be saved.
        </p>
      </div>
    </div>
  );
};

export default AuthModal;
