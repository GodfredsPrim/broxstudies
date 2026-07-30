import pytest
from fastapi import HTTPException

from app.models import AuthUser, Question, QuestionType, Subject
from app.routes.teacher import require_teacher
from app.services.teacher_verification import TeacherVerificationService


class MemoryDb:
    is_postgres = False

    def __init__(self, path):
        import sqlite3
        self.path = path
        with self._connect() as conn:
            conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, full_name TEXT)")
            conn.execute("INSERT INTO users (id, full_name) VALUES (7, 'Ama Teacher')")

    def _connect(self):
        import sqlite3
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def _execute(self, conn, query, params=()):
        return conn.execute(query, params)


def sample_question():
    return Question(
        subject=Subject.SCIENCE,
        question_type=QuestionType.SHORT_ANSWER,
        question_text="State one observation.",
        correct_answer="A colour change.",
        explanation="An observable change is expected.",
        marking_scheme="One mark for a valid observation.",
        difficulty_level="medium",
        year_generated=2026,
        pattern_confidence=0.8,
    )


def test_teacher_edit_verify_and_history(tmp_path):
    service = TeacherVerificationService(MemoryDb(tmp_path / "review.db"))
    question = service.record_questions([sample_question()], owner_user_id=None)[0]
    edited = service.review(
        question.id,
        reviewer_user_id=7,
        reviewer_name="Ama Teacher",
        action="edit",
        edits={"question_text": "State two observations.", "marking_scheme": "One mark per valid observation."},
    )
    assert edited["question"]["question_text"] == "State two observations."
    assert edited["review_status"] == "pending_teacher_review"
    verified = service.review(
        question.id,
        reviewer_user_id=7,
        reviewer_name="Ama Teacher",
        action="verify",
        review_target="both",
        comment="Curriculum and marking scheme checked.",
    )
    assert verified["review_status"] == "verified"
    assert verified["question"]["teacher_verified"] is True
    assert verified["question"]["verified_by"] == "Ama Teacher"
    assert [event["action"] for event in verified["history"]] == ["edit", "verify"]


def test_invalid_review_action_is_rejected(tmp_path):
    service = TeacherVerificationService(MemoryDb(tmp_path / "review.db"))
    question = service.record_questions([sample_question()], owner_user_id=None)[0]
    with pytest.raises(ValueError):
        service.review(
            question.id,
            reviewer_user_id=7,
            reviewer_name="Ama Teacher",
            action="publish",
        )


def test_teacher_permission_is_enforced_in_backend():
    student = AuthUser(id=1, full_name="Student", email="s@example.com", provider="email")
    with pytest.raises(HTTPException) as exc:
        require_teacher(student)
    assert exc.value.status_code == 403

    teacher = student.model_copy(update={"is_teacher": True})
    assert require_teacher(teacher).id == student.id
