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
      if (chrome.runtime.lastError) { ss = null; }
      sendToggle(tab.id, ss);
    });
  } catch(e) {
    sendToggle(tab.id, null);
  }
});

function sendToggle(tabId, screenshot) {
  chrome.tabs.sendMessage(tabId, { type: "VERIFI_TOGGLE", screenshot: screenshot || null }, function(response) {
    if (chrome.runtime.lastError) {
      // Content script not injected yet — inject it programmatically, then retry
      console.log("Verifi.ai: Content script not found, injecting...");
      chrome.scripting.insertCSS({ target: { tabId: tabId }, files: ["content.css"] }, function() {
        void chrome.runtime.lastError; // ignore errors
      });
      chrome.scripting.executeScript({ target: { tabId: tabId }, files: ["content.js"] }, function() {
        if (chrome.runtime.lastError) {
          console.error("Verifi.ai: Failed to inject content script:", chrome.runtime.lastError.message);
          window.close();
          return;
        }
        // Wait a bit for content script to initialize, then send toggle again
        setTimeout(function() {
          chrome.tabs.sendMessage(tabId, { type: "VERIFI_TOGGLE", screenshot: screenshot || null }, function() {
            void chrome.runtime.lastError;
            window.close();
          });
        }, 200);
      });
    } else {
      window.close();
    }
  });
}