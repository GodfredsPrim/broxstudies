import hashlib
import hmac
import logging
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, List, Optional, Tuple

import jwt
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.config import settings
from app.models import AuthUser, ChatHistoryMessage

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self) -> None:
        self.db_path = Path(settings.AUTH_DB_PATH)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_tables()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _ensure_tables(self) -> None:
        with self._connect() as conn:
            # ── Users table ────────────────────────────────────────────────────
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    full_name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT,
                    salt TEXT,
                    provider TEXT NOT NULL,
                    provider_subject TEXT,
                    created_at TEXT NOT NULL,
                    last_login_at TEXT NOT NULL,
                    subscription_status TEXT NOT NULL DEFAULT 'inactive',
                    subscription_expires_at TEXT,
                    is_admin INTEGER NOT NULL DEFAULT 0
                )
                """
            )

            # Migrate existing users table if subscription columns are missing
            existing_cols = {
                row[1]
                for row in conn.execute("PRAGMA table_info(users)").fetchall()
            }
            if "subscription_status" not in existing_cols:
                conn.execute(
                    "ALTER TABLE users ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'inactive'"
                )
                # Whitelist pre-existing users: give them active status until far future
                far_future = (
                    datetime.now(timezone.utc) + timedelta(days=365 * 10)
                ).isoformat()
                conn.execute(
                    "UPDATE users SET subscription_status = 'active', subscription_expires_at = ?",
                    (far_future,),
                )
            if "subscription_expires_at" not in existing_cols:
                conn.execute(
                    "ALTER TABLE users ADD COLUMN subscription_expires_at TEXT"
                )
            if "is_admin" not in existing_cols:
                conn.execute(
                    "ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0"
                )

            # ── Access codes table ─────────────────────────────────────────────
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS access_codes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT NOT NULL UNIQUE,
                    duration_months INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    used_at TEXT,
                    used_by_user_id INTEGER
                )
                """
            )

            # ── Chat history table ─────────────────────────────────────────────
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS chat_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    subject TEXT,
                    created_at TEXT NOT NULL
                )
                """
            )

            # ── Exam history table ─────────────────────────────────────────────
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS exam_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    exam_type TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    score_obtained REAL,
                    total_questions INTEGER,
                    percentage REAL,
                    details_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )

            # ── Manual Payment Requests table ──────────────────────────────────
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS payment_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    momo_name TEXT NOT NULL,
                    momo_number TEXT NOT NULL,
                    reference TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at TEXT NOT NULL,
                    processed_at TEXT
                )
                """
            )

            # ── Competitions table ─────────────────────────────────────────────
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS competitions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    prize TEXT NOT NULL,
                    start_date TEXT NOT NULL,
                    end_date TEXT NOT NULL,
                    quiz_json TEXT,
                    pdf_url TEXT,
                    image_url TEXT,
                    created_at TEXT NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 1
                )
                """
            )

            try:
                conn.execute("ALTER TABLE competitions ADD COLUMN image_url TEXT")
            except sqlite3.OperationalError:
                pass # Already exists

            # ── Competition Results table ──────────────────────────────────────
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS competition_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    competition_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    score REAL NOT NULL,
                    total_questions INTEGER NOT NULL,
                    percentage REAL NOT NULL,
                    submitted_at TEXT NOT NULL,
                    FOREIGN KEY (competition_id) REFERENCES competitions (id),
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
                """
            )

            # ── Competition Registrations table ───────────────────────────────
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS competition_registrations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    competition_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    registered_at TEXT NOT NULL,
                    FOREIGN KEY (competition_id) REFERENCES competitions (id),
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    UNIQUE(competition_id, user_id)
                )
                """
            )

            conn.commit()

    # ── password helpers ───────────────────────────────────────────────────────

    def _hash_password(self, password: str, salt: str) -> str:
        return hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            200_000,
        ).hex()

    def _verify_password(self, password: str, salt: str, password_hash: str) -> bool:
        candidate = self._hash_password(password, salt)
        return hmac.compare_digest(candidate, password_hash)

    # ── row helpers ────────────────────────────────────────────────────────────

    def _row_to_user(self, row: sqlite3.Row) -> AuthUser:
        status = row["subscription_status"] or "inactive"
        expires_at = row["subscription_expires_at"]

        # Auto-expire: if expiry date is in the past, mark expired
        if expires_at and status == "active":
            try:
                exp_dt = datetime.fromisoformat(expires_at)
                if exp_dt.tzinfo is None:
                    exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                if datetime.now(timezone.utc) > exp_dt:
                    status = "expired"
            except ValueError:
                pass

        return AuthUser(
            id=row["id"],
            full_name=row["full_name"],
            email=row["email"],
            provider=row["provider"],
            subscription_status=status,
            subscription_expires_at=expires_at,
            is_admin=bool(row["is_admin"]),
        )

    def _issue_token(self, user: AuthUser, is_static_admin: bool = False) -> str:
        now = datetime.now(timezone.utc)
        payload = {
            "sub": str(user.id),
            "email": user.email,
            "provider": user.provider,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS)).timestamp()),
            "is_static_admin": is_static_admin
        }
        return jwt.encode(payload, settings.AUTH_SECRET_KEY, algorithm="HS256")

    # ── auth methods ───────────────────────────────────────────────────────────

    def signup(self, full_name: str, email: str, password: str) -> Tuple[str, AuthUser]:
        normalized_email = email.strip().lower()
        if len(password.strip()) < 6:
            raise ValueError("Password must be at least 6 characters long.")

        salt = secrets.token_hex(16)
        password_hash = self._hash_password(password, salt)
        now = datetime.now(timezone.utc).isoformat()

        with self._connect() as conn:
            existing = conn.execute(
                "SELECT id FROM users WHERE email = ?",
                (normalized_email,),
            ).fetchone()
            if existing:
                raise ValueError("An account with this email already exists.")

            cursor = conn.execute(
                """
                INSERT INTO users
                    (full_name, email, password_hash, salt, provider, provider_subject,
                     created_at, last_login_at, subscription_status, subscription_expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (full_name.strip(), normalized_email, password_hash, salt,
                 "email", None, now, now, "inactive", None),
            )
            conn.commit()
            user_id = cursor.lastrowid

        user = AuthUser(
            id=user_id,
            full_name=full_name.strip(),
            email=normalized_email,
            provider="email",
            subscription_status="inactive",
            subscription_expires_at=None,
        )
        return self._issue_token(user), user

    def login(self, email: str, password: str) -> Tuple[str, AuthUser]:
        normalized_email = email.strip().lower()

        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE email = ?",
                (normalized_email,),
            ).fetchone()
            if not row:
                raise ValueError("No account found with that email.")
            if row["provider"] != "email":
                raise ValueError(
                    f"This account uses {row['provider']} sign-in. Use that provider to continue."
                )
            if (
                not row["salt"]
                or not row["password_hash"]
                or not self._verify_password(password, row["salt"], row["password_hash"])
            ):
                raise ValueError("Incorrect email or password.")

            now = datetime.now(timezone.utc).isoformat()
            conn.execute(
                "UPDATE users SET last_login_at = ? WHERE id = ?", (now, row["id"])
            )
            conn.commit()

        user = self._row_to_user(row)
        return self._issue_token(user), user

    def login_admin_static(self, username: str, password: str) -> Tuple[str, AuthUser]:
        if username != settings.ADMIN_USERNAME or password != settings.ADMIN_PASSWORD:
            raise ValueError("Incorrect admin username or password.")

        # Create virtual admin user
        admin = AuthUser(
            id=0,
            full_name="BisaME Administrator",
            email="admin@bisame.online",
            provider="static",
            subscription_status="active",
            subscription_expires_at=None,
            is_admin=True
        )
        return self._issue_token(admin, is_static_admin=True), admin

    def login_with_google(self, credential: str) -> Tuple[str, AuthUser]:
        if not settings.GOOGLE_CLIENT_ID:
            raise ValueError("Google sign-in is not configured on the server.")

        idinfo = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )

        email = str(idinfo.get("email", "")).strip().lower()
        email_verified = bool(idinfo.get("email_verified"))
        subject = str(idinfo.get("sub", "")).strip()
        full_name = str(
            idinfo.get("name") or idinfo.get("given_name") or "Google Learner"
        ).strip()

        if not email or not email_verified or not subject:
            raise ValueError("Google account verification failed.")

        now = datetime.now(timezone.utc).isoformat()

        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE email = ?",
                (email,),
            ).fetchone()

            if row:
                if row["provider"] not in {"google", "email"}:
                    raise ValueError(
                        f"This email is already registered with {row['provider']}."
                    )

                if row["provider"] == "email":
                    conn.execute(
                        """
                        UPDATE users
                        SET provider = ?, provider_subject = ?, full_name = ?, last_login_at = ?
                        WHERE id = ?
                        """,
                        ("google", subject, full_name, now, row["id"]),
                    )
                else:
                    conn.execute(
                        "UPDATE users SET provider_subject = ?, full_name = ?, last_login_at = ? WHERE id = ?",
                        (subject, full_name, now, row["id"]),
                    )
                conn.commit()
                updated = conn.execute(
                    "SELECT * FROM users WHERE email = ?", (email,)
                ).fetchone()
                user = self._row_to_user(updated)
                return self._issue_token(user), user

            cursor = conn.execute(
                """
                INSERT INTO users
                    (full_name, email, password_hash, salt, provider, provider_subject,
                     created_at, last_login_at, subscription_status, subscription_expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (full_name, email, None, None, "google", subject,
                 now, now, "inactive", None),
            )
            conn.commit()
            user = AuthUser(
                id=cursor.lastrowid,
                full_name=full_name,
                email=email,
                provider="google",
                subscription_status="inactive",
                subscription_expires_at=None,
            )
            return self._issue_token(user), user

    def get_user_from_token(self, token: str) -> AuthUser:
        try:
            payload = jwt.decode(
                token, settings.AUTH_SECRET_KEY, algorithms=["HS256"]
            )
        except jwt.PyJWTError as exc:
            raise ValueError("Invalid or expired token.") from exc

        user_id = payload.get("sub")
        is_static = payload.get("is_static_admin", False)
        
        if is_static:
            return AuthUser(
                id=0,
                full_name="BisaME Administrator",
                email="admin@bisame.online",
                provider="static",
                subscription_status="active",
                subscription_expires_at=None,
                is_admin=True
            )

        if not user_id:
            raise ValueError("Invalid token payload.")

        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE id = ?", (int(user_id),)
            ).fetchone()
            if not row:
                raise ValueError("Account no longer exists.")
            return self._row_to_user(row)

    # ── subscription / access-code methods ────────────────────────────────────

    def generate_admin_codes(
        self, admin_secret: str, duration_months: Optional[int] = None, quantity: int = 1
    ) -> List[str]:
        if admin_secret != settings.ADMIN_SECRET:
            raise ValueError("Invalid admin secret.")

        months = duration_months or settings.SUBSCRIPTION_MONTHS
        now = datetime.now(timezone.utc).isoformat()
        # Generate short, unambiguous 6-character codes
        def _gen_simple_code():
            # Exclude O, 0, I, 1, L to avoid confusion
            chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
            return "".join(secrets.choice(chars) for _ in range(6))

        codes = [_gen_simple_code() for _ in range(quantity)]

        with self._connect() as conn:
            for code in codes:
                conn.execute(
                    "INSERT INTO access_codes (code, duration_months, created_at) VALUES (?, ?, ?)",
                    (code, months, now),
                )
            conn.commit()

        return codes

    def get_unused_access_codes(self) -> List[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM access_codes WHERE used_at IS NULL ORDER BY created_at DESC"
            ).fetchall()
            return [dict(r) for r in rows]

    def verify_access_code(self, user_id: int, code: str) -> AuthUser:
        code_clean = code.strip().upper()
        now = datetime.now(timezone.utc)

        with self._connect() as conn:
            code_row = conn.execute(
                "SELECT * FROM access_codes WHERE code = ?", (code_clean,)
            ).fetchone()

            if not code_row:
                raise ValueError("Invalid access code. Please check and try again.")
            if code_row["used_at"] is not None:
                raise ValueError("This access code has already been used.")

            # Calculate new expiry — extend from existing expiry if still active
            user_row = conn.execute(
                "SELECT * FROM users WHERE id = ?", (user_id,)
            ).fetchone()
            if not user_row:
                raise ValueError("User not found.")

            existing_expiry = user_row["subscription_expires_at"]
            if existing_expiry and user_row["subscription_status"] == "active":
                try:
                    base = datetime.fromisoformat(existing_expiry)
                    if base.tzinfo is None:
                        base = base.replace(tzinfo=timezone.utc)
                    if base > now:
                        base_dt = base
                    else:
                        base_dt = now
                except ValueError:
                    base_dt = now
            else:
                base_dt = now

            months = code_row["duration_months"]
            new_expiry = (base_dt + timedelta(days=30 * months)).isoformat()

            # Mark code used
            conn.execute(
                "UPDATE access_codes SET used_at = ?, used_by_user_id = ? WHERE code = ?",
                (now.isoformat(), user_id, code_clean),
            )
            # Activate subscription
            conn.execute(
                """
                UPDATE users
                SET subscription_status = 'active', subscription_expires_at = ?
                WHERE id = ?
                """,
                (new_expiry, user_id),
            )
            conn.commit()

            updated = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            return self._row_to_user(updated)

    def get_subscription_status(self, user_id: int) -> AuthUser:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            if not row:
                raise ValueError("User not found.")
            return self._row_to_user(row)

    def create_payment_request(self, user_id: int, momo_name: str, momo_number: str, reference: str) -> int:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO payment_requests (user_id, momo_name, momo_number, reference, status, created_at)
                VALUES (?, ?, ?, ?, 'pending', ?)
                """,
                (user_id, momo_name, momo_number, reference, now),
            )
            conn.commit()
            return cursor.lastrowid

    def get_pending_payment_requests(self) -> List[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT p.id, p.user_id, u.full_name, u.email, p.momo_name, p.momo_number, p.reference, p.status, p.created_at
                FROM payment_requests p
                JOIN users u ON p.user_id = u.id
                WHERE p.status = 'pending'
                ORDER BY p.created_at DESC
                """
            ).fetchall()
            return [dict(r) for r in rows]

    def process_payment_confirmation(self, request_id: int, action: str) -> bool:
        """action: 'confirm' or 'reject'"""
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            row = conn.execute("SELECT user_id FROM payment_requests WHERE id = ?", (request_id,)).fetchone()
            if not row:
                return False
            
            user_id = row["user_id"]
            new_status = 'confirmed' if action == 'confirm' else 'rejected'
            
            conn.execute(
                "UPDATE payment_requests SET status = ?, processed_at = ? WHERE id = ?",
                (new_status, now, request_id)
            )
            
            if action == 'confirm':
                # Grant 3 months subscription
                expiry = (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
                conn.execute(
                    "UPDATE users SET subscription_status = 'active', subscription_expires_at = ? WHERE id = ?",
                    (expiry, user_id)
                )
            
            conn.commit()
            return True

    # ── chat history methods ───────────────────────────────────────────────────

    def save_chat_message(
        self, user_id: int, role: str, content: str, subject: Optional[str] = None
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO chat_history (user_id, role, content, subject, created_at) VALUES (?, ?, ?, ?, ?)",
                (user_id, role, content, subject, now),
            )
            conn.commit()

    def get_chat_history(self, user_id: int, limit: int = 60) -> List[ChatHistoryMessage]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, role, content, subject, created_at
                FROM chat_history
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (user_id, limit),
            ).fetchall()

        # Return in chronological order
        return [
            ChatHistoryMessage(
                id=r["id"],
                role=r["role"],
                content=r["content"],
                subject=r["subject"],
                created_at=r["created_at"],
            )
            for r in reversed(rows)
        ]

    # ── exam history methods ───────────────────────────────────────────────────

    def save_exam_history(
        self, user_id: int, exam_type: str, subject: str, score: float, total: int, percentage: float, details_json: str
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO exam_history 
                (user_id, exam_type, subject, score_obtained, total_questions, percentage, details_json, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (user_id, exam_type, subject, score, total, percentage, details_json, now),
            )
            conn.commit()

    def get_exam_history(self, user_id: int, limit: int = 50) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, exam_type, subject, score_obtained, total_questions, percentage, details_json, created_at
                FROM exam_history
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (user_id, limit),
            ).fetchall()

        return [
            {
                "id": r["id"],
                "exam_type": r["exam_type"],
                "subject": r["subject"],
                "score_obtained": r["score_obtained"],
                "total_questions": r["total_questions"],
                "percentage": r["percentage"],
                "details_json": r["details_json"],
                "created_at": r["created_at"],
            }
            for r in rows
        ]

    # ── Admin & Competition methods ───────────────────────────────────────────

    def get_admin_analytics(self) -> dict:
        with self._connect() as conn:
            total_users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            active_subs = conn.execute(
                "SELECT COUNT(*) FROM users WHERE subscription_status = 'active'"
            ).fetchone()[0]
            
            now = datetime.now(timezone.utc)
            soon = (now + timedelta(days=7)).isoformat()
            expiring_soon = conn.execute(
                "SELECT COUNT(*) FROM users WHERE subscription_status = 'active' AND subscription_expires_at < ?",
                (soon,),
            ).fetchone()[0]
            
            # Revenue: Each confirmed student pays 10 GHS
            confirmed_payments = conn.execute("SELECT COUNT(*) FROM payment_requests WHERE status = 'confirmed'").fetchone()[0]
            used_coupons = conn.execute("SELECT COUNT(*) FROM access_codes WHERE used_at IS NOT NULL").fetchone()[0]
            
            # Assume each unique subscription activation (either via code or manual payment) represents a 10 GHS payment
            total_rev_ghs = (confirmed_payments + used_coupons) * 10

            recent_activity = conn.execute(
                """
                SELECT full_name, last_login_at as activity_at, 'Login' as type
                FROM users
                ORDER BY last_login_at DESC
                LIMIT 10
                """
            ).fetchall()

            # Fix total_codes_generated to count from access_codes instead of users
            total_codes_gen = conn.execute("SELECT COUNT(*) FROM access_codes").fetchone()[0]

            return {
                "total_users": total_users,
                "active_subscriptions": active_subs,
                "expiring_subscriptions": expiring_soon,
                "total_revenue_ghs": float(total_rev_ghs),
                "total_codes_generated": total_codes_gen,
                "total_codes_used": used_coupons,
                "recent_activity": [dict(r) for r in recent_activity]
            }

    def get_unused_access_codes(self) -> List[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT code, duration_months, created_at FROM access_codes WHERE used_at IS NULL ORDER BY created_at DESC"
            ).fetchall()
            return [dict(r) for r in rows]

    def update_competition_image(self, competition_id: int, image_url: str) -> bool:
        with self._connect() as conn:
            cursor = conn.execute(
                "UPDATE competitions SET image_url = ? WHERE id = ?",
                (image_url, competition_id)
            )
            conn.commit()
            return cursor.rowcount > 0

    def create_payment_request(self, user_id: int, momo_name: str, momo_number: str, reference: str) -> int:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            cursor = conn.execute(
                "INSERT INTO payment_requests (user_id, momo_name, momo_number, reference, created_at) VALUES (?, ?, ?, ?, ?)",
                (user_id, momo_name, momo_number, reference, now)
            )
            conn.commit()
            return cursor.lastrowid

    def get_pending_payment_requests(self) -> List[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT p.*, u.full_name, u.email 
                FROM payment_requests p
                JOIN users u ON p.user_id = u.id
                WHERE p.status = 'pending'
                ORDER BY p.created_at ASC
                """
            ).fetchall()
            return [dict(r) for r in rows]

    def process_payment_confirmation(self, request_id: int, action: str) -> bool:
        """action can be 'confirm' or 'reject'"""
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            request = conn.execute("SELECT user_id FROM payment_requests WHERE id = ?", (request_id,)).fetchone()
            if not request:
                return False
            
            user_id = request['user_id']
            status = 'confirmed' if action == 'confirm' else 'rejected'
            
            conn.execute(
                "UPDATE payment_requests SET status = ?, processed_at = ? WHERE id = ?",
                (status, now, request_id)
            )

            if action == 'confirm':
                # Grant 3 months premium
                expires_at = (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
                conn.execute(
                    "UPDATE users SET subscription_status = 'active', subscription_expires_at = ? WHERE id = ?",
                    (expires_at, user_id)
                )
            
            conn.commit()
            return True

    def create_competition(self, title: str, description: str, prize: str, start_date: str, end_date: str, quiz_json: Optional[str] = None, pdf_url: Optional[str] = None) -> int:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO competitions (title, description, prize, start_date, end_date, quiz_json, pdf_url, created_at, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
                """,
                (title, description, prize, start_date, end_date, quiz_json, pdf_url, now),
            )
            conn.commit()
            return cursor.lastrowid

    def update_competition_image(self, competition_id: int, image_url: str) -> bool:
        with self._connect() as conn:
            cursor = conn.execute(
                "UPDATE competitions SET image_url = ? WHERE id = ?",
                (image_url, competition_id)
            )
            conn.commit()
            return cursor.rowcount > 0

    def update_competition_pdf(self, competition_id: int, pdf_url: str) -> bool:
        with self._connect() as conn:
            cursor = conn.execute(
                "UPDATE competitions SET pdf_url = ? WHERE id = ?",
                (pdf_url, competition_id)
            )
            conn.commit()
            return cursor.rowcount > 0

    def list_competitions(self, active_only: bool = True) -> list[dict]:
        with self._connect() as conn:
            query = "SELECT * FROM competitions"
            if active_only:
                query += " WHERE is_active = 1"
            rows = conn.execute(query).fetchall()
            return [dict(r) for r in rows]

    def register_for_competition(self, user_id: int, competition_id: int) -> bool:
        now = datetime.now(timezone.utc).isoformat()
        try:
            with self._connect() as conn:
                conn.execute(
                    "INSERT INTO competition_registrations (competition_id, user_id, registered_at) VALUES (?, ?, ?)",
                    (competition_id, user_id, now),
                )
                conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def submit_competition_score(self, user_id: int, competition_id: int, score: float, total: int, percentage: float) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO competition_results (competition_id, user_id, score, total_questions, percentage, submitted_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (competition_id, user_id, score, total, percentage, now),
            )
            conn.commit()

    def get_global_leaderboard(self, limit: int = 20) -> list[dict]:
        with self._connect() as conn:
            # Aggregate score from exam_history as 'points'
            # points = sum(score_obtained)
            rows = conn.execute(
                """
                SELECT u.full_name as player_name, 
                       SUM(CASE 
                           WHEN e.exam_type = 'challenge_quiz' THEN e.score_obtained * 0.8 
                           ELSE e.score_obtained * 0.2 
                       END) as total_points
                FROM users u
                JOIN exam_history e ON u.id = e.user_id
                GROUP BY u.id
                ORDER BY total_points DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
            
            return [
                {
                    "player_name": r["player_name"],
                    "total_points": int(r["total_points"] or 0),
                    "rank": idx + 1,
                    "is_online": False # Simplification
                }
                for idx, r in enumerate(rows)
            ]

    def set_user_admin(self, email: str, is_admin: bool = True) -> bool:
        with self._connect() as conn:
            cursor = conn.execute("UPDATE users SET is_admin = ? WHERE email = ?", (1 if is_admin else 0, email))
            conn.commit()
            return cursor.rowcount > 0
