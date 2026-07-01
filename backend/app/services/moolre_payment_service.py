"""Moolre payment collection integration for BroxStudies subscriptions."""

from __future__ import annotations

import logging
import secrets
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from app.config import settings
from app.services.sms_service import normalize_ghana_phone

logger = logging.getLogger(__name__)

# Moolre mobile-money channel codes
CHANNEL_MTN = "13"
CHANNEL_TELECEL = "6"
CHANNEL_AT = "7"

_MTN_PREFIXES = {"024", "025", "054", "055", "059"}
_TELECEL_PREFIXES = {"020", "050"}
_AT_PREFIXES = {"026", "027", "056", "057"}


def momo_channel_from_phone(phone: str) -> str:
    """Map a Ghana MoMo number to a Moolre channel code."""
    normalized = normalize_ghana_phone(phone)
    local = f"0{normalized[3:]}"
    prefix = local[:3]
    if prefix in _MTN_PREFIXES:
        return CHANNEL_MTN
    if prefix in _TELECEL_PREFIXES:
        return CHANNEL_TELECEL
    if prefix in _AT_PREFIXES:
        return CHANNEL_AT
    raise ValueError(
        "Could not detect mobile network. Use an MTN, Telecel, or AirtelTigo number."
    )


def format_moolre_payer(phone: str) -> str:
    """Format payer number for Moolre collection APIs (0XXXXXXXXX)."""
    normalized = normalize_ghana_phone(phone)
    return f"0{normalized[3:]}"


@dataclass
class MoolreInitResult:
    success: bool
    reference: Optional[str] = None
    authorization_url: Optional[str] = None
    message: str = ""
    requires_otp: bool = False
    pending_approval: bool = False


@dataclass
class MoolreVerifyResult:
    success: bool
    status: str = "pending"
    reference: Optional[str] = None
    amount: float = 0.0
    message: str = ""


