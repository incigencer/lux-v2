<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="Lux logo">
</p>

<h1 align="center">Lux</h1>
<p align="center">A simple text highlighter for Chrome &amp; Firefox — plus a <strong>Bluebook Mode</strong> for satquestionbank.org.</p>

---

## What it does

Lux is a Manifest V3 browser extension that's easy to install and use, and runs on both **Chrome** and **Firefox**. It has two independent features:

1. **Highlighter (any site):** Select text on any web page and highlight it in color from the right-click menu or with a keyboard shortcut.
2. **Bluebook Mode (satquestionbank.org only):** Reskins a question set on [satquestionbank.org](https://satquestionbank.org) to look like **Bluebook**, College Board's official digital SAT app — with a top/bottom bar and tools like Highlights & Notes, Calculator, Reference, and Cross out answers.

---

## Features

### 🖍️ Highlighter
- Select text → right-click → **Vurgula** (Highlight) → 6 colors (yellow, blue, pink, green, orange, purple)
- **Ctrl+Shift+H** — highlights the selection with the last-used color
- **Ctrl+Shift+Z** — undoes the most recent highlight (no selection needed)
- Select any text (highlighted or not) → right-click → **Vurguyu Kaldır** (Remove highlight) removes **every** highlight inside the selection at once
- Works on pages with `iframe`s (`all_frames: true` + messages routed to the correct frame)
- Self-heals in tabs that were already open when the extension was updated or reloaded (re-injects itself via `chrome.scripting.executeScript` when needed)

> The context-menu labels are currently in Turkish.

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
2. Right-click → **Vurgula** → pick a color (or press `Ctrl+Shift+H`).
3. To remove: select the text again → right-click → **Vurguyu Kaldır** (or press `Ctrl+Shift+Z` to undo the last highlight).

> If the shortcuts don't work, check that they're assigned to "Lux" on `chrome://extensions/shortcuts`.

**On satquestionbank.org:**
1. Open a question set (via Find Questions).
2. Click the **Bluebook Mode** button in the bottom-right corner.
3. Use the *Highlights & Notes*, *Calculator*, *Reference*, and *More* tools in the top bar.
4. To turn it off: **More → Turn off Bluebook Mode**.

---

## File structure

| File | Purpose |
|---|---|
| `manifest.json` | Manifest V3 definition: permissions, content-script rules, keyboard shortcuts, Firefox settings (`browser_specific_settings.gecko`) |
| `background.js` | Service worker that handles the right-click menu and keyboard-shortcut commands |
| `content.js` | Highlight / remove / undo logic; runs on every site |
| `bluebook.css` | Bluebook Mode styling — fully scoped under `html.lux-bb`, so it doesn't touch the site while the mode is off |
| `bluebook.js` | Bluebook Mode detection, on/off toggle, its own shell (top/bottom bar, panels), and proxies to the site's tools |
| `icons/` | Extension icons (16/32/48/128 px) |

---

## Technical notes

- **Permissions:** `contextMenus`, `activeTab`, `scripting` — none of them require broad host permissions; `scripting` is only used through `activeTab` access granted by a user gesture (right-click / shortcut).
- **Selector strategy (bluebook.css/js):** satquestionbank.org is built with React + Tailwind/DaisyUI; instead of fragile generated class names, Lux targets the site's stable, meaningful classes (`.explanation_content`, `.answer_content`, `.join`, `.label`) and structural position via `:has()`.
- **Highlighter safety:** No rule in `bluebook.css` sets `background` with `!important` on question/passage text — so the inline `background-color` on Lux's highlight spans always stays visible.
- **No persistence:** Highlights disappear when the page reloads (a deliberate simplicity choice). The Bluebook Mode preference, however, persists in `localStorage`.
- **Chrome + Firefox compatibility:** In `manifest.json`, `background` defines both `service_worker` (Chrome) and `scripts` (Firefox's MV3 event page); the Firefox side is completed with `browser_specific_settings.gecko` (ID, minimum version, "no data collection" declaration). To meet AMO (addons.mozilla.org) review requirements, the icons in `bluebook.js` are parsed with `DOMParser` and added to the DOM instead of using `innerHTML`.

---

## Known limitations

- Highlights aren't saved across pages or reloads.
- Bluebook Mode is designed only for satquestionbank.org; if the site significantly changes its DOM structure, the selectors may need updating.
- Not guaranteed to work on Firefox versions below 140; add-ons installed via "Load Temporary Add-on" are removed when the browser restarts.
