from app.models import Question, QuestionType, Subject
from app.services.question_evidence import ACADEMIC_DISCLAIMER, attach_question_evidence


def test_evidence_is_complete_and_honest():
    question = Question(
        subject=Subject.MATHEMATICS,
        question_type=QuestionType.MULTIPLE_CHOICE,
        question_text="Solve the algebraic equation 2x + 4 = 10.",
        options=["1", "2", "3", "4"],
        correct_answer="3",
        explanation="Subtract 4 and divide by 2.",
        difficulty_level="medium",
        year_generated=2026,
        pattern_confidence=0.88,
    )

    enriched = attach_question_evidence(
        [question],
        subject_label="Core Mathematics",
        topics=["Linear equations"],
        source_used="textbook_guided",
    )[0].evidence

    assert enriched.curriculum_strand == "Algebra and number"
    assert enriched.curriculum_sub_strand == "Linear equations"
    assert enriched.learning_outcome
    assert enriched.source_document
    assert enriched.source_excerpt
    assert enriched.historical_exam_pattern
    assert enriched.question_difficulty == "medium"
    assert enriched.marks == 1
    assert enriched.confidence_explanation
    assert enriched.verification_status == "pending_teacher_review"
    assert enriched.academic_disclaimer == ACADEMIC_DISCLAIMER
    assert "leaked or guaranteed" in enriched.academic_disclaimer


def test_default_question_always_has_evidence_contract():
    question = Question(
        subject=Subject.ENGLISH,
        question_type=QuestionType.ESSAY,
        question_text="Write an essay.",
        correct_answer="See marking scheme",
        explanation="Assess content and expression.",
        difficulty_level="standard",
        year_generated=2026,
        pattern_confidence=0.5,
    )
    assert question.evidence.academic_disclaimer
    assert question.evidence.verification_status == "unverified"
