from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.models import AuthUser
from app.routes.auth import get_current_user
from app.services.teacher_verification import teacher_verification_service

router = APIRouter()


class ReviewBody(BaseModel):
    action: str
    review_target: str = "both"
    comment: str = Field(default="", max_length=1000)
    question_text: Optional[str] = None
    options: Optional[list[str]] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    marking_scheme: Optional[str] = None
    difficulty_level: Optional[str] = None


def require_teacher(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    if not (user.is_teacher or user.is_admin):
        raise HTTPException(status_code=403, detail="Authorised teacher access required.")
    return user


@router.get("/questions")
async def review_queue(
    status: Optional[str] = None,
    limit: int = 100,
    teacher: AuthUser = Depends(require_teacher),
):
    return {"questions": teacher_verification_service.list_queue(status=status, limit=limit)}


@router.get("/questions/{question_id}")
async def review_detail(question_id: str, teacher: AuthUser = Depends(require_teacher)):
    record = teacher_verification_service.get_record(question_id)
    if not record:
        raise HTTPException(status_code=404, detail="Question not found.")
    return record


@router.post("/questions/{question_id}/review")
async def review_question(
    question_id: str,
    body: ReviewBody,
    teacher: AuthUser = Depends(require_teacher),
):
    try:
        return teacher_verification_service.review(
            question_id,
            reviewer_user_id=teacher.id,
            reviewer_name=teacher.full_name,
            action=body.action,
            review_target=body.review_target,
            comment=body.comment,
            edits=body.model_dump(exclude={"action", "review_target", "comment"}, exclude_none=True),
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
