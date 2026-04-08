from fastapi import APIRouter, HTTPException
from app.models import Subject, AnalysisResult
from app.services.rag_engine import RAGEngine

router = APIRouter()
rag_engine = RAGEngine()

@router.get("/patterns/{subject}")
async def analyze_patterns(subject: Subject):
    """Analyze patterns in past questions for a subject"""
    try:
        patterns = await rag_engine.analyze_patterns(subject)
        
        return AnalysisResult(
            subject=subject,
            total_past_questions_analyzed=patterns.get("total_questions", 0),
            common_topics=patterns.get("common_topics", []),
            question_patterns=patterns.get("patterns", {}),
            difficulty_distribution=patterns.get("difficulty", {}),
            topic_frequency=patterns.get("topic_frequency", {})
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/topics/{subject}")
async def get_topics(subject: Subject):
    """Get common topics for a subject"""
    try:
        topics = await rag_engine.get_topics(subject)
        return {"subject": subject, "topics": topics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/index")
async def rebuild_index():
    """Rebuild the vector index"""
    try:
        result = await rag_engine.rebuild_index()
        return {"status": "success", "message": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
