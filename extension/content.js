/**
 * Verifi.ai — Premium Extension v4
 * Clean architecture, proper SVG icons, resizable panel, theme toggle, language switch
 */

var VERIFI_API = "http://localhost:8000";
var verifiSS   = null;
var verifiOn   = false;
var panelTheme = "dark";
var _authToken = null;

try { var _t = localStorage.getItem("vf_theme"); if (_t === "light" || _t === "dark") panelTheme = _t; } catch(e) {}

/* Try to get auth token from chrome.storage or localStorage */
try {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["verifi_token"], function(r) {
      if (r && r.verifi_token) _authToken = r.verifi_token;
    });
  }
} catch(e) {}
try {
  var _tk = localStorage.getItem("verifi_token");
  if (_tk) _authToken = _tk;
} catch(e) {}

/* ── SVG Icons ── */
var ICO = {
  area:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
  text:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>',
  upload: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  close:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  sun:    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>',
  moon:   '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>',
  grid:   '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  arrow:  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'
};

/* ── Message listener ── */
try {
  chrome.runtime.onMessage.addListener(function(msg, _, respond) {
    if (msg && msg.type === "VERIFI_TOGGLE") {
      verifiSS = msg.screenshot || null;
      verifiOn ? verifiClose() : verifiOpen();
      try { respond({ ok: true }); } catch(e) {}
    }
    return true;
  });
} catch(e) {}

/* ════════════════════════════════════════════
   OPEN
   ════════════════════════════════════════════ */
function verifiOpen() {
  if (document.getElementById("vf-root")) return;
  verifiOn = true;
  document.body.style.overflow = "hidden";

  var root = document.createElement("div");
  root.id = "vf-root";

  root.innerHTML = [
    '<div id="vf-backdrop"></div>',

    /* ── TOP BAR ── */
    '<div id="vf-topbar">',
      '<div class="vf-brand">',
        '<div class="vf-logo">V</div>',
        '<span>Verifi.ai</span>',
      '</div>',
      '<div class="vf-sep"></div>',
      '<button id="vf-btn-area" class="vf-tool active">' + ICO.area + ' Select Area</button>',
      '<button id="vf-btn-text" class="vf-tool">' + ICO.text + ' Select Text</button>',
      '<button id="vf-btn-upload" class="vf-tool">' + ICO.upload + ' Upload</button>',
      '<input type="file" id="vf-file" accept="image/*" style="display:none">',
      '<div class="vf-sep"></div>',
      '<button id="vf-btn-close" class="vf-icon-btn vf-close-hover" title="Close (Esc)">' + ICO.close + '</button>',
    '</div>',

    /* ── HINT ── */
    '<div id="vf-hint">Click and drag to select an area</div>',

    /* ── CANVAS ── */
    '<canvas id="vf-canvas"></canvas>',

    /* ── RESULTS PANEL ── */
    '<div id="vf-panel" class="vf-panel-hidden' + (panelTheme === "light" ? " vf-light" : "") + '">',
      '<div id="vf-resize-h"></div>',
      '<div id="vf-resize-v"></div>',
      '<div id="vf-panel-hdr">',
        '<div class="vf-brand">',
          '<div class="vf-logo">V</div>',
          '<span>Results</span>',
        '</div>',
        '<div class="vf-hdr-actions">',
          '<select id="vf-lang" class="vf-lang-sel" style="display:none">',
            '<option value="en">EN</option>',
            '<option value="hi">\u0939\u093F\u0902\u0926\u0940</option>',
            '<option value="mr">\u092E\u0930\u093E\u0920\u0940</option>',
          '</select>',
          '<button id="vf-btn-theme" class="vf-theme-btn">' + (panelTheme === "dark" ? ICO.sun + " Light" : ICO.moon + " Dark") + '</button>',
          '<button id="vf-btn-panel-close" class="vf-icon-btn vf-close-hover">' + ICO.close + '</button>',
        '</div>',
      '</div>',
      '<div id="vf-panel-body"></div>',
    '</div>',

    /* ── TEXT POPUP ── */
    '<div id="vf-textpop" class="vf-hidden">',
      '<button id="vf-btn-analyze-sel" class="vf-textpop-btn">',
        '<div class="vf-textpop-icon">' + ICO.search + '</div>',
        'Analyze Credibility',
      '</button>',
    '</div>'
  ].join("");

  document.documentElement.appendChild(root);
  verifiSetup(root);
}

