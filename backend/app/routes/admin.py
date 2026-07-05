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
    AdminStaticLoginRequest,
    NewsArticle,
    NewsArticleCreateRequest,
    NewsArticleUpdateRequest,
    PaymentConfirmResponse,
    SendAccessCodeSmsRequest,
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

@router.post("/payments/{request_id}/confirm", response_model=PaymentConfirmResponse)
async def confirm_payment(request_id: int, admin: AuthUser = Depends(require_admin)):
    result = auth_service.process_payment_confirmation(request_id, "confirm")
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result.get("error", "Request not found."))
    return PaymentConfirmResponse(
        status="success",
        access_code=result.get("access_code"),
        duration_months=result.get("duration_months"),
        sms_sent=bool(result.get("sms_sent")),
        sms_message=result.get("sms_message"),
    )

@router.post("/payments/{request_id}/reject")
async def reject_payment(request_id: int, admin: AuthUser = Depends(require_admin)):
    result = auth_service.process_payment_confirmation(request_id, "reject")
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result.get("error", "Request not found."))
    return {"status": "success"}


@router.post("/codes/send-sms")
async def send_access_code_sms(request: SendAccessCodeSmsRequest, admin: AuthUser = Depends(require_admin)):
    from app.services.sms_service import sms_service

    months = request.duration_months or settings.SUBSCRIPTION_MONTHS
    result = sms_service.send_access_code(request.phone, request.code, months)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    return {"status": "success", "message": result.message}

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


# ── News articles ────────────────────────────────────────────────────────────

@router.get("/news", response_model=List[NewsArticle])
async def list_news(category: str = "all"):
    """Public: list published news articles merged with external news and motivation feeds."""
    from app.services.news_fetcher import get_external_articles
    cat_filter = category if category != "all" else None

    # Admin-posted articles
    rows = auth_service.list_news_articles(published_only=True, category=cat_filter)
    admin_articles = [
        NewsArticle(**{**r, "is_published": bool(r.get("is_published", 1)), "is_pinned": bool(r.get("is_pinned", 0)), "source": "admin"})
        for r in rows
    ]

    # External articles (cached, non-blocking on failure)
    try:
        ext_raw = await get_external_articles()
        if cat_filter:
            ext_raw = [a for a in ext_raw if a.get("category") == cat_filter]
        ext_articles = [NewsArticle(**a) for a in ext_raw]
    except Exception:
        ext_articles = []

    combined = admin_articles + ext_articles
    # Stable sort: newest-first within each group, then pinned articles float to the top.
    combined.sort(key=lambda a: a.created_at, reverse=True)
    combined.sort(key=lambda a: a.is_pinned, reverse=True)
    return combined


@router.get("/news/all", response_model=List[NewsArticle])
async def list_all_news(admin: AuthUser = Depends(require_admin)):
    """Admin: list all articles including drafts."""
    rows = auth_service.list_news_articles(published_only=False)
    return [NewsArticle(**{**r, "is_published": bool(r.get("is_published", 1)), "is_pinned": bool(r.get("is_pinned", 0))}) for r in rows]


@router.post("/news", response_model=int)
async def create_news(request: NewsArticleCreateRequest, admin: AuthUser = Depends(require_admin)):
    article_id = auth_service.create_news_article(
        title=request.title,
        content=request.content,
        category=request.category,
        author_name=request.author_name,
        image_url=request.image_url,
        is_published=request.is_published,
        is_pinned=request.is_pinned,
    )
    return article_id


@router.put("/news/{article_id}")
async def update_news(article_id: int, request: NewsArticleUpdateRequest, admin: AuthUser = Depends(require_admin)):
    ok = auth_service.update_news_article(
        article_id=article_id,
        title=request.title,
        content=request.content,
        category=request.category,
        image_url=request.image_url,
        is_published=request.is_published,
        is_pinned=request.is_pinned,
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Article not found.")
    return {"status": "success"}


@router.delete("/news/{article_id}")
async def delete_news(article_id: int, admin: AuthUser = Depends(require_admin)):
    ok = auth_service.delete_news_article(article_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Article not found.")
    return {"status": "success"}


@router.post("/news/{article_id}/upload-image")
async def upload_news_image(article_id: int, file: UploadFile = File(...), admin: AuthUser = Depends(require_admin)):
    allowed_exts = {".jpg", ".jpeg", ".png", ".webp"}
    import os
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="Only images (JPG, PNG, WEBP) are allowed.")

    news_upload_dir = BACKEND_DIR / "uploads" / "news"
    news_upload_dir.mkdir(parents=True, exist_ok=True)

    filename = f"news_{article_id}{ext}"
    file_path = news_upload_dir / filename

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    image_url = f"/uploads/news/{filename}"
    success = auth_service.update_news_article_image(article_id, image_url)

    if not success:
        raise HTTPException(status_code=404, detail="Article not found.")

    return {"status": "success", "image_url": image_url}
