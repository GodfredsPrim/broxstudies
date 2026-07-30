import json
import uuid
from datetime import datetime, timezone
from typing import Iterable, Optional

from app.models import Question
from app.services.auth_service import AuthService


VALID_ACTIONS = {"approve", "edit", "reject", "verify"}


class TeacherVerificationService:
    def __init__(self, db: Optional[AuthService] = None) -> None:
        self.db = db or AuthService()
        self._ensure_tables()

    @staticmethod
    def now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def _ensure_tables(self) -> None:
        id_type = "SERIAL PRIMARY KEY" if self.db.is_postgres else "INTEGER PRIMARY KEY AUTOINCREMENT"
        with self.db._connect() as conn:
            self.db._execute(
                conn,
                """CREATE TABLE IF NOT EXISTS generated_question_records (
                    id TEXT PRIMARY KEY,
                    owner_user_id INTEGER,
                    subject TEXT NOT NULL,
                    question_type TEXT NOT NULL,
                    question_json TEXT NOT NULL,
                    review_status TEXT NOT NULL DEFAULT 'pending_teacher_review',
                    version INTEGER NOT NULL DEFAULT 1,
                    is_demo INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )""",
            )
            self.db._execute(
                conn,
                f"""CREATE TABLE IF NOT EXISTS question_review_history (
                    id {id_type},
                    question_id TEXT NOT NULL,
                    reviewer_user_id INTEGER NOT NULL,
                    action TEXT NOT NULL,
                    review_target TEXT NOT NULL,
                    comment TEXT,
                    before_json TEXT NOT NULL,
                    after_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (question_id) REFERENCES generated_question_records(id)
                )""",
            )
            self.db._execute(
                conn,
                "CREATE INDEX IF NOT EXISTS idx_generated_review_status ON generated_question_records (review_status, created_at)",
            )
            self.db._execute(
                conn,
                "CREATE INDEX IF NOT EXISTS idx_question_review_history ON question_review_history (question_id, created_at)",
            )

    def record_questions(
        self,
        questions: Iterable[Question],
        *,
        owner_user_id: Optional[int],
        is_demo: bool = False,
    ) -> list[Question]:
        now = self.now()
        result: list[Question] = []
        with self.db._connect() as conn:
            for question in questions:
                question.id = question.id or str(uuid.uuid4())
                question.review_status = question.review_status or "pending_teacher_review"
                question.teacher_verified = question.review_status == "verified"
                question.evidence.verification_status = question.review_status
                payload = question.model_dump(mode="json")
                self.db._execute(
                    conn,
                    """INSERT INTO generated_question_records
                       (id, owner_user_id, subject, question_type, question_json, review_status, version, is_demo, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
                       ON CONFLICT(id) DO UPDATE SET question_json=excluded.question_json,
                           review_status=excluded.review_status, updated_at=excluded.updated_at""",
                    (
                        question.id,
                        owner_user_id,
                        question.subject.value,
                        question.question_type.value,
                        json.dumps(payload),
                        question.review_status,
                        1 if is_demo else 0,
                        now,
                        now,
                    ),
                )
                result.append(question)
        return result

    def list_queue(self, status: Optional[str] = None, limit: int = 100, include_demo: bool = False) -> list[dict]:
        query = """SELECT q.id, q.subject, q.question_type, q.question_json, q.review_status,
                          q.version, q.is_demo, q.created_at, q.updated_at,
                          u.full_name AS owner_name
                   FROM generated_question_records q
                   LEFT JOIN users u ON u.id=q.owner_user_id
                   WHERE q.is_demo=?"""
        params: list[object] = [1 if include_demo else 0]
        if status:
            query += " AND q.review_status=?"
            params.append(status)
        query += " ORDER BY q.updated_at DESC LIMIT ?"
        params.append(max(1, min(limit, 250)))
        with self.db._connect() as conn:
            rows = self.db._execute(conn, query, tuple(params)).fetchall()
        items = []
        for row in rows:
            item = dict(row)
            item["question"] = json.loads(item.pop("question_json"))
            item["is_demo"] = bool(item["is_demo"])
            items.append(item)
        return items

    def get_record(self, question_id: str) -> Optional[dict]:
        with self.db._connect() as conn:
            row = self.db._execute(
                conn,
                "SELECT * FROM generated_question_records WHERE id=?",
                (question_id,),
            ).fetchone()
        if not row:
            return None
        item = dict(row)
        item["question"] = json.loads(item.pop("question_json"))
        item["is_demo"] = bool(item["is_demo"])
        item["history"] = self.history(question_id)
        return item

    def history(self, question_id: str) -> list[dict]:
        with self.db._connect() as conn:
            rows = self.db._execute(
                conn,
                """SELECT h.id, h.action, h.review_target, h.comment, h.before_json, h.after_json,
                          h.created_at, h.reviewer_user_id, u.full_name AS reviewer_name
                   FROM question_review_history h
                   LEFT JOIN users u ON u.id=h.reviewer_user_id
                   WHERE h.question_id=? ORDER BY h.created_at ASC, h.id ASC""",
                (question_id,),
            ).fetchall()
        return [
            {
                **dict(row),
                "before": json.loads(row["before_json"]),
                "after": json.loads(row["after_json"]),
            }
            for row in rows
        ]

    def review(
        self,
        question_id: str,
        *,
        reviewer_user_id: int,
        reviewer_name: str,
        action: str,
        review_target: str = "both",
        comment: str = "",
        edits: Optional[dict] = None,
    ) -> dict:
        if action not in VALID_ACTIONS:
            raise ValueError("Use approve, edit, reject, or verify.")
        if review_target not in {"question", "marking_scheme", "both"}:
            raise ValueError("Review target must be question, marking_scheme, or both.")
        with self.db._connect() as conn:
            row = self.db._execute(
                conn,
                "SELECT question_json, review_status, version FROM generated_question_records WHERE id=?",
                (question_id,),
            ).fetchone()
            if not row:
                raise LookupError("Question not found.")

            before = json.loads(row["question_json"])
            after = json.loads(row["question_json"])
            safe_edits = edits or {}
            if action == "edit":
                allowed = {"question_text", "options", "correct_answer", "explanation", "marking_scheme", "difficulty_level"}
                changed = False
                for key in allowed:
                    if key in safe_edits and safe_edits[key] is not None:
                        after[key] = safe_edits[key]
                        changed = True
                if not changed:
                    raise ValueError("An edit action requires at least one changed field.")
                new_status = "pending_teacher_review"
            else:
                new_status = {
                    "approve": "approved",
                    "reject": "rejected",
                    "verify": "verified",
                }[action]

            after["review_status"] = new_status
            after["teacher_verified"] = new_status == "verified"
            after["verified_by"] = reviewer_name if new_status == "verified" else None
            after["verified_at"] = self.now() if new_status == "verified" else None
            evidence = after.setdefault("evidence", {})
            evidence["verification_status"] = new_status
            now = self.now()
            version = int(row["version"]) + 1
            self.db._execute(
                conn,
                """UPDATE generated_question_records
                   SET question_json=?, review_status=?, version=?, updated_at=?
                   WHERE id=?""",
                (json.dumps(after), new_status, version, now, question_id),
            )
            self.db._execute(
                conn,
                """INSERT INTO question_review_history
                   (question_id, reviewer_user_id, action, review_target, comment, before_json, after_json, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    question_id,
                    reviewer_user_id,
                    action,
                    review_target,
                    comment[:1000],
                    json.dumps(before),
                    json.dumps(after),
                    now,
                ),
            )
        return self.get_record(question_id) or {}


teacher_verification_service = TeacherVerificationService()