/* ════════════════════════════════════════════
   CLOSE
   ════════════════════════════════════════════ */
var _escHandler = null, _textHandler = null;

function verifiClose() {
  var r = document.getElementById("vf-root");
  if (r) r.remove();
  verifiOn = false;
  document.body.style.overflow = "";
  if (_escHandler) { document.removeEventListener("keydown", _escHandler); _escHandler = null; }
  if (_textHandler) { document.removeEventListener("mouseup", _textHandler); _textHandler = null; }
}

/* ════════════════════════════════════════════
   SETUP
   ════════════════════════════════════════════ */
function verifiSetup(root) {
  var canvas  = document.getElementById("vf-canvas");
  var hint    = document.getElementById("vf-hint");
  var panel   = document.getElementById("vf-panel");
  var pbody   = document.getElementById("vf-panel-body");
  var topbar  = document.getElementById("vf-topbar");
  var textpop = document.getElementById("vf-textpop");
  if (!canvas || !hint || !panel || !pbody) return;

  var ctx = canvas.getContext("2d");
  var dpr = window.devicePixelRatio || 1;
  var mode = "area", drawing = false, sx = 0, sy = 0;
  var savedData = null;

  /* Size canvas */
  function sizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
  }
  sizeCanvas();
  window.addEventListener("resize", sizeCanvas);

  /* ── Panel resize (horizontal) ── */
  var rh = document.getElementById("vf-resize-h");
  var rv = document.getElementById("vf-resize-v");
  if (rh) setupResize(rh, panel, "h");
  if (rv) setupResize(rv, panel, "v");

  function setupResize(handle, el, dir) {
    var startPos, startSize;
    handle.addEventListener("mousedown", function(e) {
      e.preventDefault();
      startPos = dir === "h" ? e.clientX : e.clientY;
      startSize = dir === "h" ? el.offsetWidth : el.offsetHeight;
      handle.classList.add("dragging");
      document.addEventListener("mousemove", onDrag);
      document.addEventListener("mouseup", stopDrag);
    });
    function onDrag(e) {
      var newSize;
      if (dir === "h") {
        newSize = Math.max(300, Math.min(560, startSize + (startPos - e.clientX)));
      } else {
        newSize = Math.max(200, Math.min(window.innerHeight - 28, startSize + (e.clientY - startPos)));
      }
      el.style[dir === "h" ? "width" : "height"] = newSize + "px";
    }
    function stopDrag() {
      handle.classList.remove("dragging");
      document.removeEventListener("mousemove", onDrag);
      document.removeEventListener("mouseup", stopDrag);
    }
  }

  /* ── Theme toggle ── */
  var themeBtn = document.getElementById("vf-btn-theme");
  if (themeBtn) {
    themeBtn.onclick = function() {
      panelTheme = panelTheme === "dark" ? "light" : "dark";
      try { localStorage.setItem("vf_theme", panelTheme); } catch(e) {}
      if (panelTheme === "light") {
        panel.classList.add("vf-light");
        themeBtn.innerHTML = ICO.moon + " Dark";
      } else {
        panel.classList.remove("vf-light");
        themeBtn.innerHTML = ICO.sun + " Light";
      }
    };
  }

  /* ── Language toggle ── */
  var langSel = document.getElementById("vf-lang");
  if (langSel) {
    langSel.addEventListener("change", function() {
      if (savedData && !panel.classList.contains("vf-panel-hidden")) {
        renderResults(savedData);
      }
    });
  }

  /* ── ESC ── */
  _escHandler = function(e) { if (e.key === "Escape") verifiClose(); };
  document.addEventListener("keydown", _escHandler);

  /* ── Close buttons ── */
  document.getElementById("vf-btn-close").onclick = verifiClose;
  document.getElementById("vf-btn-panel-close").onclick = function() { panel.classList.add("vf-panel-hidden"); };

  /* ────────────── MODE SWITCHING ────────────── */
  function toArea() {
    mode = "area";
    document.getElementById("vf-btn-area").classList.add("active");
    document.getElementById("vf-btn-text").classList.remove("active");
    canvas.style.display = "";
    canvas.style.pointerEvents = "auto";
    root.style.pointerEvents = "none";
    canvas.style.pointerEvents = "auto";
    topbar.style.pointerEvents = "auto";
    panel.style.pointerEvents = "auto";
    if (textpop) textpop.classList.add("vf-hidden");
    hint.textContent = "Click and drag to select an area";
    hint.style.display = "";
    if (_textHandler) { document.removeEventListener("mouseup", _textHandler); _textHandler = null; }
  }

  function toText() {
    mode = "text";
    document.getElementById("vf-btn-text").classList.add("active");
    document.getElementById("vf-btn-area").classList.remove("active");
    canvas.style.display = "none";
    root.style.pointerEvents = "none";
    topbar.style.pointerEvents = "auto";
    panel.style.pointerEvents = "auto";
    if (textpop) textpop.style.pointerEvents = "auto";
    hint.textContent = "Select any text on the page";
    hint.style.display = "";
    hint.style.pointerEvents = "none";
    listenText();
  }

  document.getElementById("vf-btn-area").onclick = toArea;
  document.getElementById("vf-btn-text").onclick = toText;

  var fInput = document.getElementById("vf-file");
  document.getElementById("vf-btn-upload").onclick = function() { fInput.click(); };
  fInput.onchange = function(e) {
    var f = e.target.files[0]; if (!f) return;
    fInput.value = "";
    toArea();
    var rd = new FileReader();
    rd.onload = function() { analyzeImage(rd.result); };
    rd.readAsDataURL(f);
  };

  /* ── Text selection listener ── */
  function listenText() {
    if (_textHandler) document.removeEventListener("mouseup", _textHandler);
    _textHandler = function(e) {
      if (topbar.contains(e.target) || panel.contains(e.target) || (textpop && textpop.contains(e.target))) return;
      setTimeout(function() {
        var sel = window.getSelection();
        var txt = sel ? sel.toString().trim() : "";
        if (txt.length > 3) {
          try {
            var rect = sel.getRangeAt(0).getBoundingClientRect();
            if (textpop) {
              textpop.classList.remove("vf-hidden");
              var cx = Math.max(120, Math.min(rect.left + rect.width / 2, window.innerWidth - 120));
              textpop.style.left = cx + "px";
              textpop.style.top = (rect.bottom + 12) + "px";
            }
            document.getElementById("vf-btn-analyze-sel").onclick = function() {
              textpop.classList.add("vf-hidden");
              root.style.pointerEvents = "none";
              topbar.style.pointerEvents = "auto";
              panel.style.pointerEvents = "auto";
              canvas.style.display = "";
              analyzeText(txt);
            };
          } catch(_) {}
        } else if (textpop) {
          textpop.classList.add("vf-hidden");
        }
      }, 20);
    };
    document.addEventListener("mouseup", _textHandler);
  }

  /* ────────────── CANVAS DRAWING ────────────── */
  canvas.onmousedown = function(e) {
    if (mode !== "area") return;
    sx = e.clientX; sy = e.clientY; drawing = true;
    hint.style.display = "none";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  canvas.onmousemove = function(e) {
    if (!drawing) return;
    var x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY);
    var w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(x, y, w, h);
    ctx.strokeStyle = "#34d399"; ctx.lineWidth = 2; ctx.setLineDash([]);
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    /* Corner brackets */
    var L = 14; ctx.lineWidth = 3;
    [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]].forEach(function(c) {
      ctx.beginPath();
      ctx.moveTo(c[0]+c[2]*L, c[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(c[0], c[1]+c[3]*L);
      ctx.stroke();
    });
  };

  canvas.onmouseup = function(e) {
    if (!drawing) return; drawing = false;
    var x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY);
    var w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy);
    if (w < 20 || h < 20) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hint.textContent = "Too small \u2014 try again";
      hint.style.display = "";
      return;
    }
    cropAndAnalyze(x, y, w, h);
  };

  /* ────────────── CROP ────────────── */
  function cropAndAnalyze(x, y, w, h) {
    if (!verifiSS) { showError("No screenshot \u2014 close and click the extension icon again."); return; }
    showLoading("Analyzing selected area\u2026");
    var img = new Image();
    img.onload = function() {
      var c = document.createElement("canvas");
      c.width = w * dpr; c.height = h * dpr;
      c.getContext("2d").drawImage(img, x * dpr, y * dpr, w * dpr, h * dpr, 0, 0, w * dpr, h * dpr);
      analyzeImage(c.toDataURL("image/png"));
    };
    img.onerror = function() { showError("Screenshot processing failed."); };
    img.src = verifiSS;
  }

  /* ────────────── API ────────────── */
  function _apiHeaders(extra) {
    var h = Object.assign({ "Content-Type": "application/json" }, extra || {});
    if (_authToken) h["Authorization"] = "Bearer " + _authToken;
    return h;
  }

  function analyzeText(text) {
    showLoading("Analyzing text\u2026");
    fetch(VERIFI_API + "/analyze", {
      method: "POST",
      headers: _apiHeaders(),
      body: JSON.stringify({ text: text })
    })
    .then(handleResponse)
    .then(function(d) { savedData = d; renderResults(d); })
    .catch(function(e) { showError(e.message); });
  }

  function analyzeImage(dataUrl) {
    showLoading("Analyzing image\u2026");
    fetch(dataUrl).then(function(r) { return r.blob(); })
    .then(function(blob) {
      var fd = new FormData();
      fd.append("file", blob, "capture.png");
      var h = {};
      if (_authToken) h["Authorization"] = "Bearer " + _authToken;
      return fetch(VERIFI_API + "/analyze-image", { method: "POST", headers: h, body: fd });
    })
    .then(handleResponse)
    .then(function(d) { savedData = d; renderResults(d); })
    .catch(function(e) { showError(e.message); });
  }

  function handleResponse(r) {
    if (!r.ok) throw new Error("Server " + r.status + " \u2014 is the backend running?");
    return r.json().then(function(d) {
      if (d.detail) throw new Error(d.detail);
      return d;
    });
  }

  /* ────────────── LOADING ────────────── */
  function showLoading(msg) {
    panel.classList.remove("vf-panel-hidden");
    pbody.innerHTML = '<div class="vf-loading"><div class="vf-spinner"></div><p>' + esc(msg) + '</p></div>';
  }

  /* ────────────── ERROR ────────────── */
  function showError(msg) {
    panel.classList.remove("vf-panel-hidden");
    pbody.innerHTML = [
      '<div class="vf-error">',
        '<div class="vf-error-icon">\u26A0\uFE0F</div>',
        '<h4>Something went wrong</h4>',
        '<p>' + esc(msg || "Unknown error") + '</p>',
        '<a class="vf-error-link" href="' + VERIFI_API + '/health" target="_blank">' + ICO.search + ' Check backend</a>',
      '</div>'
    ].join("");
  }

  /* ────────────── RENDER RESULTS ────────────── */
  function renderResults(data) {
    var lang = langSel ? langSel.value : "en";
    if (langSel) langSel.style.display = "block";

    var score = Math.round(data.trustScore || 0);
    var clr   = score >= 70 ? "#34d399" : score >= 50 ? "#fbbf24" : "#fb7185";
    var R = 28, circ = +(2 * Math.PI * R).toFixed(2);
    var dash = +(circ - (score / 100) * circ).toFixed(2);

    var acc  = data.factualAccuracy || "";
    var bias = data.biasRating || "";
    var accC  = acc === "High" ? "vf-badge-green" : acc === "Medium" ? "vf-badge-yellow" : acc ? "vf-badge-red" : "vf-badge-gray";
    var biasC = bias === "Neutral" || bias === "None" ? "vf-badge-green" : bias ? "vf-badge-yellow" : "vf-badge-gray";

    var headline = loc(data, "headline", lang) || "Analysis Complete";
    var summary  = loc(data, "summary", lang) || "No summary available.";
    var isImg    = data.extracted_text !== undefined || data.is_manipulated !== undefined;
    var claims   = data.claimVerdict || [];
    var tags     = data.tags || [];

    var h = [];

    /* Score card */
    h.push('<div class="vf-score-card">');
    h.push('<div class="vf-ring-wrap">');
    h.push('<svg width="68" height="68" viewBox="0 0 68 68">');
    h.push('<circle cx="34" cy="34" r="' + R + '" fill="none" stroke="var(--p-card2)" stroke-width="4.5"/>');
    h.push('<circle cx="34" cy="34" r="' + R + '" fill="none" stroke="' + clr + '" stroke-width="4.5"');
    h.push(' stroke-dasharray="' + circ + '" stroke-dashoffset="' + dash + '"');
    h.push(' stroke-linecap="round" style="transition:stroke-dashoffset 0.9s cubic-bezier(.16,1,.3,1)"/>');
    h.push('</svg>');
    h.push('<div class="vf-score-num" style="color:' + clr + '">' + score + '<span class="vf-score-sub">/100</span></div>');
    h.push('</div>');
    h.push('<div class="vf-score-info">');
    h.push('<div class="vf-score-title">' + esc(headline) + '</div>');
    h.push('<div class="vf-badges">');
    if (acc) h.push('<span class="vf-badge ' + accC + '">' + esc(acc) + ' Accuracy</span>');
    if (bias) h.push('<span class="vf-badge ' + biasC + '">' + esc(bias) + ' Bias</span>');
    h.push('</div></div></div>');

    /* Manipulation alert */
    if (isImg && data.is_manipulated !== undefined) {
      if (data.is_manipulated) {
        var signs = (data.manipulation_signs || []).map(function(s) { return "<li>" + esc(s) + "</li>"; }).join("");
        h.push('<div class="vf-alert vf-alert-danger"><span class="vf-alert-icon">\u26A0</span>');
        h.push('<div><strong>Manipulation Detected</strong>');
        if (signs) h.push('<ul>' + signs + '</ul>');
        h.push('</div></div>');
      } else {
        h.push('<div class="vf-alert vf-alert-safe"><span class="vf-alert-icon">\u2713</span>');
        h.push('<div><strong>No Manipulation Detected</strong></div></div>');
      }
    }

    /* Extracted text */
    if (isImg && data.extracted_text) {
      h.push('<div class="vf-card"><div class="vf-label">Extracted Text</div>');
      h.push('<p class="vf-mono">' + esc(data.extracted_text) + '</p></div>');
    }

    /* Summary */
    h.push('<div class="vf-card"><div class="vf-label">Summary</div>');
    h.push('<p class="vf-summary-text">' + esc(summary) + '</p></div>');

    /* Claim verdicts */
    if (claims.length > 0) {
      var vTitle = lang === "hi" ? "\u0926\u093E\u0935\u093E \u0928\u093F\u0930\u094D\u0923\u092F" : lang === "mr" ? "\u0926\u093E\u0935\u093E \u0928\u093F\u0915\u093E\u0932" : "Claim Verdicts";
      h.push('<div class="vf-label" style="margin-top:6px">' + vTitle + '</div>');
      claims.forEach(function(c) {
        var ct = loc(c, "claim", lang);
        var rt = loc(c, "reason", lang);
        var vl = (c.verdict || "").toLowerCase();
        var dc = vl === "verified" ? "#34d399" : vl === "false" ? "#fb7185" : vl === "misleading" ? "#fbbf24" : "#6b7280";
        var ic = vl === "verified" ? "\u2713" : vl === "false" ? "\u2717" : "!";
        h.push('<div class="vf-verdict">');
        h.push('<div class="vf-verdict-dot" style="background:' + dc + '">' + ic + '</div>');
        h.push('<div class="vf-verdict-body">');
        h.push('<strong>' + esc(c.verdict || "Unknown") + '</strong>');
        if (ct) h.push('<div class="vf-verdict-claim">' + esc(ct) + '</div>');
        if (rt) h.push('<div class="vf-verdict-reason">' + esc(rt) + '</div>');
        h.push('</div></div>');
      });
    }

    /* Tags */
    if (tags.length > 0) {
      h.push('<div class="vf-tags">');
      tags.forEach(function(t) { h.push('<span class="vf-tag">' + esc(t) + '</span>'); });
      h.push('</div>');
    }

    /* CTA */
    h.push('<a href="http://localhost:3000" target="_blank" class="vf-cta">');
    h.push(ICO.grid + ' Open Dashboard ' + ICO.arrow + '</a>');

    panel.classList.remove("vf-panel-hidden");
    pbody.innerHTML = h.join("");
  }

  /* ── Helpers ── */
  function loc(obj, key, lang) {
    if (lang === "hi" && obj[key + "_hi"]) return obj[key + "_hi"];
    if (lang === "mr" && obj[key + "_mr"]) return obj[key + "_mr"];
    return obj[key] || "";
  }
  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}