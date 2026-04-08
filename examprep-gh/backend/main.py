"""
BisaME Osuani — Ghana SHS Exam Prep API
Main FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from routers import questions, ingest, auth

# ── App ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="BisaME Osuani",
    description="AI-powered Ghana SHS exam preparation platform",
    version="0.1.0",
)

# ── CORS (dev mode — allow all origins) ────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────

app.include_router(questions.router, prefix="/api/questions")
app.include_router(ingest.router, prefix="/api/ingest")
app.include_router(auth.router, prefix="/api/auth")

# ── Health Check ───────────────────────────────────────────────────────

@app.get("/")
async def health_check():
    return {"status": "ok", "app": "ExamPrep GH"}
