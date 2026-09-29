<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="Lux logo">
</p>

<h1 align="center">Lux</h1>
<p align="center">A simple text highlighter for Chrome &amp; Firefox — plus a <strong>Bluebook Mode</strong> for satquestionbank.org and a one-click highlight button for Khan Academy.</p>

---

## What it does

Lux is a Manifest V3 browser extension that's easy to install and use, and runs on both **Chrome** and **Firefox** (Windows, Linux and macOS). It has three independent features:

1. **Highlighter (any site):** Select text on any web page and highlight it in color from the right-click menu or with a keyboard shortcut.
2. **Bluebook Mode (satquestionbank.org only):** Reskins a question set on [satquestionbank.org](https://satquestionbank.org) to look like **Bluebook**, College Board's official digital SAT app — with a top/bottom bar and tools like Highlights & Notes, Calculator, Reference, and Cross out answers.
3. **Khan Academy highlight button:** On Khan Academy question pages, a **Highlight** button in the top-right corner turns on auto-highlighting: every text selection is highlighted instantly until you turn it off.

---

## Features

### 🖍️ Highlighter
- Select text → right-click → **Vurgula** (Highlight) → 6 colors (yellow, blue, pink, green, orange, purple)
- **Ctrl+Shift+H** (Mac: **Control+Shift+H**) — highlights the selection with the last-used color
- **Ctrl+Shift+Z** (Mac: **Control+Shift+Z**) — undoes the most recent highlight (no selection needed)
- Select any text (highlighted or not) → right-click → **Vurguyu Kaldır** (Remove highlight) removes **every** highlight inside the selection at once
- Works on pages with `iframe`s (`all_frames: true` + messages routed to the correct frame)
- Self-heals in tabs that were already open when the extension was updated or reloaded (re-injects itself via `chrome.scripting.executeScript` when needed)

> The context-menu labels are currently in Turkish.

> On Mac the shortcuts use the real **Control** key (not ⌘), because ⌘+Shift+H is Chrome's "Home page" shortcut and ⌘+Shift+Z is Redo in text fields.

### 🎓 Khan Academy highlight button
- Appears in the top-right corner **only** on Khan Academy question pages (pages that render a Perseus exercise or have a **Check** button); it disappears elsewhere
- Click **Highlight** to turn it on: from then on, any text you select is highlighted as soon as you release the mouse (or finish a Shift+arrow selection) — until you click it again to turn it off
- Pick one of the 6 Lux colors from the swatches shown under the button while it's on
- **Ctrl+Z** (Mac: **⌘Z**) undoes the most recent highlight; if there is nothing to undo, or you're typing in a text box, the key is left alone for Khan Academy
- The on/off state and the chosen color are remembered in `localStorage`, so it stays on for the next question

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
2. Right-click → **Vurgula** → pick a color (or press `Ctrl+Shift+H`; Mac: `Control+Shift+H`).
3. To remove: select the text again → right-click → **Vurguyu Kaldır** (or press `Ctrl+Shift+Z`; Mac: `Control+Shift+Z` to undo the last highlight).

> If the shortcuts don't work, check that they're assigned to "Lux" on `chrome://extensions/shortcuts`.

**On satquestionbank.org:**
1. Open a question set (via Find Questions).
2. Click the **Bluebook Mode** button in the bottom-right corner.
3. Use the *Highlights & Notes*, *Calculator*, *Reference*, and *More* tools in the top bar.
4. To turn it off: **More → Turn off Bluebook Mode**.

**On Khan Academy:**
1. Open an exercise, quiz, or unit test.
2. Click **Highlight** in the top-right corner and pick a color.
3. Select text — it's highlighted immediately. Press `Ctrl+Z` (Mac: `⌘Z`) to undo the last one.
4. Click **Highlight** again to turn it off.

---

## File structure

| File | Purpose |
|---|---|
| `manifest.json` | Manifest V3 definition: permissions, content-script rules, keyboard shortcuts, Firefox settings (`browser_specific_settings.gecko`) |
| `background.js` | Service worker that handles the right-click menu and keyboard-shortcut commands |
| `content.js` | Highlight / remove / undo logic; runs on every site and exposes a small `window.__lux` API used by `bluebook.js` and `khan.js` |
| `bluebook.css` | Bluebook Mode styling — fully scoped under `html.lux-bb`, so it doesn't touch the site while the mode is off |
| `bluebook.js` | Bluebook Mode detection, on/off toggle, its own shell (top/bottom bar, panels), and proxies to the site's tools |
| `khan.js` | Khan Academy highlight button: question-page detection, auto-highlight on selection, Ctrl/⌘+Z undo |
| `khan.css` | Styling for the Khan Academy button and color swatches |
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
- Khan Academy re-renders parts of the page (e.g. when you check an answer or move to the next question), which can remove highlights made on that part.
- Not guaranteed to work on Firefox versions below 140; add-ons installed via "Load Temporary Add-on" are removed when the browser restarts.
