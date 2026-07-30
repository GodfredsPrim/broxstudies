from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import List
from pathlib import Path
import uuid
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
    SocialPost, SocialPostCreateRequest, SocialCommentCreateRequest, SocialReactionRequest,
    PaymentConfirmResponse,
    SendAccessCodeSmsRequest,
    SmsLogEntry,
)
from app.routes.auth import get_current_user
from app.services.auth_service import AuthService
from app.config import settings
from app.services.backtesting_service import backtesting_service
from app.services.impact_service import impact_service

router = APIRouter()
auth_service = AuthService()

IMAGE_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def _store_media(filename: str, content_type: str, data: bytes) -> str:
    return auth_service.store_media_asset(
        uuid.uuid4().hex,
        Path(filename).name[:180] or "upload",
        content_type,
        data,
    )


def _valid_image_signature(extension: str, data: bytes) -> bool:
    return {
        ".jpg": data.startswith(b"\xff\xd8\xff"),
        ".jpeg": data.startswith(b"\xff\xd8\xff"),
        ".png": data.startswith(b"\x89PNG\r\n\x1a\n"),
        ".webp": len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP",
    }.get(extension, False)


class CouponGenerateRequest(BaseModel):
    quantity: int = 1
    duration_months: int | None = None


class TeacherRoleRequest(BaseModel):
    is_teacher: bool = True


class BacktestRequest(BaseModel):
    subject: str
    hidden_year: int

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


@router.get("/users")
async def list_users(limit: int = 100, admin: AuthUser = Depends(require_admin)):
    with auth_service._connect() as conn:
        rows = auth_service._execute(
            conn,
            """SELECT id, full_name, email, is_admin, is_teacher, created_at
               FROM users ORDER BY created_at DESC LIMIT ?""",
            (max(1, min(limit, 250)),),
        ).fetchall()
    return {
        "users": [
            {
                **dict(row),
                "is_admin": bool(row["is_admin"]),
                "is_teacher": bool(row["is_teacher"]),
            }
            for row in rows
        ]
    }


@router.put("/users/{user_id}/teacher")
async def set_teacher_role(
    user_id: int,
    body: TeacherRoleRequest,
    admin: AuthUser = Depends(require_admin),
):
    if not auth_service.set_user_teacher(user_id, body.is_teacher):
        raise HTTPException(status_code=404, detail="User not found.")
    return {"user_id": user_id, "is_teacher": body.is_teacher}


@router.get("/backtesting/catalog")
async def backtesting_catalog(admin: AuthUser = Depends(require_admin)):
    return {"subjects": backtesting_service.catalog()}


