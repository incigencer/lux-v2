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

  // Bu sekmede eklenen vurguların geçmişi (Ctrl+Shift+Z ile geri almak
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
    }
  };

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
