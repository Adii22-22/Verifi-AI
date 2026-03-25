chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
  var tab = tabs[0];
  if (!tab || !tab.id) { window.close(); return; }
  var url = tab.url || "";
  if (url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:")) {
    window.close(); return;
  }
  // Try to capture screenshot, but still work if it fails
  try {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, function(ss) {
      // Ignore capture errors (e.g. permission denied) — still send toggle
      if (chrome.runtime.lastError) { ss = null; }
      chrome.tabs.sendMessage(tab.id, { type: "VERIFI_TOGGLE", screenshot: ss || null }, function() {
        void chrome.runtime.lastError;
      });
      window.close();
    });
  } catch(e) {
    // If captureVisibleTab throws, still toggle the overlay without screenshot
    chrome.tabs.sendMessage(tab.id, { type: "VERIFI_TOGGLE", screenshot: null }, function() {
      void chrome.runtime.lastError;
    });
    window.close();
  }
});