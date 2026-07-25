import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import NoteCard from "../components/NoteCard.jsx";
import NoteModal from "../components/NoteModal.jsx";
import ContextMenu from "../components/ContextMenu.jsx";

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [error, setError] = useState("");

  // Modal state
  const [modalNote, setModalNote] = useState(null); // null = closed, {} = new, note = edit
  const [modalOpen, setModalOpen] = useState(false);

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, note }

  // Drag state
  const dragId = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [n, c] = await Promise.all([api.getNotes(), api.getCategories()]);
      setNotes(n);
      setCategories(c);
    } catch (e) {
      setError(e.message);
    }
  }

  // ---- Filtering ----
  const visible = notes.filter((n) => {
    if (filterCat !== "All" && (n.category || "") !== filterCat) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return n.title?.toLowerCase().includes(q) || n.body?.toLowerCase().includes(q);
    }
    return true;
  });

  // ---- Modal ----
  function openNew() {
    setModalNote({ title: "", body: "", color: "#1e1f2e", category: "" });
    setModalOpen(true);
  }

  function openEdit(note) {
    setModalNote(note);
    setModalOpen(true);
  }

  async function handleModalSave(data) {
    try {
      if (!modalNote?.id) {
        // New note — only create if there's actual content
        if (!data.title.trim() && !data.body.trim()) return;
        const created = await api.createNote(data);
        setNotes((prev) => [...prev, created]);
      } else {
        const updated = await api.updateNote(modalNote.id, data);
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleModalDelete() {
    if (!modalNote?.id) return;
    try {
      await api.deleteNote(modalNote.id);
      setNotes((prev) => prev.filter((n) => n.id !== modalNote.id));
    } catch (e) {
      setError(e.message);
    }
  }

  // ---- Context menu ----
  function openCtx(note, x, y) {
    setCtxMenu({ note, x, y });
  }

  async function ctxDelete(note) {
    try {
      await api.deleteNote(note.id);
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function ctxColor(note, color) {
    try {
      const updated = await api.updateNote(note.id, { ...note, color });
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    } catch (e) {
      setError(e.message);
    }
  }

  async function ctxCategory(note, category) {
    try {
      const updated = await api.updateNote(note.id, { ...note, category });
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    } catch (e) {
      setError(e.message);
    }
  }

  // ---- Drag & drop ----
  function handleDragStart(id) {
    dragId.current = id;
  }

  function handleDrop(targetId) {
    if (dragId.current == null || dragId.current === targetId) return;
    const reordered = [...notes];
    const fromIdx = reordered.findIndex((n) => n.id === dragId.current);
    const toIdx = reordered.findIndex((n) => n.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setNotes(reordered);
    setDragOver(null);
    dragId.current = null;
    api.reorderNotes(reordered.map((n) => n.id)).catch((e) => setError(e.message));
  }

  // Close context menu on scroll
  useEffect(() => {
    function onScroll() { setCtxMenu(null); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="content">
      {error && <div className="error">{error} <button className="btn-icon" onClick={() => setError("")}>×</button></div>}

      {/* Toolbar */}
      <div className="notes-toolbar">
        <div className="search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search notes"
          />
        </div>

        <div className="filter-chips" role="group" aria-label="Filter by category">
          <button
            className={`filter-chip${filterCat === "All" ? " active" : ""}`}
            onClick={() => setFilterCat("All")}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`filter-chip${filterCat === cat ? " active" : ""}`}
              onClick={() => setFilterCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <button className="btn btn-primary" onClick={openNew} aria-label="New note">
          + New note
        </button>
      </div>

      {/* Masonry grid */}
      {visible.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <p>{search || filterCat !== "All" ? "No notes match your filter." : "No notes yet. Create your first one!"}</p>
        </div>
      ) : (
        <div className="notes-grid" role="list">
          {visible.map((note) => (
            <div key={note.id} className="note-card-wrap" role="listitem">
              <NoteCard
                note={note}
                onOpen={() => openEdit(note)}
                onContextMenu={(x, y) => openCtx(note, x, y)}
                onDragStart={() => handleDragStart(note.id)}
                onDragOver={() => setDragOver(note.id)}
                onDrop={() => handleDrop(note.id)}
                isDragging={dragId.current === note.id}
                isDragOver={dragOver === note.id}
              />
            </div>
          ))}
        </div>
      )}

      {/* Note modal */}
      {modalOpen && (
        <NoteModal
          note={modalNote}
          categories={categories}
          onClose={() => setModalOpen(false)}
          onSave={handleModalSave}
          onDelete={handleModalDelete}
        />
      )}

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          note={ctxMenu.note}
          categories={categories}
          onClose={() => setCtxMenu(null)}
          onDelete={() => ctxDelete(ctxMenu.note)}
          onColorChange={(color) => ctxColor(ctxMenu.note, color)}
          onCategoryChange={(cat) => ctxCategory(ctxMenu.note, cat)}
        />
      )}
    </div>
  );
}
