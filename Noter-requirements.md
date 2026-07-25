# Noter — Requirements

## Context and idea

I want a personal note-taking app in the spirit of Google Keep — fast, visual, and
frictionless. Notes sit in a masonry grid (side by side and wrapping below), can be
reordered by drag and drop, opened in a popup for editing, given a color, and assigned
to categories. Everything is local and self-hosted. No AI, no accounts, no cloud sync.

## How I currently take notes

Scattered across Google Keep: short plain-text notes, some with titles, most without.
Color coding for rough grouping. No nested structure. Occasionally I export them as a
.txt or .json dump.

## Problem

Google Keep is fine but I want something self-hosted, distraction-free, with a UI I
control, and with proper category management (not just labels that are hard to see).

---

## Stack

- **Backend**: Dockerized ASP.NET Core Web API + Entity Framework Core + SQLite
- **Frontend**: React (Vite) — plain CSS, no component library
- **Runtime**: Docker Compose
- **Style**: Same dark, premium feel as FinTrack

---

## Pages

### 1. Notes (home — `/`)

The main view. A responsive masonry grid of note cards. Each card shows:
- The note title (if set — optional)
- A preview of the note body (truncated to ~4 lines)
- The assigned category as a small visible badge
- The note's background color

Interactions on the grid:
- **Click** a card → opens the edit popup
- **Drag** a card → reorder in the grid (persisted)
- **Right-click / long-press** → quick action menu (delete, change color, change category)
- **"+ New note"** button (top right or floating) → opens a blank popup
- **Filter bar** at the top → filter by category (all / one category)
- **Search bar** → live filter by text content

### 2. Settings (`/settings`)

Two sections:

**Categories**
- Add and delete categories (chip editor, same pattern as FinTrack's bank/category editor)
- Deleting a category sets affected notes to "Uncategorized"
- "Uncategorized" is the protected fallback — cannot be removed
- Default categories on first run: `Personal`, `Work`, `Ideas`, `Uncategorized`

**Export / Import**
- **Export all as TXT**: one file, notes separated by a clear divider, including title,
  category, color, and creation date
- **Export all as JSON**: full structured dump (same schema as the DB, for backup)
- **Import from JSON**: restore from a previous JSON export; asks for confirmation;
  replaces all notes
- (Import from TXT is not required — TXT export is a one-way human-readable snapshot)

---

## Data model

A single `Note` entity:

| Field | Meaning |
|---|---|
| `id` | auto-increment primary key |
| `title` | optional short title |
| `body` | plain text content |
| `color` | one of a fixed palette (hex or name, stored as string) |
| `category` | category name string (free text, validated against settings) |
| `sortOrder` | integer for manual grid ordering |
| `createdAt` | UTC timestamp |
| `updatedAt` | UTC timestamp |

Settings table: key/value, same as FinTrack. Used for `Categories`.

---

## Color palette

Fixed set of 8–10 swatches the user can pick from. Suggested palette:

| Name | Hex |
|---|---|
| Default | `#1e1f2e` (the card surface, no tint) |
| Red | `#3b1f1f` |
| Orange | `#3b2a1a` |
| Yellow | `#2f2d14` |
| Green | `#1a2e1e` |
| Teal | `#142b2e` |
| Blue | `#1a1f3b` |
| Purple | `#271a3b` |
| Pink | `#3b1a2e` |

---

## Note popup (modal)

Opens when clicking a card or the + New note button. Contains:
- Title field (optional, placeholder "Title")
- Body textarea (auto-grows, placeholder "Take a note…")
- Color picker (row of swatches at the bottom)
- Category selector (dropdown)
- Close button (saves automatically on close — no explicit Save button)
- Delete button (with confirm)

---

## Reordering

Drag and drop on the grid — same HTML5 drag API pattern used in FinTrack's checklist.
Persisted via a `POST /api/notes/reorder` endpoint that accepts an ordered list of IDs.

---

## API endpoints (backend)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/notes` | all notes, ordered by `sortOrder` |
| POST | `/api/notes` | create note |
| PUT | `/api/notes/:id` | update note (full replace) |
| DELETE | `/api/notes/:id` | delete note |
| POST | `/api/notes/reorder` | update sort order |
| GET | `/api/categories` | list categories |
| PUT | `/api/categories` | replace category list (orphans → Uncategorized) |
| GET | `/api/export/json` | full JSON backup |
| GET | `/api/export/txt` | TXT export (download) |
| POST | `/api/import/json` | restore from JSON backup |

---

## Non-requirements

- No user authentication
- No rich text / markdown rendering (plain text only for now)
- No image attachments
- No reminders or notifications
- No Google Keep sync
- No mobile app (responsive web is enough)
