import { parseLinks } from "../linkify.js";
import { api } from "../api.js";

function parseImages(raw) {
  return (raw || "").split(",").map((s) => s.trim()).filter(Boolean);
}

// Renders plain text with http/https URLs turned into safe links.
// Links open in a new tab with noopener noreferrer.
function BodyWithLinks({ text }) {
  if (!text) return null;
  const segments = parseLinks(text);
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "link" ? (
          <a
            key={i}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            className="note-link"
            onClick={(e) => e.stopPropagation()} // don't open note modal when clicking a link
          >
            {seg.value}
          </a>
        ) : (
          <span key={i}>{seg.value}</span>
        )
      )}
    </>
  );
}

export default function NoteCard({
  note,
  onOpen,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  isDragOver,
}) {
  const images = parseImages(note.images);

  function handleContextMenu(e) {
    e.preventDefault();
    onContextMenu(e.clientX, e.clientY);
  }

  // Long press for touch
  let pressTimer = null;
  function handleTouchStart(e) {
    pressTimer = setTimeout(() => {
      const touch = e.touches[0];
      onContextMenu(touch.clientX, touch.clientY);
    }, 600);
  }
  function handleTouchEnd() { clearTimeout(pressTimer); }

  return (
    <div
      className={`note-card${isDragging ? " dragging" : ""}${isDragOver ? " drag-over" : ""}`}
      style={{ background: note.color || "#1e1f2e" }}
      onClick={(e) => { e.currentTarget.blur(); onOpen(); }}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      aria-label={note.title || "Note"}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }}
    >
      <span className="note-card-drag" aria-hidden="true">⠿</span>

      {/* First image as card thumbnail */}
      {images.length > 0 && (
        <img
          src={api.imageUrl(images[0])}
          alt=""
          className="note-card-thumb"
          loading="lazy"
          draggable={false}
        />
      )}

      {note.title && <p className="note-card-title">{note.title}</p>}

      {note.body && (
        <p className="note-card-body">
          <BodyWithLinks text={note.body} />
        </p>
      )}

      <div className="note-card-footer">
        {note.category && <span className="category-badge">{note.category}</span>}
        {images.length > 1 && (
          <span className="note-card-img-count" aria-label={`${images.length} images`}>
            +{images.length - 1}
          </span>
        )}
      </div>
    </div>
  );
}
