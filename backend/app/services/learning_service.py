import json
import secrets
from datetime import date, datetime, timedelta, timezone

from app.services.auth_service import AuthService


class LearningService:
    def __init__(self) -> None:
        self.db = AuthService()
        self._ensure_tables()

    def _ensure_tables(self) -> None:
        with self.db._connect() as conn:
            id_type = "SERIAL PRIMARY KEY" if self.db.is_postgres else "INTEGER PRIMARY KEY AUTOINCREMENT"
            statements = [
                f"""CREATE TABLE IF NOT EXISTS learning_profiles (
                    user_id INTEGER PRIMARY KEY, exam_date TEXT, target_grade TEXT NOT NULL DEFAULT 'A1',
                    daily_minutes INTEGER NOT NULL DEFAULT 45, subjects_json TEXT NOT NULL DEFAULT '[]',
                    updated_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)""",
                f"""CREATE TABLE IF NOT EXISTS topic_mastery (
                    id {id_type}, user_id INTEGER NOT NULL, subject TEXT NOT NULL, topic TEXT NOT NULL,
                    correct_count INTEGER NOT NULL DEFAULT 0, attempt_count INTEGER NOT NULL DEFAULT 0,
                    mastery_score INTEGER NOT NULL DEFAULT 0, next_review_at TEXT, updated_at TEXT NOT NULL,
                    UNIQUE(user_id, subject, topic), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)""",
                f"""CREATE TABLE IF NOT EXISTS study_plan_items (
                    id {id_type}, user_id INTEGER NOT NULL, plan_date TEXT NOT NULL, subject TEXT NOT NULL,
                    topic TEXT NOT NULL, minutes INTEGER NOT NULL DEFAULT 30, activity TEXT NOT NULL,
                    completed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)""",
                f"""CREATE TABLE IF NOT EXISTS mock_attempts (
                    id {id_type}, user_id INTEGER NOT NULL, subject TEXT NOT NULL, exam_type TEXT NOT NULL,
                    total_questions INTEGER NOT NULL, correct_answers INTEGER NOT NULL, percentage INTEGER NOT NULL,
                    duration_minutes INTEGER NOT NULL, created_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)""",
                f"""CREATE TABLE IF NOT EXISTS learning_feedback (
                    id {id_type}, user_id INTEGER NOT NULL, feature TEXT NOT NULL, reference_id TEXT,
                    rating TEXT NOT NULL, details TEXT, created_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)""",
                f"""CREATE TABLE IF NOT EXISTS teacher_classes (
                    id {id_type}, teacher_id INTEGER NOT NULL, name TEXT NOT NULL, join_code TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL, FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE)""",
                f"""CREATE TABLE IF NOT EXISTS class_members (
                    class_id INTEGER NOT NULL, user_id INTEGER NOT NULL, joined_at TEXT NOT NULL,
                    PRIMARY KEY(class_id, user_id), FOREIGN KEY (class_id) REFERENCES teacher_classes(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)""",
                f"""CREATE TABLE IF NOT EXISTS social_reports (
                    id {id_type}, post_id INTEGER NOT NULL, reporter_id INTEGER NOT NULL, reason TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL,
                    UNIQUE(post_id, reporter_id), FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE)""",
                f"""CREATE TABLE IF NOT EXISTS social_blocks (
                    blocker_id INTEGER NOT NULL, blocked_id INTEGER NOT NULL, created_at TEXT NOT NULL,
                    PRIMARY KEY(blocker_id, blocked_id))""",
                f"""CREATE TABLE IF NOT EXISTS review_cards (
                    id {id_type}, user_id INTEGER NOT NULL, subject TEXT NOT NULL, front TEXT NOT NULL,
                    back TEXT NOT NULL, source TEXT, interval_days INTEGER NOT NULL DEFAULT 0,
                    ease REAL NOT NULL DEFAULT 2.5, next_review_at TEXT NOT NULL, last_reviewed_at TEXT,
                    created_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)""",
                f"""CREATE TABLE IF NOT EXISTS class_assignments (
                    id {id_type}, class_id INTEGER NOT NULL, title TEXT NOT NULL, subject TEXT NOT NULL,
                    instructions TEXT, due_at TEXT, created_at TEXT NOT NULL,
                    FOREIGN KEY (class_id) REFERENCES teacher_classes(id) ON DELETE CASCADE)""",
                f"""CREATE TABLE IF NOT EXISTS assignment_completions (
                    assignment_id INTEGER NOT NULL, user_id INTEGER NOT NULL, score INTEGER,
                    completed_at TEXT NOT NULL, PRIMARY KEY(assignment_id, user_id),
                    FOREIGN KEY (assignment_id) REFERENCES class_assignments(id) ON DELETE CASCADE)""",
                f"""CREATE TABLE IF NOT EXISTS moderation_appeals (
                    id {id_type}, user_id INTEGER NOT NULL, event_type TEXT NOT NULL, details TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL)""",
                f"""CREATE TABLE IF NOT EXISTS push_subscriptions (
                    id {id_type}, user_id INTEGER NOT NULL, endpoint TEXT NOT NULL UNIQUE,
                    p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)""",
            ]
            for statement in statements:
                self.db._execute(conn, statement)

    @staticmethod
    def now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def profile(self, user_id: int) -> dict:
        with self.db._connect() as conn:
            row = self.db._execute(conn, "SELECT * FROM learning_profiles WHERE user_id = ?", (user_id,)).fetchone()
        if not row:
            return {"exam_date": None, "target_grade": "A1", "daily_minutes": 45, "subjects": []}
        item = dict(row)
        item["subjects"] = json.loads(item.pop("subjects_json") or "[]")
        return item

    def save_profile(self, user_id: int, data: dict) -> dict:
        now = self.now()
        with self.db._connect() as conn:
            self.db._execute(conn, """INSERT INTO learning_profiles (user_id, exam_date, target_grade, daily_minutes, subjects_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET exam_date=excluded.exam_date,
                target_grade=excluded.target_grade, daily_minutes=excluded.daily_minutes, subjects_json=excluded.subjects_json,
                updated_at=excluded.updated_at""", (user_id, data.get("exam_date"), data.get("target_grade", "A1"), max(15, min(240, data.get("daily_minutes", 45))), json.dumps(data.get("subjects", [])), now))
        return self.profile(user_id)

    def record_mastery(self, user_id: int, subject: str, topic: str, correct: int, total: int) -> dict:
        correct, total = max(0, correct), max(1, total)
        with self.db._connect() as conn:
            row = self.db._execute(conn, "SELECT correct_count, attempt_count FROM topic_mastery WHERE user_id=? AND subject=? AND topic=?", (user_id, subject, topic)).fetchone()
            old_correct, old_total = (int(row["correct_count"]), int(row["attempt_count"])) if row else (0, 0)
            new_correct, new_total = old_correct + min(correct, total), old_total + total
            score = round(new_correct / new_total * 100)
            interval = 14 if score >= 80 else 5 if score >= 55 else 1
            next_review = (datetime.now(timezone.utc) + timedelta(days=interval)).isoformat()
            self.db._execute(conn, """INSERT INTO topic_mastery (user_id, subject, topic, correct_count, attempt_count, mastery_score, next_review_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, subject, topic) DO UPDATE SET
                correct_count=excluded.correct_count, attempt_count=excluded.attempt_count, mastery_score=excluded.mastery_score,
                next_review_at=excluded.next_review_at, updated_at=excluded.updated_at""", (user_id, subject, topic, new_correct, new_total, score, next_review, self.now()))
        return {"subject": subject, "topic": topic, "mastery_score": score, "correct_count": new_correct, "attempt_count": new_total, "next_review_at": next_review, "status": "mastered" if score >= 80 else "developing" if score >= 55 else "needs_revision"}

    def mastery(self, user_id: int) -> list[dict]:
        with self.db._connect() as conn:
            rows = self.db._execute(conn, "SELECT subject, topic, correct_count, attempt_count, mastery_score, next_review_at, updated_at FROM topic_mastery WHERE user_id=? ORDER BY mastery_score ASC, updated_at DESC", (user_id,)).fetchall()
        return [{**dict(row), "status": "mastered" if row["mastery_score"] >= 80 else "developing" if row["mastery_score"] >= 55 else "needs_revision"} for row in rows]

    def generate_plan(self, user_id: int) -> list[dict]:
        profile = self.profile(user_id)
        mastery = self.mastery(user_id)
        weak = mastery[:5]
        subjects = profile.get("subjects") or [item["subject"] for item in weak] or ["Core Mathematics", "English Language", "Integrated Science"]
        today, now = date.today(), self.now()
        with self.db._connect() as conn:
            missed = self.db._execute(conn, "SELECT subject, topic FROM study_plan_items WHERE user_id=? AND plan_date<? AND completed=0 ORDER BY plan_date LIMIT 5", (user_id, today.isoformat())).fetchall()
            self.db._execute(conn, "DELETE FROM study_plan_items WHERE user_id=? AND plan_date>=?", (user_id, today.isoformat()))
            for offset in range(7):
                carried = dict(missed[offset]) if offset < len(missed) else None
                item = carried or (weak[offset % len(weak)] if weak else None)
                subject = item["subject"] if item else subjects[offset % len(subjects)]
                topic = item["topic"] if item else "Diagnostic practice"
                activity = "Catch-up session" if carried else ("Spaced review" if item and item.get("next_review_at") and item["next_review_at"][:10] <= (today + timedelta(days=offset)).isoformat() else "Targeted practice")
                self.db._execute(conn, "INSERT INTO study_plan_items (user_id, plan_date, subject, topic, minutes, activity, completed, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)", (user_id, (today + timedelta(days=offset)).isoformat(), subject, topic, profile.get("daily_minutes", 45), activity, now))
        return self.plan(user_id)

    def plan(self, user_id: int) -> list[dict]:
        with self.db._connect() as conn:
            rows = self.db._execute(conn, "SELECT id, plan_date, subject, topic, minutes, activity, completed FROM study_plan_items WHERE user_id=? AND plan_date>=? ORDER BY plan_date, id LIMIT 30", (user_id, date.today().isoformat())).fetchall()
        return [{**dict(row), "completed": bool(row["completed"])} for row in rows]

    def complete_plan_item(self, user_id: int, item_id: int) -> bool:
        with self.db._connect() as conn:
            cursor = self.db._execute(conn, "UPDATE study_plan_items SET completed=1 WHERE id=? AND user_id=?", (item_id, user_id))
            return cursor.rowcount > 0

    def save_mock(self, user_id: int, data: dict) -> dict:
        total = max(1, int(data["total_questions"])); correct = max(0, min(total, int(data["correct_answers"])))
        percentage = round(correct / total * 100)
        with self.db._connect() as conn:
            query = "INSERT INTO mock_attempts (user_id, subject, exam_type, total_questions, correct_answers, percentage, duration_minutes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            if self.db.is_postgres: query += " RETURNING id"
            cursor = self.db._execute(conn, query, (user_id, data["subject"], data.get("exam_type", "WASSCE"), total, correct, percentage, max(1, int(data.get("duration_minutes", 1))), self.now()))
            attempt_id = cursor.fetchone()["id"] if self.db.is_postgres else cursor.lastrowid
        self.record_mastery(user_id, data["subject"], data.get("topic", "Full mock"), correct, total)
        return {"id": attempt_id, "percentage": percentage, "predicted_grade": "A1" if percentage >= 80 else "B2" if percentage >= 70 else "B3" if percentage >= 60 else "C" if percentage >= 50 else "Needs revision"}

    def report_post(self, reporter_id: int, post_id: int, reason: str) -> None:
        with self.db._connect() as conn:
            self.db._execute(conn, "INSERT INTO social_reports (post_id, reporter_id, reason, status, created_at) VALUES (?, ?, ?, 'pending', ?) ON CONFLICT(post_id, reporter_id) DO UPDATE SET reason=excluded.reason, status='pending'", (post_id, reporter_id, reason, self.now()))

    def block_user(self, blocker_id: int, blocked_id: int) -> None:
        if blocker_id == blocked_id: return
        with self.db._connect() as conn:
            self.db._execute(conn, "INSERT INTO social_blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?) ON CONFLICT(blocker_id, blocked_id) DO NOTHING", (blocker_id, blocked_id, self.now()))

    def save_review_cards(self, user_id: int, subject: str, cards: list[dict]) -> list[dict]:
        now = self.now()
        with self.db._connect() as conn:
            for card in cards[:100]:
                front, back = str(card.get("front", "")).strip(), str(card.get("back", "")).strip()
                if front and back:
                    self.db._execute(conn, "INSERT INTO review_cards (user_id, subject, front, back, source, next_review_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", (user_id, subject[:100], front[:2000], back[:4000], str(card.get("source", ""))[:300], now, now))
        return self.due_review_cards(user_id)

    def due_review_cards(self, user_id: int, limit: int = 30) -> list[dict]:
        with self.db._connect() as conn:
            rows = self.db._execute(conn, "SELECT id, subject, front, back, source, interval_days, ease, next_review_at FROM review_cards WHERE user_id=? AND next_review_at<=? ORDER BY next_review_at LIMIT ?", (user_id, self.now(), limit)).fetchall()
        return [dict(row) for row in rows]

    def grade_review_card(self, user_id: int, card_id: int, rating: str) -> dict | None:
        factors = {"again": (1, -0.2), "hard": (3, -0.1), "good": (2, 0.0), "easy": (3, 0.15)}
        if rating not in factors: return None
        with self.db._connect() as conn:
            row = self.db._execute(conn, "SELECT interval_days, ease FROM review_cards WHERE id=? AND user_id=?", (card_id, user_id)).fetchone()
            if not row: return None
            multiplier, ease_delta = factors[rating]
            old = int(row["interval_days"] or 0)
            interval = 1 if rating == "again" else max(1, (old or 1) * multiplier)
            ease = max(1.3, min(3.0, float(row["ease"] or 2.5) + ease_delta))
            next_at = (datetime.now(timezone.utc) + timedelta(days=interval)).isoformat()
            self.db._execute(conn, "UPDATE review_cards SET interval_days=?, ease=?, next_review_at=?, last_reviewed_at=? WHERE id=? AND user_id=?", (interval, ease, next_at, self.now(), card_id, user_id))
        return {"id": card_id, "rating": rating, "interval_days": interval, "next_review_at": next_at}

    def create_class(self, teacher_id: int, name: str) -> dict:
        code = secrets.token_hex(3).upper()
        with self.db._connect() as conn:
            query = "INSERT INTO teacher_classes (teacher_id, name, join_code, created_at) VALUES (?, ?, ?, ?)"
            if self.db.is_postgres: query += " RETURNING id"
            cur = self.db._execute(conn, query, (teacher_id, name[:120], code, self.now()))
            class_id = cur.fetchone()["id"] if self.db.is_postgres else cur.lastrowid
        return {"id": class_id, "name": name[:120], "join_code": code}

    def join_class(self, user_id: int, code: str) -> dict | None:
        with self.db._connect() as conn:
            row = self.db._execute(conn, "SELECT id, name FROM teacher_classes WHERE join_code=?", (code.strip().upper(),)).fetchone()
            if not row: return None
            self.db._execute(conn, "INSERT INTO class_members (class_id, user_id, joined_at) VALUES (?, ?, ?) ON CONFLICT(class_id,user_id) DO NOTHING", (row["id"], user_id, self.now()))
        return dict(row)

    def create_assignment(self, teacher_id: int, class_id: int, data: dict) -> dict | None:
        with self.db._connect() as conn:
            owned = self.db._execute(conn, "SELECT id FROM teacher_classes WHERE id=? AND teacher_id=?", (class_id, teacher_id)).fetchone()
            if not owned: return None
            query = "INSERT INTO class_assignments (class_id,title,subject,instructions,due_at,created_at) VALUES (?,?,?,?,?,?)"
            if self.db.is_postgres: query += " RETURNING id"
            cur = self.db._execute(conn, query, (class_id, data["title"][:160], data["subject"][:100], data.get("instructions", "")[:2000], data.get("due_at"), self.now()))
            assignment_id = cur.fetchone()["id"] if self.db.is_postgres else cur.lastrowid
        return {"id": assignment_id, "class_id": class_id, **data}

    def classes_and_assignments(self, user_id: int, teacher: bool = False) -> list[dict]:
        with self.db._connect() as conn:
            if teacher:
                classes = self.db._execute(conn, "SELECT id,name,join_code FROM teacher_classes WHERE teacher_id=? ORDER BY id DESC", (user_id,)).fetchall()
            else:
                classes = self.db._execute(conn, "SELECT c.id,c.name,c.join_code FROM teacher_classes c JOIN class_members m ON m.class_id=c.id WHERE m.user_id=? ORDER BY c.id DESC", (user_id,)).fetchall()
            result=[]
            for item in classes:
                value=dict(item)
                value["assignments"]=[dict(row) for row in self.db._execute(conn, "SELECT id,title,subject,instructions,due_at FROM class_assignments WHERE class_id=? ORDER BY due_at,id DESC", (item["id"],)).fetchall()]
                result.append(value)
        return result

    def moderation_reports(self) -> list[dict]:
        with self.db._connect() as conn:
            rows=self.db._execute(conn, "SELECT id,post_id,reporter_id,reason,status,created_at FROM social_reports ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,id DESC LIMIT 100").fetchall()
        return [dict(row) for row in rows]

    def resolve_report(self, report_id: int, status: str) -> bool:
        with self.db._connect() as conn:
            return self.db._execute(conn, "UPDATE social_reports SET status=? WHERE id=?", (status, report_id)).rowcount > 0

    def save_push_subscription(self, user_id: int, subscription: dict) -> None:
        keys = subscription.get("keys") or {}
        with self.db._connect() as conn:
            self.db._execute(conn, "INSERT INTO push_subscriptions (user_id,endpoint,p256dh,auth,created_at) VALUES (?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth", (user_id, subscription["endpoint"], keys["p256dh"], keys["auth"], self.now()))

    def teacher_snapshot(self, teacher_id: int) -> dict:
        with self.db._connect() as conn:
            rows = self.db._execute(conn, """SELECT tm.subject, tm.topic, AVG(tm.mastery_score) AS average_mastery, COUNT(DISTINCT tm.user_id) AS learners
                FROM topic_mastery tm GROUP BY tm.subject, tm.topic ORDER BY average_mastery ASC LIMIT 30""").fetchall()
            reports = self.db._execute(conn, "SELECT COUNT(*) AS count FROM social_reports WHERE status='pending'").fetchone()
        return {"topic_snapshot": [dict(row) for row in rows], "pending_reports": int(reports["count"] or 0)}


learning_service = LearningService()