class MoolrePaymentService:
    def __init__(self) -> None:
        self.api_user = settings.MOOLRE_API_USER
        self.api_key = settings.MOOLRE_API_KEY
        self.api_pubkey = settings.MOOLRE_API_PUBKEY
        self.account_number = settings.MOOLRE_ACCOUNT_NUMBER

    @property
    def base_url(self) -> str:
        if settings.MOOLRE_USE_SANDBOX:
            return "https://sandbox.moolre.com"
        return settings.MOOLRE_API_BASE_URL.rstrip("/")

    @property
    def enabled(self) -> bool:
        if not settings.MOOLRE_PAYMENTS_ENABLED:
            return False
        if not self.api_user or not self.account_number:
            return False
        if settings.MOOLRE_USE_SANDBOX:
            return True
        return bool(self.api_key and self.api_pubkey)

    def generate_reference(self, user_id: int) -> str:
        token = secrets.token_hex(4).upper()
        return f"BX{user_id}-{token}"

    def _headers_private(self) -> dict[str, str]:
        headers = {"X-API-USER": self.api_user, "Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-KEY"] = self.api_key
        return headers

    def _headers_public(self) -> dict[str, str]:
        headers = {"X-API-USER": self.api_user, "Content-Type": "application/json"}
        if self.api_pubkey:
            headers["X-API-PUBKEY"] = self.api_pubkey
        return headers

    def initiate_momo_payment(
        self,
        *,
        payer: str,
        amount_ghs: float,
        externalref: str,
        channel: Optional[str] = None,
        otpcode: Optional[str] = None,
    ) -> MoolreInitResult:
        """Send a MoMo collection prompt to the payer's phone."""
        if not self.enabled:
            return MoolreInitResult(success=False, message="Moolre payments are not configured.")

        try:
            channel_code = channel or momo_channel_from_phone(payer)
            payer_local = format_moolre_payer(payer)
        except ValueError as exc:
            return MoolreInitResult(success=False, message=str(exc))

        payload: dict[str, Any] = {
            "type": 1,
            "channel": channel_code,
            "currency": "GHS",
            "payer": payer_local,
            "amount": str(amount_ghs),
            "externalref": externalref,
            "accountnumber": self.account_number,
        }
        if otpcode:
            payload["otpcode"] = otpcode

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"{self.base_url}/open/transact/payment",
                    json=payload,
                    headers=self._headers_private(),
                )
                data = response.json()
        except httpx.HTTPError as exc:
            logger.exception("Moolre initiate payment failed")
            return MoolreInitResult(success=False, message=f"Payment gateway error: {exc}")
        except ValueError:
            return MoolreInitResult(success=False, message="Invalid response from payment gateway.")

        status = data.get("status")
        code = str(data.get("code", ""))
        message = data.get("message") or "Payment request sent."

        if code == "TP14":
            return MoolreInitResult(
                success=False,
                reference=externalref,
                message=message or "Complete OTP verification and try again.",
                requires_otp=True,
            )

        if response.status_code == 200 and status == 1:
            return MoolreInitResult(
                success=True,
                reference=externalref,
                message=message or "Approve the MoMo prompt on your phone to complete payment.",
                pending_approval=True,
            )

        return MoolreInitResult(
            success=False,
            message=message or "Could not initiate MoMo payment.",
        )

    def generate_payment_link(
        self,
        *,
        email: str,
        amount_ghs: float,
        externalref: str,
        callback_url: str,
        redirect_url: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> MoolreInitResult:
        """Create a hosted Moolre POS payment page."""
        if not self.enabled:
            return MoolreInitResult(success=False, message="Moolre payments are not configured.")

        payload: dict[str, Any] = {
            "type": 1,
            "amount": str(amount_ghs),
            "email": email,
            "externalref": externalref,
            "callback": callback_url,
            "redirect": redirect_url,
            "reusable": "0",
            "currency": "GHS",
            "accountnumber": self.account_number,
        }
        if metadata:
            payload["metadata"] = metadata

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"{self.base_url}/embed/link",
                    json=payload,
                    headers=self._headers_public(),
                )
                data = response.json()
        except httpx.HTTPError as exc:
            logger.exception("Moolre payment link failed")
            return MoolreInitResult(success=False, message=f"Payment gateway error: {exc}")
        except ValueError:
            return MoolreInitResult(success=False, message="Invalid response from payment gateway.")

        if response.status_code == 200 and data.get("status") == 1:
            inner = data.get("data") or {}
            return MoolreInitResult(
                success=True,
                reference=inner.get("reference") or externalref,
                authorization_url=inner.get("authorization_url"),
                message=data.get("message", "Payment page created."),
                pending_approval=False,
            )

        return MoolreInitResult(
            success=False,
            message=data.get("message", "Could not create payment page."),
        )

    def verify_payment(self, externalref: str) -> MoolreVerifyResult:
        """Check payment status by external reference."""
        if not self.enabled:
            return MoolreVerifyResult(success=False, message="Moolre payments are not configured.")

        payload = {
            "type": 1,
            "idtype": "1",
            "id": externalref,
            "accountnumber": self.account_number,
        }

        try:
            with httpx.Client(timeout=25.0) as client:
                response = client.post(
                    f"{self.base_url}/open/transact/status",
                    json=payload,
                    headers=self._headers_public(),
                )
                data = response.json()
        except httpx.HTTPError as exc:
            logger.exception("Moolre payment status check failed")
            return MoolreVerifyResult(success=False, message=f"Verification error: {exc}")
        except ValueError:
            return MoolreVerifyResult(success=False, message="Invalid response from payment gateway.")

        if data.get("status") != 1:
            return MoolreVerifyResult(
                success=False,
                status="pending",
                reference=externalref,
                message=data.get("message", "Payment not completed yet."),
            )

        inner = data.get("data") or {}
        txstatus = inner.get("txstatus")
        amount_raw = inner.get("amount") or inner.get("value") or "0"
        try:
            amount = float(amount_raw)
        except (TypeError, ValueError):
            amount = 0.0

        if txstatus == 1:
            return MoolreVerifyResult(
                success=True,
                status="success",
                reference=inner.get("externalref") or externalref,
                amount=amount,
                message=data.get("message", "Transaction successful."),
            )

        return MoolreVerifyResult(
            success=False,
            status="pending",
            reference=externalref,
            amount=amount,
            message=data.get("message", "Payment still pending."),
        )

    @staticmethod
    def extract_webhook_reference(payload: dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
        """Return (externalref, payer_phone) from a Moolre webhook payload."""
        if payload.get("status") != 1:
            return None, None
        data = payload.get("data") or {}
        ref = data.get("externalref") or data.get("external_ref")
        payer = data.get("payer") or data.get("payee")
        if ref:
            return str(ref), str(payer) if payer else None
        return None, None


moolre_payment_service = MoolrePaymentService()
