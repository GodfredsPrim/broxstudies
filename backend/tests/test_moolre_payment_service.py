"""Tests for Moolre payment helpers."""

import pytest

from app.services.moolre_payment_service import (
    CHANNEL_AT,
    CHANNEL_MTN,
    CHANNEL_TELECEL,
    format_moolre_payer,
    momo_channel_from_phone,
)


def test_momo_channel_mtn():
    assert momo_channel_from_phone("0241234567") == CHANNEL_MTN
    assert momo_channel_from_phone("233241234567") == CHANNEL_MTN


def test_momo_channel_telecel():
    assert momo_channel_from_phone("0201234567") == CHANNEL_TELECEL


def test_momo_channel_at():
    assert momo_channel_from_phone("0271234567") == CHANNEL_AT


def test_format_moolre_payer():
    assert format_moolre_payer("0241234567") == "0241234567"
    assert format_moolre_payer("233241234567") == "0241234567"


def test_momo_channel_unknown_raises():
    with pytest.raises(ValueError):
        momo_channel_from_phone("0991234567")
