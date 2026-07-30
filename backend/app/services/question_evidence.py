import re
from pathlib import Path
from typing import Iterable, Optional

from app.models import Question, QuestionEvidence, QuestionType


ACADEMIC_DISCLAIMER = (
    "This is an independently generated study question, not a leaked or guaranteed examination question. "
    "Learners should verify it against official curriculum and examination materials."
)

STRAND_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Algebra and number", ("algebra", "equation", "ratio", "percentage", "factor", "number")),
    ("Geometry and measurement", ("angle", "circle", "triangle", "area", "volume", "length")),
    ("Statistics and probability", ("statistics", "probability", "mean", "median", "graph", "frequency")),
    ("Language and literacy", ("passage", "grammar", "essay", "summary", "vocabulary", "comprehension")),
    ("Scientific inquiry", ("experiment", "hypothesis", "observation", "reaction", "force", "energy")),
    ("Civic and social development", ("government", "citizen", "economy", "history", "society", "policy")),
    ("Digital literacy", ("computer", "network", "database", "algorithm", "program", "coding")),
)


def _clean_label(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("_", " ")).strip()


def _strand_for(question_text: str, subject_label: str, topics: Iterable[str]) -> tuple[str, str]:
    topic_list = [_clean_label(topic) for topic in topics if _clean_label(topic)]
    searchable = " ".join([question_text, subject_label, *topic_list]).lower()
    for strand, keywords in STRAND_RULES:
        match = next((keyword for keyword in keywords if keyword in searchable), None)
        if match:
            # An explicitly selected or extracted curriculum topic is stronger
            # evidence than a keyword inferred from the generated stem.
            sub_strand = topic_list[0] if topic_list else match.title()
            return strand, sub_strand
    return f"{_clean_label(subject_label) or 'Subject'} curriculum", topic_list[0] if topic_list else "General competency"


def _learning_outcome(question: Question, sub_strand: str) -> str:
    action = {
        QuestionType.MULTIPLE_CHOICE: "identify and apply",
        QuestionType.TRUE_FALSE: "distinguish accurate statements about",
        QuestionType.SHORT_ANSWER: "explain and apply",
        QuestionType.ESSAY: "analyse, organise and communicate understanding of",
        QuestionType.STANDARD: "demonstrate examination competence in",
    }.get(question.question_type, "demonstrate understanding of")
    return f"Learner can {action} {sub_strand.lower()} in a WASSCE-style task."


def _marks_for(question: Question) -> int:
    if question.question_type in {QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE}:
        return 1
    if question.question_type == QuestionType.SHORT_ANSWER:
        return 3
    subparts = len(re.findall(r"\([a-zivx]+\)", question.question_text.lower()))
    return min(20, max(5, subparts * 2 if subparts else 10))


def _source_document(source_document: Optional[str], source_used: str, subject_label: str) -> str:
    if source_document:
        return Path(source_document).name
    labels = {
        "past_questions_only": f"Historical examination archive — {_clean_label(subject_label)}",
        "textbook_only": f"Official curriculum textbook — {_clean_label(subject_label)}",
        "textbook_guided": f"Official curriculum textbook and historical paper structure — {_clean_label(subject_label)}",
        "exam_structured": f"Historical examination archive and curriculum textbooks — {_clean_label(subject_label)}",
        "ai_generated": "No retrievable source document was retained",
        "none_found": "No source document available",
    }
    return labels.get(source_used, f"Curriculum resources — {_clean_label(subject_label)}")


def build_question_evidence(
    question: Question,
    *,
    subject_label: str,
    topics: Optional[Iterable[str]] = None,
    source_used: str = "ai_generated",
    source_document: Optional[str] = None,
    source_excerpt: Optional[str] = None,
    years_scanned: Optional[int] = None,
) -> QuestionEvidence:
    strand, sub_strand = _strand_for(question.question_text, subject_label, topics or ())
    source_name = _source_document(source_document, source_used, subject_label)
    grounded = source_used not in {"ai_generated", "none_found"} or bool(source_document)
    excerpt = _clean_label(source_excerpt or "")
    if not excerpt:
        excerpt = (
            "A verbatim excerpt was not retained; consult the named source document before academic use."
            if grounded
            else "No verbatim source excerpt is available for this item."
        )
    pattern = (
        f"{question.question_type.value.replace('_', ' ').title()} structure"
        f"{f' observed across {years_scanned} historical examination years' if years_scanned else ' based on the available historical examination archive'}; "
        f"pattern confidence {round(question.pattern_confidence * 100)}%."
    )
    confidence = (
        f"{round(question.pattern_confidence * 100)}% automated pattern confidence. "
        + (
            "The item is linked to named curriculum or historical resources, but requires teacher review."
            if grounded
            else "No retrievable source document was retained, so confidence is provisional and teacher review is required."
        )
    )
    return QuestionEvidence(
        curriculum_strand=strand,
        curriculum_sub_strand=sub_strand,
        learning_outcome=_learning_outcome(question, sub_strand),
        source_document=source_name,
        source_excerpt=excerpt[:600],
        historical_exam_pattern=pattern,
        question_difficulty=question.difficulty_level,
        marks=_marks_for(question),
        confidence_explanation=confidence,
        verification_status="pending_teacher_review",
        academic_disclaimer=ACADEMIC_DISCLAIMER,
    )


def attach_question_evidence(
    questions: Iterable[Question],
    *,
    subject_label: str,
    topics: Optional[Iterable[str]] = None,
    source_used: str = "ai_generated",
) -> list[Question]:
    enriched = []
    for question in questions:
        question.evidence = build_question_evidence(
            question,
            subject_label=subject_label,
            topics=topics,
            source_used=source_used,
        )
        enriched.append(question)
    return enriched
