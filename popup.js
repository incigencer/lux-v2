// Lux toolbar paneli: Auto-highlight aç/kapa, renk seçimi, kısayol özeti
// ve Help sayfası bağlantısı. Ayarlar chrome.storage.local'da tutulur;
// content.js storage.onChanged ile anında güncellenir.

(function () {
  var DEFAULT_COLOR = "#ffff00";
  var IS_MAC = /mac/i.test(
    (navigator.userAgentData && navigator.userAgentData.platform) ||
      navigator.platform ||
      ""
  );

  var autoInput = document.getElementById("auto");
  var swatches = Array.prototype.slice.call(document.querySelectorAll(".swatch"));

  function markColor(color) {
    swatches.forEach(function (b) {
      b.classList.toggle("is-selected", b.dataset.color === color);
    });
  }

  var persistInput = document.getElementById("persist");

  chrome.storage.local.get(
    ["autoHighlight", "autoColor", "persistHighlights"],
    function (res) {
      res = res || {};
      autoInput.checked = !!res.autoHighlight;
      persistInput.checked = !!res.persistHighlights;
      markColor(res.autoColor || DEFAULT_COLOR);
    }
  );

  autoInput.addEventListener("change", function () {
    chrome.storage.local.set({ autoHighlight: autoInput.checked });
  });

  persistInput.addEventListener("change", function () {
    chrome.storage.local.set({ persistHighlights: persistInput.checked });
  });

  swatches.forEach(function (b) {
    b.addEventListener("click", function () {
      chrome.storage.local.set({ autoColor: b.dataset.color });
      markColor(b.dataset.color);
    });
  });

  // Kısayol özeti: kullanıcının GERÇEKTEN atanmış kısayollarını göster
  // (chrome://extensions/shortcuts'ta değiştirilmiş olabilir).
  function setKey(name, text) {
    var el = document.querySelector('kbd[data-key="' + name + '"]');
    if (el) el.textContent = text;
  }
  function prettify(shortcut) {
    if (!shortcut) return "Not set";
    // Chrome Mac'te "⌃⇧H" gibi semboller döndürebiliyor; olduğu gibi göster
    return shortcut;
  }

  setKey("highlight", IS_MAC ? "Control+Shift+H" : "Ctrl+Shift+H");
  setKey("undo", IS_MAC ? "⌘Z" : "Ctrl+Z");
  setKey("undo-global", IS_MAC ? "Control+Shift+Z" : "Ctrl+Shift+Z");

  try {
    chrome.commands.getAll(function (commands) {
      (commands || []).forEach(function (c) {
        if (c.name === "highlight-selection") setKey("highlight", prettify(c.shortcut));
        if (c.name === "undo-highlight") setKey("undo-global", prettify(c.shortcut));
      });
    });
  } catch (e) {}

  document.getElementById("help").addEventListener("click", function (e) {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL("help.html") });
    window.close();
  });
})();
