from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.models import Competition, LeaderboardEntry, AuthUser
from app.routes.auth import get_current_user
from app.services.auth_service import AuthService

router = APIRouter()
auth_service = AuthService()


@router.get("", response_model=List[Competition])
async def list_competitions_public():
    """List all active competitions (public endpoint)."""
    comps = auth_service.list_competitions(active_only=True)
    return [Competition(**c) for c in comps]


@router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard_public():
    """Get global leaderboard (public endpoint)."""
    data = auth_service.get_global_leaderboard()
    return [LeaderboardEntry(**d) for d in data]


@router.post("/{comp_id}/register")
async def register_for_competition(comp_id: int, current_user: AuthUser = Depends(get_current_user)):
    """Register current user for a competition."""
    success = auth_service.register_for_competition(current_user.id, comp_id)
    if not success:
        raise HTTPException(status_code=400, detail="Already registered or competition invalid.")
    return {"status": "success"}
