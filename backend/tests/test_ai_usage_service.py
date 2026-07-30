import asyncio
import time
from collections import defaultdict, deque
from types import SimpleNamespace

import pytest

from app.models import AuthUser
from app.services.ai_usage_service import AIUsageService


class DummyConnection:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False


class DummyDatabase:
    is_postgres = False

    def _connect(self):
        return DummyConnection()

    def _execute(self, connection, query, params=()):
        return SimpleNamespace(lastrowid=1)


def make_user(status: str = "active") -> AuthUser:
    return AuthUser(
        id=42,
        full_name="Premium Learner",
        email="premium@example.com",
        provider="email",
        subscription_status=status,
    )


def make_service(requests: int, tokens: int) -> AIUsageService:
    service = AIUsageService.__new__(AIUsageService)
    service.db = DummyDatabase()
    service._recent = defaultdict(deque)
    service._active = set()
    service._lock = asyncio.Lock()
    service._today_usage = lambda usage_key: (requests, tokens)
    return service


def test_premium_status_reports_unlimited_access():
    service = make_service(requests=5_000, tokens=50_000_000)

    status = service.status("user:42", make_user("active"))

    assert status["tier"] == "active"
    assert status["unlimited"] is True
    assert status["requests_limit"] is None
    assert status["tokens_limit"] is None
    assert status["requests_remaining"] is None


def test_premium_request_is_not_blocked_by_daily_or_token_totals():
    service = make_service(requests=5_000, tokens=50_000_000)

    context = asyncio.run(
        service.begin(
            usage_key="user:42",
            user=make_user("active"),
            route="/api/tutor/ask-with-files",
            input_chars=100_000,
        )
    )

    assert context["tier"] == "active"
    assert context["usage_key"] == "user:42"


def test_registered_account_still_has_a_daily_limit():
    service = make_service(requests=10, tokens=0)

    with pytest.raises(ValueError, match="usage limit"):
        asyncio.run(
            service.begin(
                usage_key="user:42",
                user=make_user("inactive"),
                route="/api/tutor/ask-with-files",
                input_chars=1_000,
            )
        )


def test_premium_per_minute_protection_remains_active():
    service = make_service(requests=5_000, tokens=50_000_000)
    service._recent["user:42"].extend([time.monotonic()] * 10)

    with pytest.raises(ValueError, match="wait a minute"):
        asyncio.run(
            service.begin(
                usage_key="user:42",
                user=make_user("active"),
                route="/api/tutor/ask-with-files",
                input_chars=1_000,
            )
        )
