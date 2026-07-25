import { useEffect, useRef } from "react";
import { NOTE_COLORS } from "../constants.js";

export default function ContextMenu({ x, y, note, categories, onClose, onDelete, onColorChange, onCategoryChange }) {
  const ref = useRef(null);

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handle);
    document.addEventListener("touchstart", handle);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("touchstart", handle);
    };
  }, [onClose]);

  // Keep menu inside viewport
  const menuStyle = {
    left: Math.min(x, window.innerWidth - 200),
    top: Math.min(y, window.innerHeight - 360),
  };

  return (
    <div ref={ref} className="ctx-menu" style={menuStyle} role="menu">
      <div className="ctx-sub-label">Color</div>
      <div className="ctx-colors">
        {NOTE_COLORS.map((c) => (
          <button
            key={c.hex}
            className={`ctx-color-swatch${note.color === c.hex ? " selected" : ""}`}
            style={{ background: c.hex, outline: note.color === c.hex ? "2px solid var(--accent)" : "2px solid rgba(255,255,255,0.12)" }}
            onClick={() => { onColorChange(c.hex); onClose(); }}
            title={c.name}
            aria-label={`Color: ${c.name}`}
            role="menuitemradio"
            aria-checked={note.color === c.hex}
          />
        ))}
      </div>

      <div className="ctx-separator" />
      <div className="ctx-sub-label">Category</div>
      <div className="ctx-categories">
        <button
          className={`ctx-cat-item${!note.category ? " selected" : ""}`}
          onClick={() => { onCategoryChange(""); onClose(); }}
          role="menuitemradio"
          aria-checked={!note.category}
        >
          {!note.category ? "✓ " : ""}No category
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            className={`ctx-cat-item${note.category === cat ? " selected" : ""}`}
            onClick={() => { onCategoryChange(cat); onClose(); }}
            role="menuitemradio"
            aria-checked={note.category === cat}
          >
            {note.category === cat ? "✓ " : ""}{cat}
          </button>
        ))}
      </div>

      <div className="ctx-separator" />
      <button className="ctx-item danger" onClick={() => { onDelete(); onClose(); }} role="menuitem">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        Delete note
      </button>
    </div>
  );
}
