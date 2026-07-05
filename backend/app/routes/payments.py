import json
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from app.config import settings
from app.routes.auth import get_current_user
from app.models import (
    AuthUser,
    MoolreInitiateRequest,
    MoolreInitiateResponse,
    MoolreOtpSubmitRequest,
    MoolreStatusResponse,
    MoolreTransactionHistoryItem,
)
from app.services.auth_service import AuthService
from app.services.moolre_payment_service import moolre_payment_service
from app.services.paystack_service import paystack_service

logger = logging.getLogger(__name__)
router = APIRouter()
auth_service = AuthService()


# ── Moolre payment routes ─────────────────────────────────────────────────────

@router.post("/moolre/initiate", response_model=MoolreInitiateResponse)
async def moolre_initiate(
    body: MoolreInitiateRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    if not moolre_payment_service.enabled:
        raise HTTPException(status_code=503, detail="Moolre payment is not configured.")

    from app.services.sms_service import normalize_ghana_phone
    try:
        phone = normalize_ghana_phone(body.momo_number.strip())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    amount = settings.SUBSCRIPTION_PRICE_GHS
    external_ref = moolre_payment_service.generate_reference(current_user.id)

    auth_service.create_moolre_transaction(
        user_id=current_user.id,
        momo_number=phone,
        amount=amount,
        external_ref=external_ref,
    )

    result = moolre_payment_service.initiate_payment(phone, amount, external_ref)

    if result.status == "otp_required":
        return MoolreInitiateResponse(
            status="otp_required",
            external_ref=external_ref,
            message="Your network sent you an OTP. Enter it to confirm the payment.",
        )
    if result.status == "pending":
        if result.moolre_txid:
            auth_service.update_moolre_transaction_txid(external_ref, result.moolre_txid)
        return MoolreInitiateResponse(
            status="pending",
            external_ref=external_ref,
            message="Payment initiated. Approve it on your phone if prompted.",
        )

    raise HTTPException(status_code=400, detail=result.message or "Payment initiation failed.")


@router.post("/moolre/submit-otp")
async def moolre_submit_otp(
    body: MoolreOtpSubmitRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    if not moolre_payment_service.enabled:
        raise HTTPException(status_code=503, detail="Moolre payment is not configured.")

    tx = auth_service.get_moolre_transaction(body.external_ref)
    if not tx or int(tx["user_id"]) != current_user.id:
        raise HTTPException(status_code=404, detail="Payment not found.")
    if tx.get("status") == "success":
        return {"status": "already_paid"}

    result = moolre_payment_service.initiate_payment(
        phone=tx["momo_number"],
        amount=tx["amount"],
        external_ref=body.external_ref,
        otp_code=body.otp_code,
    )

    if result.status == "pending":
        if result.moolre_txid:
            auth_service.update_moolre_transaction_txid(body.external_ref, result.moolre_txid)
        return {"status": "pending"}
    if result.status == "otp_required":
        return {"status": "otp_required", "message": "Incorrect OTP. Please try again."}

    raise HTTPException(status_code=400, detail=result.message or "OTP submission failed.")


@router.get("/moolre/status/{external_ref}", response_model=MoolreStatusResponse)
async def moolre_status(
    external_ref: str,
    current_user: AuthUser = Depends(get_current_user),
):
    tx = auth_service.get_moolre_transaction(external_ref)
    if not tx or int(tx["user_id"]) != current_user.id:
        raise HTTPException(status_code=404, detail="Payment not found.")

    # Already fulfilled — return from DB
    if tx.get("status") == "success" and tx.get("access_code"):
        return MoolreStatusResponse(
            status="success",
            access_code=tx["access_code"],
            sms_sent=bool(tx.get("sms_sent")),
            already_fulfilled=True,
        )

    # Check with Moolre
    check = moolre_payment_service.check_status(external_ref)
    if check.status == "success":
        fulfillment = auth_service.complete_moolre_transaction(external_ref, tx.get("momo_number"))
        if not fulfillment.get("ok"):
            raise HTTPException(status_code=400, detail=fulfillment.get("error", "Fulfillment failed."))
        return MoolreStatusResponse(
            status="success",
            access_code=fulfillment.get("access_code"),
            sms_sent=bool(fulfillment.get("sms_sent")),
            sms_message=fulfillment.get("sms_message"),
            already_fulfilled=bool(fulfillment.get("already_fulfilled")),
        )
    if check.status == "failed":
        return MoolreStatusResponse(status="failed")

    return MoolreStatusResponse(status="pending")


@router.get("/moolre/history", response_model=list[MoolreTransactionHistoryItem])
async def moolre_history(current_user: AuthUser = Depends(get_current_user)):
    """The current user's own Moolre payment history — successful, pending, and failed."""
    transactions = auth_service.get_moolre_transactions_for_user(current_user.id)
    return [
        MoolreTransactionHistoryItem(
            external_ref=tx["external_ref"],
            amount=tx["amount"],
            status=tx["status"],
            momo_number=tx["momo_number"],
            access_code=tx.get("access_code"),
            created_at=tx["created_at"],
            paid_at=tx.get("paid_at"),
        )
        for tx in transactions
    ]


@router.post("/moolre/webhook")
async def moolre_webhook(request: Request):
    """Moolre payment callback — verify via status check before fulfilling."""
    try:
        event = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    data = event.get("data") or {}
    external_ref = data.get("externalref")
    if not external_ref:
        return {"status": "missing_ref"}

    tx = auth_service.get_moolre_transaction(external_ref)
    if not tx:
        logger.warning("Moolre webhook: unknown external_ref %s", external_ref)
        return {"status": "unknown_ref"}

    if tx.get("status") == "success":
        return {"status": "already_done"}

    check = moolre_payment_service.check_status(external_ref)
    if check.status == "success":
        fulfillment = auth_service.complete_moolre_transaction(external_ref, tx.get("momo_number"))
        logger.info("Moolre webhook fulfilled %s: code=%s sms=%s", external_ref,
                    fulfillment.get("access_code"), fulfillment.get("sms_sent"))
    return {"status": "ok"}


# ── Paystack routes (disabled by default; kept for rollback) ──────────────────

def _require_paystack():
    if not (paystack_service.enabled and settings.PAYSTACK_ENABLED):
        raise HTTPException(status_code=503, detail="Paystack payment is disabled.")


from pydantic import BaseModel, Field

class PaystackInitializeRequest(BaseModel):
    momo_number: str = Field(..., min_length=9, max_length=15)
    callback_url: str | None = None

class PaystackInitializeResponse(BaseModel):
    authorization_url: str
    reference: str
    public_key: str

class PaystackVerifyResponse(BaseModel):
    status: str
    access_code: str | None = None
    sms_sent: bool = False
    sms_message: str | None = None
    already_fulfilled: bool = False


@router.post("/paystack/initialize", response_model=PaystackInitializeResponse)
async def initialize_paystack_payment(
    body: PaystackInitializeRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    _require_paystack()
    amount = float(settings.SUBSCRIPTION_PRICE_GHS) if settings.SUBSCRIPTION_PRICE_GHS.replace(".", "").isdigit() else 20.0
    reference = paystack_service.generate_reference(current_user.id)
    callback = body.callback_url or f"{settings.PUBLIC_APP_URL.rstrip('/')}/activate?reference={reference}"

    auth_service.create_paystack_transaction(
        user_id=current_user.id,
        reference=reference,
        amount_pesewas=int(round(amount * 100)),
        momo_number=body.momo_number.strip(),
    )

    result = paystack_service.initialize_transaction(
        email=current_user.email,
        amount_ghs=amount,
        reference=reference,
        callback_url=callback,
        metadata={
            "user_id": current_user.id,
            "momo_number": body.momo_number.strip(),
            "product": "broxstudies_premium",
        },
    )

    if not result.success or not result.authorization_url:
        raise HTTPException(status_code=400, detail=result.message)

    return PaystackInitializeResponse(
        authorization_url=result.authorization_url,
        reference=result.reference or reference,
        public_key=settings.PAYSTACK_PUBLIC_KEY,
    )


@router.get("/paystack/verify/{reference}", response_model=PaystackVerifyResponse)
async def verify_paystack_payment(
    reference: str,
    current_user: AuthUser = Depends(get_current_user),
):
    _require_paystack()
    tx = auth_service.get_paystack_transaction(reference)
    if not tx or int(tx["user_id"]) != current_user.id:
        raise HTTPException(status_code=404, detail="Payment not found.")

    if tx.get("status") == "success" and tx.get("access_code"):
        return PaystackVerifyResponse(
            status="success",
            access_code=tx["access_code"],
            sms_sent=bool(tx.get("sms_sent")),
            already_fulfilled=True,
        )

    verify = paystack_service.verify_transaction(reference)
    if not verify.success:
        return PaystackVerifyResponse(status=verify.status, sms_message=verify.message)

    fulfillment = auth_service.complete_paystack_transaction(reference, tx.get("momo_number"))
    if not fulfillment.get("ok"):
        raise HTTPException(status_code=400, detail=fulfillment.get("error", "Fulfillment failed."))

    return PaystackVerifyResponse(
        status="success",
        access_code=fulfillment.get("access_code"),
        sms_sent=bool(fulfillment.get("sms_sent")),
        sms_message=fulfillment.get("sms_message"),
        already_fulfilled=bool(fulfillment.get("already_fulfilled")),
    )


@router.post("/paystack/webhook")
async def paystack_webhook(
    request: Request,
    x_paystack_signature: str | None = Header(default=None),
):
    _require_paystack()
    payload = await request.body()
    if not paystack_service.verify_webhook_signature(payload, x_paystack_signature or ""):
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")

    try:
        event = json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.") from exc

    if event.get("event") != "charge.success":
        return {"status": "ignored"}

    data = event.get("data") or {}
    reference = data.get("reference")
    if not reference:
        return {"status": "missing_reference"}

    metadata = data.get("metadata") or {}
    momo_number = metadata.get("momo_number")
    auth_service.complete_paystack_transaction(reference, momo_number)
    return {"status": "ok"}
