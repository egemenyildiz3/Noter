// Central place for all backend calls.
// Base URL comes from VITE_API_URL (used in Docker); falls back to the dev proxy path.
const BASE = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : null;
}

export const api = {
  // Notes
  getNotes: () => request("/api/notes"),
  createNote: (n) => request("/api/notes", { method: "POST", body: JSON.stringify(n) }),
  updateNote: (id, n) => request(`/api/notes/${id}`, { method: "PUT", body: JSON.stringify(n) }),
  deleteNote: (id) => request(`/api/notes/${id}`, { method: "DELETE" }),
  reorderNotes: (ids) => request("/api/notes/reorder", { method: "POST", body: JSON.stringify(ids) }),

  // Images — multipart upload, no JSON Content-Type override
  uploadImage: async (file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/api/images`, { method: "POST", body: form });
    if (!res.ok) { const t = await res.text(); throw new Error(t); }
    return res.json(); // { filename }
  },
  deleteImage: (filename) => request(`/api/images/${encodeURIComponent(filename)}`, { method: "DELETE" }),
  imageUrl: (filename) => `${BASE}/uploads/${encodeURIComponent(filename)}`,

  // Categories
  getCategories: () => request("/api/categories"),
  setCategories: (cats) => request("/api/categories", { method: "PUT", body: JSON.stringify(cats) }),

  // Export / Import
  exportJson: () => request("/api/export/json"),
  importJson: (data) => request("/api/import/json", { method: "POST", body: JSON.stringify(data) }),
};
