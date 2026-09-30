<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="Lux logo">
</p>

<h1 align="center">Lux</h1>
<p align="center">A simple text highlighter for Chrome &amp; Firefox — plus a <strong>Bluebook Mode</strong> for satquestionbank.org with auto-highlight and a toolbar control panel.</p>

---

## What it does

Lux is a Manifest V3 browser extension that's easy to install and use, and runs on both **Chrome** and **Firefox** (Windows, Linux and macOS). It has three independent features:

1. **Highlighter (any site):** Select text on any web page and highlight it in color from the right-click menu or with a keyboard shortcut.
2. **Bluebook Mode (satquestionbank.org only):** Reskins a question set on [satquestionbank.org](https://satquestionbank.org) to look like **Bluebook**, College Board's official digital SAT app — with a top/bottom bar and tools like Highlights & Notes, Calculator, Reference, and Cross out answers.
3. **Auto-highlight (any site):** Turn it on from the Lux toolbar panel and every text selection is highlighted instantly — great for Khan Academy questions — until you turn it off.

---

## Features

### 🖍️ Highlighter
- Select text → right-click → **Highlight** → 6 colors (yellow, blue, pink, green, orange, purple)
- **Ctrl+Shift+H** (Mac: **Control+Shift+H**) — highlights the selection with the last-used color
- **Ctrl+Z** (Mac: **⌘Z**) — undoes the most recent highlight when there's one to undo; inside text boxes, or when there's nothing to undo, the key is left to the site
- **Ctrl+Shift+Z** (Mac: **Control+Shift+Z**) — browser-level shortcut that also undoes the most recent highlight
- Select any text (highlighted or not) → right-click → **Remove highlight** removes **every** highlight inside the selection at once
- Works on pages with `iframe`s (`all_frames: true` + messages routed to the correct frame)
- Self-heals in tabs that were already open when the extension was updated or reloaded (re-injects itself via `chrome.scripting.executeScript` when needed)

> On Mac the shortcuts use the real **Control** key (not ⌘), because ⌘+Shift+H is Chrome's "Home page" shortcut and ⌘+Shift+Z is Redo in text fields.

### ✨ Auto-highlight & control panel
- Click the **Lux icon** in the browser toolbar to open the control panel
- Turn on **Auto-highlight**: any text you select on any site is highlighted as soon as you release the mouse (or finish a Shift+arrow selection), until you turn it off
- Pick the auto-highlight color from the 6 swatches
- The panel also lists your shortcuts (read from the browser, so it shows what's actually assigned) and links to the **Help** page
- **Keep highlights after reload** switch: when on, new highlights are saved and come back when you reload or revisit the page (off by default)
- Settings live in `chrome.storage.local`, so they apply to every tab at once and survive restarts

### ❓ Help page
- **Help & shortcuts →** in the panel opens a built-in help page: how highlighting works, a Windows/Linux vs Mac shortcut table (your column is highlighted), Bluebook Mode, and troubleshooting (with a button that opens the browser's shortcut settings)

### 📘 Bluebook Mode
- Toggled with a button in the bottom-right corner that appears **only** while a question set is open (`satquestionbank.org/question/...?set=...`); it never shows on the home page or during normal browsing
- The preference is stored in `localStorage`, so it stays on for the next question
- Doesn't remove or move the site's **own** tools (Mark for Review, Cross out answers, Shuffle, the question list, the Desmos calculator, the SAT reference sheet) — it hides them and triggers them programmatically from its own Bluebook-style UI
- Questions with a reading passage are automatically split into two panes (left: passage, right: question)
- Opening the calculator **doesn't cover** the question; it opens as a side-by-side column in the page flow
- Answer-elimination (ABC) buttons render correctly, even on MathJax (SVG) answer choices

---

## Installation

Download or clone this folder, then follow the steps for your browser:

**Chrome (or other Chromium-based browsers):**
1. Go to:
   ```
   chrome://extensions
   ```
2. Turn on **Developer mode** in the top-right corner.
3. Click **Load unpacked** → select this folder.
4. "Lux" appears in the extensions list.

After changing the code, just click the reload (🔄) icon on the `chrome://extensions` page.

**Firefox:**
1. Go to:
   ```
   about:debugging#/runtime/this-firefox
   ```
2. Click **Load Temporary Add-on...** → select `manifest.json` in this folder.
3. "Lux" appears in the temporary extensions list.

> Requires Firefox 140 or later (`browser_specific_settings.gecko.strict_min_version`). Temporary add-ons are removed when Firefox restarts — a permanent install requires a package signed through [addons.mozilla.org](https://addons.mozilla.org).

---

## Usage

**On any site:**
1. Select some text.
2. Right-click → **Highlight** → pick a color (or press `Ctrl+Shift+H`; Mac: `Control+Shift+H`).
3. To remove: select the text again → right-click → **Remove highlight** (or press `Ctrl+Z`; Mac: `⌘Z` to undo the last highlight).

> If the shortcuts don't work, open the Help page from the Lux panel → **Troubleshooting**, or check `chrome://extensions/shortcuts`.

**On satquestionbank.org:**
1. Open a question set (via Find Questions).
2. Click the **Bluebook Mode** button in the bottom-right corner.
3. Use the *Highlights & Notes*, *Calculator*, *Reference*, and *More* tools in the top bar.
4. To turn it off: **More → Turn off Bluebook Mode**.

**Auto-highlight (e.g. on Khan Academy):**
1. Click the Lux icon in the toolbar (pin it from the puzzle-piece menu if you don't see it).
2. Turn on **Auto-highlight** and pick a color.
3. Select text — it's highlighted immediately. Press `Ctrl+Z` (Mac: `⌘Z`) to undo the last one.
4. Turn it off again from the same panel.

---

## File structure

| File | Purpose |
|---|---|
| `manifest.json` | Manifest V3 definition: permissions, content-script rules, keyboard shortcuts, Firefox settings (`browser_specific_settings.gecko`) |
| `background.js` | Service worker that handles the right-click menu and keyboard-shortcut commands |
| `content.js` | Highlight / remove / undo logic; runs on every site and exposes a small `window.__lux` API used by `bluebook.js`; also handles auto-highlight and Ctrl/⌘+Z |
| `bluebook.css` | Bluebook Mode styling — fully scoped under `html.lux-bb`, so it doesn't touch the site while the mode is off |
| `bluebook.js` | Bluebook Mode detection, on/off toggle, its own shell (top/bottom bar, panels), and proxies to the site's tools |
| `popup.html` / `popup.js` / `popup.css` | Toolbar control panel: auto-highlight toggle, color, shortcut summary, Help link |
| `help.html` / `help.js` / `help.css` | Built-in help page with platform-aware shortcuts and troubleshooting |
| `icons/` | Extension icons (16/32/48/128 px) |

---

## Technical notes

- **Permissions:** `contextMenus`, `activeTab`, `scripting`, `storage` — none of them require broad host permissions; `scripting` is only used through `activeTab` access granted by a user gesture (right-click / shortcut), and `storage` holds the auto-highlight settings.
- **Selector strategy (bluebook.css/js):** satquestionbank.org is built with React + Tailwind/DaisyUI; instead of fragile generated class names, Lux targets the site's stable, meaningful classes (`.explanation_content`, `.answer_content`, `.join`, `.label`) and structural position via `:has()`.
- **Highlighter safety:** No rule in `bluebook.css` sets `background` with `!important` on question/passage text — so the inline `background-color` on Lux's highlight spans always stays visible.
- **Saving highlights (opt-in):** With *Keep highlights after reload* on, each highlight is stored in `chrome.storage.local` under the page address (without `#…`) as its text plus ~40 characters before and after it (a text-quote anchor). On load, Lux searches the page's visible text (skipping `<script>`, `<style>`, etc.) for the best match, and on late-loading pages retries for ~20 s as content appears. Removing or undoing a highlight deletes its record. The Bluebook Mode preference persists separately in `localStorage`.
- **Chrome + Firefox compatibility:** In `manifest.json`, `background` defines both `service_worker` (Chrome) and `scripts` (Firefox's MV3 event page); the Firefox side is completed with `browser_specific_settings.gecko` (ID, minimum version, "no data collection" declaration). To meet AMO (addons.mozilla.org) review requirements, the icons in `bluebook.js` are parsed with `DOMParser` and added to the DOM instead of using `innerHTML`.

---

## Known limitations

- Highlights are only saved when *Keep highlights after reload* is on; if a page's text changes significantly, a saved highlight may not be found again.
- Bluebook Mode is designed only for satquestionbank.org; if the site significantly changes its DOM structure, the selectors may need updating.
- Sites that redraw parts of the page (e.g. Khan Academy after you check an answer) can remove highlights made on those parts.
- Not guaranteed to work on Firefox versions below 140; add-ons installed via "Load Temporary Add-on" are removed when the browser restarts.
