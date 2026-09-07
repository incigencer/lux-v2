// Uzantı kurulduğunda/güncellendiğinde sağ tık (context) menüsünü oluşturur.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "highlight-parent",
    title: "Vurgula",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "highlight-yellow",
    parentId: "highlight-parent",
    title: "Sarı",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "highlight-blue",
    parentId: "highlight-parent",
    title: "Mavi",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "highlight-pink",
    parentId: "highlight-parent",
    title: "Pembe",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "highlight-green",
    parentId: "highlight-parent",
    title: "Yeşil",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "highlight-orange",
    parentId: "highlight-parent",
    title: "Turuncu",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "highlight-purple",
    parentId: "highlight-parent",
    title: "Mor",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "remove-highlight",
    title: "Vurguyu Kaldır",
    contexts: ["selection"]
  });
});

const COLORS = {
  "highlight-yellow": "#ffff00",
  "highlight-blue": "#a8d8ff",
  "highlight-pink": "#ffb3d9",
  "highlight-green": "#b3ffb3",
  "highlight-orange": "#ffd9a8",
  "highlight-purple": "#e0b3ff"
};

// content.js normalde her sayfaya otomatik enjekte olur. Ama uzantı
// güncellenip yeniden yüklendiğinde, O SIRADA ZATEN AÇIK olan sekmelere
// Chrome content script'i otomatik olarak tekrar enjekte ETMEZ — sekme
// yenilenmeden çalışmaz. Bunu kullanıcıya bırakmamak için, her komuttan
// (sağ tık / kısayol) hemen önce content.js'i o sekmeye/çerçeveye elle
// enjekte etmeyi deniyoruz. Zaten yüklüyse content.js kendi içindeki
// korumaya (window.__luxHighlighterLoaded) takılıp sessizce hiçbir şey
// yapmadan çıkar, yani bu işlem tamamen zararsızdır.
async function ensureContentScriptInjected(tabId, frameId) {
  const target = { tabId };
  if (typeof frameId === "number") {
    target.frameIds = [frameId];
  } else {
    target.allFrames = true;
  }
  try {
    await chrome.scripting.executeScript({ target, files: ["content.js"] });
  } catch (err) {
    // chrome://, Web Store gibi özel sayfalarda enjeksiyon zaten mümkün
    // değildir; bu beklenen bir durumdur, sessizce yutuyoruz.
    console.warn("Lux: content script enjekte edilemedi:", err && err.message);
  }
}

async function sendToTab(tabId, message, frameId) {
  await ensureContentScriptInjected(tabId, frameId);
  const options = typeof frameId === "number" ? { frameId } : {};
  chrome.tabs.sendMessage(tabId, message, options, () => {
    // Karşı tarafta dinleyici yoksa chrome.runtime.lastError set edilir;
    // konsolu kirletmemek için okuyup görmezden geliyoruz.
    void chrome.runtime.lastError;
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  // info.frameId, sağ tıklamanın olduğu (ana sayfa ya da iframe) çerçeveyi
  // belirtir; Khan Academy gibi sorularını iframe içinde gösteren sitelerde
  // doğru çerçeveye ulaşmak için bunu kullanıyoruz.
  if (COLORS[info.menuItemId]) {
    sendToTab(
      tab.id,
      { action: "highlight", color: COLORS[info.menuItemId] },
      info.frameId
    );
  } else if (info.menuItemId === "remove-highlight") {
    sendToTab(tab.id, { action: "remove-highlight" }, info.frameId);
  }
});

// Klavye kısayolları: Ctrl+Shift+H (vurgula) ve Ctrl+Shift+Z (geri al).
// chrome://extensions/shortcuts sayfasından kullanıcı bu tuşları değiştirebilir.
chrome.commands.onCommand.addListener((command, tab) => {
  if (!tab || !tab.id) return;

  if (command === "highlight-selection") {
    sendToTab(tab.id, { action: "highlight-shortcut" });
  } else if (command === "undo-highlight") {
    sendToTab(tab.id, { action: "undo-highlight" });
  }
});
