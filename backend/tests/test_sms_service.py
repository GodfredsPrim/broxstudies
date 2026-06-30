"""Tests for Moolre SMS service helpers."""

import pytest

from app.services.sms_service import (
    build_access_code_message,
    normalize_ghana_phone,
    MoolreSmsService,
)


def test_normalize_ghana_phone_local_format():
    assert normalize_ghana_phone("0248317900") == "233248317900"


def test_normalize_ghana_phone_international_format():
    assert normalize_ghana_phone("+233248317900") == "233248317900"
    assert normalize_ghana_phone("233248317900") == "233248317900"


def test_normalize_ghana_phone_invalid():
    with pytest.raises(ValueError):
        normalize_ghana_phone("12345")


def test_build_access_code_message_truncates_to_160_chars():
    msg = build_access_code_message("AB12CD", 3)
    assert "AB12CD" in msg
    assert len(msg) <= 160


def test_send_sms_disabled_without_config(monkeypatch):
    monkeypatch.setattr("app.services.sms_service.settings.MOOLRE_VAS_KEY", "")
    monkeypatch.setattr("app.services.sms_service.settings.MOOLRE_SENDER_ID", "")
    service = MoolreSmsService()
    result = service.send_sms("0248317900", "Hello")
    assert result.success is False
    assert result.code == "SMS_DISABLED"
