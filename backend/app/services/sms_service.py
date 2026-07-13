"""Moolre SMS integration for delivering BroxStudies access codes."""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class SmsResult:
    success: bool
    message: str
    code: Optional[str] = None
    data: Optional[Any] = None
    """Full raw JSON response from Moolre (not just its "data" field, which is
    null on every observed SMS send) — kept so nothing is lost when tracing a
    delivery dispute with Moolre support."""


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
        self.enabled = bool(settings.SMS_ENABLED and settings.MOOLRE_VAS_KEY.strip() and settings.MOOLRE_SENDER_ID.strip())
        self.base_url = settings.MOOLRE_API_BASE_URL.rstrip("/")
        self.vas_key = settings.MOOLRE_VAS_KEY.strip().strip('"').strip("'")
        self.sender_id = settings.MOOLRE_SENDER_ID.strip().strip('"').strip("'")[:11]

    @staticmethod
    def _message(value: Any) -> str:
        if isinstance(value, list):
            return "; ".join(str(item) for item in value)
        if isinstance(value, dict):
            return str(value.get("message") or value.get("detail") or value)
        return str(value or "Unknown response from SMS gateway")

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

        response = None
        try:
            with httpx.Client(timeout=httpx.Timeout(20.0, connect=8.0)) as client:
                for attempt in range(2):
                    response = client.post(url, json=payload, headers=headers)
                    if response.status_code not in {429, 500, 502, 503, 504} or attempt == 1:
                        break
                    time.sleep(0.35)
                try:
                    data = response.json()
                except ValueError:
                    logger.error("Moolre SMS returned non-JSON HTTP %s", response.status_code)
                    return SmsResult(success=False, message="The SMS provider returned an invalid response.", code="PARSE_ERROR")
        except httpx.TimeoutException:
            logger.warning("Moolre SMS request timed out")
            return SmsResult(success=False, message="The SMS provider timed out. Please retry shortly.", code="TIMEOUT")
        except httpx.HTTPError as exc:
            logger.exception("Moolre SMS request failed")
            return SmsResult(success=False, message="The SMS provider could not be reached. Please retry shortly.", code="NETWORK_ERROR", data={"error_type": type(exc).__name__})

        status = data.get("status")
        api_code = data.get("code", "")
        api_message = self._message(data.get("message", "Unknown response"))

        if response.is_success and str(status).strip() == "1":
            return SmsResult(success=True, message=api_message, code=api_code, data=data)

        if response.status_code in {401, 403} or api_code == "AIN01":
            api_message = "SMS provider authentication failed. The Moolre VAS key must be regenerated or corrected in deployment settings."
        elif api_code == "ASMS07":
            api_message = f"The SMS sender ID '{self.sender_id}' is not approved in Moolre."

        return SmsResult(success=False, message=api_message, code=api_code, data=data)

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
