// Help sayfası: kısayolları kullanıcının işletim sistemine göre doldurur,
// tabloda kendi sütununu vurgular ve "shortcut settings" düğmesini bağlar.

(function () {
  var IS_MAC = /mac/i.test(
    (navigator.userAgentData && navigator.userAgentData.platform) ||
      navigator.platform ||
      ""
  );
  var IS_FIREFOX = /firefox/i.test(navigator.userAgent);

  var KEYS = IS_MAC
    ? { highlight: "Control+Shift+H", undo: "⌘Z", "undo-global": "Control+Shift+Z" }
    : { highlight: "Ctrl+Shift+H", undo: "Ctrl+Z", "undo-global": "Ctrl+Shift+Z" };

  Object.keys(KEYS).forEach(function (name) {
    document.querySelectorAll("kbd.k-" + name).forEach(function (el) {
      el.textContent = KEYS[name];
    });
  });

  // Tabloda kullanıcının sütununu vurgula (2 = Windows/Linux, 3 = Mac)
  var col = IS_MAC ? 3 : 2;
  document.querySelectorAll("table tbody tr").forEach(function (tr) {
    var cell = tr.children[col - 1];
    if (cell) cell.classList.add("is-you");
  });
  var os = document.getElementById("your-os");
  if (os) {
    os.textContent = IS_MAC
      ? "You're on a Mac — the highlighted column is yours."
      : "You're on Windows/Linux — the highlighted column is yours.";
  }

  // Kısayol ayarları sayfasını aç
  var btn = document.getElementById("open-shortcuts");
  if (btn) {
    btn.addEventListener("click", function () {
      try {
        if (IS_FIREFOX && chrome.commands && chrome.commands.openShortcutSettings) {
          chrome.commands.openShortcutSettings();
        } else if (!IS_FIREFOX) {
          chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
        } else {
          alert("Open about:addons → ⚙ → Manage Extension Shortcuts.");
        }
      } catch (e) {
        alert(
          IS_FIREFOX
            ? "Open about:addons → ⚙ → Manage Extension Shortcuts."
            : "Open chrome://extensions/shortcuts in a new tab."
        );
      }
    });
  }
})();
