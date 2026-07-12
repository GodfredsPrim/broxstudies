import base64
import json
import logging
import tempfile
from io import BytesIO
from typing import AsyncIterator, List, Optional

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.models import (
    AuthUser,
    ChatHistoryMessage,
    ChatHistoryResponse,
    TutorImageRequest,
    TutorRequest,
    TutorResponse,
)
from app.services.auth_service import AuthService
from app.services.pdf_processor import PDFProcessor
from app.services.tutor_service import TutorService

logger = logging.getLogger(__name__)

_MAX_FILE_BYTES = 8 * 1024 * 1024    # 8 MB per file
_MAX_TOTAL_BYTES = 24 * 1024 * 1024  # 24 MB total

_ALLOWED_MIMES = {
    "image/png", "image/jpeg", "image/webp", "image/gif",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain", "text/markdown",
}
_IMAGE_MIMES = {"image/png", "image/jpeg", "image/webp", "image/gif"}

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


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


async def _stream_tutor_answer(
    *,
    question: str,
    subject: Optional[str],
    context: Optional[str],
    is_main_concept_only: bool,
    history: list,
    current_user: Optional[AuthUser],
) -> AsyncIterator[str]:
    full_parts: list[str] = []
    try:
        async for token in tutor_service.stream_explanation(
            question,
            subject=subject or "general",
            context=context,
            is_main_concept_only=is_main_concept_only,
            history=history,
        ):
            full_parts.append(token)
            yield _sse({"token": token})
    except Exception as exc:
        logger.exception("Tutor stream failed: %s", exc)
        yield _sse({"error": str(exc)})
        return

    explanation = "".join(full_parts)
    yield _sse({"done": True, "explanation": explanation})

    if current_user and explanation.strip():
        try:
            auth_service.save_chat_message(
                user_id=current_user.id,
                role="user",
                content=question,
                subject=subject,
            )
            auth_service.save_chat_message(
                user_id=current_user.id,
                role="ai",
                content=explanation,
                subject=subject,
            )
        except Exception as hist_err:
            logger.warning("Failed to save streamed chat history: %s", hist_err)


