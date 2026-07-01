import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.config import settings
from app.models import AuthUser
from app.routes.auth import get_current_user
from app.services.auth_service import AuthService
from app.services.moolre_payment_service import moolre_payment_service

logger = logging.getLogger(__name__)
router = APIRouter()
auth_service = AuthService()


class MoolreInitializeRequest(BaseModel):
    momo_number: str = Field(..., min_length=9, max_length=15)
    method: Literal["momo", "link"] = "momo"
    channel: str | None = None
    callback_url: str | None = None


class MoolreInitializeResponse(BaseModel):
    reference: str
    message: str
    pending_approval: bool = True
    authorization_url: str | None = None
    requires_otp: bool = False


class MoolreVerifyResponse(BaseModel):
    status: str
    access_code: str | None = None
    sms_sent: bool = False
    sms_message: str | None = None
    already_fulfilled: bool = False


def _subscription_amount_ghs() -> float:
    raw = settings.SUBSCRIPTION_PRICE_GHS
    if isinstance(raw, str) and raw.replace(".", "", 1).isdigit():
        return float(raw)
    return 20.0


@router.post("/moolre/initialize", response_model=MoolreInitializeResponse)
async def initialize_moolre_payment(
    body: MoolreInitializeRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    if not moolre_payment_service.enabled:
        raise HTTPException(status_code=503, detail="Online payment is not configured yet.")

    amount = _subscription_amount_ghs()
    reference = moolre_payment_service.generate_reference(current_user.id)
    momo_number = body.momo_number.strip()

    auth_service.create_paystack_transaction(
        user_id=current_user.id,
        reference=reference,
        amount_pesewas=int(round(amount * 100)),
        momo_number=momo_number,
    )

    if body.method == "link":
        callback = f"{settings.PUBLIC_APP_URL.rstrip('/')}/api/payments/moolre/webhook"
        redirect = body.callback_url or f"{settings.PUBLIC_APP_URL.rstrip('/')}/activate?reference={reference}"
        result = moolre_payment_service.generate_payment_link(
            email=current_user.email,
            amount_ghs=amount,
            externalref=reference,
            callback_url=callback,
            redirect_url=redirect,
            metadata={"user_id": current_user.id, "momo_number": momo_number},
        )
    else:
        result = moolre_payment_service.initiate_momo_payment(
            payer=momo_number,
            amount_ghs=amount,
            externalref=reference,
            channel=body.channel,
        )

    if not result.success:
        if result.requires_otp:
            raise HTTPException(status_code=400, detail=result.message)
        raise HTTPException(status_code=400, detail=result.message)

    return MoolreInitializeResponse(
        reference=result.reference or reference,
        message=result.message,
        pending_approval=result.pending_approval,
        authorization_url=result.authorization_url,
        requires_otp=result.requires_otp,
    )


@router.get("/moolre/verify/{reference}", response_model=MoolreVerifyResponse)
async def verify_moolre_payment(
    reference: str,
    current_user: AuthUser = Depends(get_current_user),
):
    tx = auth_service.get_paystack_transaction(reference)
    if not tx or int(tx["user_id"]) != current_user.id:
        raise HTTPException(status_code=404, detail="Payment not found.")

    if tx.get("status") == "success" and tx.get("access_code"):
        return MoolreVerifyResponse(
            status="success",
            access_code=tx["access_code"],
            sms_sent=bool(tx.get("sms_sent")),
            already_fulfilled=True,
        )

    verify = moolre_payment_service.verify_payment(reference)
    if not verify.success:
        return MoolreVerifyResponse(status=verify.status, sms_message=verify.message)

    fulfillment = auth_service.complete_paystack_transaction(reference, tx.get("momo_number"))
    if not fulfillment.get("ok"):
        raise HTTPException(status_code=400, detail=fulfillment.get("error", "Fulfillment failed."))

    return MoolreVerifyResponse(
        status="success",
        access_code=fulfillment.get("access_code"),
        sms_sent=bool(fulfillment.get("sms_sent")),
        sms_message=fulfillment.get("sms_message"),
        already_fulfilled=bool(fulfillment.get("already_fulfilled")),
    )


@router.post("/moolre/webhook")
async def moolre_webhook(request: Request):
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.") from exc

    reference, payer = moolre_payment_service.extract_webhook_reference(payload)
    if not reference:
        return {"status": "ignored"}

    try:
        auth_service.complete_paystack_transaction(reference, payer)
    except Exception as exc:
        logger.warning("Moolre webhook fulfillment failed for %s: %s", reference, exc)
        return {"status": "error"}

    return {"status": "ok"}
