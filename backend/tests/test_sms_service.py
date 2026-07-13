"""Tests for Moolre SMS service helpers."""

import pytest
import httpx

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


def test_sms_accepts_string_success_status(monkeypatch):
    monkeypatch.setattr("app.services.sms_service.settings.MOOLRE_VAS_KEY", " key ")
    monkeypatch.setattr("app.services.sms_service.settings.MOOLRE_SENDER_ID", "BroxStudies")
    monkeypatch.setattr("app.services.sms_service.settings.SMS_ENABLED", True)
    monkeypatch.setattr("httpx.Client.post", lambda *args, **kwargs: httpx.Response(200, json={"status": "1", "code": "SMS01", "message": "Success"}, request=httpx.Request("POST", "https://api.moolre.com")))
    result = MoolreSmsService().send_sms("0248317900", "Test")
    assert result.success is True


def test_sms_maps_provider_authentication_error(monkeypatch):
    monkeypatch.setattr("app.services.sms_service.settings.MOOLRE_VAS_KEY", "invalid")
    monkeypatch.setattr("app.services.sms_service.settings.MOOLRE_SENDER_ID", "BroxStudies")
    monkeypatch.setattr("app.services.sms_service.settings.SMS_ENABLED", True)
    monkeypatch.setattr("httpx.Client.post", lambda *args, **kwargs: httpx.Response(401, json={"status": 0, "code": "AIN01", "message": "Authentication Error"}, request=httpx.Request("POST", "https://api.moolre.com")))
    result = MoolreSmsService().send_sms("0248317900", "Test")
    assert result.success is False
    assert result.code == "AIN01"
    assert "VAS key" in result.message
