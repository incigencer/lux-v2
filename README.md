<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="Lux logosu">
</p>

<h1 align="center">Lux</h1>
<p align="center">Basit bir Chrome &amp; Firefox metin vurgulayıcı — ve satquestionbank.org için bir <strong>Bluebook Mode</strong>.</p>

---

## Neler yapar?

Lux, Manifest V3 ile yazılmış, kurulumu ve kullanımı basit, hem **Chrome** hem **Firefox**'ta çalışan bir tarayıcı uzantısıdır. İki bağımsız özelliği var:

1. **Vurgulayıcı (her sitede):** Herhangi bir web sayfasında metin seçip sağ tık menüsünden veya klavye kısayoluyla renkli vurgulama yapabilirsiniz.
2. **Bluebook Mode (sadece satquestionbank.org):** [satquestionbank.org](https://satquestionbank.org)'daki bir soru setini, College Board'un resmi dijital SAT uygulaması **Bluebook**'un arayüzüne benzer şekilde yeniden giydirir — üst/alt bar, Highlights & Notes, Calculator, Reference, Cross out answers gibi araçlarla.

---

## Özellikler

### 🖍️ Vurgulayıcı
- Metin seçince sağ tık menüsünde **Vurgula** → 6 renk (Sarı, Mavi, Pembe, Yeşil, Turuncu, Mor)
- **Ctrl+Shift+H** — seçili metni son kullanılan renkle vurgular
- **Ctrl+Shift+Z** — en son eklenen vurguyu geri alır (seçim yapmaya gerek yok)
- Bir metni seçtiğinizde (vurgulu olsun olmasın) sağ tık → **Vurguyu Kaldır**, seçim aralığındaki **tüm** vurguları tek seferde kaldırır
- `iframe` içeren sayfalarda da çalışır (`all_frames: true` + doğru çerçeveye mesaj gönderimi)
- Uzantı güncellenip yeniden yüklendiğinde, zaten açık olan sekmelerde de otomatik kendini onarır (`chrome.scripting.executeScript` ile gerektiğinde yeniden enjekte olur)

### 📘 Bluebook Mode
- Sadece bir **soru seti** açıkken (`satquestionbank.org/question/...?set=...`) sağ altta beliren bir düğmeyle açılıp kapanır; ana sayfada veya normal gezinmede hiç görünmez
- Tercih `localStorage`'da tutulur, bir sonraki soruda kaldığı yerden devam eder
- Sitenin **kendi** araçlarını (Mark for Review, Cross out answers, Shuffle, soru listesi, Desmos hesap makinesi, SAT referans sayfası) siler/taşımaz — sadece görünmez yapıp kendi Bluebook arayüzünden programatik olarak tetikler
- Okuma parçalı sorularda otomatik olarak iki panele (sol: parça, sağ: soru) bölünür
- Hesap makinesi açıldığında soru metnini **örtmez**; sayfa akışında yan yana bir sütun olarak açılır
- Cevap eleme (ABC) düğmeleri, MathJax (SVG) şıklarda dahi doğru görünür

---

## Kurulum

Bu klasörü bilgisayarınıza indirin/klonlayın, ardından tarayıcınıza göre:

**Chrome (veya diğer Chromium tabanlılar):**
1. Adres çubuğuna yazın:
   ```
   chrome://extensions
   ```
2. Sağ üstten **Geliştirici modu**'nu (Developer mode) açın.
3. **Paketlenmemiş öğe yükle** (Load unpacked) → bu klasörü seçin.
4. "Lux" uzantı listesinde görünür.

Kod değiştikçe `chrome://extensions` sayfasındaki yenile (🔄) ikonuna basmanız yeterlidir.

**Firefox:**
1. Adres çubuğuna yazın:
   ```
   about:debugging#/runtime/this-firefox
   ```
2. **Geçici Eklenti Yükle...** (Load Temporary Add-on) → bu klasördeki `manifest.json`'ı seçin.
3. "Lux" geçici eklentiler listesinde görünür.

> Firefox 140 ve üzeri gerekir (`browser_specific_settings.gecko.strict_min_version`). Geçici olarak yüklenen eklentiler Firefox yeniden başlatıldığında kaldırılır — kalıcı kurulum için [addons.mozilla.org](https://addons.mozilla.org) üzerinden imzalanmış bir paket gerekir.

---

## Kullanım

**Herhangi bir sitede:**
1. Bir metni seçin.
2. Sağ tık → **Vurgula** → bir renk seçin (ya da `Ctrl+Shift+H`).
3. Kaldırmak için: metni tekrar seçip sağ tık → **Vurguyu Kaldır** (ya da `Ctrl+Shift+Z` ile son vurguyu geri alın).

> Kısayollar çalışmıyorsa `chrome://extensions/shortcuts` sayfasından "Lux" için atanmış olduklarını kontrol edin.

**satquestionbank.org'da:**
1. Bir soru seti açın (Find Questions ile).
2. Sağ altta çıkan **Bluebook Mode** düğmesine tıklayın.
3. Üst bardaki *Highlights & Notes*, *Calculator*, *Reference*, *More* araçlarını kullanın.
4. Kapatmak için: **More → Turn off Bluebook Mode**.

---

## Dosya yapısı

| Dosya | Görev |
|---|---|
| `manifest.json` | Manifest V3 tanımı, izinler, content script kuralları, klavye kısayolları, Firefox (`browser_specific_settings.gecko`) ayarları |
| `background.js` | Sağ tık menüsü + klavye kısayolu komutlarını yöneten servis çalışanı (service worker) |
| `content.js` | Vurgulama/kaldırma/geri alma mantığı; her sitede çalışır |
| `bluebook.css` | Bluebook Mode görünümü — tamamı `html.lux-bb` altında kapsanmış, mod kapalıyken siteye dokunmaz |
| `bluebook.js` | Bluebook Mode'un tespiti, aç/kapa, kendi kabuğu (üst/alt bar, paneller) ve sitenin araçlarına proxy |
| `icons/` | Uzantı ikonları (16/32/48/128 px) |

---

## Teknik notlar

- **İzinler:** `contextMenus`, `activeTab`, `scripting` — hiçbiri geniş kapsamlı host izni gerektirmiyor; `scripting` sadece kullanıcı jestiyle (sağ tık / kısayol) tetiklenen `activeTab` erişimiyle kullanılıyor.
- **Seçici stratejisi (bluebook.css/js):** satquestionbank.org React + Tailwind/DaisyUI ile yazılı; kırılgan üretken class'lar yerine sitenin sabit/anlamlı sınıfları (`.explanation_content`, `.answer_content`, `.join`, `.label`) ve `:has()` ile yapısal konum kullanılıyor.
- **Vurgulayıcı güvenliği:** `bluebook.css` içinde soru/parça metnine `background`'a `!important` ile dokunan hiçbir kural yok — bu sayede Lux'un vurgu span'lerindeki satır-içi `background-color` her zaman görünür kalıyor.
- **Kalıcılık yok:** Vurgular sayfa yenilenince kaybolur (bilinçli bir sadelik tercihi). Bluebook Mode tercihi ise `localStorage`'da kalıcıdır.
- **Chrome + Firefox uyumluluğu:** `manifest.json`'da `background` hem `service_worker` (Chrome) hem `scripts` (Firefox'un MV3 event page'i) alanlarını birlikte tanımlıyor; Firefox tarafı `browser_specific_settings.gecko` ile (id, minimum sürüm, "veri toplama yok" beyanı) tamamlanıyor. `bluebook.js`'deki ikonlar da AMO (addons.mozilla.org) inceleme gereksinimleri için `innerHTML` yerine `DOMParser` ile ayrıştırılıp DOM'a ekleniyor.

---

## Bilinen sınırlar

- Vurgular sayfalar arası/yenilemeler arası saklanmıyor.
- Bluebook Mode yalnızca satquestionbank.org için tasarlandı; site kendi DOM yapısını önemli ölçüde değiştirirse seçicilerin güncellenmesi gerekebilir.
- Firefox 140'ın altındaki sürümlerde çalışması garanti değildir; "Geçici Eklenti Yükle" ile kurulanlar tarayıcı yeniden başlatılınca kaldırılır.
