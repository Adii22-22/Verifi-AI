/**
 * Verifi.ai — Side Panel Script
 * Manages active tab detection, theme switching (Black / White),
 * backend communication, and result rendering.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const htmlEl = document.documentElement;
  const btnTheme = document.getElementById("btn-theme-toggle");
  const themeIcon = document.getElementById("theme-icon");
  const themeLabel = document.getElementById("theme-label");

  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");

  const tabTitle = document.getElementById("tab-title");
  const tabUrl = document.getElementById("tab-url");
  const btnRefreshTab = document.getElementById("btn-refresh-tab");
  const btnAnalyzePage = document.getElementById("btn-analyze-page");
  const btnSnipArea = document.getElementById("btn-snip-area");

  const textInput = document.getElementById("text-input");
  const btnAnalyzeText = document.getElementById("btn-analyze-text");

  const loadingState = document.getElementById("loading-state");
  const loadingText = document.getElementById("loading-text");
  const errorState = document.getElementById("error-state");
  const errorMessage = document.getElementById("error-message");
  const btnRetry = document.getElementById("btn-retry");

  const resultContainer = document.getElementById("result-container");
  const btnClearResults = document.getElementById("btn-clear-results");

  let currentTab = null;
  let lastPayload = null;

  /* ════════════════════════════════════════════
     1. SIMPLE BLACK & WHITE THEME SWITCHER
     ════════════════════════════════════════════ */
  let currentTheme = localStorage.getItem("verifi_theme") || "dark";
  applyTheme(currentTheme);

  btnTheme.addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    localStorage.setItem("verifi_theme", currentTheme);
    applyTheme(currentTheme);
  });

  function applyTheme(theme) {
    htmlEl.setAttribute("data-theme", theme);
    if (theme === "dark") {
      themeIcon.textContent = "☀️";
      themeLabel.textContent = "White";
      btnTheme.title = "Switch to White (Light) Mode";
    } else {
      themeIcon.textContent = "🌙";
      themeLabel.textContent = "Black";
      btnTheme.title = "Switch to Black (Dark) Mode";
    }
  }

  /* ════════════════════════════════════════════
     2. BACKEND HEALTH CHECK
     ════════════════════════════════════════════ */
  function checkBackendHealth() {
    chrome.runtime.sendMessage({ type: "CHECK_HEALTH" }, (res) => {
      if (res && res.ok) {
        statusDot.className = "status-dot online";
        statusText.textContent = "Online";
      } else {
        statusDot.className = "status-dot offline";
        statusText.textContent = "Offline";
      }
    });
  }
  checkBackendHealth();
  setInterval(checkBackendHealth, 15000);

  /* ════════════════════════════════════════════
     3. ACTIVE TAB DETECTION
     ════════════════════════════════════════════ */
  function updateActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab) {
        tabTitle.textContent = "No active tab";
        tabUrl.textContent = "—";
        currentTab = null;
        return;
      }
      currentTab = tab;
      tabTitle.textContent = tab.title || "Untitled Page";
      tabUrl.textContent = tab.url || "";
    });
  }
  updateActiveTab();

  // Listen for tab switch or tab navigation
  if (chrome.tabs && chrome.tabs.onActivated) {
    chrome.tabs.onActivated.addListener(updateActiveTab);
  }
  if (chrome.tabs && chrome.tabs.onUpdated) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status === "complete") updateActiveTab();
    });
  }

  btnRefreshTab.addEventListener("click", updateActiveTab);

  /* ════════════════════════════════════════════
     4. ACTIONS (ANALYZE PAGE & TEXT)
     ════════════════════════════════════════════ */
  btnAnalyzePage.addEventListener("click", () => {
    if (!currentTab || !currentTab.url) {
      showError("No active webpage URL found.");
      return;
    }
    if (currentTab.url.startsWith("chrome://") || currentTab.url.startsWith("about:")) {
      showError("Cannot verify internal browser pages. Please open a news article or website.");
      return;
    }
    runVerification(currentTab.url, "Analyzing webpage content & checking facts…");
  });

  btnAnalyzeText.addEventListener("click", () => {
    const text = textInput.value.trim();
    if (!text) {
      textInput.focus();
      return;
    }
    runVerification(text, "Verifying claim against news evidence…");
  });

  btnSnipArea.addEventListener("click", () => {
    if (!currentTab || !currentTab.id) {
      showError("Please open a valid tab to snip an area.");
      return;
    }
    chrome.runtime.sendMessage({ type: "START_SNIP", tabId: currentTab.id }, (res) => {
      if (res && !res.ok) {
        showError(res.error || "Could not launch snip tool on this page.");
      }
    });
  });

  btnClearResults.addEventListener("click", () => {
    resultContainer.classList.add("sp-hidden");
    errorState.classList.add("sp-hidden");
    textInput.value = "";
  });

  btnRetry.addEventListener("click", () => {
    if (lastPayload) {
      runVerification(lastPayload.text, lastPayload.msg, lastPayload.isImage, lastPayload.dataUrl);
    } else {
      errorState.classList.add("sp-hidden");
    }
  });

  // Listen for analysis results coming from on-page snip
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "SNIP_ANALYSIS_RESULT" && msg.data) {
      renderResults(msg.data);
    }
  });

  /* ════════════════════════════════════════════
     5. RUN VERIFICATION VIA BACKEND
     ════════════════════════════════════════════ */
  function runVerification(text, loadingMsg = "Analyzing…", isImage = false, dataUrl = null) {
    lastPayload = { text, msg: loadingMsg, isImage, dataUrl };

    // UI state
    loadingState.classList.remove("sp-hidden");
    loadingText.textContent = loadingMsg;
    errorState.classList.add("sp-hidden");
    resultContainer.classList.add("sp-hidden");

    btnAnalyzePage.disabled = true;
    btnAnalyzeText.disabled = true;

    chrome.storage.local.get(["verifi_token"], (store) => {
      const token = store?.verifi_token || null;
      const msgType = isImage ? "ANALYZE_IMAGE" : "ANALYZE_TEXT";
      const payload = isImage ? { type: msgType, dataUrl, token } : { type: msgType, text, token };

      chrome.runtime.sendMessage(payload, (res) => {
        loadingState.classList.add("sp-hidden");
        btnAnalyzePage.disabled = false;
        btnAnalyzeText.disabled = false;

        if (res && res.ok && res.data) {
          renderResults(res.data);
        } else {
          showError(res?.error || "Analysis failed. Make sure the backend server is running on http://localhost:8000");
        }
      });
    });
  }

  function showError(msg) {
    loadingState.classList.add("sp-hidden");
    errorState.classList.remove("sp-hidden");
    errorMessage.textContent = msg;
    resultContainer.classList.add("sp-hidden");
  }

  /* ════════════════════════════════════════════
     6. RENDER RESULTS VIEW
     ════════════════════════════════════════════ */
  function renderResults(data) {
    resultContainer.classList.remove("sp-hidden");
    errorState.classList.add("sp-hidden");

    const score = Math.round(data.trustScore || 0);
    const scoreNum = document.getElementById("score-number");
    const scoreRing = document.getElementById("sp-ring-fill");
    const scoreVerdict = document.getElementById("score-verdict");

    // Score label & colors
    let strokeColor = "#22c55e"; // Green
    let verdictText = "Highly Credible";

    if (score < 40) {
      strokeColor = "#ef4444"; // Red
      verdictText = "Unreliable / Contradicted";
    } else if (score < 60) {
      strokeColor = "#f59e0b"; // Yellow
      verdictText = "Mixed / Caution";
    } else if (score < 80) {
      strokeColor = "#22c55e";
      verdictText = "Mostly Accurate";
    }

    scoreNum.textContent = score;
    scoreVerdict.textContent = verdictText;

    // Ring animation
    const circumference = 2 * Math.PI * 34; // r=34 -> 213.6
    const offset = circumference - (score / 100) * circumference;
    scoreRing.style.stroke = strokeColor;
    scoreRing.style.strokeDasharray = `${circumference}`;
    setTimeout(() => {
      scoreRing.style.strokeDashoffset = `${offset}`;
    }, 50);

    // Pills
    const pillAcc = document.getElementById("pill-accuracy");
    const acc = data.factualAccuracy || "Medium";
    pillAcc.textContent = `Accuracy: ${acc}`;
    pillAcc.className = `sp-pill ${acc === "High" ? "green" : acc === "Medium" ? "yellow" : "red"}`;

    const pillBias = document.getElementById("pill-bias");
    const bias = data.biasRating || "Neutral";
    pillBias.textContent = `Bias: ${bias}`;
    pillBias.className = `sp-pill ${bias === "Neutral" ? "green" : "yellow"}`;

    // Manipulation warning (for images)
    const manipBanner = document.getElementById("manipulation-banner");
    const manipList = document.getElementById("manipulation-list");
    if (data.is_manipulated !== undefined && data.is_manipulated) {
      manipBanner.classList.remove("sp-hidden");
      manipList.innerHTML = (data.manipulation_signs || [])
        .map((s) => `<li>${escapeHtml(s)}</li>`)
        .join("");
    } else {
      manipBanner.classList.add("sp-hidden");
    }

    // Headline & Summary
    document.getElementById("result-headline").textContent = data.headline || "Fact-Check Result";
    document.getElementById("result-summary").textContent = data.summary || "No summary available.";

    // Claim Breakdown
    const claimsCard = document.getElementById("claims-card");
    const claimsList = document.getElementById("claims-list");
    const claims = data.claimVerdict || [];
    if (claims.length > 0) {
      claimsCard.classList.remove("sp-hidden");
      claimsList.innerHTML = claims
        .map((c) => {
          const v = c.verdict || "Unverified";
          return `
            <div class="sp-claim-item">
              <div class="sp-claim-header">
                <span class="sp-claim-text">${escapeHtml(c.claim || "")}</span>
                <span class="sp-claim-badge ${escapeHtml(v)}">${escapeHtml(v)}</span>
              </div>
              <p class="sp-claim-reason">${escapeHtml(c.reason || "")}</p>
            </div>
          `;
        })
        .join("");
    } else {
      claimsCard.classList.add("sp-hidden");
    }

    // Evidence & Cross-References
    const sourcesCard = document.getElementById("sources-card");
    const sourcesList = document.getElementById("sources-list");
    const sources = data.crossReferences || [];
    if (sources.length > 0) {
      sourcesCard.classList.remove("sp-hidden");
      sourcesList.innerHTML = sources
        .map((s) => {
          const name = escapeHtml(s.source || "News Source");
          const time = escapeHtml(s.timeAgo || "");
          const url = s.url || "";
          if (url) {
            return `
              <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="sp-source-link">
                <div>
                  <strong>${name}</strong>
                  <span class="sp-source-meta">· ${time}</span>
                </div>
                <span>↗</span>
              </a>
            `;
          }
          return `
            <div class="sp-source-link" style="cursor:default;">
              <div>
                <strong>${name}</strong>
                <span class="sp-source-meta">· ${time}</span>
              </div>
            </div>
          `;
        })
        .join("");
    } else {
      sourcesCard.classList.add("sp-hidden");
    }

    // Tags
    const tagsContainer = document.getElementById("tags-container");
    const tags = data.tags || [];
    tagsContainer.innerHTML = tags.map((t) => `<span class="sp-tag">#${escapeHtml(t)}</span>`).join("");

    // Scroll results into view smoothly
    resultContainer.scrollIntoView({ behavior: "smooth" });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
});
