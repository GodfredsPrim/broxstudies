"""
Auth Router — Supabase-based authentication for BisaME Osuani.
"""

import os
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(tags=["Auth"])

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")


def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# ── Request / Response Models ─────────────────────────────────────────

class SignUpRequest(BaseModel):
    email: str
    password: str
    full_name: str = ""


class SignInRequest(BaseModel):
    email: str
    password: str


# ── Endpoints ──────────────────────────────────────────────────────────

@router.post("/signup")
async def sign_up(req: SignUpRequest):
    """Register a new user via Supabase Auth."""
    try:
        supabase = get_supabase()
        result = supabase.auth.sign_up({
            "email": req.email,
            "password": req.password,
            "options": {
                "data": {"full_name": req.full_name}
            },
        })
        return {
            "status": "success",
            "message": "Account created. Please check your email to confirm.",
            "user_id": result.user.id if result.user else None,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/signin")
async def sign_in(req: SignInRequest):
    """Sign in with email + password and return a JWT session."""
    try:
        supabase = get_supabase()
        result = supabase.auth.sign_in_with_password({
            "email": req.email,
            "password": req.password,
        })
        return {
            "status": "success",
            "access_token": result.session.access_token,
            "refresh_token": result.session.refresh_token,
            "user": {
                "id": result.user.id,
                "email": result.user.email,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid credentials")


@router.post("/signout")
async def sign_out():
    """Sign out (client should discard tokens)."""
    return {"status": "success", "message": "Signed out."}


@router.get("/me")
async def get_current_user():
    """
    Placeholder — in production, extract user from the
    Authorization header JWT and return user profile.
    """
    return {"message": "Send a valid Bearer token to get user info."}