@router.post("/backtesting/run")
async def run_backtest(body: BacktestRequest, admin: AuthUser = Depends(require_admin)):
    try:
        return backtesting_service.run(body.subject, body.hidden_year, admin.id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/backtesting/history")
async def backtesting_history(admin: AuthUser = Depends(require_admin)):
    return {"runs": backtesting_service.history()}


@router.get("/impact")
async def impact_dashboard(admin: AuthUser = Depends(require_admin)):
    return impact_service.snapshot()

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
    filename = file.filename or "competition.pdf"
    if Path(filename).suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    content = await file.read(15 * 1024 * 1024 + 1)
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Competition PDFs must be 15 MB or smaller.")
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid PDF.")

    pdf_url = _store_media(filename, "application/pdf", content)
    success = auth_service.update_competition_pdf(comp_id, pdf_url)
    
    if not success:
        raise HTTPException(status_code=404, detail="Competition not found.")
    
    return {"status": "success", "pdf_url": pdf_url}

@router.post("/competitions/{comp_id}/upload-image")
async def upload_comp_image(comp_id: int, file: UploadFile = File(...), admin: AuthUser = Depends(require_admin)):
    filename = file.filename or "competition-image"
    ext = Path(filename).suffix.lower()
    if ext not in IMAGE_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Only images (JPG, PNG, WEBP) are allowed.")

    content = await file.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Images must be 5 MB or smaller.")
    if not _valid_image_signature(ext, content):
        raise HTTPException(status_code=400, detail="The image contents do not match its file type.")

    image_url = _store_media(filename, IMAGE_CONTENT_TYPES[ext], content)
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
    auth_service._log_sms(request.phone, "access_code", result)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    return {"status": "success", "message": result.message}


@router.get("/sms-log", response_model=List[SmsLogEntry])
async def get_sms_log(limit: int = 100, admin: AuthUser = Depends(require_admin)):
    """Recent OTP/access-code SMS send attempts with the raw Moolre response —
    hand this to Moolre support (api_data often carries their message ID) when
    disputing "sent but never delivered" reports."""
    rows = auth_service.list_sms_log(limit=min(limit, 500))
    return [SmsLogEntry(**{**r, "success": bool(r.get("success"))}) for r in rows]

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
    # Keep the feed calm: at most one motivation item per calendar day.
    seen_motivation_days = set()
    filtered = []
    for article in sorted(combined, key=lambda a: a.created_at, reverse=True):
        if article.category == "motivation":
            day = article.created_at[:10]
            if day in seen_motivation_days:
                continue
            seen_motivation_days.add(day)
        filtered.append(article)
    combined = filtered
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
    filename = file.filename or "news-image"
    ext = Path(filename).suffix.lower()
    if ext not in IMAGE_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Only images (JPG, PNG, WEBP) are allowed.")

    content = await file.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Images must be 5 MB or smaller.")
    if not _valid_image_signature(ext, content):
        raise HTTPException(status_code=400, detail="The image contents do not match its file type.")

    image_url = _store_media(filename, IMAGE_CONTENT_TYPES[ext], content)
    success = auth_service.update_news_article_image(article_id, image_url)

    if not success:
        raise HTTPException(status_code=404, detail="Article not found.")

    return {"status": "success", "image_url": image_url}


# ── Student social feed ──────────────────────────────────────────────────────

@router.get("/social", response_model=List[SocialPost])
async def list_social_posts(current_user: AuthUser = Depends(get_current_user)):
    return [SocialPost(**post) for post in auth_service.list_social_posts(current_user.id)]


@router.post("/social", response_model=int)
async def create_social_post(
    content: str = Form(default=""),
    attachment: UploadFile | None = File(default=None),
    current_user: AuthUser = Depends(get_current_user),
):
    content = content.strip()
    if len(content) > 500 or (not content and not attachment):
        raise HTTPException(status_code=400, detail="Add a message or attachment; messages may contain up to 500 characters.")

    attachment_url = attachment_name = attachment_type = None
    if attachment:
        import os
        allowed = {
            ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
            ".pdf": "application/pdf", ".doc": "application/msword",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }
        ext = os.path.splitext(attachment.filename or "")[1].lower()
        if ext not in allowed:
            raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP, PDF, DOC, and DOCX files are allowed.")
        data = await attachment.read(10 * 1024 * 1024 + 1)
        if len(data) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Attachments must be 10 MB or smaller.")
        signatures_ok = {
            ".jpg": data.startswith(b"\xff\xd8\xff"),
            ".jpeg": data.startswith(b"\xff\xd8\xff"),
            ".png": data.startswith(b"\x89PNG\r\n\x1a\n"),
            ".webp": len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP",
            ".pdf": data.startswith(b"%PDF-"),
            ".doc": data.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"),
            ".docx": data.startswith(b"PK\x03\x04"),
        }
        if not signatures_ok[ext]:
            raise HTTPException(status_code=400, detail="The attachment contents do not match its file type.")
        attachment_name = os.path.basename(attachment.filename or f"attachment{ext}")[:180]
        attachment_type = allowed[ext]
        attachment_url = _store_media(attachment_name, attachment_type, data)

    return auth_service.create_social_post(current_user.id, content, attachment_url, attachment_name, attachment_type)


@router.post("/social/{post_id}/comments", response_model=int)
async def create_social_comment(post_id: int, request: SocialCommentCreateRequest, current_user: AuthUser = Depends(get_current_user)):
    content = request.content.strip()
    if not content or len(content) > 300:
        raise HTTPException(status_code=400, detail="Comments must contain 1 to 300 characters.")
    comment_id = auth_service.add_social_comment(post_id, current_user.id, content)
    if not comment_id:
        raise HTTPException(status_code=404, detail="Post not found.")
    return comment_id


@router.put("/social/{post_id}/reaction")
async def react_to_social_post(post_id: int, request: SocialReactionRequest, current_user: AuthUser = Depends(get_current_user)):
    if request.reaction not in {None, "like", "love", "insightful"}:
        raise HTTPException(status_code=400, detail="Unsupported reaction.")
    if not auth_service.set_social_reaction(post_id, current_user.id, request.reaction):
        raise HTTPException(status_code=404, detail="Post not found.")
    return {"status": "success"}
