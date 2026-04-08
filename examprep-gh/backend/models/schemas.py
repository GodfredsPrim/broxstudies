"""
Pydantic models for BisaME Osuani — Ghana SHS Exam Prep
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum
import uuid


# ── Enums ──────────────────────────────────────────────────────────────

class SubjectCategory(str, Enum):
    CORE = "core"
    ELECTIVE = "elective"


class QuestionFormat(str, Enum):
    MCQ = "MCQ"
    ESSAY = "Essay"
    MOCK_EXAM = "MockExam"


class UserPlan(str, Enum):
    FREE = "free"
    PREMIUM = "premium"


# ── Core Schemas ───────────────────────────────────────────────────────

class Subject(BaseModel):
    name: str = Field(..., example="Mathematics")
    code: str = Field(..., example="MATH101")
    category: SubjectCategory


class GenerateRequest(BaseModel):
    subject: str = Field(..., example="Mathematics")
    topic: str = Field(..., example="Algebra")
    format: QuestionFormat = QuestionFormat.MCQ
    num_questions: int = Field(default=5, ge=1, le=50)


class Question(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    options: List[str] = Field(default_factory=list)
    answer: str
    explanation: str = ""
    topic: str = ""
    subject: str = ""
    confidence_score: float = Field(default=0.0, ge=0.0, le=1.0)
    format: QuestionFormat = QuestionFormat.MCQ


class IngestRequest(BaseModel):
    file_path: str
    subject: str
    topic: str


class User(BaseModel):
    email: str
    full_name: str
    plan: UserPlan = UserPlan.FREE
