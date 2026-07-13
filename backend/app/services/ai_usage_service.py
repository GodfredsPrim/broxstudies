import asyncio
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Optional

from app.models import AuthUser
from app.services.auth_service import AuthService


class AIUsageService:
    """Authoritative request, concurrency, and estimated-token controls."""

    LIMITS = {
        "guest": {"minute": 3, "daily": 3, "tokens": 9_000},
        "registered": {"minute": 5, "daily": 10, "tokens": 30_000},
        "active": {"minute": 10, "daily": 100, "tokens": 250_000},
        "admin": {"minute": 30, "daily": 500, "tokens": 1_000_000},
    }

    def __init__(self) -> None:
        self.db = AuthService()
        self._recent: dict[str, deque[float]] = defaultdict(deque)
        self._active: set[str] = set()
        self._lock = asyncio.Lock()
        self._ensure_table()

    def _ensure_table(self) -> None:
        with self.db._connect() as conn:
            id_type = "SERIAL PRIMARY KEY" if self.db.is_postgres else "INTEGER PRIMARY KEY AUTOINCREMENT"
            self.db._execute(conn, f"""
                CREATE TABLE IF NOT EXISTS ai_usage_events (
                    id {id_type}, usage_key TEXT NOT NULL, user_id INTEGER,
                    route TEXT NOT NULL, input_tokens INTEGER NOT NULL DEFAULT 0,
                    output_tokens INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
                )
            """)
            self.db._execute(conn, "CREATE INDEX IF NOT EXISTS idx_ai_usage_key_created ON ai_usage_events (usage_key, created_at)")

    @staticmethod
    def tier(user: Optional[AuthUser]) -> str:
        if not user:
            return "guest"
        if user.is_admin:
            return "admin"
        return "active" if user.subscription_status == "active" else "registered"

    @staticmethod
    def key(user: Optional[AuthUser], ip: str, guest_id: str) -> str:
        return f"user:{user.id}" if user else f"guest:{ip}:{guest_id[:64]}"

    def _today_usage(self, usage_key: str) -> tuple[int, int]:
        today = datetime.now(timezone.utc).date().isoformat()
        with self.db._connect() as conn:
            row = self.db._execute(conn, """
                SELECT COUNT(*) AS requests, COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens
                FROM ai_usage_events WHERE usage_key = ? AND created_at >= ?
            """, (usage_key, today)).fetchone()
            return int(row["requests"] or 0), int(row["tokens"] or 0)

    async def begin(self, *, usage_key: str, user: Optional[AuthUser], route: str, input_chars: int = 0) -> dict:
        import time
        tier = self.tier(user)
        limits = self.LIMITS[tier]
        now = time.monotonic()
        async with self._lock:
            recent = self._recent[usage_key]
            while recent and now - recent[0] > 60:
                recent.popleft()
            if len(recent) >= limits["minute"]:
                raise ValueError("Too many AI requests. Please wait a minute and try again.")
            if usage_key in self._active:
                raise ValueError("You already have an AI response in progress. Please let it finish first.")
            requests, tokens = self._today_usage(usage_key)
            estimated_input = max(1, input_chars // 4)
            if requests >= limits["daily"] or tokens + estimated_input >= limits["tokens"]:
                raise ValueError("Your AI usage limit for today has been reached. It resets at midnight UTC.")
            recent.append(now)
            self._active.add(usage_key)
        created_at = datetime.now(timezone.utc).isoformat()
        with self.db._connect() as conn:
            query = "INSERT INTO ai_usage_events (usage_key, user_id, route, input_tokens, output_tokens, created_at) VALUES (?, ?, ?, ?, 0, ?)"
            if self.db.is_postgres:
                query += " RETURNING id"
            cursor = self.db._execute(conn, query, (usage_key, user.id if user else None, route, estimated_input, created_at))
            event_id = cursor.fetchone()["id"] if self.db.is_postgres else cursor.lastrowid
        return {"event_id": event_id, "usage_key": usage_key, "tier": tier}

    async def finish(self, context: dict, output_chars: int = 0) -> None:
        if output_chars > 0:
            with self.db._connect() as conn:
                self.db._execute(conn, "UPDATE ai_usage_events SET output_tokens = ? WHERE id = ?", (max(0, output_chars // 4), context["event_id"]))
        async with self._lock:
            self._active.discard(context["usage_key"])

    def status(self, usage_key: str, user: Optional[AuthUser]) -> dict:
        requests, tokens = self._today_usage(usage_key)
        tier = self.tier(user)
        limits = self.LIMITS[tier]
        return {
            "tier": tier, "requests_used": requests, "requests_limit": limits["daily"],
            "tokens_used": tokens, "tokens_limit": limits["tokens"],
            "requests_remaining": max(0, limits["daily"] - requests),
        }


ai_usage_service = AIUsageService()
