# NoteModal UI — Handover Document

## What the agent has been asked to do

Build a note editing modal (popup) for a Google Keep-style note-taking app. The modal opens when clicking a note card on the main grid. It must:

- Show title (input) and body (textarea) for editing
- Display URLs in the body as clickable hyperlinks
- Have a color picker (9 swatches), category dropdown, image attach button in the footer
- Have a delete button with two-step confirm
- Close on ESC, backdrop click, or Cmd/Ctrl+Enter
- Support image drag-and-drop

---

## Current Visible Problems (from screenshots)

### 1. Modal position is wrong
The modal appears **partially off the top of the screen** — the title input is cut off or hidden above the visible viewport. The close button (`×`) appears near the very top edge. This happens across multiple attempts with different CSS strategies.

**Screenshots show:**
- First screenshot: Title "Title" barely visible, modal starts too high, body text and footer visible but title area is clipped
- Second screenshot: Modal appears lower but title area is still cramped, no clear separation between title and body

### 2. No visible dark backdrop
The background behind the modal shows the app content (note grid, toolbar) **without the expected dark dimming overlay**. The `rgba(0,0,0,0.7)` backdrop + `backdrop-filter: blur(6px)` is in the CSS but isn't visually prominent enough, or is not rendering at all in some states.

### 3. Body area is too tall and empty
The body area has `min-height: 120px` causing a large blank space below short notes. The modal looks empty and unbalanced when the note has only a couple lines of text.

### 4. Read/edit mode toggle is unreliable
The modal uses a dual-mode body: a `div` (read mode, shows inline links) and a `<textarea>` (edit mode). The toggle logic has caused multiple issues:
- **Blank screen crash**: `isNew` was used before being declared when initializing `useState(isNew)` — temporal dead zone error. Fixed once but the structure is fragile.
- **Premature collapse to read mode**: `onBlur` on the textarea fires when the user clicks the color picker, category dropdown, or delete button (all inside the modal), immediately switching back to read mode. The current fix uses `document.mousedown` outside the modal ref — but this is still unreliable.
- **Focus cursor position**: When switching from read → edit mode, the cursor placement at end-of-text works in theory but the textarea `selectionStart/selectionEnd` approach doesn't always fire correctly.

### 5. Link rendering inconsistency
- **On the note card (grid view)**: URLs in the body render as blue underlined links correctly via `BodyWithLinks` component using `parseLinks`.
- **In the modal (read mode)**: The `RichBody` component should do the same but the read mode is often not reached correctly — the modal opens in edit mode for existing notes (should be read mode), or crashes before rendering.

### 6. The `modal-scroll` wrapper causes layout issues
The current JSX wraps body + images in a `<div className="modal-scroll">` with `flex: 1; overflow-y: auto`. The title input is **outside** this scroll div but **inside** the `display: flex; flex-direction: column` modal. This should work but combined with the modal's `max-height: calc(100vh - 80px)` and `overflow: hidden`, the title sometimes gets squashed or disappears when the content area grows.

---

## Current File Structure

```
frontend/src/
  components/
    NoteModal.jsx      ← the modal component (main problem area)
    NoteCard.jsx       ← grid card (links work fine here)
    ContextMenu.jsx    ← right-click menu
  pages/
    Notes.jsx          ← main page, opens modal
    Settings.jsx
  styles.css           ← all CSS, no CSS modules
  linkify.js           ← URL parser (works correctly)
  api.js
  constants.js         ← NOTE_COLORS array
```

---

## Relevant CSS — Current State

```css
/* Backdrop */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: fade-in 0.15s ease;
}

/* Modal container */
.modal {
  background: #141523;
  border: 1px solid rgba(255,255,255,0.16);
  border-radius: 22px;
  padding: 28px 28px 22px;
  width: 100%;
  max-width: 540px;
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.9);
  position: relative;
  overflow: hidden;
}

/* Scrollable content area (body + images) */
.modal-scroll {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* Title */
.modal-title-input {
  font-size: 20px;
  font-weight: 700;
  flex-shrink: 0;
  /* background: none, border: none, outline: none */
}

/* Body textarea */
.modal-body-input {
  min-height: 120px;
  max-height: 40vh;
  overflow-y: auto;
  resize: none;
}

/* Body rendered div (read mode, shows links) */
.modal-body-rendered {
  min-height: 120px;
  cursor: text;
  white-space: pre-wrap;
}
```

