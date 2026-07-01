# BroxStudies

## Overview
Ghana SHS/TVET EdTech platform: AI tutor, practice generation, WASSCE prep, library, gamification, and admin tools.

## Active codebase
- **`backend/`** — FastAPI app (`app/main.py`), SQLite/Postgres via `auth_service`, LangChain tutor, RAG question generation
- **`frontend/`** — React 18 + Vite + TypeScript SPA; built to `frontend/dist` and served by FastAPI in production

## Local development
```bash
# Backend
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```

## Key routes (frontend)
- `/welcome` — landing (public)
- `/dashboard` — student hub
- `/` — AI tutor (Study)
- `/practice`, `/wassce`, `/quiz`, `/library`, `/analytics`, `/admin`

## Do not recreate
Legacy folders (`frontend-old`, `frontend-v2`, `broxstudies/`, `examprep-gh/`) were removed. All UI work goes in `frontend/`.
