import json
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.config import settings
from app.routes.auth import get_current_user
from app.models import AuthUser
from app.services.auth_service import AuthService
from app.services.paystack_service import paystack_service

logger = logging.getLogger(__name__)
router = APIRouter()
auth_service = AuthService()


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
    if not paystack_service.enabled:
        raise HTTPException(status_code=503, detail="Online payment is not configured yet.")

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