---

## Current JSX Structure (simplified)

```jsx
<div className="modal-backdrop" onClick={handleBackdropClick}>
  <div ref={modalRef} className="modal" style={{ background: modalBg }}>

    <button className="modal-close-btn">×</button>

    <input className="modal-title-input" />     {/* outside scroll */}

    <div className="modal-scroll">              {/* scrollable area */}
      {editing
        ? <textarea className="modal-body-input" />
        : <div className="modal-body-rendered" onClick={() => setEditing(true)}>
            <RichBody text={body} />
          </div>
      }
      {/* images grid */}
    </div>

    <div className="modal-divider" />           {/* outside scroll */}

    <div className="modal-footer">              {/* outside scroll */}
      {/* color swatches, category select, attach button, delete button */}
    </div>

  </div>
</div>
```

---

## What the Read/Edit Toggle Needs to Do

The goal is Google Keep-like behavior:

1. **Opening an existing note** → body renders as a rich div with clickable links. Title is editable immediately (input is always an input).
2. **Clicking anywhere on the body text** → switches to textarea for editing. Cursor placed at click position (ideally).
3. **Clicking outside the body** (but still inside the modal, e.g. color swatch) → stays in edit mode.
4. **Clicking outside the modal entirely** (backdrop) → saves and closes, no need to switch to read mode first.
5. **Creating a new note** → opens directly in edit mode.

Current implementation uses `document.addEventListener("mousedown")` checking `modalRef.current.contains(e.target)` to decide when to exit edit mode. This is close but still triggers incorrectly in some cases.

---

## Recommended Fix Approach

The cleanest solution that avoids all the toggle fragility:

**Option A — Always textarea, linkify on card only (simplest)**
- Remove the read/edit toggle entirely from the modal
- The body is always a `<textarea>` — user can always type
- Links are only rendered as clickable on the note **card** (already works)
- This matches how most note apps actually work (Notion, Bear, etc.)
- Zero complexity, zero crashes

**Option B — Proper two-panel approach**
- Keep the toggle but make it explicit: add a small "edit" / "done" toggle button in the modal footer
- User explicitly switches modes — no implicit blur/mousedown detection
- When in read mode: rich div with links, not editable
- When in edit mode: textarea

**Option C — contenteditable**
- Use `contenteditable="true"` on a div — allows editing AND inline link rendering simultaneously
- More complex to implement correctly (needs to sanitize HTML output back to plain text)
- Would require a custom `onInput` handler to extract plain text and re-render links

---

## What Works Fine (do not break)

- **Note cards** on the main grid — layout, colors, category badges, drag-and-drop all work correctly
- **`linkify.js`** — URL parsing is correct and secure (http/https only, strips trailing punctuation)
- **`NoteCard.jsx` `BodyWithLinks`** — inline links on card work correctly
- **Backend** — all API endpoints, image upload with magic-byte validation, categories, export/import
- **Settings page** — categories chip editor, JSON export/import
- **Context menu** — right-click color/category/delete
- **ESC to close** — `document.addEventListener("keydown")` with `handleClose` via `useCallback` — this is stable now
- **Backdrop click to close** — `if (e.target === e.currentTarget) handleClose()` — works
- **Delete with two-step confirm** — works (confirm state resets correctly)
- **Drag-and-drop image upload** — `handleDragOver`/`handleDrop` on the modal div works

---

## Design Tokens (do not change)

```css
--bg: #070810
--surface: rgba(255, 255, 255, 0.035)
--surface-2: rgba(255, 255, 255, 0.06)
--border: rgba(255, 255, 255, 0.09)
--border-strong: rgba(255, 255, 255, 0.16)
--text: #f4f5fb
--muted: #8b90a6
--accent: #7c6cff
--neg: #ff6b81
--radius: 18px
Font: Plus Jakarta Sans
```

---

## App context

- React 18 + Vite, plain CSS (no modules, no Tailwind)
- Dark premium aesthetic matching a companion FinTrack app
- Self-hosted, no auth, no cloud
- Running: `docker compose up --build` → frontend on port 8081, backend on 5199
- Dev: `npm run dev` in `frontend/` (proxies `/api` to `localhost:5199`)
- GitHub: https://github.com/egemenyildiz3/Noter
