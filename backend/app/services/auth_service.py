import hashlib
import hmac
import logging
import secrets
import sqlite3
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, List, Optional, Tuple, Union

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    POSTGRES_AVAILABLE = True
except ImportError:
    POSTGRES_AVAILABLE = False

import jwt
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.config import settings
from app.models import AuthUser, ChatHistoryMessage

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self) -> None:
        self.db_url = settings.db_url
        self.is_postgres = settings.is_postgres
        
        if not self.is_postgres:
            # If DATABASE_URL is a sqlite URL, use that path instead of the hardcoded AUTH_DB_PATH
            if settings.DATABASE_URL.startswith("sqlite:///"):
                # Extract path from sqlite:///./path/to/db
                db_path_str = settings.DATABASE_URL.replace("sqlite:///", "")
                # Ensure it's relative to BACKEND_DIR if it starts with ./
                if db_path_str.startswith("./"):
                    from app.config import BACKEND_DIR
                    self.db_path = BACKEND_DIR / db_path_str[2:]
                else:
                    self.db_path = Path(db_path_str)
            else:
                self.db_path = Path(settings.AUTH_DB_PATH)
                
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            logger.info(f"🗄️ SQLite Database configured at: {self.db_path.absolute()}")
            
            # Automated Backup on Startup (SQLite only)
            if self.db_path.exists() and self.db_path.stat().st_size > 0:
                try:
                    import shutil
                    backup_path = self.db_path.with_suffix(".db.bak")
                    shutil.copy2(self.db_path, backup_path)
                    logger.info(f"📂 Created safety backup at: {backup_path.name}")
                except Exception as e:
                    logger.warning(f"⚠️ Could not create database backup: {str(e)}")
        else:
            logger.info("📡 PostgreSQL (Supabase) Database detected.")
        
        self._ensure_tables()

    def _connect(self) -> Any:
        if self.is_postgres:
            if not POSTGRES_AVAILABLE:
                raise ImportError("psycopg2-binary is required for PostgreSQL support but not installed.")
            conn = psycopg2.connect(self.db_url)
            conn.autocommit = True # Make it behave more like sqlite for simple writes
            return conn
        else:
            connection = sqlite3.connect(self.db_path)
            connection.row_factory = sqlite3.Row
            return connection

    def _execute(self, conn: Any, query: str, params: tuple = ()) -> Any:
        # Abstract the parameter marker difference (?, %s)
        if self.is_postgres:
            # Simple direct replace for this app's usage pattern
            # Note: This is naive but works for the current auth_service SQL patterns
            query = query.replace("?", "%s")
        
        cursor = conn.cursor(cursor_factory=RealDictCursor) if self.is_postgres else conn.cursor()
        cursor.execute(query, params)
        return cursor

    def _ensure_tables(self) -> None:
        with self._connect() as conn:
            # Dialect-specific ID types
            id_type = "SERIAL PRIMARY KEY" if self.is_postgres else "INTEGER PRIMARY KEY AUTOINCREMENT"
            
            # ── Users table ────────────────────────────────────────────────────
            self._execute(conn,
                f"""
                CREATE TABLE IF NOT EXISTS users (
                    id {id_type},
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
                    is_admin INTEGER NOT NULL DEFAULT 0,
                    session_id TEXT,
                    track TEXT
                )
                """
            )

            # Migration: Ensure session_id and track exist (for older DBs)
            try:
                self._execute(conn, "ALTER TABLE users ADD COLUMN session_id TEXT")
            except:
                pass
            try:
                self._execute(conn, "ALTER TABLE users ADD COLUMN track TEXT")
            except:
                pass

            # ── Access codes table ─────────────────────────────────────────────
            self._execute(conn, 
                f"""
                CREATE TABLE IF NOT EXISTS access_codes (
                    id {id_type},
                    code TEXT NOT NULL UNIQUE,
                    duration_months INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    used_at TEXT,
                    used_by_user_id INTEGER
                )
                """
            )

            # ── Chat history table ─────────────────────────────────────────────
            self._execute(conn, 
                f"""
                CREATE TABLE IF NOT EXISTS chat_history (
                    id {id_type},
                    user_id INTEGER NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    subject TEXT,
                    created_at TEXT NOT NULL
                )
                """
            )

            # ── Exam history table ─────────────────────────────────────────────
            self._execute(conn, 
                f"""
                CREATE TABLE IF NOT EXISTS exam_history (
                    id {id_type},
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
            self._execute(conn, 
                f"""
                CREATE TABLE IF NOT EXISTS payment_requests (
                    id {id_type},
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
            self._execute(conn, 
                f"""
                CREATE TABLE IF NOT EXISTS competitions (
                    id {id_type},
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

            # ── Competition Results table ──────────────────────────────────────
            self._execute(conn, 
                f"""
                CREATE TABLE IF NOT EXISTS competition_results (
                    id {id_type},
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
            self._execute(conn,
                f"""
                CREATE TABLE IF NOT EXISTS competition_registrations (
                    id {id_type},
                    competition_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    registered_at TEXT NOT NULL,
                    FOREIGN KEY (competition_id) REFERENCES competitions (id),
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    UNIQUE(competition_id, user_id)
                )
                """
            )

            # ── Recent generated questions (24h anti-repeat) ──────────────────
            self._execute(conn,
                f"""
                CREATE TABLE IF NOT EXISTS recent_generated_questions (
                    id {id_type},
                    user_id INTEGER NOT NULL,
                    subject_slug TEXT NOT NULL,
                    question_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            self._execute(conn, "CREATE INDEX IF NOT EXISTS idx_rgq_user_subj_time ON recent_generated_questions (user_id, subject_slug, created_at)")

            if not self.is_postgres:
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

        try:
            row_track = row["track"]
        except (KeyError, IndexError, TypeError):
            row_track = None

        return AuthUser(
            id=row["id"],
            full_name=row["full_name"],
            email=row["email"],
            provider=row["provider"],
            subscription_status=status,
            subscription_expires_at=expires_at,
            is_admin=bool(row["is_admin"]),
            track=row_track,
        )

    def _issue_token(self, user: AuthUser, is_static_admin: bool = False, session_id: Optional[str] = None) -> str:
        now = datetime.now(timezone.utc)
        payload = {
            "sub": str(user.id),
            "email": user.email,
            "provider": user.provider,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS)).timestamp()),
            "is_static_admin": is_static_admin,
            "sid": session_id or (getattr(user, "session_id") if hasattr(user, "session_id") else None)
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
            existing = self._execute(conn, 
                "SELECT id FROM users WHERE email = ?",
                (normalized_email,),
            ).fetchone()
            if existing:
                raise ValueError("An account with this email already exists.")

            new_session_id = secrets.token_hex(16)
            
            query = """
                INSERT INTO users
                    (full_name, email, password_hash, salt, provider, provider_subject,
                     created_at, last_login_at, subscription_status, subscription_expires_at, session_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            if self.is_postgres:
                query += " RETURNING id"
            
            cursor = self._execute(conn, query, (full_name.strip(), normalized_email, password_hash, salt,
                                               "email", None, now, now, "inactive", None, new_session_id))
            
            if self.is_postgres:
                user_id = cursor.fetchone()["id"]
            else:
                user_id = cursor.lastrowid

        user = AuthUser(
            id=user_id,
            full_name=full_name.strip(),
            email=normalized_email,
            provider="email",
            subscription_status="inactive",
            subscription_expires_at=None,
        )
        return self._issue_token(user, session_id=new_session_id), user

    def login(self, email: str, password: str) -> Tuple[str, AuthUser]:
        normalized_email = email.strip().lower()

        # Fallback: Check if credentials match the static admin
        if normalized_email == settings.ADMIN_USERNAME.lower() and password == settings.ADMIN_PASSWORD:
            return self.login_admin_static(settings.ADMIN_USERNAME, settings.ADMIN_PASSWORD)

        with self._connect() as conn:
            row = self._execute(conn, 
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
            new_session_id = secrets.token_hex(16)
            self._execute(conn, 
                "UPDATE users SET last_login_at = ?, session_id = ? WHERE id = ?", 
                (now, new_session_id, row["id"])
            )

        user = self._row_to_user(row)
        return self._issue_token(user, session_id=new_session_id), user


    def login_admin_with_secret(self, secret: str) -> Tuple[str, AuthUser]:
        if secret != settings.ADMIN_SECRET:
            raise ValueError("Invalid admin access code.")

        # Create virtual admin user
        admin = AuthUser(
            id=0,
            full_name="BroxStudies Online Administrator",
            email="admin@broxstudies.online",
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
            row = self._execute(conn, 
                "SELECT * FROM users WHERE email = ?",
                (email,),
            ).fetchone()

            if row:
                if row["provider"] not in {"google", "email"}:
                    raise ValueError(
                        f"This email is already registered with {row['provider']}."
                    )

                if row["provider"] == "email":
                    self._execute(conn, 
                        """
                        UPDATE users
                        SET provider = ?, provider_subject = ?, full_name = ?, last_login_at = ?
                        WHERE id = ?
                        """,
                        ("google", subject, full_name, now, row["id"]),
                    )
                else:
                    self._execute(conn, "UPDATE users SET provider_subject = ?, full_name = ?, last_login_at = ? WHERE id = ?",
                        (subject, full_name, now, row["id"]),
                    )
                
                updated = self._execute(conn, 
                    "SELECT * FROM users WHERE email = ?", (email,)
                ).fetchone()
                user = self._row_to_user(updated)
                new_session_id = secrets.token_hex(16)
                self._execute(conn, 
                    "UPDATE users SET session_id = ? WHERE id = ?",
                    (new_session_id, user.id)
                )
                return self._issue_token(user, session_id=new_session_id), user

            new_session_id = secrets.token_hex(16)
            query = """
                INSERT INTO users
                    (full_name, email, password_hash, salt, provider, provider_subject,
                     created_at, last_login_at, subscription_status, subscription_expires_at, session_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            if self.is_postgres:
                query += " RETURNING id"

            cursor = self._execute(conn, query, (full_name, email, None, None, "google", subject,
                                               now, now, "inactive", None, new_session_id))
            
            if self.is_postgres:
                user_id = cursor.fetchone()["id"]
            else:
                user_id = cursor.lastrowid

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
                full_name="BroxStudies Online Administrator",
                email="admin@broxstudies.online",
                provider="static",
                subscription_status="active",
                subscription_expires_at=None,
                is_admin=True
            )

        if not user_id:
            raise ValueError("Invalid token payload.")

        with self._connect() as conn:
            row = self._execute(conn, 
                "SELECT * FROM users WHERE id = ?", (int(user_id),)
            ).fetchone()
            if not row:
                raise ValueError("Account no longer exists.")
            
            # SESSION LOCK: Verify session_id matches (except for admins)
            if not bool(row["is_admin"]):
                token_session_id = payload.get("sid")
                current_session_id = row["session_id"]
                if token_session_id != current_session_id:
                    raise ValueError("Another device has logged into this account. Please log in again.")

            return self._row_to_user(row)

    # ── subscription / access-code methods ────────────────────────────────────

    def generate_admin_codes(
        self, admin_secret: str, duration_months: Optional[int] = None, quantity: int = 1
    ) -> List[str]:
        if admin_secret != settings.ADMIN_SECRET:
            raise ValueError("Invalid admin secret.")

        months = duration_months or settings.SUBSCRIPTION_MONTHS
        now = datetime.now(timezone.utc).isoformat()
        # Generate short, complex 6-character codes
        def _gen_simple_code():
            # Mix of Numbers, Alphabets and Symbols
            chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ!@#$%^&*?"
            return "".join(secrets.choice(chars) for _ in range(6))

        codes = [_gen_simple_code() for _ in range(quantity)]

        with self._connect() as conn:
            for code in codes:
                self._execute(conn, 
                    "INSERT INTO access_codes (code, duration_months, created_at) VALUES (?, ?, ?)",
                    (code, months, now),
                )

        return codes

    def get_unused_access_codes(self) -> List[dict]:
        with self._connect() as conn:
            rows = self._execute(conn, 
                "SELECT code, duration_months, created_at FROM access_codes WHERE used_at IS NULL ORDER BY created_at DESC"
            ).fetchall()
            return [dict(r) for r in rows]

    def get_pending_payments(self) -> List[dict]:
        with self._connect() as conn:
            # Join with users to get name and email
            rows = self._execute(conn, """
                SELECT p.*, u.full_name, u.email
                FROM payment_requests p
                JOIN users u ON p.user_id = u.id
                WHERE p.status = 'pending'
                ORDER BY p.created_at DESC
            """).fetchall()
            return [dict(r) for r in rows]

    def verify_access_code(self, user_id: int, code: str, track: Optional[str] = None) -> AuthUser:
        # Normalize user-entered codes so formatted values like "BROX-1234" or "B R O X" still work.
        code_clean = code.strip().upper().replace(" ", "").replace("-", "")
        now = datetime.now(timezone.utc)
        valid_tracks = {"shs", "tvet"}

        with self._connect() as conn:
            code_row = self._execute(conn,
                "SELECT * FROM access_codes WHERE code = ?", (code_clean,)
            ).fetchone()

            if code_clean == "BROX":
                user_row = self._execute(conn,
                    "SELECT * FROM users WHERE id = ?", (user_id,)
                ).fetchone()
                if not user_row:
                    raise ValueError("User not found.")

                try:
                    existing_track = user_row["track"]
                except (KeyError, IndexError, TypeError):
                    existing_track = None
                if existing_track and track and existing_track != track:
                    raise ValueError(
                        f"Your account is locked to the {existing_track.upper()} track. "
                        "You cannot switch tracks. Contact support if this is an error."
                    )
                resolved_track = existing_track or (track if track in valid_tracks else None)

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

                new_expiry = (base_dt + timedelta(days=7)).isoformat()
                self._execute(conn,
                    """
                    UPDATE users
                    SET subscription_status = 'active', subscription_expires_at = ?, track = ?
                    WHERE id = ?
                    """,
                    (new_expiry, resolved_track, user_id),
                )

                updated = self._execute(conn, "SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
                return self._row_to_user(updated)

            if not code_row:
                raise ValueError("Invalid access code. Please check and try again.")
            try:
                used_at = code_row["used_at"]
            except (KeyError, IndexError, TypeError):
                used_at = None
            if used_at is not None:
                raise ValueError("This access code has already been used.")

            # Calculate new expiry — extend from existing expiry if still active
            user_row = self._execute(conn,
                "SELECT * FROM users WHERE id = ?", (user_id,)
            ).fetchone()
            if not user_row:
                raise ValueError("User not found.")

            # Track lock: if user already has a track, they cannot change it via a new code
            try:
                existing_track = user_row["track"]
            except (KeyError, IndexError, TypeError):
                existing_track = None
            if existing_track and track and existing_track != track:
                raise ValueError(
                    f"Your account is locked to the {existing_track.upper()} track. "
                    "You cannot switch tracks. Contact support if this is an error."
                )

            # Determine which track to lock this account to
            resolved_track = existing_track or (track if track in valid_tracks else None)

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

            try:
                months = code_row["duration_months"]
            except (KeyError, IndexError, TypeError):
                months = 1  # default to 1 month if not found
            new_expiry = (base_dt + timedelta(days=30 * months)).isoformat()

            # Mark code used
            self._execute(conn,
                "UPDATE access_codes SET used_at = ?, used_by_user_id = ? WHERE code = ?",
                (now.isoformat(), user_id, code_clean),
            )
            # Activate subscription and lock track
            self._execute(conn,
                """
                UPDATE users
                SET subscription_status = 'active', subscription_expires_at = ?, track = ?
                WHERE id = ?
                """,
                (new_expiry, resolved_track, user_id),
            )

            updated = self._execute(conn, "SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            return self._row_to_user(updated)

    def get_subscription_status(self, user_id: int) -> AuthUser:
        with self._connect() as conn:
            row = self._execute(conn, "SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            if not row:
                raise ValueError("User not found.")
            return self._row_to_user(row)

    def create_payment_request(self, user_id: int, momo_name: str, momo_number: str, reference: Optional[str] = None) -> int:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            query = """
                INSERT INTO payment_requests (user_id, momo_name, momo_number, reference, status, created_at)
                VALUES (?, ?, ?, ?, 'pending', ?)
            """
            if self.is_postgres:
                query += " RETURNING id"
            
            cursor = self._execute(conn, query, (user_id, momo_name, momo_number, reference, now))
            
            if self.is_postgres:
                return cursor.fetchone()["id"]
            return cursor.lastrowid
    def get_pending_payments(self) -> List[dict]:
        with self._connect() as conn:
            rows = self._execute(conn, """
                SELECT p.id, p.user_id, u.full_name, u.email, p.momo_name, p.momo_number, p.reference, p.status, p.created_at
                FROM payment_requests p
                JOIN users u ON p.user_id = u.id
                WHERE p.status = 'pending'
                ORDER BY p.created_at DESC
            """).fetchall()
            return [dict(r) for r in rows]

    def process_payment_confirmation(self, request_id: int, action: str) -> bool:
        """action can be 'confirm' or 'reject'"""
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            row = self._execute(conn, "SELECT user_id FROM payment_requests WHERE id = ?", (request_id,)).fetchone()
            if not row:
                return False
            
            user_id = row["user_id"]
            new_status = 'confirmed' if action == 'confirm' else 'rejected'
            
            self._execute(conn, 
                "UPDATE payment_requests SET status = ?, processed_at = ? WHERE id = ?",
                (new_status, now, request_id)
            )
            
            if action == 'confirm':
                # Grant 3 months premium
                expires_at = (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
                self._execute(conn, 
                    "UPDATE users SET subscription_status = 'active', subscription_expires_at = ? WHERE id = ?",
                    (expires_at, user_id)
                )
            
            return True

    # ── chat history methods ───────────────────────────────────────────────────

    def save_chat_message(
        self, user_id: int, role: str, content: str, subject: Optional[str] = None
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            self._execute(conn, 
                "INSERT INTO chat_history (user_id, role, content, subject, created_at) VALUES (?, ?, ?, ?, ?)",
                (user_id, role, content, subject, now),
            )

    def get_chat_history(self, user_id: int, limit: int = 60) -> List[ChatHistoryMessage]:
        with self._connect() as conn:
            rows = self._execute(conn, 
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
            self._execute(conn, 
                """
                INSERT INTO exam_history 
                (user_id, exam_type, subject, score_obtained, total_questions, percentage, details_json, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (user_id, exam_type, subject, score, total, percentage, details_json, now),
            )

    def get_exam_history(self, user_id: int, limit: int = 50) -> list[dict]:
        with self._connect() as conn:
            rows = self._execute(conn, 
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

    # ── Anti-repeat: recently generated questions ─────────────────────────────

    def get_recent_question_hashes(self, user_id: int, subject_slug: str, hours: int = 24) -> set[str]:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        with self._connect() as conn:
            rows = self._execute(conn,
                """
                SELECT question_hash FROM recent_generated_questions
                WHERE user_id = ? AND subject_slug = ? AND created_at > ?
                """,
                (user_id, subject_slug, cutoff),
            ).fetchall()
        return {r["question_hash"] for r in rows}

    def record_generated_questions(self, user_id: int, subject_slug: str, question_hashes: list[str]) -> None:
        if not question_hashes:
            return
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            for h in question_hashes:
                self._execute(conn,
                    "INSERT INTO recent_generated_questions (user_id, subject_slug, question_hash, created_at) VALUES (?, ?, ?, ?)",
                    (user_id, subject_slug, h, now),
                )
            # Opportunistic pruning: drop entries older than 48h for this user+subject
            stale_cutoff = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
            self._execute(conn,
                "DELETE FROM recent_generated_questions WHERE user_id = ? AND subject_slug = ? AND created_at < ?",
                (user_id, subject_slug, stale_cutoff),
            )

    # ── Admin & Competition methods ───────────────────────────────────────────

    def get_admin_analytics(self) -> dict:
        with self._connect() as conn:
            total_users = self._execute(conn, "SELECT COUNT(*) FROM users").fetchone()
            total_users = list(total_users.values())[0] if self.is_postgres else total_users[0]
            
            active_subs = self._execute(conn, 
                "SELECT COUNT(*) FROM users WHERE subscription_status = 'active'"
            ).fetchone()
            active_subs = list(active_subs.values())[0] if self.is_postgres else active_subs[0]
            
            now = datetime.now(timezone.utc)
            soon = (now + timedelta(days=7)).isoformat()
            expiring_soon = self._execute(conn, 
                "SELECT COUNT(*) FROM users WHERE subscription_status = 'active' AND subscription_expires_at < ?",
                (soon,),
            ).fetchone()
            expiring_soon = list(expiring_soon.values())[0] if self.is_postgres else expiring_soon[0]
            
            # Revenue calculation using the configured price
            confirmed_payments = self._execute(conn, "SELECT COUNT(*) FROM payment_requests WHERE status = 'confirmed'").fetchone()
            confirmed_payments = list(confirmed_payments.values())[0] if self.is_postgres else confirmed_payments[0]
            
            used_coupons = self._execute(conn, "SELECT COUNT(*) FROM access_codes WHERE used_at IS NOT NULL").fetchone()
            used_coupons = list(used_coupons.values())[0] if self.is_postgres else used_coupons[0]
            
            # Use settings for price calculation instead of hardcoded 10
            price = float(settings.SUBSCRIPTION_PRICE_GHS) if settings.SUBSCRIPTION_PRICE_GHS.isdigit() else 10.0
            total_rev_ghs = (confirmed_payments + used_coupons) * price

            recent_activity = self._execute(conn, 
                """
                SELECT full_name, last_login_at as activity_at, 'Login' as type
                FROM users
                ORDER BY last_login_at DESC
                LIMIT 10
                """
            ).fetchall()

            # Fix total_codes_generated to count from access_codes instead of users
            total_codes_gen = self._execute(conn, "SELECT COUNT(*) FROM access_codes").fetchone()
            total_codes_gen = list(total_codes_gen.values())[0] if self.is_postgres else total_codes_gen[0]

            return {
                "total_users": total_users,
                "active_subscriptions": active_subs,
                "expiring_subscriptions": expiring_soon,
                "total_revenue_ghs": float(total_rev_ghs),
                "total_codes_generated": total_codes_gen,
                "total_codes_used": used_coupons,
                "recent_activity": [dict(r) for r in recent_activity]
            }


    def update_competition_image(self, competition_id: int, image_url: str) -> bool:
        with self._connect() as conn:
            cursor = self._execute(conn, 
                "UPDATE competitions SET image_url = ? WHERE id = ?",
                (image_url, competition_id)
            )
            return cursor.rowcount > 0

    def process_payment_confirmation(self, request_id: int, action: str) -> bool:
        """action can be 'confirm' or 'reject'"""
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            request = self._execute(conn, "SELECT user_id FROM payment_requests WHERE id = ?", (request_id,)).fetchone()
            if not request:
                return False
            
            user_id = request['user_id']
            status = 'confirmed' if action == 'confirm' else 'rejected'
            
            self._execute(conn, 
                "UPDATE payment_requests SET status = ?, processed_at = ? WHERE id = ?",
                (status, now, request_id)
            )

            if action == 'confirm':
                # Grant 3 months premium
                expires_at = (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
                self._execute(conn, 
                    "UPDATE users SET subscription_status = 'active', subscription_expires_at = ? WHERE id = ?",
                    (expires_at, user_id)
                )
            
            return True

    def create_competition(self, title: str, description: str, prize: str, start_date: str, end_date: str, quiz_json: Optional[str] = None, pdf_url: Optional[str] = None) -> int:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            query = """
                INSERT INTO competitions (title, description, prize, start_date, end_date, quiz_json, pdf_url, created_at, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            """
            if self.is_postgres:
                query += " RETURNING id"
            cursor = self._execute(conn, query, (title, description, prize, start_date, end_date, quiz_json, pdf_url, now))
            
            if self.is_postgres:
                return cursor.fetchone()["id"]
            return cursor.lastrowid


    def update_competition_pdf(self, competition_id: int, pdf_url: str) -> bool:
        with self._connect() as conn:
            cursor = self._execute(conn, 
                "UPDATE competitions SET pdf_url = ? WHERE id = ?",
                (pdf_url, competition_id)
            )
            return cursor.rowcount > 0

    def list_competitions(self, active_only: bool = True) -> list[dict]:
        with self._connect() as conn:
            query = "SELECT * FROM competitions"
            if active_only:
                query += " WHERE is_active = 1"
            rows = self._execute(conn, query).fetchall()
            return [dict(r) for r in rows]

    def register_for_competition(self, user_id: int, competition_id: int) -> bool:
        now = datetime.now(timezone.utc).isoformat()
        try:
            with self._connect() as conn:
                self._execute(conn, 
                    "INSERT INTO competition_registrations (competition_id, user_id, registered_at) VALUES (?, ?, ?)",
                    (competition_id, user_id, now),
                )
            return True
        except (sqlite3.IntegrityError, Exception):
            # Postgres raises psycopg2.errors.UniqueViolation, but catching Exception is safer for this generic helper
            return False

    def submit_competition_score(self, user_id: int, competition_id: int, score: float, total: int, percentage: float) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            self._execute(conn, 
                """
                INSERT INTO competition_results (competition_id, user_id, score, total_questions, percentage, submitted_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (competition_id, user_id, score, total, percentage, now),
            )

    def get_global_leaderboard(self, limit: int = 20) -> list[dict]:
        with self._connect() as conn:
            # Aggregate score from exam_history as 'points'
            # points = sum(score_obtained)
            rows = self._execute(conn, 
                """
                SELECT u.full_name as player_name, 
                       SUM(CASE 
                           WHEN e.exam_type = 'challenge_quiz' THEN e.score_obtained * 0.8 
                           ELSE e.score_obtained * 0.2 
                       END) as total_points
                FROM users u
                JOIN exam_history e ON u.id = e.user_id
                GROUP BY u.id, u.full_name
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
            cursor = self._execute(conn, "UPDATE users SET is_admin = ? WHERE email = ?", (1 if is_admin else 0, email))
            return cursor.rowcount > 0
