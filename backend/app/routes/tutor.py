from fastapi import APIRouter, Depends, Header, HTTPException
from typing import Optional

from app.models import (
    ChatHistoryResponse,
    TutorImageRequest,
    TutorRequest,
    TutorResponse,
    AuthUser,
)
from app.services.tutor_service import TutorService
from app.services.auth_service import AuthService

router = APIRouter()
tutor_service = TutorService()
auth_service = AuthService()


def _get_optional_user(authorization: Optional[str] = Header(default=None)) -> Optional[AuthUser]:
    """Returns authenticated user or None without raising an error."""
    if not authorization:
        return None
    try:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            return None
        return auth_service.get_user_from_token(token)
    except Exception:
        return None


def _get_current_user(authorization: Optional[str] = Header(default=None)) -> AuthUser:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required.")
    try:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise HTTPException(status_code=401, detail="Invalid authorization header.")
        return auth_service.get_user_from_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/ask", response_model=TutorResponse)
async def ask_tutor(
    request: TutorRequest,
    current_user: Optional[AuthUser] = Depends(_get_optional_user),
):
    """Ask the AI tutor a question for a quick explanation."""
    try:
        if not request.question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty.")

        history = []
        if request.history:
            from app.models import ChatHistoryMessage
            history = [
                ChatHistoryMessage(id=0, role=m.get("role", "user"), content=m.get("content", ""), created_at="")
                for m in request.history
            ]
        elif current_user:
            history = auth_service.get_chat_history(current_user.id, limit=10)

        result = await tutor_service.get_explanation(
            request.question,
            subject=request.subject,
            context=request.context,
            is_main_concept_only=request.is_main_concept_only,
            history=history
        )

        # Persist to chat history for authenticated users
        if current_user:
            try:
                auth_service.save_chat_message(
                    user_id=current_user.id,
                    role="user",
                    content=request.question,
                    subject=request.subject,
                )
                auth_service.save_chat_message(
                    user_id=current_user.id,
                    role="ai",
                    content=result.explanation,
                    subject=request.subject,
                )
            except Exception as hist_err:
                # History saving is non-critical — never fail the main request
                import logging
                logging.getLogger(__name__).warning("Failed to save chat history: %s", hist_err)

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/interpret-image", response_model=TutorResponse)
async def interpret_study_image(
    request: TutorImageRequest,
    current_user: Optional[AuthUser] = Depends(_get_optional_user),
):
    """Interpret a study image and explain it in a step-by-step teaching style."""
    try:
        if not request.image_base64.strip():
            raise HTTPException(status_code=400, detail="Image data is required.")

        history = []
        if request.history:
            from app.models import ChatHistoryMessage
            history = [
                ChatHistoryMessage(id=0, role=m.get("role", "user"), content=m.get("content", ""), created_at="")
                for m in request.history
            ]
        elif current_user:
            history = auth_service.get_chat_history(current_user.id, limit=10)

        result = await tutor_service.get_image_explanation(
            question=request.question,
            image_base64=request.image_base64,
            subject=request.subject,
            context=request.context,
            filename=request.filename,
            content_type=request.content_type,
            is_main_concept_only=request.is_main_concept_only,
            history=history
        )

        # Persist to chat history
        if current_user:
            try:
                label = request.question or "Interpreted an image"
                auth_service.save_chat_message(
                    user_id=current_user.id,
                    role="user",
                    content=f"[Image] {label}",
                    subject=request.subject,
                )
                auth_service.save_chat_message(
                    user_id=current_user.id,
                    role="ai",
                    content=result.explanation,
                    subject=request.subject,
                )
            except Exception as hist_err:
                import logging
                logging.getLogger(__name__).warning("Failed to save image chat history: %s", hist_err)

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history", response_model=ChatHistoryResponse)
async def get_chat_history(
    limit: int = 60,
    current_user: AuthUser = Depends(_get_current_user),
):
    """Return the authenticated user's recent AI chat history."""
    messages = auth_service.get_chat_history(user_id=current_user.id, limit=limit)
    return ChatHistoryResponse(messages=messages)