@router.post("/ask/stream")
async def ask_tutor_stream(
    request: TutorRequest,
    current_user: Optional[AuthUser] = Depends(_get_optional_user),
):
    """Stream AI tutor tokens via Server-Sent Events (text questions only)."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    history = []
    if request.history:
        history = [
            ChatHistoryMessage(id=0, role=m.get("role", "user"), content=m.get("content", ""), created_at="")
            for m in request.history
        ]
    elif current_user:
        history = auth_service.get_chat_history(current_user.id, limit=10)

    return StreamingResponse(
        _stream_tutor_answer(
            question=request.question,
            subject=request.subject,
            context=request.context,
            is_main_concept_only=request.is_main_concept_only,
            history=history,
            current_user=current_user,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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


@router.post("/ask-with-files", response_model=TutorResponse)
async def ask_tutor_with_files(
    question: str = Form(""),
    history_json: str = Form("[]"),
    subject: Optional[str] = Form(None),
    files: List[UploadFile] = File(default=[]),
    current_user: AuthUser = Depends(_get_current_user),
):
    """Ask the AI tutor a question with optional file attachments (images, PDFs, DOCX, TXT/MD)."""
    if not question.strip() and not files:
        raise HTTPException(status_code=400, detail="Provide a question and/or at least one file.")

    try:
        history_raw = json.loads(history_json) if history_json.strip() else []
    except Exception:
        history_raw = []

    history = [
        ChatHistoryMessage(id=0, role=m.get("role", "user"), content=m.get("content", ""), created_at="")
        for m in history_raw
    ]

    images: List[str] = []
    extracted_parts: List[str] = []
    file_names: List[str] = []
    total_bytes = 0

    for upload in files:
        raw = await upload.read(_MAX_FILE_BYTES + 1)
        if len(raw) > _MAX_FILE_BYTES:
            raise HTTPException(status_code=413, detail=f"File '{upload.filename}' exceeds the 8 MB limit.")
        total_bytes += len(raw)
        if total_bytes > _MAX_TOTAL_BYTES:
            raise HTTPException(status_code=413, detail="Total upload size exceeds the 24 MB limit.")

        # Determine mime by content-type header or filename extension
        mime = (upload.content_type or "").split(";")[0].strip().lower()
        fname = (upload.filename or "").lower()
        if not mime or mime == "application/octet-stream":
            if fname.endswith(".pdf"):
                mime = "application/pdf"
            elif fname.endswith(".docx"):
                mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            elif fname.endswith((".txt", ".md")):
                mime = "text/plain"
            elif fname.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
                mime = f"image/{fname.rsplit('.', 1)[-1].replace('jpg', 'jpeg')}"

        if mime not in _ALLOWED_MIMES:
            raise HTTPException(status_code=415, detail=f"File type '{mime}' is not supported. Upload images, PDFs, DOCX, TXT, or MD files.")

        if mime == "application/pdf" and not raw.startswith(b"%PDF-"):
            raise HTTPException(status_code=415, detail=f"File '{upload.filename}' is not a valid PDF.")
        if mime in _IMAGE_MIMES and not raw.startswith((b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff", b"RIFF", b"GIF87a", b"GIF89a")):
            raise HTTPException(status_code=415, detail=f"File '{upload.filename}' is not a valid supported image.")

        file_names.append(upload.filename or "file")

        if mime in _IMAGE_MIMES:
            b64 = base64.b64encode(raw).decode()
            images.append(f"data:{mime};base64,{b64}")

        elif mime == "application/pdf":
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(raw)
                tmp_path = tmp.name
            try:
                result = await PDFProcessor().process_pdf(tmp_path, "learning_material", subject)
                text = result.get("text", "") if isinstance(result, dict) else str(result)
                if text.strip():
                    extracted_parts.append(f"--- {upload.filename} ---\n{text[:10000]}")
            except Exception as pdf_err:
                logger.warning("PDF extraction failed for %s: %s", upload.filename, pdf_err)
            finally:
                import os; os.unlink(tmp_path)

        elif mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            try:
                import docx as python_docx
                doc = python_docx.Document(BytesIO(raw))
                text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
                if text.strip():
                    extracted_parts.append(f"--- {upload.filename} ---\n{text[:10000]}")
            except Exception as docx_err:
                logger.warning("DOCX extraction failed for %s: %s", upload.filename, docx_err)

        else:  # text/plain or text/markdown
            try:
                text = raw.decode("utf-8", errors="replace")
                if text.strip():
                    extracted_parts.append(f"--- {upload.filename} ---\n{text[:10000]}")
            except Exception:
                pass

    extracted_text = "\n\n".join(extracted_parts)
    # Cap total extracted text to ~30K chars to stay well within LLM context
    if len(extracted_text) > 30000:
        extracted_text = extracted_text[:30000] + "\n\n[Content truncated — file too long]"

    try:
        result = await tutor_service.get_explanation_with_attachments(
            question=question.strip(),
            images=images,
            extracted_text=extracted_text,
            subject=subject,
            history=history,
        )
    except ValueError as ve:
        raise HTTPException(status_code=415, detail=str(ve))

    if current_user:
        try:
            attachment_label = ", ".join(file_names)
            user_content = f"[Attached: {attachment_label}]\n{question.strip()}" if file_names else question.strip()
            auth_service.save_chat_message(user_id=current_user.id, role="user", content=user_content, subject=subject)
            auth_service.save_chat_message(user_id=current_user.id, role="ai", content=result.explanation, subject=subject)
        except Exception as hist_err:
            logger.warning("Failed to save attachment chat history: %s", hist_err)

    return result


@router.get("/history", response_model=ChatHistoryResponse)
async def get_chat_history(
    limit: int = 60,
    current_user: AuthUser = Depends(_get_current_user),
):
    """Return the authenticated user's recent AI chat history."""
    messages = auth_service.get_chat_history(user_id=current_user.id, limit=limit)
    return ChatHistoryResponse(messages=messages)
