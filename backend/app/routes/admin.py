from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List
from pydantic import BaseModel
from app.models import (
    AuthUser,
    AdminAnalytics,
    Competition,
    CompetitionCreateRequest,
    LeaderboardEntry,
    AuthResponse,
    AdminSecretLoginRequest,
    AdminStaticLoginRequest
)
from app.routes.auth import get_current_user
from app.services.auth_service import AuthService
from app.config import BACKEND_DIR, settings

router = APIRouter()
auth_service = AuthService()


class CouponGenerateRequest(BaseModel):
    quantity: int = 1
    duration_months: int | None = None

def require_admin(current_user: AuthUser = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required.")
    return current_user

@router.post("/login-secret", response_model=AuthResponse)
async def admin_login_secret(request: AdminSecretLoginRequest):
    try:
        token, admin = auth_service.login_admin_with_secret(request.secret)
        return AuthResponse(access_token=token, user=admin)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))

@router.get("/analytics", response_model=AdminAnalytics)
async def get_analytics(admin: AuthUser = Depends(require_admin)):
    data = auth_service.get_admin_analytics()
    return AdminAnalytics(**data)

@router.post("/competitions", response_model=int)
async def create_comp(request: CompetitionCreateRequest, admin: AuthUser = Depends(require_admin)):
    return auth_service.create_competition(
        request.title,
        request.description,
        request.prize,
        request.start_date,
        request.end_date,
        request.quiz_json,
        request.pdf_url
    )

@router.post("/competitions/{comp_id}/upload-pdf")
async def upload_comp_pdf(comp_id: int, file: UploadFile = File(...), admin: AuthUser = Depends(require_admin)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")
    
    import os
    # Create directory if not exists
    comp_upload_dir = BACKEND_DIR / "uploads" / "competitions"
    comp_upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Save file with unique name
    filename = f"comp_{comp_id}_{file.filename}"
    file_path = comp_upload_dir / filename
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Update DB
    pdf_url = f"/uploads/competitions/{filename}"
    success = auth_service.update_competition_pdf(comp_id, pdf_url)
    
    if not success:
        raise HTTPException(status_code=404, detail="Competition not found.")
    
    return {"status": "success", "pdf_url": pdf_url}

@router.post("/competitions/{comp_id}/upload-image")
async def upload_comp_image(comp_id: int, file: UploadFile = File(...), admin: AuthUser = Depends(require_admin)):
    allowed_exts = {".jpg", ".jpeg", ".png", ".webp"}
    import os
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="Only images (JPG, PNG, WEBP) are allowed.")
    
    # Create directory if not exists
    img_upload_dir = BACKEND_DIR / "uploads" / "ads"
    img_upload_dir.mkdir(parents=True, exist_ok=True)
    
    filename = f"ad_{comp_id}{ext}"
    file_path = img_upload_dir / filename
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    image_url = f"/uploads/ads/{filename}"
    success = auth_service.update_competition_image(comp_id, image_url)
    
    if not success:
        raise HTTPException(status_code=404, detail="Competition not found.")
    
    return {"status": "success", "image_url": image_url}

@router.get("/coupons/inventory")
async def get_coupon_inventory(admin: AuthUser = Depends(require_admin)):
    return auth_service.get_unused_access_codes()


@router.post("/coupons/generate")
async def generate_coupons(request: CouponGenerateRequest, admin: AuthUser = Depends(require_admin)):
    try:
        codes = auth_service.generate_admin_codes(
            admin_secret=settings.ADMIN_SECRET,
            duration_months=request.duration_months,
            quantity=max(1, min(request.quantity, 100)),
        )
        return {
            "codes": codes,
            "duration_months": request.duration_months or settings.SUBSCRIPTION_MONTHS,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@router.get("/payments/pending")
async def get_pending_payments(admin: AuthUser = Depends(require_admin)):
    return auth_service.get_pending_payments()

@router.post("/payments/{request_id}/confirm")
async def confirm_payment(request_id: int, admin: AuthUser = Depends(require_admin)):
    success = auth_service.process_payment_confirmation(request_id, "confirm")
    if not success:
        raise HTTPException(status_code=404, detail="Request not found.")
    return {"status": "success"}

@router.post("/payments/{request_id}/reject")
async def reject_payment(request_id: int, admin: AuthUser = Depends(require_admin)):
    success = auth_service.process_payment_confirmation(request_id, "reject")
    if not success:
        raise HTTPException(status_code=404, detail="Request not found.")
    return {"status": "success"}

@router.get("/competitions/all", response_model=List[Competition])
async def list_all_comps(admin: AuthUser = Depends(require_admin)):
    comps = auth_service.list_competitions(active_only=False)
    return [Competition(**c) for c in comps]

@router.get("/competitions", response_model=List[Competition])
async def list_comps():
    comps = auth_service.list_competitions(active_only=True)
    return [Competition(**c) for c in comps]

@router.post("/competitions/{comp_id}/register")
async def register_comp(comp_id: int, current_user: AuthUser = Depends(get_current_user)):
    success = auth_service.register_for_competition(current_user.id, comp_id)
    if not success:
        raise HTTPException(status_code=400, detail="Already registered or competition invalid.")
    return {"status": "success"}

@router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard():
    data = auth_service.get_global_leaderboard()
    return [LeaderboardEntry(**d) for d in data]

# Removed setup-initial-admin as per request.
