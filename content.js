// Bu dosya hem otomatik (manifest content_scripts) hem de arka plan
// tarafından elle (chrome.scripting.executeScript ile, sekme zaten açıkken
// uzantı güncellendiğinde) birden fazla kez enjekte edilebilir. Aynı
// sayfada/çerçevede iki kez çalışırsa dinleyicilerin çiftlenmemesi için
// bir bayrakla koruma altına alıyoruz.
(function () {
  if (window.__luxHighlighterLoaded) {
    return;
  }
  window.__luxHighlighterLoaded = true;

  // Son sağ tıklanan noktayı hatırlıyoruz ki "Vurguyu Kaldır" hangi
  // vurgulanmış elemente tıklandığını bulabilsin.
  let lastRightClickTarget = null;

  // Bu sekmede eklenen vurguların geçmişi (Ctrl+Shift+Z / Mac: Control+Shift+Z ile geri almak
  // için) ve klavye kısayoluyla vurgularken kullanılacak "son renk".
  let highlightHistory = [];
  let lastColor = "#ffff00";

  document.addEventListener(
    "contextmenu",
    (event) => {
      lastRightClickTarget = event.target;
    },
    true
  );

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "highlight") {
      highlightSelection(message.color);
    } else if (message.action === "highlight-shortcut") {
      // Klavye kısayolu: son kullanılan renkle vurgula.
      highlightSelection(lastColor);
    } else if (message.action === "remove-highlight") {
      removeHighlight();
    } else if (message.action === "undo-highlight") {
      undoLastHighlight();
    }
  });

  function highlightSelection(color) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const range = selection.getRangeAt(0);

    const span = document.createElement("span");
    span.className = "my-ext-highlight";
    span.style.backgroundColor = color;

    try {
      // Seçim tek bir düğüm sınırı içindeyse doğrudan sarabiliriz.
      range.surroundContents(span);
    } catch (err) {
      // Seçim birden fazla elementin arasına yayılıyorsa (surroundContents
      // hata verir): içeriği çıkarıp span'in içine koyuyoruz.
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    }

    lastColor = color;
    highlightHistory.push(span);

    selection.removeAllRanges();
  }

  function removeHighlight() {
    const selection = window.getSelection();

    // Seçili (collapsed olmayan) bir metin varsa: o metnin içinde/üzerinde
    // kesişen TÜM vurgulanmış span'leri bul ve hepsini kaldır. Böylece
    // vurgusuz bir metni seçseniz bile, seçimin içine giren her vurgu silinir.
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const allHighlights = document.querySelectorAll(".my-ext-highlight");
      const toRemove = [];

      allHighlights.forEach((el) => {
        if (range.intersectsNode(el)) {
          toRemove.push(el);
        }
      });

      if (toRemove.length > 0) {
        toRemove.forEach(unwrapHighlightElement);
        selection.removeAllRanges();
        return;
      }
    }

    // Seçim yoksa (ör. sadece bir vurgunun üzerine sağ tıklanmışsa): en son
    // sağ tıklanan noktadaki vurguyu kaldır.
    if (!lastRightClickTarget) return;

    const highlightEl = lastRightClickTarget.closest
      ? lastRightClickTarget.closest(".my-ext-highlight")
      : null;

    if (!highlightEl) return;

    unwrapHighlightElement(highlightEl);
  }

  function undoLastHighlight() {
    // Geçmişte, elle (sağ tık ile) zaten kaldırılmış eski kayıtlar olabilir;
    // bunları atlayıp hâlâ sayfada duran en son vurguyu buluyoruz.
    while (highlightHistory.length > 0) {
      const span = highlightHistory.pop();
      if (span && document.body.contains(span)) {
        unwrapHighlightElement(span);
        return;
      }
    }
  }

  // Bluebook modunun ("Highlights & Notes" paneli) vurgulayıcıyı
  // kullanabilmesi için küçük bir API. bluebook.js ile aynı izole dünyada
  // çalıştığımız için aynı window nesnesini paylaşıyoruz.
  window.__lux = {
    highlight: function (color) {
      highlightSelection(color || lastColor);
    },
    removeInSelection: function () {
      removeHighlight();
    },
    undo: function () {
      undoLastHighlight();
    },
    // Geri alınacak (hâlâ sayfada duran) bir vurgu var mı?
    canUndo: canUndo
  };

  function canUndo() {
    return highlightHistory.some(function (span) {
      return span && document.body.contains(span);
    });
  }

  /* ----------------------------------------------------------------------
     Auto-highlight + Ctrl/⌘+Z
     Toolbar panelindeki (popup) "Auto-highlight" açıkken, seçilen her metin
     fare bırakıldığı anda panelde seçilen renkle vurgulanır. Ayar
     chrome.storage.local'da; panelde değişince tüm açık sekmeler anında
     güncellenir (storage.onChanged).
     ---------------------------------------------------------------------- */

  let autoOn = false;
  let autoColor = "#ffff00";
  const IS_MAC = /mac/i.test(
    (navigator.userAgentData && navigator.userAgentData.platform) ||
      navigator.platform ||
      ""
  );

  try {
    chrome.storage.local.get(["autoHighlight", "autoColor"], (res) => {
      if (!res) return;
      autoOn = !!res.autoHighlight;
      if (res.autoColor) autoColor = res.autoColor;
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.autoHighlight) autoOn = !!changes.autoHighlight.newValue;
      if (changes.autoColor && changes.autoColor.newValue) {
        autoColor = changes.autoColor.newValue;
      }
    });
  } catch (e) {
    // storage yoksa (çok eski tarayıcı) auto-highlight kapalı kalır
  }

  // Metin kutusu / düzenlenebilir alan içinde miyiz? Orada ne vurguluyoruz
  // ne de Ctrl+Z'yi yakalıyoruz — yazı yazma davranışı bozulmasın.
  function isEditable(node) {
    const el = node && node.nodeType === 1 ? node : node && node.parentElement;
    if (!el || !el.closest) return false;
    return !!el.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"]'
    );
  }

  // Lux'un kendi arayüzü (Bluebook Mode kabuğu/panelleri) üzerinde
  // yapılan tıklamalar vurgulama tetiklemesin.
  function isLuxUi(node) {
    const el = node && node.nodeType === 1 ? node : node && node.parentElement;
    return !!(
      el &&
      el.closest &&
      el.closest(
        "#lux-bb-toggle, .lux-bb-header, .lux-bb-footer, .lux-bb-panel, .lux-bb-qstrip"
      )
    );
  }

  function maybeAutoHighlight(event) {
    if (!autoOn) return;
    if (isLuxUi(event.target)) return;
    // Seçim, mouseup'tan hemen sonra kesinleşiyor
    setTimeout(() => {
      if (!autoOn) return;
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
      if (!selection.toString().trim()) return;
      const range = selection.getRangeAt(0);
      if (isEditable(range.startContainer) || isEditable(range.endContainer)) return;
      highlightSelection(autoColor);
    }, 0);
  }

  document.addEventListener("mouseup", maybeAutoHighlight, true);
  // Shift+ok tuşlarıyla yapılan klavye seçimi, Shift bırakılınca vurgulanır
  document.addEventListener(
    "keyup",
    (event) => {
      if (event.key === "Shift") maybeAutoHighlight(event);
    },
    true
  );

  // Ctrl+Z (Mac'te ⌘Z): en son vurguyu geri al. Sadece geri alınacak bir
  // vurgu varsa ve metin kutusunda değilsek tuşu yakalıyoruz; aksi halde
  // tuş sitenin kendi davranışına kalır.
  document.addEventListener(
    "keydown",
    (event) => {
      const mod = IS_MAC ? event.metaKey : event.ctrlKey;
      if (!mod || event.shiftKey || event.altKey) return;
      if ((event.key || "").toLowerCase() !== "z") return;
      if (isEditable(event.target)) return;
      if (!canUndo()) return;
      event.preventDefault();
      event.stopPropagation();
      undoLastHighlight();
    },
    true
  );

  function unwrapHighlightElement(highlightEl) {
    const parent = highlightEl.parentNode;
    if (!parent) return;

    // Span'in içindeki metni/düğümleri span'in yerine koyup span'i kaldırıyoruz.
    while (highlightEl.firstChild) {
      parent.insertBefore(highlightEl.firstChild, highlightEl);
    }
    parent.removeChild(highlightEl);
    parent.normalize();

    const idx = highlightHistory.indexOf(highlightEl);
    if (idx !== -1) highlightHistory.splice(idx, 1);
  }
})();
