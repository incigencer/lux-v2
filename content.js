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

    // "Keep highlights after reload" açıksa, metni SARMADAN ÖNCE konumunu
    // tarif ediyoruz (sarmak DOM'u değiştirir ama metni değiştirmez).
    const anchor = persistOn ? describeRange(range) : null;

    const span = wrapRange(range, color);

    lastColor = color;
    highlightHistory.push(span);

    selection.removeAllRanges();

    if (anchor) {
      const id = "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      span.dataset.luxId = id;
      saveRecord(Object.assign({ id: id, color: color }, anchor));
    }
  }

  function wrapRange(range, color) {
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
    return span;
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

  // "Keep highlights after reload" (panelden). Açıkken yeni vurgular
  // chrome.storage.local'a kaydedilir ve sayfa tekrar açılınca geri gelir.
  let persistOn = false;

  try {
    chrome.storage.local.get(
      ["autoHighlight", "autoColor", "persistHighlights"],
      (res) => {
        if (!res) return;
        autoOn = !!res.autoHighlight;
        if (res.autoColor) autoColor = res.autoColor;
        persistOn = !!res.persistHighlights;
        if (persistOn) startRestore();
      }
    );
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.autoHighlight) autoOn = !!changes.autoHighlight.newValue;
      if (changes.autoColor && changes.autoColor.newValue) {
        autoColor = changes.autoColor.newValue;
      }
      if (changes.persistHighlights) {
        persistOn = !!changes.persistHighlights.newValue;
        if (persistOn) startRestore();
      }
    });
  } catch (e) {
    // storage yoksa (çok eski tarayıcı) auto-highlight / kaydetme kapalı kalır
  }

  /* ----------------------------------------------------------------------
     Vurguları kaydetme / geri yükleme
     Her vurgu, sayfanın düz metni içindeki konumuyla değil, METNİN KENDİSİ
     + önündeki/arkasındaki ~40 karakterle kaydedilir. Böylece site küçük
     değişiklikler yapsa ya da içerik farklı sırada yüklense bile aynı yer
     bulunabilir. Anahtar: sayfa adresi (# kısmı hariç).
     ---------------------------------------------------------------------- */

  const CONTEXT = 40;
  let saveQueue = Promise.resolve();

  function pageKey() {
    return "lux:hl:" + location.href.split("#")[0];
  }

  // Sayfanın GÖRÜNEBİLİR metninin dizini. <script>, <style> vb. içindeki
  // metinler atlanır — aksi halde (ör. Next.js sayfalarındaki JSON verisinde
  // aynı cümle geçtiği için) vurgu bir <script>'in içine yerleştirilebilir.
  const SKIP = "script, style, noscript, template, textarea, svg title";

  function textIndex() {
    const nodes = [];
    let full = "";
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.parentElement && n.parentElement.closest(SKIP)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT
    });
    let node;
    while ((node = walker.nextNode())) {
      nodes.push({ node: node, start: full.length });
      full += node.data;
    }
    return { nodes: nodes, full: full };
  }

  // Bir DOM sınır noktasının (container, offset) dizindeki karakter konumu
  function offsetOf(index, container, offset) {
    if (container.nodeType === 3) {
      for (let i = 0; i < index.nodes.length; i++) {
        if (index.nodes[i].node === container) return index.nodes[i].start + offset;
      }
    }
    const boundary = document.createRange();
    boundary.setStart(container, offset);
    for (let i = 0; i < index.nodes.length; i++) {
      // Bu metin düğümü sınır noktasında ya da sonrasında mı başlıyor?
      if (boundary.comparePoint(index.nodes[i].node, 0) >= 0) return index.nodes[i].start;
    }
    return index.full.length;
  }

  function describeRange(range) {
    try {
      const index = textIndex();
      const start = offsetOf(index, range.startContainer, range.startOffset);
      const end = offsetOf(index, range.endContainer, range.endOffset);
      const exact = index.full.slice(start, end);
      if (!exact.trim()) return null;
      return {
        exact: exact,
        prefix: index.full.slice(Math.max(0, start - CONTEXT), start),
        suffix: index.full.slice(end, end + CONTEXT)
      };
    } catch (e) {
      return null;
    }
  }

  // Aynı anahtara art arda yazmalar birbirini ezmesin diye sıraya koyuyoruz
  function updateRecords(key, fn) {
    saveQueue = saveQueue.then(
      () =>
        new Promise((resolve) => {
          try {
            chrome.storage.local.get([key], (res) => {
              const list = fn((res && res[key]) || []);
              const obj = {};
              obj[key] = list;
              if (list.length) chrome.storage.local.set(obj, resolve);
              else if (chrome.storage.local.remove) chrome.storage.local.remove(key, resolve);
              else chrome.storage.local.set(obj, resolve);
            });
          } catch (e) {
            resolve();
          }
        })
    );
  }

  function saveRecord(rec) {
    updateRecords(pageKey(), (list) => list.concat([rec]));
  }

  function deleteRecord(id) {
    updateRecords(pageKey(), (list) => list.filter((r) => r.id !== id));
  }

  // İki metnin uçtan/baştan kaç karakteri örtüşüyor (bağlam puanı)
  function commonSuffix(a, b) {
    let n = 0;
    while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
    return n;
  }
  function commonPrefix(a, b) {
    let n = 0;
    while (n < a.length && n < b.length && a[n] === b[n]) n++;
    return n;
  }

  // Dizindeki karakter konumunu gerçek bir DOM noktasına çevir
  function pointAt(index, pos, isEnd) {
    for (let i = 0; i < index.nodes.length; i++) {
      const n = index.nodes[i];
      const len = n.node.data.length;
      if (isEnd ? pos <= n.start + len : pos < n.start + len) {
        return { node: n.node, offset: pos - n.start };
      }
    }
    return null;
  }

  function isVisible(node) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    return !!(el && el.getClientRects().length);
  }

  function locate(rec, index) {
    const full = index.full;
    let best = null;
    let from = 0;
    let guard = 0;
    while (guard++ < 500) {
      const at = full.indexOf(rec.exact, from);
      if (at === -1) break;
      const score =
        commonSuffix(full.slice(Math.max(0, at - CONTEXT), at), rec.prefix || "") +
        commonPrefix(full.slice(at + rec.exact.length, at + rec.exact.length + CONTEXT), rec.suffix || "");
      const startPt = pointAt(index, at, false);
      // Eşit puanda görünür olanı tercih et (ör. gizli kopyalar yerine)
      const visibleBonus = startPt && isVisible(startPt.node) ? 0.5 : 0;
      if (!best || score + visibleBonus > best.score) {
        best = { at: at, score: score + visibleBonus };
      }
      from = at + 1;
    }
    if (!best) return null;
    const s = pointAt(index, best.at, false);
    const e = pointAt(index, best.at + rec.exact.length, true);
    if (!s || !e) return null;
    const range = document.createRange();
    range.setStart(s.node, s.offset);
    range.setEnd(e.node, e.offset);
    return range;
  }

  let restoreObserver = null;
  let restoreTimer = null;
  let restoreDeadline = 0;
  let restoredKey = null;

  // Kayıtlı vurgulardan sayfada henüz olmayanları yerleştir; hepsi
  // yerleşince true döner.
  function restorePending(records) {
    let pending = 0;
    let index = null;
    records.forEach((rec) => {
      if (document.querySelector('[data-lux-id="' + rec.id + '"]')) return;
      if (index === null) index = textIndex();
      const range = locate(rec, index);
      if (!range) {
        pending++;
        return;
      }
      try {
        const span = wrapRange(range, rec.color);
        span.dataset.luxId = rec.id;
        highlightHistory.push(span);
        index = null; // DOM değişti; bir sonraki kayıt için dizini tazele
      } catch (e) {
        pending++;
      }
    });
    return pending === 0;
  }

  function stopRestore() {
    if (restoreObserver) restoreObserver.disconnect();
    restoreObserver = null;
    clearTimeout(restoreTimer);
  }

  // Sayfa (veya tek sayfalık uygulamada yeni "sayfa") açıldığında kayıtlı
  // vurguları geri getir. İçeriği sonradan yüklenen sitelerde (ör. Khan
  // Academy) içerik gelene kadar ~20 sn boyunca DOM değiştikçe tekrar dener.
  function startRestore() {
    if (!persistOn || !document.body) return;
    const key = pageKey();
    restoredKey = key;
    stopRestore();
    try {
      chrome.storage.local.get([key], (res) => {
        const records = (res && res[key]) || [];
        if (!records.length || !persistOn || restoredKey !== key) return;
        if (restorePending(records)) return;
        restoreDeadline = Date.now() + 20000;
        restoreObserver = new MutationObserver(() => {
          clearTimeout(restoreTimer);
          restoreTimer = setTimeout(() => {
            if (!persistOn || restoredKey !== key || Date.now() > restoreDeadline) {
              stopRestore();
              return;
            }
            if (restorePending(records)) stopRestore();
          }, 400);
        });
        restoreObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
        setTimeout(stopRestore, 20500);
      });
    } catch (e) {}
  }

  // Tek sayfalık uygulamalarda adres değişince yeni sayfanın vurgularını yükle
  let lastHref = location.href.split("#")[0];
  setInterval(() => {
    const href = location.href.split("#")[0];
    if (href !== lastHref) {
      lastHref = href;
      if (persistOn) startRestore();
    }
  }, 1000);

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

    // Kaydedilmiş bir vurguysa kaydını da sil (ayar kapalı olsa bile —
    // silinen vurgu bir sonraki açılışta geri gelmesin).
    if (highlightEl.dataset && highlightEl.dataset.luxId) {
      deleteRecord(highlightEl.dataset.luxId);
    }
  }
})();
