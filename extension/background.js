/**
 * Verifi.ai — Background Service Worker (Manifest V3)
 * Manages Chrome Side Panel behavior (opens side panel on action icon click),
 * screenshot capture, and API request routing without CSP/mixed-content blocks.
 */

const API_BASE = "http://localhost:8000";

// Configure Chrome Side Panel to open when user clicks the extension action icon in toolbar
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.log("Side panel behavior initialized:", error));
}

// Fallback for browsers where sidePanel API is not supported
if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener((tab) => {
    if (!chrome.sidePanel && tab && tab.id) {
      triggerInPageSidebar(tab.id);
    }
  });
}

function triggerInPageSidebar(tabId) {
  chrome.tabs.sendMessage(tabId, { type: "VERIFI_TOGGLE" }, () => {
    if (chrome.runtime.lastError) {
      chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] }, () => {
        void chrome.runtime.lastError;
        chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }, () => {
          if (!chrome.runtime.lastError) {
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, { type: "VERIFI_TOGGLE" });
            }, 100);
          }
        });
      });
    }
  });
}

// Health check
async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// Analyze text via backend
async function analyzeText(text, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Server error: ${res.status}`);
  }
  return await res.json();
}

// Analyze image via backend
async function analyzeImage(dataUrl, token = null) {
  const blob = await (await fetch(dataUrl)).blob();
  const formData = new FormData();
  formData.append("file", blob, "snip.png");

  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/analyze-image`, {
    method: "POST",
    headers,
    body: formData,
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Image analysis error: ${res.status}`);
  }
  return await res.json();
}

// Listen for messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CHECK_HEALTH") {
    checkHealth().then((ok) => sendResponse({ ok }));
    return true;
  }

  if (msg.type === "ANALYZE_TEXT") {
    analyzeText(msg.text, msg.token)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "ANALYZE_IMAGE") {
    analyzeImage(msg.dataUrl, msg.token)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "CAPTURE_TAB") {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({ ok: false, error: chrome.runtime.lastError?.message || "Failed to capture tab" });
      } else {
        sendResponse({ ok: true, dataUrl });
      }
    });
    return true;
  }

  if (msg.type === "START_SNIP") {
    const tabId = msg.tabId;
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (screenshot) => {
      const ss = chrome.runtime.lastError ? null : screenshot;
      chrome.tabs.sendMessage(tabId, { type: "VERIFI_TOGGLE", screenshot: ss }, () => {
        if (chrome.runtime.lastError) {
          chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] }, () => {
            void chrome.runtime.lastError;
            chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }, () => {
              if (chrome.runtime.lastError) {
                sendResponse({ ok: false, error: chrome.runtime.lastError.message });
              } else {
                setTimeout(() => {
                  chrome.tabs.sendMessage(tabId, { type: "VERIFI_TOGGLE", screenshot: ss }, () => {
                    void chrome.runtime.lastError;
                    sendResponse({ ok: true });
                  });
                }, 150);
              }
            });
          });
        } else {
          sendResponse({ ok: true });
        }
      });
    });
    return true;
  }
});
