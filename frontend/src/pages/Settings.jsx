import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

export default function Settings() {
  const [categories, setCategories] = useState([]);
  const [newCat, setNewCat] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [importing, setImporting] = useState(false);
  const [confirmImport, setConfirmImport] = useState(null); // holds parsed backup data
  const fileRef = useRef(null);

  useEffect(() => {
    api.getCategories().then(setCategories).catch((e) => setError(e.message));
  }, []);

  // ---- Categories ----
  async function addCategory(e) {
    e.preventDefault();
    const name = newCat.trim();
    if (!name) return;
    const updated = [...categories.filter((c) => c.toLowerCase() !== name.toLowerCase()), name];
    try {
      const saved = await api.setCategories(updated);
      setCategories(saved);
      setNewCat("");
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteCategory(cat) {
    const updated = categories.filter((c) => c !== cat);
    try {
      const saved = await api.setCategories(updated);
      setCategories(saved);
    } catch (e) {
      setError(e.message);
    }
  }

  // ---- Export ----
  async function exportJson() {
    try {
      const data = await api.exportJson();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `noter-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  }

  // ---- Import ----
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        setConfirmImport(data);
      } catch {
        setError("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
    // reset input so same file can be selected again
    e.target.value = "";
  }

  async function doImport() {
    if (!confirmImport) return;
    setImporting(true);
    try {
      await api.importJson(confirmImport);
      setNotice("Import successful! Reload the Notes page to see your data.");
      setConfirmImport(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="settings-content">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted small">Manage categories and your data.</p>
        </div>
      </div>

      {error && (
        <div className="error">
          {error}
          <button className="btn-icon" style={{ marginLeft: 8 }} onClick={() => setError("")}>×</button>
        </div>
      )}
      {notice && (
        <div className="notice">
          {notice}
          <button className="btn-icon" style={{ marginLeft: 8 }} onClick={() => setNotice("")}>×</button>
        </div>
      )}

      {/* Categories */}
      <div className="card">
        <div className="section-head">
          <h2>Categories</h2>
        </div>
        <p className="muted small" style={{ marginBottom: 14 }}>
          Deleting a category clears the category from all affected notes. Notes without a category are shown without a badge.
        </p>

        <div className="chip-list" role="list">
          {categories.map((cat) => (
            <span key={cat} className="chip" role="listitem">
              {cat}
              <button
                className="chip-del"
                onClick={() => deleteCategory(cat)}
                aria-label={`Remove ${cat}`}
                title="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <form className="add-chip-form" onSubmit={addCategory}>
          <input
            className="add-chip-input"
            placeholder="New category name…"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            maxLength={40}
            aria-label="New category name"
          />
          <button type="submit" className="btn btn-primary btn-sm">Add</button>
        </form>
      </div>

      {/* Export / Import */}
      <div className="card">
        <div className="section-head">
          <h2>Export / Import</h2>
        </div>
        <p className="muted small" style={{ marginBottom: 16 }}>
          Export your notes as a full JSON backup or restore from a previous export.
        </p>

        <div className="export-grid">
          <button className="export-btn-card" onClick={exportJson}>
            <span className="label">Export JSON</span>
            <span className="desc">Full structured backup for restoring</span>
          </button>

          <button
            className="export-btn-card"
            onClick={() => fileRef.current?.click()}
          >
            <span className="label">Import JSON</span>
            <span className="desc">Restore from a previous JSON export</span>
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={handleFileChange}
          aria-label="Import JSON file"
        />
      </div>

      {/* Confirm import dialog */}
      {confirmImport && (
        <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label="Confirm import">
          <div className="confirm-box">
            <h3>Replace all notes?</h3>
            <p>
              This will permanently delete all current notes and replace them with the data from the imported file.
              {confirmImport.notes?.length != null && ` The backup contains ${confirmImport.notes.length} note(s).`}
            </p>
            <div className="confirm-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmImport(null)}>
                Cancel
              </button>
              <button className="btn btn-danger btn-sm" onClick={doImport} disabled={importing}>
                {importing ? "Importing…" : "Yes, replace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
