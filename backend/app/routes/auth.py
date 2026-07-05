from typing import Union

from fastapi import APIRouter, Depends, Header, HTTPException

from app.config import settings
from app.models import (
    AccessCodeVerifyRequest,
    AddPhoneRequest,
    AdminCodeGenerateRequest,
    AdminCodeGenerateResponse,
    AuthConfigResponse,
    AuthLoginRequest,
    AuthOtpRequiredResponse,
    AuthResponse,
    AuthSignupRequest,
    AuthUser,
    GoogleAuthRequest,
    OtpRequestBody,
    OtpVerifyBody,
    PaymentManualRequest,
    SubscriptionStatusResponse,
    UserProgressResponse,
    UserProgressUpdate,
    VerifyPhoneRequest,
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


def require_active_subscription(current_user: AuthUser = Depends(get_current_user)) -> AuthUser:
    if current_user.is_admin:
        return current_user
    if current_user.subscription_status != "active":
        raise HTTPException(status_code=403, detail="An active subscription is required for this feature.")
    return current_user


@router.get("/config", response_model=AuthConfigResponse)
async def get_auth_config():
    from app.services.sms_service import sms_service
    from app.services.paystack_service import paystack_service
    from app.services.moolre_payment_service import moolre_payment_service

    return AuthConfigResponse(
        google_client_id=settings.GOOGLE_CLIENT_ID,
        google_enabled=bool(settings.GOOGLE_CLIENT_ID),
        facebook_enabled=False,
        tiktok_enabled=False,
        passkey_enabled=False,
        subscription_price_ghs=settings.SUBSCRIPTION_PRICE_GHS,
        subscription_months=settings.SUBSCRIPTION_MONTHS,
        momo_payment_number=settings.MOMO_PAYMENT_NUMBER,
        sms_enabled=sms_service.enabled and settings.SMS_ENABLED,
        paystack_enabled=paystack_service.enabled and settings.PAYSTACK_ENABLED,
        paystack_public_key=settings.PAYSTACK_PUBLIC_KEY if paystack_service.enabled else "",
        moolre_payment_enabled=moolre_payment_service.enabled,
        phone_otp_enabled=sms_service.enabled and settings.SMS_ENABLED,
    )


@router.post("/signup", response_model=AuthOtpRequiredResponse)
async def signup(request: AuthSignupRequest):
    """Create an unverified account and text an OTP to the given phone.
    The account isn't usable until /verify-otp confirms the code."""
    try:
        result = auth_service.signup(request.full_name, request.phone, request.password, request.email)
        return AuthOtpRequiredResponse(phone=result["phone"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/login", response_model=Union[AuthResponse, AuthOtpRequiredResponse])
async def login(request: AuthLoginRequest):
    try:
        result = auth_service.login(request.identifier, request.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if isinstance(result, dict):
        return AuthOtpRequiredResponse(**result)
    token, user = result
    return AuthResponse(access_token=token, user=user)


@router.post("/google", response_model=AuthResponse)
async def login_with_google(request: GoogleAuthRequest):
    try:
        token, user = auth_service.login_with_google(request.credential)
        return AuthResponse(access_token=token, user=user)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/request-otp")
async def request_otp(body: OtpRequestBody):
    """Send a 6-digit OTP to the given Ghana phone number via Moolre SMS."""
    from app.services.sms_service import sms_service
    if not sms_service.enabled:
        raise HTTPException(status_code=503, detail="SMS service is not configured.")
    try:
        auth_service.create_otp(body.phone.strip())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "message": "OTP sent. Check your phone."}


@router.post("/verify-otp", response_model=AuthResponse)
async def verify_otp(body: OtpVerifyBody):
    """Verify the OTP and return a JWT. Completes a pending signup, or logs in/creates a phone-based account."""
    result = auth_service.verify_otp(body.phone.strip(), body.code.strip())
    if not result:
        raise HTTPException(status_code=400, detail="Invalid or expired code. Please try again.")
    return AuthResponse(access_token=result["token"], user=result["user"])


@router.post("/add-phone")
async def add_phone(body: AddPhoneRequest, current_user: AuthUser = Depends(get_current_user)):
    """Start adding/verifying a phone number on an already-authenticated account
    (e.g. a legacy account created before phone numbers were required)."""
    from app.services.sms_service import sms_service
    if not sms_service.enabled:
        raise HTTPException(status_code=503, detail="SMS service is not configured.")
    try:
        auth_service.request_phone_verification(current_user.id, body.phone.strip())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "message": "OTP sent. Check your phone."}


@router.post("/verify-phone", response_model=AuthUser)
async def verify_phone(body: VerifyPhoneRequest, current_user: AuthUser = Depends(get_current_user)):
    """Confirm the OTP from /add-phone and attach the phone number to the current account."""
    try:
        updated_user = auth_service.confirm_phone_verification(current_user.id, body.phone.strip(), body.code.strip())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return updated_user


@router.get("/me", response_model=AuthUser)
async def get_me(current_user: AuthUser = Depends(get_current_user)):
    return current_user


@router.get("/progress", response_model=UserProgressResponse)
async def get_progress(current_user: AuthUser = Depends(get_current_user)):
    """Return the authenticated user's gamification progress."""
    data = auth_service.get_user_progress(current_user.id)
    return UserProgressResponse(**data)


@router.patch("/progress", response_model=UserProgressResponse)
async def update_progress(
    body: UserProgressUpdate,
    current_user: AuthUser = Depends(get_current_user),
):
    """Sync gamification progress from the client."""
    patch = body.model_dump(exclude_unset=True)
    if not patch:
        data = auth_service.get_user_progress(current_user.id)
        return UserProgressResponse(**data)
    data = auth_service.upsert_user_progress(current_user.id, patch)
    return UserProgressResponse(**data)


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
