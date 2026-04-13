from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, field_validator


class QuestionType(str, Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    SHORT_ANSWER = "short_answer"
    ESSAY = "essay"
    TRUE_FALSE = "true_false"
    STANDARD = "standard"


class Subject(str, Enum):
    MATHEMATICS = "mathematics"
    ENGLISH = "english"
    SCIENCE = "science"
    SOCIAL_STUDIES = "social_studies"
    ICT = "ict"
    ELECTIVES = "electives"


SUBJECT_ALIASES = {
    "core_mathematics": Subject.MATHEMATICS.value,
    "mathematics": Subject.MATHEMATICS.value,
    "additional_mathematics": Subject.MATHEMATICS.value,
    "english_language": Subject.ENGLISH.value,
    "english": Subject.ENGLISH.value,
    "literature-in-english": Subject.ENGLISH.value,
    "literature_in_english": Subject.ENGLISH.value,
    "integrated_science": Subject.SCIENCE.value,
    "science": Subject.SCIENCE.value,
    "physics": Subject.SCIENCE.value,
    "chemistry_note": Subject.SCIENCE.value,
    "chemistry": Subject.SCIENCE.value,
    "biology": Subject.SCIENCE.value,
    "general_science": Subject.SCIENCE.value,
    "general science": Subject.SCIENCE.value,
    "social_studies": Subject.SOCIAL_STUDIES.value,
    "history": Subject.SOCIAL_STUDIES.value,
    "government": Subject.SOCIAL_STUDIES.value,
    "economics": Subject.SOCIAL_STUDIES.value,
    "geography_note": Subject.SOCIAL_STUDIES.value,
    "geography": Subject.SOCIAL_STUDIES.value,
    "social studies": Subject.SOCIAL_STUDIES.value,
    "elective_ict": Subject.ICT.value,
    "ict": Subject.ICT.value,
    "computing": Subject.ICT.value,
    "design_and_communication_technology": Subject.ICT.value,
    "design and communication technology": Subject.ICT.value,
    "design_communication": Subject.ICT.value,
    "engineering": Subject.ICT.value,
    "french": Subject.ELECTIVES.value,
    "french_year_2": Subject.ELECTIVES.value,
    "arabic": Subject.ELECTIVES.value,
    "ghanaian_language": Subject.ELECTIVES.value,
    "ghanaian language": Subject.ELECTIVES.value,
    "food_nutrition": Subject.ELECTIVES.value,
    "food and nutrition": Subject.ELECTIVES.value,
    "clothing_textiles": Subject.ELECTIVES.value,
    "clothing and textiles": Subject.ELECTIVES.value,
    "management_living": Subject.ELECTIVES.value,
    "management in living": Subject.ELECTIVES.value,
    "music": Subject.ELECTIVES.value,
    "christian_studies": Subject.ELECTIVES.value,
    "islamic_religious_studies": Subject.ELECTIVES.value,
    "islamic studies": Subject.ELECTIVES.value,
    "electives": Subject.ELECTIVES.value,
    # Additional textbook subjects
    "accounting": Subject.ELECTIVES.value,
    "agriculture_science": Subject.SCIENCE.value,
    "agriculture science": Subject.SCIENCE.value,
    "art_and_design": Subject.ELECTIVES.value,
    "art and design": Subject.ELECTIVES.value,
    "aviation_aerospace": Subject.ELECTIVES.value,
    "aviation and aerospace": Subject.ELECTIVES.value,
    "business_management": Subject.ELECTIVES.value,
    "business management": Subject.ELECTIVES.value,
    "core_peh": Subject.ELECTIVES.value,
    "elective_physical_education": Subject.ELECTIVES.value,
    "electronics_technology": Subject.ICT.value,
    "electronics and electrons technology": Subject.ICT.value,
    "performing_art": Subject.ELECTIVES.value,
    "performing art": Subject.ELECTIVES.value,
    "robotics": Subject.ICT.value,
    "rme": Subject.ELECTIVES.value,
    "spanish": Subject.ELECTIVES.value,
    "woodwork_technology": Subject.ICT.value,
}


def normalize_subject_value(value):
    if isinstance(value, Subject):
        return value
    if value is None:
        return value

    normalized = str(value).strip().lower()
    return SUBJECT_ALIASES.get(normalized, normalized)


class PDFUpload(BaseModel):
    filename: str
    file_type: str  # "syllabus", "past_question", "textbook"
    subject: Subject
    uploaded_at: datetime = None
    file_path: str = None

    @field_validator("subject", mode="before")
    @classmethod
    def validate_subject(cls, value):
        return normalize_subject_value(value)


class Question(BaseModel):
    id: Optional[str] = None
    subject: Subject
    question_type: QuestionType
    question_text: str
    options: Optional[List[str]] = None
    correct_answer: str
    explanation: str
    difficulty_level: str  # easy, medium, hard
    year_generated: int
    pattern_confidence: float


class QuestionGenerationRequest(BaseModel):
    subject: str
    year: Optional[str] = None
    student_id: Optional[str] = None
    question_type: QuestionType
    num_questions: int = 5
    difficulty_level: Optional[str] = None
    topics: Optional[List[str]] = None

    @field_validator("subject", mode="before")
    @classmethod
    def validate_subject(cls, value):
        if isinstance(value, str) and ":" in value:
            return value.strip().lower()
        normalized = normalize_subject_value(value)
        return str(normalized)


class AnalysisResult(BaseModel):
    subject: Subject
    total_past_questions_analyzed: int
    common_topics: List[str]
    question_patterns: dict
    difficulty_distribution: dict
    topic_frequency: dict


class GeneratedQuestions(BaseModel):
    questions: List[Question]
    generation_time: float
    model_used: str
    source_used: Optional[str] = None
    source_details: Optional[dict] = None


class PracticeMarkItem(BaseModel):
    question_text: str
    question_type: QuestionType
    correct_answer: str
    explanation: Optional[str] = ""
    options: Optional[List[str]] = None
    student_answer: str


class PracticeMarkRequest(BaseModel):
    student_id: Optional[str] = None
    subject: Optional[str] = None
    items: List[PracticeMarkItem]


class PracticeMarkResult(BaseModel):
    index: int
    score: float
    is_correct: bool
    feedback: str
    expected_answer: str
    student_answer: str


class PracticeMarkResponse(BaseModel):
    total_questions: int
    score_obtained: float
    percentage: float
    results: List[PracticeMarkResult]


class LiveQuizCreateRequest(BaseModel):
    player_name: str
    subject: str
    year: Optional[str] = None
    question_type: QuestionType = QuestionType.MULTIPLE_CHOICE
    num_questions: int = 5
    difficulty_level: Optional[str] = "medium"


class LiveQuizCreateResponse(BaseModel):
    code: str
    host_player: str
    total_questions: int


class LiveQuizJoinRequest(BaseModel):
    code: str
    player_name: str


class LiveQuizSubmitRequest(BaseModel):
    player_name: str
    answers: List[str]
