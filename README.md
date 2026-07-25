# Noter

A self-hosted, Google Keep-style note-taking app with a dark premium UI.

## Stack

- **Backend**: ASP.NET Core 10 Web API + Entity Framework Core + SQLite
- **Frontend**: React 18 (Vite) — plain CSS, no component library
- **Runtime**: Docker Compose

## Run with Docker

```bash
docker compose up --build
```

- Frontend → http://localhost:8081
- Backend API → http://localhost:5199

Data is persisted in a Docker volume (`noter-data`).

## Run locally (dev)

**Backend:**
```bash
cd backend/Noter.Api
dotnet run
# API at http://localhost:5199
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# UI at http://localhost:5173
```

## Features

- Masonry grid of note cards with drag-and-drop reordering
- Note colors (9-swatch palette)
- Category filtering and search
- Right-click / long-press context menu (delete, change color, change category)
- Note popup with auto-grow textarea, color picker, category selector
- Settings: manage categories (chip editor), export TXT/JSON, import JSON
