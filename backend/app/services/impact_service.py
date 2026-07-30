from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

from app.services.auth_service import AuthService


def calculate_score_changes(rows: Iterable[dict]) -> dict:
    grouped: dict[tuple[int, str], list[dict]] = defaultdict(list)
    for row in rows:
        grouped[(int(row["user_id"]), str(row["subject"]))].append(dict(row))
    deltas = []
    for attempts in grouped.values():
        attempts.sort(key=lambda item: (str(item["created_at"]), int(item.get("id") or 0)))
        if len(attempts) >= 2:
            deltas.append(float(attempts[-1]["percentage"] or 0) - float(attempts[0]["percentage"] or 0))
    return {
        "average_percentage_point_change": round(sum(deltas) / len(deltas), 1) if deltas else 0.0,
        "learners_improved": sum(1 for delta in deltas if delta > 0),
        "learners_declined": sum(1 for delta in deltas if delta < 0),
        "learner_subject_comparisons": len(deltas),
    }


class ImpactService:
    def __init__(self, db: Optional[AuthService] = None) -> None:
        self.db = db or AuthService()

    def snapshot(self) -> dict:
        active_cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        with self.db._connect() as conn:
            registered = self.db._execute(
                conn,
                "SELECT COUNT(*) AS count FROM users WHERE is_admin=0 AND is_teacher=0",
            ).fetchone()["count"]
            active = self.db._execute(
                conn,
                """SELECT COUNT(*) AS count FROM users
                   WHERE is_admin=0 AND last_login_at>=?""",
                (active_cutoff,),
            ).fetchone()["count"]
            questions = self.db._execute(
                conn,
                "SELECT COUNT(*) AS count FROM generated_question_records WHERE is_demo=0",
            ).fetchone()["count"]
            practice = self.db._execute(
                conn,
                """SELECT COUNT(*) AS count FROM exam_history
                   WHERE LOWER(exam_type)='practice'""",
            ).fetchone()["count"]
            mocks = self.db._execute(
                conn,
                "SELECT COUNT(*) AS count FROM mock_attempts",
            ).fetchone()["count"]
            verified = self.db._execute(
                conn,
                """SELECT COUNT(*) AS count FROM generated_question_records
                   WHERE is_demo=0 AND review_status='verified'""",
            ).fetchone()["count"]
            score_rows = self.db._execute(
                conn,
                """SELECT id, user_id, subject, percentage, created_at
                   FROM exam_history ORDER BY user_id, subject, created_at, id""",
            ).fetchall()

        score_change = calculate_score_changes(dict(row) for row in score_rows)
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "metrics": {
                "registered_students": int(registered),
                "active_users_30d": int(active),
                "questions_generated": int(questions),
                "practice_sessions_completed": int(practice),
                "mock_examinations_completed": int(mocks),
                "teacher_verified_questions": int(verified),
            },
            "score_change": score_change,
            "definitions": {
                "registered_students": "Non-administrator, non-teacher accounts stored in users.",
                "active_users_30d": "Non-administrator accounts whose last login is within 30 days.",
                "questions_generated": "Persisted production generated-question records; demo records excluded.",
                "practice_sessions_completed": "Stored exam-history rows whose type is Practice.",
                "mock_examinations_completed": "Stored completed mock-attempt rows.",
                "teacher_verified_questions": "Production generated questions with verified review status.",
                "score_change": "Latest minus earliest stored percentage for each learner-subject pair with at least two results.",
            },
            "data_status": "live_database",
        }


impact_service = ImpactService()
