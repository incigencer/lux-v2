// ==========================================================================
// Lux — "Bluebook Mode" (satquestionbank.org)
// ==========================================================================
// Bu script sitenin HİÇBİR öğesini taşımaz/silmez. Yaptığı iş:
//   1. Sadece bir SORU SETİ açıkken (/question/<id>?set=...) sağ altta
//      "Bluebook Mode" düğmesi gösterir. Ana sayfada hiçbir şey yapmaz.
//   2. Mod açılınca <html>'e .lux-bb sınıfını ekler (tüm görünümü
//      bluebook.css devralır) ve üstte/altta kendi Bluebook kabuğunu kurar.
//   3. Kabuktaki düğmeler sitenin KENDİ (görünmez yapılmış) kontrollerine
//      programatik olarak tıklar — yani tüm işlevsellik sitenin kendi
//      kodunda kalır, biz sadece Bluebook görünümünü veriyoruz.
//   4. Mod kapatılınca her şey eski haline döner.
// Tercih localStorage'da saklanır (ek izin gerekmez).
// ==========================================================================

(function () {
  if (window.__luxBluebookLoaded) return;
  window.__luxBluebookLoaded = true;

  var PREF_KEY = "lux-bluebook-mode";
  var root = document.documentElement;

  var enabled = false;
  var chip = null;
  var ui = null;
  var lastHref = location.href;
  var timeHidden = false;

  /* ------------------------------ yardımcılar --------------------------- */

  function $(sel, r) {
    return (r || document).querySelector(sel);
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function icon(markup) {
    var s = el("span", "lux-bb-icon");
    s.innerHTML = markup;
    return s;
  }
  function clickSite(node) {
    if (node) node.click();
  }
  // Vurgu menüsündeki düğmeler tıklanırken metin seçimi kaybolmasın
  function keepSelection(e) {
    e.preventDefault();
  }
  // content.js'in aynı izole dünyada paylaştığı vurgulayıcı API'si
  function lux(fn, arg) {
    var api = window.__lux;
    if (api && typeof api[fn] === "function") api[fn](arg);
  }

  var SVG = {
    pen:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18 10a2.83 2.83 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
    calc:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><rect x="7" y="6" width="10" height="3.5" rx="1"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01M16 17.5h.01" stroke-linecap="round" stroke-width="2.2"/></svg>',
    dots:
      '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>',
    bookmark:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h12v18l-6-4.5L6 21V3z"/></svg>',
    chevronDown:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    chevronUp:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
    // "Bluebook Mode" düğmesindeki logo: mavi kare üzerinde beyaz imleç
    // + iki küçük üçgen. Dosya/izin gerekmemesi için inline SVG olarak
    // çizildi; köşe yuvarlaklıkları stroke-linejoin:round ile veriliyor.
    bluebookLogo:
      '<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect width="400" height="400" fill="#3a4cc8"/>' +
      '<g fill="#fff" stroke="#fff" stroke-linejoin="round">' +
      '<path d="M150 54 L338 268 L170 352 Z" stroke-width="15"/>' +
      '<path d="M256 126 L320 92 L288 168 Z" stroke-width="12"/>' +
      '<path d="M54 212 L140 172 L140 234 Z" stroke-width="12"/>' +
      "</g></svg>"
  };

  // Lux'un vurgu renkleri (content.js ile aynı paleti kullanıyoruz)
  var COLORS = [
    { name: "Yellow", hex: "#ffff00" },
    { name: "Blue", hex: "#a8d8ff" },
    { name: "Pink", hex: "#ffb3d9" },
    { name: "Green", hex: "#b3ffb3" },
    { name: "Orange", hex: "#ffd9a8" },
    { name: "Purple", hex: "#e0b3ff" }
  ];

  /* --------------------- sitenin kendi öğelerine erişim ----------------- */

  var site = {
    toolbar: function () {
      return $("div.mb-3.overflow-x-hidden");
    },
    time: function () {
      var tb = site.toolbar();
      var d = tb && tb.querySelector("label div");
      return d ? d.textContent.trim() : "";
    },
    category: function () {
      var tb = site.toolbar();
      var h2 = tb && tb.querySelector("h2");
      return h2 ? h2.textContent.trim() : "";
    },
    qid: function () {
      var tb = site.toolbar();
      var h1 = tb && tb.querySelector("h1");
      return h1 ? h1.textContent.replace(/^\s*Question\s*/i, "").trim() : "";
    },
    difficulty: function () {
      var d = $('[title^="Question Difficulty"]');
      return d ? d.getAttribute("title").split(":").pop().trim() : "";
    },
    listBtn: function () {
      return $('button[aria-label="View full question list"]');
    },
    counter: function () {
      var b = site.listBtn();
      var m = b && b.textContent.match(/(\d+)\s*\/\s*(\d+)/);
      return m ? { current: m[1], total: m[2] } : null;
    },
    submit: function () {
      return $("main form button.btn-primary");
    },
    explain: function () {
      return $("main div.join button");
    },
    next: function () {
      return $("main div.join a");
    },
    reference: function () {
      return $('button[aria-label="SAT reference sheet"]');
    },
    mark: function () {
      return $('button[aria-label="Mark question for review"]');
    },
    shuffle: function () {
      return $('button[aria-label="Enable question shuffling"]');
    },
    crossOut: function () {
      return $('label[aria-label="Cross out answers"]');
    },
    stem: function () {
      return $("main .explanation_content");
    },
    // Desmos hesap makinesi iframe'i sadece MATEMATİK sorularında render
    // edilir; Reading & Writing sorularında hiç yoktur (gerçek Bluebook'ta
    // da hesap makinesi yalnızca Math bölümünde bulunur).
    calcFrame: function () {
      return $("main ~ iframe");
    },
    row: function () {
      var m = $("main");
      return m ? m.parentElement : null;
    },
    // Cevap gönderildiğinde site radio'ları disabled yapıyor
    answered: function () {
      return !!$("main form input.radio[disabled]");
    }
  };

  /* ------------------------------ durum -------------------------------- */

  // Sadece gerçek bir soru seti açıkken devreye giriyoruz
  function onQuestionSet() {
    return (
      /^\/question\//.test(location.pathname) &&
      new URLSearchParams(location.search).has("set") &&
      !!$("main form fieldset")
    );
  }

  function getPref() {
    try {
      return localStorage.getItem(PREF_KEY) === "1";
    } catch (e) {
      return false;
    }
  }
  function setPref(v) {
    try {
      localStorage.setItem(PREF_KEY, v ? "1" : "0");
    } catch (e) {}
  }

  /* --------------------- "Bluebook Mode" açma düğmesi ------------------- */

  function ensureChip() {
    if (chip && chip.isConnected) return;
    chip = el("button");
    chip.id = "lux-bb-toggle";
    chip.type = "button";
    var logo = el("span", "lux-bb-dot");
    logo.innerHTML = SVG.bluebookLogo;
    chip.appendChild(logo);
    chip.appendChild(el("span", null, "Bluebook Mode"));
    chip.addEventListener("click", enable);
    document.body.appendChild(chip);
  }
  function removeChip() {
    if (chip) {
      chip.remove();
      chip = null;
    }
  }

  /* ----------------------------- kabuk kurulumu ------------------------- */

  function tool(label, iconNode) {
    var b = el("button", "lux-bb-tool");
    b.type = "button";
    b.appendChild(iconNode);
    b.appendChild(el("span", null, label));
    return b;
  }
  function menuItem(text) {
    var b = el("button", "lux-bb-menu-item", text);
    b.type = "button";
    return b;
  }
  function panel() {
    var p = el("div", "lux-bb-panel");
    p.hidden = true;
    document.body.appendChild(p);
    return p;
  }

  function buildUI() {
    /* ---- üst bar ---- */
    var header = el("div", "lux-bb-header");

    var left = el("div", "lux-bb-h-left");
    var section = el("div", "lux-bb-section", "Section 1");
    var directions = el("button", "lux-bb-directions");
    directions.type = "button";
    directions.appendChild(el("span", null, "Directions"));
    directions.appendChild(icon(SVG.chevronDown));
    left.appendChild(section);
    left.appendChild(directions);

    var center = el("div", "lux-bb-h-center");
    var time = el("div", "lux-bb-time", "0:00");
    var hideBtn = el("button", "lux-bb-hide", "Hide");
    hideBtn.type = "button";
    center.appendChild(time);
    center.appendChild(hideBtn);

    var right = el("div", "lux-bb-h-right");
    var tHigh = tool("Highlights & Notes", icon(SVG.pen));
    var tCalc = tool("Calculator", icon(SVG.calc));
    var x2 = el("span", "lux-bb-x2", "X²");
    var tRef = tool("Reference", x2);
    var tMore = tool("More", icon(SVG.dots));
    right.appendChild(tHigh);
    right.appendChild(tCalc);
    right.appendChild(tRef);
    right.appendChild(tMore);

    header.appendChild(left);
    header.appendChild(center);
    header.appendChild(right);
    document.body.appendChild(header);

    /* ---- alt bar ---- */
    var footer = el("div", "lux-bb-footer");
    var brand = el("div", "lux-bb-brand", "SATQuestionBank");
    var fcenter = el("div", "lux-bb-f-center");
    var qpill = el("button", "lux-bb-qpill");
    qpill.type = "button";
    var qpillText = el("span", null, "Question");
    qpill.appendChild(qpillText);
    qpill.appendChild(icon(SVG.chevronUp));
    fcenter.appendChild(qpill);

    var fright = el("div", "lux-bb-f-right");
    var explainBtn = el("button", "lux-bb-secondary", "Explanation");
    explainBtn.type = "button";
    var primaryBtn = el("button", "lux-bb-primary", "Check");
    primaryBtn.type = "button";
    fright.appendChild(explainBtn);
    fright.appendChild(primaryBtn);

    footer.appendChild(brand);
    footer.appendChild(fcenter);
    footer.appendChild(fright);
    document.body.appendChild(footer);

    /* ---- paneller ---- */
    var pDirections = panel();
    pDirections.appendChild(el("h4", null, "Question set details"));
    var dl = document.createElement("dl");
    pDirections.appendChild(dl);

    var pHigh = panel();
    pHigh.appendChild(el("h4", null, "Highlights & Notes"));
    var swatches = el("div", "lux-bb-swatches");
    COLORS.forEach(function (c) {
      var b = el("button", "lux-bb-swatch");
      b.type = "button";
      b.title = c.name;
      b.style.backgroundColor = c.hex;
      b.addEventListener("mousedown", keepSelection);
      b.addEventListener("click", function () {
        lux("highlight", c.hex);
      });
      swatches.appendChild(b);
    });
    pHigh.appendChild(swatches);
    var miRemove = menuItem("Remove highlights in selection");
    miRemove.addEventListener("mousedown", keepSelection);
    miRemove.addEventListener("click", function () {
      lux("removeInSelection");
    });
    var miUndo = menuItem("Undo last highlight");
    miUndo.addEventListener("mousedown", keepSelection);
    miUndo.addEventListener("click", function () {
      lux("undo");
    });
    pHigh.appendChild(miRemove);
    pHigh.appendChild(miUndo);
    pHigh.appendChild(
      el(
        "p",
        "lux-bb-hint",
        "Select text, then pick a color. Ctrl+Shift+H and Ctrl+Shift+Z work too."
      )
    );

    var pMore = panel();
    var miMark = menuItem("Mark for Review");
    miMark.addEventListener("click", function () {
      clickSite(site.mark());
      closePanels();
    });
    var miAbc = menuItem("Cross out answers");
    miAbc.addEventListener("click", function () {
      clickSite(site.crossOut());
      closePanels();
    });
    var miShuffle = menuItem("Shuffle questions");
    miShuffle.addEventListener("click", function () {
      clickSite(site.shuffle());
      closePanels();
    });
    var miExit = menuItem("Turn off Bluebook Mode");
    miExit.addEventListener("click", function () {
      closePanels();
      disable();
    });
    pMore.appendChild(miMark);
    pMore.appendChild(miAbc);
    pMore.appendChild(miShuffle);
    pMore.appendChild(miExit);

    /* ---- olaylar ---- */
    directions.addEventListener("click", function () {
      togglePanel(pDirections, directions, "left");
    });
    tHigh.addEventListener("mousedown", keepSelection);
    tHigh.addEventListener("click", function () {
      togglePanel(pHigh, tHigh, "right");
    });
    tCalc.addEventListener("click", function () {
      root.classList.toggle("lux-bb-calc");
      sync();
    });
    tRef.addEventListener("click", function () {
      clickSite(site.reference());
    });
    tMore.addEventListener("click", function () {
      togglePanel(pMore, tMore, "right");
    });
    hideBtn.addEventListener("click", function () {
      timeHidden = !timeHidden;
      time.classList.toggle("is-hidden", timeHidden);
      hideBtn.textContent = timeHidden ? "Show" : "Hide";
    });
    qpill.addEventListener("click", function () {
      clickSite(site.listBtn());
    });
    explainBtn.addEventListener("click", function () {
      clickSite(site.explain());
    });
    primaryBtn.addEventListener("click", function () {
      if (site.answered()) clickSite(site.next());
      else clickSite(site.submit());
    });

    ui = {
      header: header,
      footer: footer,
      section: section,
      time: time,
      hideBtn: hideBtn,
      qpillText: qpillText,
      explain: explainBtn,
      primary: primaryBtn,
      dl: dl,
      tools: { highlights: tHigh, calculator: tCalc, reference: tRef, more: tMore },
      panels: { directions: pDirections, highlights: pHigh, more: pMore }
    };
  }

  function destroyUI() {
    if (!ui) return;
    [
      ui.header,
      ui.footer,
      ui.panels.directions,
      ui.panels.highlights,
      ui.panels.more
    ].forEach(function (n) {
      if (n) n.remove();
    });
    var strip = document.querySelector(".lux-bb-qstrip");
    if (strip) strip.remove();
    var pane = document.querySelector(".lux-bb-passage");
    if (pane) pane.remove();
    ui = null;
  }

  /* ------------------------------ paneller ------------------------------ */

  function closePanels(except) {
    if (!ui) return;
    Object.keys(ui.panels).forEach(function (k) {
      if (ui.panels[k] !== except) ui.panels[k].hidden = true;
    });
  }
  function togglePanel(p, anchor, align) {
    if (!p.hidden) {
      p.hidden = true;
      return;
    }
    closePanels(p);
    p.hidden = false;
    var r = anchor.getBoundingClientRect();
    var w = p.offsetWidth;
    var x = align === "right" ? r.right - w : r.left;
    x = Math.max(12, Math.min(x, window.innerWidth - w - 12));
    p.style.left = x + "px";
    p.style.top = r.bottom + 8 + "px";
  }
  function onDocClick(e) {
    if (!ui || !e.target || !e.target.closest) return;
    if (e.target.closest(".lux-bb-panel")) return;
    if (e.target.closest(".lux-bb-tool, .lux-bb-directions")) return;
    closePanels();
  }

  /* --------------------- soru üstü şerit + parça paneli ----------------- */

  function ensureQStrip() {
    var main = $("main");
    if (!main) return null;
    var strip = main.querySelector(":scope > .lux-bb-qstrip");
    if (strip) return strip;

    strip = el("div", "lux-bb-qstrip");
    var num = el("span", "lux-bb-qnum", "1");
    var mark = el("button", "lux-bb-strip-btn lux-bb-strip-mark");
    mark.type = "button";
    mark.appendChild(icon(SVG.bookmark));
    mark.appendChild(el("span", null, "Mark for Review"));
    mark.addEventListener("click", function () {
      clickSite(site.mark());
    });
    var abc = el("button", "lux-bb-strip-btn lux-bb-strip-abc", "ABC");
    abc.type = "button";
    abc.title = "Cross out answers";
    abc.addEventListener("click", function () {
      clickSite(site.crossOut());
    });
    strip.appendChild(num);
    strip.appendChild(mark);
    strip.appendChild(abc);
    main.prepend(strip);
    return strip;
  }

  // Okuma parçası olan sorularda Bluebook'un iki panelli düzeni:
  // soru kökünün son bloğu (asıl soru cümlesi) sağda kalır, öncesindeki
  // paragraflar sol panele KOPYALANIR (sitenin düğümleri taşınmaz).
  function syncPassage() {
    var stem = site.stem();
    var row = site.row();
    if (!stem || !row) return;

    var blocks = Array.prototype.filter.call(stem.children, function (n) {
      return n.nodeType === 1;
    });
    var shouldSplit = blocks.length >= 2 && stem.textContent.trim().length >= 220;
    root.classList.toggle("lux-bb-split", shouldSplit);

    var pane = row.querySelector(":scope > .lux-bb-passage");
    if (!shouldSplit) {
      if (pane) pane.remove();
      return;
    }

    var head = blocks.slice(0, -1);
    var key = head
      .map(function (b) {
        return b.textContent;
      })
      .join("|")
      .slice(0, 400);

    // İçerik değişmediyse dokunma (aksi halde kullanıcının vurguları silinir)
    if (pane && pane.dataset.luxKey === key) return;

    if (!pane) {
      pane = el("div", "lux-bb-passage");
      row.insertBefore(pane, row.firstChild);
    }
    pane.textContent = "";
    head.forEach(function (b) {
      pane.appendChild(b.cloneNode(true));
    });
    pane.dataset.luxKey = key;
  }

  /* ------------------------------- senkron ------------------------------ */

  function sync() {
    if (!enabled || !ui) return;

    var t = site.time();
    if (t && ui.time.textContent !== t) ui.time.textContent = t;

    var cat = site.category();
    var moduleName = cat ? cat.split(" - ")[0].trim() : "";
    var sectionLabel = moduleName ? "Section 1: " + moduleName : "Section 1";
    if (ui.section.textContent !== sectionLabel) ui.section.textContent = sectionLabel;

    var c = site.counter();

    // Directions paneli = seçilen soru setinin detayları
    var details = [
      ["Category", cat || "—"],
      ["Difficulty", site.difficulty() || "—"],
      ["Question ID", site.qid() || "—"],
      ["Progress", c ? c.current + " of " + c.total : "—"]
    ];
    var dlKey = JSON.stringify(details);
    if (ui.dl.dataset.luxKey !== dlKey) {
      ui.dl.textContent = "";
      details.forEach(function (pair) {
        ui.dl.appendChild(el("dt", null, pair[0]));
        ui.dl.appendChild(el("dd", null, pair[1]));
      });
      ui.dl.dataset.luxKey = dlKey;
    }

    var pillText = c ? "Question " + c.current + " of " + c.total : "Question";
    if (ui.qpillText.textContent !== pillText) ui.qpillText.textContent = pillText;

    var strip = ensureQStrip();
    if (strip) {
      var num = strip.querySelector(".lux-bb-qnum");
      if (c && num && num.textContent !== c.current) num.textContent = c.current;

      var markBtn = site.mark();
      var marked = !!(markBtn && markBtn.innerHTML.indexOf("outline") === -1);
      strip.querySelector(".lux-bb-strip-mark").classList.toggle("is-active", marked);

      var co = site.crossOut();
      var coInput = co && co.querySelector('input[type="checkbox"]');
      strip
        .querySelector(".lux-bb-strip-abc")
        .classList.toggle("is-active", !!(coInput && coInput.checked));
    }

    var answered = site.answered();
    var primaryLabel = answered ? "Next" : "Check";
    if (ui.primary.textContent !== primaryLabel) ui.primary.textContent = primaryLabel;

    var ex = site.explain();
    var exDisabled = !ex || ex.disabled;
    if (ui.explain.disabled !== exDisabled) ui.explain.disabled = exDisabled;

    // Hesap makinesi düğmesi sadece sayfada Desmos iframe'i varsa görünür
    var hasCalc = !!site.calcFrame();
    ui.tools.calculator.hidden = !hasCalc;
    if (!hasCalc) root.classList.remove("lux-bb-calc");
    ui.tools.calculator.classList.toggle(
      "is-active",
      root.classList.contains("lux-bb-calc")
    );

    syncPassage();
  }

  /* ------------------------------ aç / kapa ----------------------------- */

  function enable() {
    if (enabled) return;
    enabled = true;
    setPref(true);
    root.classList.add("lux-bb");
    removeChip();
    buildUI();
    sync();
  }

  function disable() {
    enabled = false;
    setPref(false);
    root.classList.remove("lux-bb", "lux-bb-split", "lux-bb-calc");
    destroyUI();
    if (onQuestionSet()) ensureChip();
  }

  // Soru sayfasından çıkıldığında kabuğu kaldır ama TERCİHİ koru
  function teardownKeepPref() {
    enabled = false;
    root.classList.remove("lux-bb", "lux-bb-split", "lux-bb-calc");
    destroyUI();
    removeChip();
  }

  /* ------------------------------- döngü -------------------------------- */

  function tick() {
    if (location.href !== lastHref) {
      lastHref = location.href;
      // Soru değişti: kopyalanan parça panelini sıfırla
      var pane = document.querySelector(".lux-bb-passage");
      if (pane) pane.remove();
    }

    if (!onQuestionSet()) {
      if (enabled || chip) teardownKeepPref();
      return;
    }

    if (getPref()) {
      if (!enabled) enable();
      else sync();
    } else {
      if (enabled) disable();
      else ensureChip();
    }
  }

  function start() {
    if (!document.body) {
      setTimeout(start, 50);
      return;
    }
    document.addEventListener("click", onDocClick, true);
    setInterval(tick, 250);
    tick();
  }

  start();
})();
