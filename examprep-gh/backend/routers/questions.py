"""
Questions Router — generate and retrieve exam questions.
"""

from fastapi import APIRouter, HTTPException
from models.schemas import GenerateRequest, Question
from services.question_generator import generate_questions
from typing import List

router = APIRouter(tags=["Questions"])


@router.post("/generate", response_model=List[Question])
async def generate(req: GenerateRequest):
    """Generate AI-powered exam questions based on subject, topic, and format."""
    try:
        questions = generate_questions(
            subject=req.subject,
            topic=req.topic,
            fmt=req.format,
            num_questions=req.num_questions,
        )
        return questions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subjects")
async def list_subjects():
    """Return the available SHS subjects grouped by category."""
    return {
        "core": [
            {"name": "English Language", "code": "ENG"},
            {"name": "Mathematics (Core)", "code": "CMATH"},
            {"name": "Integrated Science", "code": "ISCI"},
            {"name": "Social Studies", "code": "SSCI"},
        ],
        "elective": [
            {"name": "Elective Mathematics", "code": "EMATH"},
            {"name": "Physics", "code": "PHY"},
            {"name": "Chemistry", "code": "CHEM"},
            {"name": "Biology", "code": "BIO"},
            {"name": "Economics", "code": "ECON"},
            {"name": "Geography", "code": "GEO"},
            {"name": "Government", "code": "GOV"},
            {"name": "History", "code": "HIST"},
            {"name": "Literature in English", "code": "LIT"},
            {"name": "French", "code": "FRE"},
            {"name": "Accounting", "code": "ACC"},
            {"name": "Business Management", "code": "BUS"},
            {"name": "ICT", "code": "ICT"},
        ],
    }
