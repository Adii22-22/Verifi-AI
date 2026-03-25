import React from "react";

const steps = [
  {
    icon: "download",
    title: "Download the Extension",
    desc: "Click the download button below to get the Verifi.ai extension folder.",
  },
  {
    icon: "settings",
    title: "Open Chrome Extensions",
    desc: 'Navigate to chrome://extensions in your browser and enable "Developer mode" in the top-right corner.',
  },
  {
    icon: "upload_file",
    title: "Load Unpacked",
    desc: 'Click "Load unpacked" and select the downloaded extension folder.',
  },
  {
    icon: "check_circle",
    title: "You're Ready!",
    desc: "Open any news article, click the Verifi.ai icon, and choose Text or Image mode to analyze.",
  },
];

const features = [
  {
    icon: "text_fields",
    title: "Text Analysis",
    desc: "Select any text on a page and analyze it instantly. Auto-detects highlighted text.",
  },
  {
    icon: "image_search",
    title: "Image Analysis",
    desc: "Capture a screenshot region or upload an image — like Google Lens for news.",
  },
  {
    icon: "translate",
    title: "Multi-Language",
    desc: "Get AI summaries in English, Hindi, and Marathi.",
  },
  {
    icon: "security",
    title: "Manipulation Detection",
    desc: "Detects edited images, cropped context, and misleading content.",
  },
  {
    icon: "speed",
    title: "Trust Score + Verdicts",
    desc: "Visual trust ring, claim-by-claim verdicts, and bias detection.",
  },
  {
    icon: "lock",
    title: "Privacy First",
    desc: "Only the current tab data is sent — no browsing history collected.",
  },
];

const ExtensionPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-12 max-w-4xl mx-auto w-full animate-fade-in">
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider">
          <span className="material-symbols-outlined text-[14px]">extension</span>
          Browser Extension v2.0
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Google Lens for{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">
            news verification.
          </span>
        </h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
          Select text or capture images directly on any webpage — Verifi.ai fact-checks it instantly without leaving the page.
        </p>
      </div>

      {/* Mode preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <span className="material-symbols-outlined">text_fields</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Text Mode</h3>
              <p className="text-xs text-slate-400">Analyze headlines, claims & URLs</p>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-surface-dark rounded-xl p-4 text-xs text-slate-500 space-y-2">
            <p>• Auto-detects selected text on the page</p>
            <p>• Paste any claim or URL manually</p>
            <p>• Gets trust score, bias, and claim verdicts</p>
          </div>
        </div>

        <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
              <span className="material-symbols-outlined">image_search</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Image Mode</h3>
              <p className="text-xs text-slate-400">Like Google Lens for news</p>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-surface-dark rounded-xl p-4 text-xs text-slate-500 space-y-2">
            <p>• Click & drag to capture any region on the page</p>
            <p>• Upload screenshots or photos from your device</p>
            <p>• Detects image manipulation & propaganda</p>
          </div>
        </div>
      </div>

      {/* Features grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((f) => (
          <div
            key={f.title}
            className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 p-5 shadow-sm flex items-start gap-4"
          >
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined">{f.icon}</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                {f.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {f.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Install steps */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          How to Install
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-white/5 p-5 shadow-sm flex items-start gap-4"
            >
              <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-background-dark font-black text-sm shrink-0">
                {i + 1}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  {step.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Download CTA */}
      <div className="bg-primary/10 rounded-2xl p-8 border border-primary/20 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-emerald-500/5" />
        <div className="relative space-y-4">
          <div className="size-14 mx-auto rounded-2xl bg-primary flex items-center justify-center text-background-dark shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-2xl">
              extension
            </span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Ready to Install?
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
            Works with Chrome, Edge, and Brave. Download the folder and follow the steps above.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/extension.zip"
              download
              className="inline-flex items-center gap-2 px-8 py-3 bg-primary hover:bg-primary/90 text-background-dark font-bold rounded-full transition-all shadow-lg shadow-primary/20"
            >
              <span className="material-symbols-outlined text-[20px]">
                download
              </span>
              Download Extension
            </a>
            <span className="text-xs text-slate-400">
              v2.0 · Chrome / Edge / Brave
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtensionPage;
