// ==========================================================================
// Lux — Khan Academy "Highlight" düğmesi
// ==========================================================================
// Sadece bir SORU sayfası açıkken sağ üst köşede bir "Highlight" düğmesi
// gösterir. Düğme açıkken, sayfada seçilen her metin fare bırakıldığı anda
// seçili renkle otomatik vurgulanır — düğme kapatılana kadar. Ctrl+Z
// (Mac'te Cmd+Z) en son vurguyu geri alır.
//
// Vurgulama/geri alma mantığı YAZILMADI: content.js'in aynı izole dünyada
// paylaştığı window.__lux API'si kullanılıyor (highlight / undo / canUndo).
// Açık/kapalı durumu ve renk localStorage'da tutulur, böylece sonraki
// sorularda da "kapatılana kadar" açık kalır.
// ==========================================================================

(function () {
  if (window.__luxKhanLoaded) return;
  window.__luxKhanLoaded = true;

  var ON_KEY = "lux-khan-highlight";
  var COLOR_KEY = "lux-khan-color";
  var IS_MAC = /mac/i.test(
    (navigator.userAgentData && navigator.userAgentData.platform) ||
      navigator.platform ||
      ""
  );

  // Lux'un vurgu renkleri (content.js / bluebook.js ile aynı palet)
  var COLORS = [
    { name: "Yellow", hex: "#ffff00" },
    { name: "Blue", hex: "#a8d8ff" },
    { name: "Pink", hex: "#ffb3d9" },
    { name: "Green", hex: "#b3ffb3" },
    { name: "Orange", hex: "#ffd9a8" },
    { name: "Purple", hex: "#e0b3ff" }
  ];

  // DOMParser ile ekleniyor (AMO innerHTML'i sevmiyor) — xmlns ŞART,
  // yoksa <svg> namespace'siz kalır ve hiç çizilmez.
  var PEN_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18 10a2.83 2.83 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';

  var ui = null;

  /* ------------------------------ yardımcılar --------------------------- */

  function get(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  }
  function isOn() {
    return get(ON_KEY, "0") === "1";
  }
  function currentColor() {
    return get(COLOR_KEY, COLORS[0].hex);
  }
  function lux(fn, arg) {
    var api = window.__lux;
    if (api && typeof api[fn] === "function") return api[fn](arg);
    return undefined;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svgNode(markup) {
    var doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    return document.importNode(doc.documentElement, true);
  }
  // Tıklanınca metin seçimi kaybolmasın
  function keepSelection(e) {
    e.preventDefault();
  }

  // Metin kutusu / düzenlenebilir alan içinde miyiz? (orada ne vurgulayıp
  // ne de Ctrl+Z'yi yakalıyoruz — yazı yazma davranışı bozulmasın)
  function isEditable(node) {
    var e = node && node.nodeType === 1 ? node : node && node.parentElement;
    if (!e || !e.closest) return false;
    return !!e.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"]'
    );
  }

  /* ---------------------------- sayfa tespiti --------------------------- */

  // Khan'ın soruları Perseus ile render ediliyor. Soru sayfası = Perseus
  // içeriği VEYA "Check" düğmesi olan bir sayfa. Birden fazla işarete
  // bakıyoruz ki Khan bir sınıf adını değiştirse de çalışmaya devam etsin.
  function onQuestionPage() {
    if (
      document.querySelector(
        '.perseus-renderer, [class*="perseus-renderer"], [data-testid*="exercise-check"], [data-test-id*="exercise-check"]'
      )
    ) {
      return true;
    }
    var main = document.querySelector("main") || document.body;
    var buttons = main.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      var t = buttons[i].textContent.trim();
      if (t === "Check" || t === "Check answer") return true;
    }
    return false;
  }

  /* -------------------------------- arayüz ------------------------------ */

  function build() {
    var root = el("div", "lux-khan");
    root.id = "lux-khan";

    var toggle = el("button", "lux-khan-toggle");
    toggle.type = "button";
    var dot = el("span", "lux-khan-dot");
    dot.appendChild(svgNode(PEN_SVG));
    toggle.appendChild(dot);
    toggle.appendChild(el("span", "lux-khan-label", "Highlight"));
    toggle.addEventListener("mousedown", keepSelection);
    toggle.addEventListener("click", function () {
      set(ON_KEY, isOn() ? "0" : "1");
      render();
    });

    var swatches = el("div", "lux-khan-swatches");
    COLORS.forEach(function (c) {
      var b = el("button", "lux-khan-swatch");
      b.type = "button";
      b.title = c.name;
      b.dataset.color = c.hex;
      b.style.backgroundColor = c.hex;
      b.addEventListener("mousedown", keepSelection);
      b.addEventListener("click", function () {
        set(COLOR_KEY, c.hex);
        render();
      });
      swatches.appendChild(b);
    });

    var hint = el(
      "div",
      "lux-khan-hint",
      "Select text to highlight · " + (IS_MAC ? "⌘Z" : "Ctrl+Z") + " to undo"
    );

    root.appendChild(toggle);
    root.appendChild(swatches);
    root.appendChild(hint);
    document.body.appendChild(root);

    ui = { root: root, toggle: toggle, swatches: swatches, dot: dot };
    render();
  }

  function destroy() {
    if (ui) ui.root.remove();
    ui = null;
  }

  function render() {
    if (!ui) return;
    var on = isOn();
    var color = currentColor();
    ui.root.classList.toggle("is-on", on);
    ui.toggle.setAttribute("aria-pressed", on ? "true" : "false");
    ui.toggle.title = on
      ? "Highlighting is on — click to turn off"
      : "Turn on highlighting";
    ui.dot.style.backgroundColor = on ? color : "";
    Array.prototype.forEach.call(ui.swatches.children, function (b) {
      b.classList.toggle("is-selected", b.dataset.color === color);
    });
  }

  /* ------------------------------- olaylar ------------------------------ */

  // Açıkken: fare bırakılınca (veya Shift+ok ile seçim bitince) seçimi vurgula
  function maybeHighlight(e) {
    if (!ui || !isOn()) return;
    if (e.target && e.target.closest && e.target.closest("#lux-khan")) return;
    // Seçim, mouseup'tan hemen sonra kesinleşiyor
    setTimeout(function () {
      var sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      if (!sel.toString().trim()) return;
      var range = sel.getRangeAt(0);
      if (
        isEditable(range.startContainer) ||
        isEditable(range.endContainer) ||
        ui.root.contains(range.commonAncestorContainer)
      ) {
        return;
      }
      lux("highlight", currentColor());
    }, 0);
  }

  // Ctrl+Z (Mac'te Cmd+Z): en son vurguyu geri al. Sadece geri alınacak
  // vurgu varsa ve bir metin kutusunda değilsek tuşu yakalıyoruz.
  function onKeyDown(e) {
    if (!ui) return;
    var mod = IS_MAC ? e.metaKey : e.ctrlKey;
    if (!mod || e.shiftKey || e.altKey) return;
    if ((e.key || "").toLowerCase() !== "z") return;
    if (isEditable(e.target)) return;
    if (!lux("canUndo")) return;
    e.preventDefault();
    e.stopPropagation();
    lux("undo");
  }

  function onKeyUp(e) {
    if (e.shiftKey || e.key === "Shift") maybeHighlight(e);
  }

  /* -------------------------------- döngü ------------------------------- */

  // Khan tek sayfalık bir uygulama; sayfa geçişlerini takip etmek için
  // periyodik olarak kontrol ediyoruz.
  function tick() {
    if (onQuestionPage()) {
      if (!ui || !ui.root.isConnected) build();
      else render();
    } else if (ui) {
      destroy();
    }
  }

  function start() {
    if (!document.body) {
      setTimeout(start, 50);
      return;
    }
    document.addEventListener("mouseup", maybeHighlight, true);
    document.addEventListener("keyup", onKeyUp, true);
    document.addEventListener("keydown", onKeyDown, true);
    setInterval(tick, 400);
    tick();
  }

  start();
})();
