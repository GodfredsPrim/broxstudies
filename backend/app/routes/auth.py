from fastapi import APIRouter, Depends, Header, HTTPException

from app.config import settings
from app.models import (
    AccessCodeVerifyRequest,
    AdminCodeGenerateRequest,
    AdminCodeGenerateResponse,
    AuthConfigResponse,
    AuthLoginRequest,
    AuthResponse,
    AuthSignupRequest,
    AuthUser,
    GoogleAuthRequest,
    PaymentManualRequest,
    SubscriptionStatusResponse,
)
from app.services.auth_service import AuthService
from datetime import datetime, timezone

router = APIRouter()
auth_service = AuthService()


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header.")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid authorization header.")
    return token


def get_current_user(authorization: str | None = Header(default=None)) -> AuthUser:
    token = _extract_bearer_token(authorization)
    try:
        return auth_service.get_user_from_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


def get_optional_user(authorization: str | None = Header(default=None)) -> AuthUser | None:
    """Returns the authenticated user or None if no valid token is present."""
    if not authorization:
        return None
    try:
        token = _extract_bearer_token(authorization)
        return auth_service.get_user_from_token(token)
    except (HTTPException, ValueError):
        return None


@router.get("/config", response_model=AuthConfigResponse)
async def get_auth_config():
    return AuthConfigResponse(
        google_client_id=settings.GOOGLE_CLIENT_ID,
        google_enabled=bool(settings.GOOGLE_CLIENT_ID),
        facebook_enabled=False,
        tiktok_enabled=False,
        passkey_enabled=False,
    )


@router.post("/signup", response_model=AuthResponse)
async def signup(request: AuthSignupRequest):
    try:
        token, user = auth_service.signup(request.full_name, request.email, request.password)
        return AuthResponse(access_token=token, user=user)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/login", response_model=AuthResponse)
async def login(request: AuthLoginRequest):
    try:
        token, user = auth_service.login(request.email, request.password)
        return AuthResponse(access_token=token, user=user)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/google", response_model=AuthResponse)
async def login_with_google(request: GoogleAuthRequest):
    try:
        token, user = auth_service.login_with_google(request.credential)
        return AuthResponse(access_token=token, user=user)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/me", response_model=AuthUser)
async def get_me(current_user: AuthUser = Depends(get_current_user)):
    return current_user


# ── Subscription routes ───────────────────────────────────────────────────────

@router.get("/subscription", response_model=SubscriptionStatusResponse)
async def get_subscription(current_user: AuthUser = Depends(get_current_user)):
    """Return the current user's subscription information."""
    user = auth_service.get_subscription_status(current_user.id)

    days_remaining = None
    if user.subscription_expires_at and user.subscription_status == "active":
        try:
            exp = datetime.fromisoformat(user.subscription_expires_at)
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            delta = exp - datetime.now(timezone.utc)
            days_remaining = max(0, delta.days)
        except ValueError:
            pass

    return SubscriptionStatusResponse(
        status=user.subscription_status,
        expires_at=user.subscription_expires_at,
        days_remaining=days_remaining,
        price_ghs=settings.SUBSCRIPTION_PRICE_GHS,
        subscription_months=settings.SUBSCRIPTION_MONTHS,
    )


@router.post("/verify-code", response_model=AuthUser)
async def verify_access_code(
    request: AccessCodeVerifyRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    """Verify a paid or promo access code to activate or extend the user's subscription."""
    try:
        updated_user = auth_service.verify_access_code(current_user.id, request.code, request.track)
        return updated_user
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/payment-request")
async def request_manual_payment(
    request: PaymentManualRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    """Submit a manual payment verification request for admin review."""
    request_id = auth_service.create_payment_request(
        current_user.id,
        request.momo_name,
        request.momo_number,
        request.reference
    )
    return {"status": "success", "request_id": request_id}


# ── Admin routes ──────────────────────────────────────────────────────────────

@router.post("/admin/generate-codes", response_model=AdminCodeGenerateResponse)
async def generate_admin_codes(request: AdminCodeGenerateRequest):
    """Generate one-time access codes (admin only, protected by ADMIN_SECRET)."""
    try:
        codes = auth_service.generate_admin_codes(
            admin_secret=request.admin_secret,
            duration_months=request.duration_months,
            quantity=max(1, min(request.quantity, 100)),
        )
        months = request.duration_months or settings.SUBSCRIPTION_MONTHS
        return AdminCodeGenerateResponse(
            codes=codes,
            duration_months=months,
            price_ghs=settings.SUBSCRIPTION_PRICE_GHS,
        )
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
