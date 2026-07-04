"""Moolre payment collection service (replaces Paystack)."""

from __future__ import annotations

import logging
import re
import secrets
from dataclasses import dataclass, field
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class MoolrePaymentResult:
    success: bool
    status: str          # "pending" | "otp_required" | "success" | "failed" | "error"
    code: str = ""       # Moolre response code (TR099, TP14, TP13, …)
    message: str = ""
    moolre_txid: str = ""
    raw: dict = field(default_factory=dict)


def to_local_format(phone: str) -> str:
    """Convert a Ghana phone number (233XXXXXXXXX or 0XXXXXXXXX) to local 0XX format.

    Moolre's payment API rejects the 233-country-code format with TR03.
    """
    digits = re.sub(r"\D", "", phone)
    return "0" + digits[3:] if digits.startswith("233") else digits


def detect_channel(phone: str) -> str:
    """Return Moolre channel code from a Ghana phone number."""
    local = to_local_format(phone)

    mtn_prefixes = ("024", "025", "053", "054", "055", "059")
    telecel_prefixes = ("020", "050")
    at_prefixes = ("026", "056", "027", "057", "028", "058")

    for p in mtn_prefixes:
        if local.startswith(p):
            return "13"
    for p in telecel_prefixes:
        if local.startswith(p):
            return "6"
    for p in at_prefixes:
        if local.startswith(p):
            return "7"
    return "13"  # default to MTN if unknown


class MoolrePaymentService:
    def __init__(self) -> None:
        self.enabled = bool(
            settings.MOOLRE_API_USER
            and settings.MOOLRE_API_KEY
            and settings.MOOLRE_ACCOUNT_NUMBER
            and settings.MOOLRE_PAYMENT_ENABLED
        )
        self.base_url = settings.MOOLRE_API_BASE_URL.rstrip("/")
        self._headers = {
            "X-API-USER": settings.MOOLRE_API_USER,
            "X-API-KEY": settings.MOOLRE_API_KEY,
        }

    def _post(self, path: str, payload: dict) -> tuple[int, dict]:
        url = f"{self.base_url}{path}"
        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(url, json=payload, headers=self._headers)
                return resp.status_code, resp.json()
        except httpx.HTTPError as exc:
            logger.exception("Moolre payment request failed: %s", exc)
            return 0, {"status": 0, "code": "NETWORK_ERROR", "message": str(exc)}
        except ValueError:
            return 0, {"status": 0, "code": "PARSE_ERROR", "message": "Invalid JSON from Moolre"}

    def generate_reference(self, user_id: int) -> str:
        rand = secrets.token_hex(2)
        return f"BX{user_id}-{rand}"

    def initiate_payment(
        self, phone: str, amount: str, external_ref: str, otp_code: Optional[str] = None
    ) -> MoolrePaymentResult:
        if not self.enabled:
            return MoolrePaymentResult(
                success=False, status="error",
                message="Moolre payment is not configured. Set MOOLRE_API_USER, MOOLRE_API_KEY, MOOLRE_ACCOUNT_NUMBER.",
            )

        channel = detect_channel(phone)
        payload: dict = {
            "type": 1,
            "channel": channel,
            "currency": "GHS",
            "payer": to_local_format(phone),
            "amount": str(amount),
            "externalref": external_ref,
            "accountnumber": settings.MOOLRE_ACCOUNT_NUMBER,
            "reference": f"BroxStudies Premium {settings.SUBSCRIPTION_MONTHS}mo",
        }
        if otp_code:
            payload["otpcode"] = otp_code

        status_code, data = self._post("/open/transact/payment", payload)
        code = data.get("code", "")
        message = data.get("message", "Unknown response from Moolre")
        raw_txid = data.get("data")
        moolre_txid = str(raw_txid) if raw_txid not in (None, "", "all") else ""

        if code == "TP14":
            return MoolrePaymentResult(
                success=True, status="otp_required",
                code=code, message=message, raw=data,
            )
        if code == "TP17":
            # TP17: "Phone no. Verification Successful." -- this call only verifies
            # the phone/OTP session; it does not register or trigger the actual
            # transaction (its "data" field is a placeholder, not a real txid).
            # Moolre requires the same payment request to be resubmitted, without
            # otpcode, to actually charge the customer. Confirmed empirically:
            # resubmitting is what produced a real transaction id and a real charge.
            confirm_payload = {k: v for k, v in payload.items() if k != "otpcode"}
            _, confirm_data = self._post("/open/transact/payment", confirm_payload)
            confirm_code = confirm_data.get("code", "")
            confirm_message = confirm_data.get("message", "Unknown response from Moolre")
            confirm_raw_txid = confirm_data.get("data")
            confirm_txid = str(confirm_raw_txid) if confirm_raw_txid not in (None, "", "all") else ""

            if confirm_code == "TR099":
                return MoolrePaymentResult(
                    success=True, status="pending",
                    code=confirm_code, message=confirm_message, moolre_txid=confirm_txid, raw=confirm_data,
                )
            if confirm_code == "TP13":
                return MoolrePaymentResult(
                    success=False, status="error",
                    code=confirm_code, message="Duplicate reference. Please try again.", raw=confirm_data,
                )
            logger.warning("Moolre confirm-after-otp: unrecognized response code=%r raw=%r", confirm_code, confirm_data)
            return MoolrePaymentResult(
                success=False, status="error",
                code=confirm_code, message=confirm_message, raw=confirm_data,
            )
        if code == "TR099":
            return MoolrePaymentResult(
                success=True, status="pending",
                code=code, message=message, moolre_txid=moolre_txid, raw=data,
            )
        if code == "TP13":
            return MoolrePaymentResult(
                success=False, status="error",
                code=code, message="Duplicate reference. Please try again.", raw=data,
            )

        logger.warning("Moolre initiate_payment: unrecognized response code=%r raw=%r", code, data)
        return MoolrePaymentResult(
            success=False, status="error",
            code=code, message=message, raw=data,
        )

    def check_status(self, external_ref: str) -> MoolrePaymentResult:
        if not self.enabled:
            return MoolrePaymentResult(success=False, status="error", message="Moolre not configured.")

        payload = {
            "type": 1,
            "idtype": "1",
            "id": external_ref,
            "accountnumber": settings.MOOLRE_ACCOUNT_NUMBER,
        }
        _, data = self._post("/open/transact/status", payload)
        inner = data.get("data") or {}
        code = data.get("code", "")
        message = data.get("message", "")
        txstatus = inner.get("txstatus")
        moolre_txid = str(inner.get("transactionid") or "")

        if txstatus == 1 or code == "SS01":
            return MoolrePaymentResult(
                success=True, status="success",
                code=code, message=message, moolre_txid=moolre_txid, raw=data,
            )
        if txstatus == 0:
            return MoolrePaymentResult(
                success=False, status="failed",
                code=code, message=message, raw=data,
            )
        return MoolrePaymentResult(
            success=False, status="pending",
            code=code, message=message, raw=data,
        )


moolre_payment_service = MoolrePaymentService()
