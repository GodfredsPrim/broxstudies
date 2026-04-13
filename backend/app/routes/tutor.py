from fastapi import APIRouter, HTTPException
from app.models import TutorRequest, TutorResponse
from app.services.tutor_service import TutorService

router = APIRouter()
tutor_service = TutorService()

@router.post("/ask", response_model=TutorResponse)
async def ask_tutor(request: TutorRequest):
    """Ask the AI tutor a question for a quick explanation."""
    try:
        if not request.question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty.")
            
        return await tutor_service.get_explanation(
            request.question,
            subject=request.subject,
            context=request.context
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
