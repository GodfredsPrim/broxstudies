"""Moolre SMS integration for delivering BroxStudies access codes."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_GH_PHONE_RE = re.compile(r"^\+?233\d{9}$|^0\d{9}$")


@dataclass
class SmsResult:
    success: bool
    message: str
    code: Optional[str] = None
    data: Optional[Any] = None
    """Raw "data" field from the Moolre response — often carries the gateway
    message ID(s), useful when asking Moolre support to trace a delivery."""


def normalize_ghana_phone(number: str) -> str:
    """Normalize Ghana phone numbers to 233XXXXXXXXX format."""
    digits = re.sub(r"\D", "", number.strip())
    if digits.startswith("233") and len(digits) == 12:
        return digits
    if digits.startswith("0") and len(digits) == 10:
        return "233" + digits[1:]
    if len(digits) == 9:
        return "233" + digits
    raise ValueError("Enter a valid Ghana phone number (e.g. 0241234567).")


def build_access_code_message(code: str, months: int) -> str:
    price = settings.SUBSCRIPTION_PRICE_GHS
    return (
        f"BroxStudies: Your premium access code is {code}. "
        f"Valid {months} months after activation. "
        f"Go to broxstudies.online/activate to unlock. "
        f"Need help? Reply to this number."
    )[:160]


class MoolreSmsService:
    def __init__(self) -> None:
        self.enabled = bool(settings.MOOLRE_VAS_KEY and settings.MOOLRE_SENDER_ID)
        self.base_url = settings.MOOLRE_API_BASE_URL.rstrip("/")
        self.vas_key = settings.MOOLRE_VAS_KEY
        self.sender_id = settings.MOOLRE_SENDER_ID[:11]

    def send_sms(self, recipient: str, message: str) -> SmsResult:
        if not self.enabled:
            return SmsResult(
                success=False,
                message="SMS is not configured. Set MOOLRE_VAS_KEY and MOOLRE_SENDER_ID.",
                code="SMS_DISABLED",
            )

        try:
            phone = normalize_ghana_phone(recipient)
        except ValueError as exc:
            return SmsResult(success=False, message=str(exc), code="INVALID_PHONE")

        url = f"{self.base_url}/open/sms/send"
        headers = {"X-API-VASKEY": self.vas_key}
        payload = {
            "type": 1,
            "senderid": self.sender_id,
            "messages": [{"recipient": phone, "message": message[:160]}],
        }

        try:
            with httpx.Client(timeout=20.0) as client:
                response = client.post(url, json=payload, headers=headers)
                data = response.json()
        except httpx.HTTPError as exc:
            logger.exception("Moolre SMS request failed")
            return SmsResult(success=False, message=f"SMS gateway error: {exc}", code="NETWORK_ERROR")
        except ValueError:
            return SmsResult(success=False, message="Invalid response from SMS gateway.", code="PARSE_ERROR")

        status = data.get("status")
        api_code = data.get("code", "")
        api_message = data.get("message", "Unknown response")
        api_data = data.get("data")

        if response.status_code == 200 and status == 1:
            return SmsResult(success=True, message=api_message, code=api_code, data=api_data)

        return SmsResult(success=False, message=api_message, code=api_code, data=api_data)

    def send_access_code(self, recipient: str, access_code: str, months: int) -> SmsResult:
        message = build_access_code_message(access_code, months)
        return self.send_sms(recipient, message)

    def send_otp(self, recipient: str, otp_code: str) -> SmsResult:
        message = (
            f"BroxStudies: Your verification code is {otp_code}. "
            f"Valid {settings.OTP_EXPIRE_MINUTES} minutes. Do not share this code."
        )[:160]
        return self.send_sms(recipient, message)


sms_service = MoolreSmsService()
