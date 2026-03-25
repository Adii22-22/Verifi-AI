import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { User } from "../../types";
import AuthModal from "./AuthModal";

interface NavbarProps {
  setLanguage: (l: "en" | "hi" | "mr") => void;
  user: User | null;
  onAuthSuccess: (user: User, token: string) => void;
  onLogout: () => void;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
}

const Navbar: React.FC<NavbarProps> = ({ setLanguage, user, onAuthSuccess, onLogout, darkMode, setDarkMode }) => {
  const [showAuth, setShowAuth] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        // Don't close if clicking the hamburger button itself
        const hamburger = document.getElementById("hamburger-btn");
        if (hamburger && hamburger.contains(e.target as Node)) return;
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { to: "/", label: "Analyze", icon: "auto_awesome" },
    { to: "/compare", label: "Compare", icon: "compare_arrows" },
    { to: "/history", label: "History", icon: "history" },
    { to: "/leaderboard", label: "Leaderboard", icon: "leaderboard" },
    { to: "/extension", label: "Extension", icon: "extension" },
  ];

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-white/5 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="size-9 rounded-xl bg-primary flex items-center justify-center text-background-dark shadow-glow">
              <span className="material-symbols-outlined text-xl">verified_user</span>
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">Verifi.ai</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label, icon }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-slate-500 hover:text-primary dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{icon}</span>
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Dark mode toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="size-9 rounded-full bg-slate-100 dark:bg-surface-dark flex items-center justify-center hover:bg-primary/10 dark:hover:bg-primary/10 transition-colors text-slate-600 dark:text-slate-300 hover:text-primary"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              <span className="material-symbols-outlined text-[18px]">
                {darkMode ? "light_mode" : "dark_mode"}
              </span>
            </button>

            {/* Language selector */}
            <select
              onChange={(e) => setLanguage(e.target.value as "en" | "hi" | "mr")}
              className="text-xs border border-gray-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-200 bg-white dark:bg-surface-dark focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="en">EN</option>
              <option value="hi">हि</option>
              <option value="mr">मर</option>
            </select>

            {/* Auth section */}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-slate-100 dark:bg-surface-dark hover:bg-primary/10 dark:hover:bg-primary/10 transition-colors"
                >
                  <div className="size-7 rounded-full bg-primary flex items-center justify-center text-background-dark font-bold text-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-slate-900 dark:text-white hidden sm:block max-w-[100px] truncate">
                    {user.name}
                  </span>
                  <span className="material-symbols-outlined text-slate-400 text-[16px]">expand_more</span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-12 bg-white dark:bg-card-dark border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl w-48 py-2 z-50 animate-fade-in">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-white/5 mb-1">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{user.name}</p>
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    </div>
                    <Link
                      to="/history"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">history</span>
                      My History
                    </Link>
                    <button
                      onClick={() => { onLogout(); setShowUserMenu(false); }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">logout</span>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-background-dark font-bold rounded-full text-sm transition-all shadow-lg shadow-primary/20"
              >
                <span className="material-symbols-outlined text-[16px]">login</span>
                Login
              </button>
            )}

            {/* Hamburger (mobile only) */}
            <button
              id="hamburger-btn"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden size-9 rounded-full bg-slate-100 dark:bg-surface-dark flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-primary/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">{mobileOpen ? "close" : "menu"}</span>
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <div
            ref={mobileMenuRef}
            className="md:hidden border-t border-gray-200 dark:border-white/5 bg-background-light dark:bg-background-dark px-6 pb-4 pt-2 space-y-1 animate-fade-in"
          >
            {navLinks.map(({ to, label, icon }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{icon}</span>
                  {label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={(u, t) => { onAuthSuccess(u, t); setShowAuth(false); }}
        />
      )}
    </>
  );
};

export default Navbar;
