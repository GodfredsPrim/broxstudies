"""Paystack payment integration for BroxStudies subscriptions."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

PAYSTACK_BASE = "https://api.paystack.co"


@dataclass
class PaystackInitResult:
    success: bool
    authorization_url: Optional[str] = None
    reference: Optional[str] = None
    message: str = ""


@dataclass
class PaystackVerifyResult:
    success: bool
    status: str = "pending"
    reference: Optional[str] = None
    amount: int = 0
    message: str = ""


class PaystackService:
    def __init__(self) -> None:
        self.enabled = bool(settings.PAYSTACK_SECRET_KEY and settings.PAYSTACK_PUBLIC_KEY)
        self.secret_key = settings.PAYSTACK_SECRET_KEY
        self.public_key = settings.PAYSTACK_PUBLIC_KEY

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }

    def generate_reference(self, user_id: int) -> str:
        token = secrets.token_hex(4).upper()
        return f"BX{user_id}-{token}"

    def initialize_transaction(
        self,
        email: str,
        amount_ghs: float,
        reference: str,
        callback_url: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> PaystackInitResult:
        if not self.enabled:
            return PaystackInitResult(success=False, message="Paystack is not configured.")

        amount_pesewas = int(round(amount_ghs * 100))
        payload = {
            "email": email,
            "amount": amount_pesewas,
            "currency": "GHS",
            "reference": reference,
            "callback_url": callback_url,
            "channels": ["mobile_money", "card"],
            "metadata": metadata or {},
        }

        try:
            with httpx.Client(timeout=25.0) as client:
                response = client.post(
                    f"{PAYSTACK_BASE}/transaction/initialize",
                    json=payload,
                    headers=self._headers(),
                )
                data = response.json()
        except httpx.HTTPError as exc:
            logger.exception("Paystack initialize failed")
            return PaystackInitResult(success=False, message=f"Payment gateway error: {exc}")

        if response.status_code == 200 and data.get("status"):
            inner = data.get("data") or {}
            return PaystackInitResult(
                success=True,
                authorization_url=inner.get("authorization_url"),
                reference=inner.get("reference") or reference,
                message=data.get("message", "Authorization URL created"),
            )

        return PaystackInitResult(
            success=False,
            message=data.get("message", "Could not initialize payment."),
        )

    def verify_transaction(self, reference: str) -> PaystackVerifyResult:
        if not self.enabled:
            return PaystackVerifyResult(success=False, message="Paystack is not configured.")

        try:
            with httpx.Client(timeout=25.0) as client:
                response = client.get(
                    f"{PAYSTACK_BASE}/transaction/verify/{reference}",
                    headers=self._headers(),
                )
                data = response.json()
        except httpx.HTTPError as exc:
            logger.exception("Paystack verify failed")
            return PaystackVerifyResult(success=False, message=f"Verification error: {exc}")

        if not data.get("status"):
            return PaystackVerifyResult(success=False, message=data.get("message", "Verification failed."))

        inner = data.get("data") or {}
        status = inner.get("status", "pending")
        return PaystackVerifyResult(
            success=status == "success",
            status=status,
            reference=inner.get("reference") or reference,
            amount=int(inner.get("amount") or 0),
            message=data.get("message", status),
        )

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        if not self.secret_key or not signature:
            return False
        digest = hmac.new(
            self.secret_key.encode("utf-8"),
            payload,
            hashlib.sha512,
        ).hexdigest()
        return hmac.compare_digest(digest, signature)


paystack_service = PaystackService()
