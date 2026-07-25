import { useCallback, useEffect, useRef, useState } from "react";
import { NOTE_COLORS } from "../constants.js";
import { api } from "../api.js";
import { parseLinks } from "../linkify.js";

const ACCEPTED_TYPES = ["image/jpeg", "image/png"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

function parseImages(raw) {
  return (raw || "").split(",").map((s) => s.trim()).filter(Boolean);
}

// Render text with inline clickable links.
function RichBody({ text, placeholder }) {
  if (!text) return <span className="modal-body-placeholder">{placeholder}</span>;
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
            className="note-link modal-inline-link"
            onClick={(e) => e.stopPropagation()}
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

async function uploadFiles(files, onAdd, onError) {
  for (const file of files) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      onError("Only JPEG and PNG images are allowed.");
      continue;
    }
    if (file.size > MAX_SIZE) {
      onError("Images must be under 5 MB.");
      continue;
    }
    try {
      const { filename } = await api.uploadImage(file);
      onAdd(filename);
    } catch (err) {
      onError(err.message);
    }
  }
}

export default function NoteModal({ note, categories, onClose, onSave, onDelete }) {
  const isNew = !note?.id;

  const [title, setTitle]                 = useState(note?.title ?? "");
  const [body, setBody]                   = useState(note?.body ?? "");
  const [color, setColor]                 = useState(note?.color ?? "#1e1f2e");
  const [category, setCategory]           = useState(note?.category ?? "");
  const [images, setImages]               = useState(parseImages(note?.images ?? ""));
  const [uploadError, setUploadError]     = useState("");
  const [uploading, setUploading]         = useState(false);
  const [dragOver, setDragOver]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // editing = textarea visible; reading = rich rendered div
  const [editing, setEditing]             = useState(isNew);

  const bodyRef   = useRef(null);
  const fileRef   = useRef(null);
  const modalRef  = useRef(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [body, editing]);

  // Focus textarea when switching to edit mode
  useEffect(() => {
    if (editing && bodyRef.current) {
      const el = bodyRef.current;
      el.focus();
      // Place cursor at end
      el.selectionStart = el.selectionEnd = el.value.length;
    }
  }, [editing]);

  // Focus body on first open for new notes
  useEffect(() => {
    if (isNew && bodyRef.current) bodyRef.current.focus();
  }, []); // eslint-disable-line

  const currentData = useCallback(
    () => ({ title, body, color, category, images: images.join(",") }),
    [title, body, color, category, images]
  );

  const handleClose = useCallback(() => {
    onSave(currentData());
    onClose();
  }, [onSave, onClose, currentData]);

  // ESC closes modal; Cmd/Ctrl+Enter also closes
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") handleClose();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleClose]);

  // Switch back to read mode when clicking outside the modal entirely
  // (not when moving focus within the modal — e.g. clicking color swatch)
  useEffect(() => {
    function onMouseDown(e) {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        setEditing(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) handleClose();
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await onDelete();
    onClose();
  }

  // ---- Uploads ----
  async function processFiles(files) {
    if (!files.length) return;
    setUploadError("");
    setUploading(true);
    await uploadFiles(
      files,
      (filename) => setImages((prev) => [...prev, filename]),
      (msg) => setUploadError(msg),
    );
    setUploading(false);
  }

  async function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    await processFiles(files);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const hasImage = Array.from(e.dataTransfer.items).some(
      (item) => item.kind === "file" && ACCEPTED_TYPES.includes(item.type)
    );
    setDragOver(hasImage);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    await processFiles(Array.from(e.dataTransfer.files || []));
  }

  async function removeImage(filename) {
    setImages((prev) => prev.filter((f) => f !== filename));
    try { await api.deleteImage(filename); } catch { /* non-critical */ }
  }

  const modalBg = color !== "#1e1f2e" ? color : "#141523";

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick} tabIndex={-1}>
      <div
        ref={modalRef}
        className={`modal${dragOver ? " modal-drag-over" : ""}`}
        style={{ background: modalBg }}
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "New note" : "Edit note"}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {dragOver && (
          <div className="modal-drop-overlay" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span>Drop image here</span>
          </div>
        )}

        <button className="modal-close-btn" onClick={handleClose} aria-label="Close">×</button>

        <input
          className="modal-title-input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Note title"
        />

        {/* Body: rendered (links clickable) or editable textarea */}
        {editing ? (
          <textarea
            ref={bodyRef}
            className="modal-body-input"
            placeholder="Take a note…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-label="Note body"
          />
        ) : (
          <div
            className="modal-body-rendered"
            onClick={() => setEditing(true)}
            role="textbox"
            aria-multiline="true"
            aria-label="Note body — click to edit"
            tabIndex={0}
            onFocus={() => setEditing(true)}
          >
            <RichBody text={body} placeholder="Take a note…" />
          </div>
        )}

        {/* Images */}
        {images.length > 0 && (
          <div className="modal-images" role="list" aria-label="Attached images">
            {images.map((filename) => (
              <div key={filename} className="modal-image-wrap" role="listitem">
                <img src={api.imageUrl(filename)} alt="Attached" className="modal-image" loading="lazy" />
                <button className="modal-image-remove" onClick={() => removeImage(filename)} aria-label="Remove image" title="Remove">×</button>
              </div>
            ))}
          </div>
        )}

        {uploadError && <p className="modal-upload-error" role="alert">{uploadError}</p>}

        <div className="modal-divider" />

        <div className="modal-footer">
          <div className="modal-footer-left">
            <div className="color-picker" role="group" aria-label="Note color">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.hex}
                  className={`color-swatch${color === c.hex ? " selected" : ""}`}
                  style={{
                    background: c.hex,
                    outline: color === c.hex ? "2px solid var(--accent)" : "2px solid rgba(255,255,255,0.15)",
                  }}
                  onClick={() => setColor(c.hex)}
                  title={c.name}
                  aria-label={`Color: ${c.name}`}
                  aria-pressed={color === c.hex}
                />
              ))}
            </div>

            <select className="modal-cat-select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
              <option value="">No category</option>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>

            <button
              className="btn-attach"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Attach image"
              title="Attach image (JPEG or PNG, max 5 MB) — or drag and drop"
            >
              {uploading ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" multiple style={{ display: "none" }} onChange={handleFileChange} aria-label="Image file input" />
          </div>

          <div className="modal-footer-right">
            {note?.id && (
              <button
                className={`btn-delete-note${confirmDelete ? " confirming" : ""}`}
                onClick={handleDelete}
                aria-label="Delete note"
              >
                {confirmDelete ? (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>Confirm</>
                ) : (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>Delete</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
