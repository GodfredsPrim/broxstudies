import asyncio
import time
import random
import string
import logging
import re
import json
from pathlib import Path
from typing import Optional, Dict, List

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse

from app.config import settings
from app.models import (
    GeneratedQuestions,
    QuestionGenerationRequest,
    PracticeMarkRequest,
    PracticeMarkResponse,
    LiveQuizCreateRequest,
    LiveQuizCreateResponse,
    LiveQuizJoinRequest,
    LiveQuizSubmitRequest,
    Subject,
    SUBJECT_ALIASES,
    Question,
    QuestionType,
)
from app.services.batch_loader import BatchLoader
from app.services.likely_wassce_generator import LikelyWASSCEGenerator
from app.services.question_generator import QuestionGenerator
from app.services.world_class_engine import WorldClassEngine
from app.services.pdf_generator import PDFGenerator

logger = logging.getLogger(__name__)
router = APIRouter()
generator = QuestionGenerator()
world_class = WorldClassEngine()
pdf_generator = PDFGenerator()
likely_wassce_generator = LikelyWASSCEGenerator()
quiz_sessions: dict = {}
quiz_lock = asyncio.Lock()


def _resolve_subject_label(year_key: str, subject_slug: str) -> str:
    catalog_path = settings.SITE_RESOURCE_DIR / "subjects_catalog.json"
    if catalog_path.exists():
        try:
            with open(catalog_path, "r", encoding="utf-8") as f:
                catalog = json.load(f)
            for item in catalog.get("years", {}).get(year_key, []):
                name = (item.get("name") or "").strip()
                slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
                if slug == subject_slug:
                    return name
        except Exception:
            pass
    return subject_slug.replace("_", " ").title()


def _subject_slug_from_url(subject_url: str, year_key: str) -> str:
    from urllib.parse import urlparse
    path = urlparse(subject_url).path.strip("/").lower()
    slug = path.split("/")[-1]
    prefixes = ["year1_", "year2_", "year_1_", "year_2_"]
    for prefix in prefixes:
        if slug.startswith(prefix):
            return slug[len(prefix):]
    return slug


def _classify_wassce_paper(question: Question) -> str:
    text = question.question_text.lower()
    if re.search(r'\bpaper\s*3\b|\bpractical\b|\balternative\b|\bobjective\b', text):
        return "paper_3"
    if question.question_type == QuestionType.MULTIPLE_CHOICE:
        return "paper_1"
    return "paper_2"


def _organize_wassce_questions_into_papers(questions: List[Question]) -> Dict[str, List[Question]]:
    paper_groups = {"paper_1": [], "paper_2": [], "paper_3": []}
    for question in questions:
        paper_groups[_classify_wassce_paper(question)].append(question)

    organized = {}
    if paper_groups["paper_1"]:
        organized["paper_1"] = paper_groups["paper_1"]
    if paper_groups["paper_2"]:
        organized["paper_2"] = paper_groups["paper_2"]
    if paper_groups["paper_3"]:
        organized["paper_3"] = paper_groups["paper_3"]
    return organized


@router.get("/loading-progress")
async def get_loading_progress():
    from app.main import loading_state
    return {
        "is_loading": loading_state.is_loading,
        "total_files": loading_state.total_files,
        "loaded_files": loading_state.loaded_files,
        "current_file": loading_state.current_file,
        "current_category": loading_state.current_category,
        "percentage": loading_state.percentage,
        "mode": "ultra" if settings.LOAD_SYLLABI_ONLY else ("fast" if settings.SELECTIVE_LOAD else "standard"),
        "results": loading_state.results,
    }


@router.post("/load-remaining")
async def load_remaining_documents():
    async def background_full_load():
        from app.main import loading_state
        try:
            loading_state.is_loading = True
            batch_loader = BatchLoader()
            results = await batch_loader.load_all_documents(settings.DATA_DIR, loading_state, selective=False)
            loading_state.results = results
            loading_state.is_loading = False
        except Exception:
            loading_state.is_loading = False

    asyncio.create_task(background_full_load())
    return {"status": "Loading remaining documents in background..."}


@router.post("/generate")
async def generate_questions(request: QuestionGenerationRequest):
    try:
        start_time = time.time()
        subject_token = str(request.subject).lower().strip()
        year_key = None
        subject_slug = subject_token

        if ":" in subject_token:
            year_key, subject_slug = subject_token.split(":", 1)

        if request.year:
            request_year = request.year.lower().strip().replace(" ", "_")
            if request_year in {"year_1", "year_2"}:
                year_key = request_year
            elif request_year in {"1", "year1"}:
                year_key = "year_1"
            elif request_year in {"2", "year2"}:
                year_key = "year_2"
            elif request_year in {"3", "year3"}:
                year_key = "year_3"

        if not year_key:
            year_key = "year_1"

        subject_id = re.sub(r"[^a-z0-9_]+", "_", subject_slug).strip("_")

        # Check if this is a request for "likely wassce questions" (standard exam with 46 questions)
        is_likely_wassce = request.question_type == "standard" and request.num_questions == 46

        from app.services.curriculum_fetcher import CurriculumResourceFetcher
        fetcher = CurriculumResourceFetcher()
        source_status = generator.get_source_status(year_key=year_key, subject_slug=subject_id)
        fetch_summary = {}

        # For WASSCE-style standardized past-paper requests, use local extracted past questions directly
        # and avoid remote curriculum resource downloads that can delay or hang the endpoint.
        if not is_likely_wassce:
            fetch_summary = await fetcher.ensure_subject_resources(
                year_key=year_key,
                subject_slug=subject_id,
                resource_types=["past_questions", "textbooks", "teacher_resources"],
            )
            source_status = generator.get_source_status(year_key=year_key, subject_slug=subject_id)
            if source_status.get("source_used") == "none_found":
                logger.info(f"No source material found for {subject_id}, will fallback to AI knowledge")
                source_status["source_used"] = "ai_generated"
        
        try:
            subject_enum = Subject(subject_id)
        except ValueError:
            subject_enum = Subject(SUBJECT_ALIASES.get(subject_id, Subject.ELECTIVES.value))

        organized_papers = None
        if is_likely_wassce:
            # Use past question extractor for likely WASSCE questions
            # Return questions EXACTLY as they appear in past papers - don't force a 40/6 split
            from app.services.past_question_extractor import PastQuestionExtractor
            extractor = PastQuestionExtractor()

            # Get up to 46 questions WITHOUT forcing question type split
            questions = extractor.get_random_questions_for_subject(
                subject_slug=subject_id,
                num_questions=request.num_questions,
                question_type=None  # Don't filter by type - get all questions as they are
            )

            # If the user asked for a full WASSCE mock, preserve the past-paper order
            # by using the first available question chunks from the subject.

            if not questions:
                logger.warning(f"No past questions found for {subject_id}, falling back to AI generation")
                questions = await generator.generate_questions(
                    subject=subject_enum,
                    question_type=request.question_type,
                    num_questions=request.num_questions,
                    difficulty_level=request.difficulty_level,
                    topics=request.topics,
                    year_key=year_key,
                    subject_slug=subject_id,
                    subject_label=_resolve_subject_label(year_key, subject_id),
                    semester=request.semester or "all_year",
                )
                source_used = "ai_generated"
            else:
                logger.info(f"Using {len(questions)} real past questions for {subject_id}")
                source_used = "past_questions_only"
                source_status = {
                    "source_used": "past_questions_only",
                    "has_site_past": False,
                    "has_legacy_past": True,
                    "has_site_textbook": False,
                    "has_site_teacher": False,
                }
            organized_papers = _organize_wassce_questions_into_papers(questions)
        else:
            questions = await generator.generate_questions(
                subject=subject_enum,
                question_type=request.question_type,
                num_questions=request.num_questions,
                difficulty_level=request.difficulty_level,
                topics=request.topics,
                year_key=year_key,
                subject_slug=subject_id,
                subject_label=_resolve_subject_label(year_key, subject_id),
                semester=request.semester or "all_year",
            )
            source_used = source_status.get("source_used")

        return GeneratedQuestions(
            questions=questions,
            generation_time=time.time() - start_time,
            model_used="past_question_extraction" if is_likely_wassce and source_used == "past_questions_only" else settings.resolved_llm_model,
            source_used=source_used if is_likely_wassce else source_status.get("source_used"),
            source_details={**source_status, "fetch_summary": fetch_summary, "is_likely_wassce": is_likely_wassce},
            organized_papers=organized_papers,
        )
    except Exception as e:
        logger.error(f"Error generating questions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subjects")
async def get_subjects():
    """Get subjects from site catalog (Year 1 and Year 2)."""
    import json
    import re

    catalog_path = settings.SITE_RESOURCE_DIR / "subjects_catalog.json"
    subjects_list = []
    seen = set()

    if catalog_path.exists():
        try:
            with open(catalog_path, "r", encoding="utf-8") as f:
                catalog = json.load(f)

            years = catalog.get("years", {})
            for year_key in ["year_1", "year_2", "year_3"]:
                for subject_info in years.get(year_key, []):
                    name = subject_info.get("name", "").strip()
                    if not name:
                        continue
                    # Extract slug from URL if possible, else normalize name
                    raw_url = subject_info.get("url", "")
                    slug = _subject_slug_from_url(raw_url, year_key)
                    if not slug:
                        slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
                    
                    subject_id = f"{year_key}:{slug}"
                    if subject_id in seen:
                        continue
                    seen.add(subject_id)

                    subjects_list.append(
                        {
                            "id": subject_id,
                            "name": name,
                            "year": year_key.replace("_", " ").title(),
                        }
                    )
        except Exception as e:
            logger.error(f"Error reading subjects catalog: {str(e)}")

    if not subjects_list:
        # Fallback values if site catalog is empty or missing.
        known_subjects = {
            "year_1": [
                "Additional Mathematics", "Agricultural Science", "Agriculture", "Applied Technology", "Arabic",
                "Biology", "Business Management", "Accounting", "Chemistry", "Computing",
                "Economics", "English Language", "Geography", "Ghanaian Language", "Government", "History",
                "Literature-in-English", "Mathematics", "Music", "Physics", "Social Studies", "French",
            ],
            "year_2": [
                "Additional Mathematics", "Agricultural Science", "Agriculture", "Biology", "Accounting", 
                "Business Management", "Chemistry", "Economics", "English Language", "French", "Geography",
                "Ghanaian Language", "Government", "History", "Literature-in-English", "Mathematics", 
                "Physics", "Social Studies",
            ],
            "year_3": [
                "Additional Mathematics", "Agricultural Science", "Agriculture", "Biology", "Accounting", 
                "Business Management", "Chemistry", "Economics", "English Language", "French", "Geography",
                "Ghanaian Language", "Government", "History", "Literature-in-English", "Mathematics", 
                "Physics", "Social Studies",
            ],
        }

        for year_key, names in known_subjects.items():
            for name in names:
                slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
                subject_id = f"{year_key}:{slug}"
                if subject_id in seen:
                    continue
                seen.add(subject_id)
                subjects_list.append(
                    {
                        "id": subject_id,
                        "name": name,
                        "year": year_key.replace("_", " ").title(),
                    }
                )

    subjects_list.sort(key=lambda x: (x["year"], x["name"]))
    return {"subjects": subjects_list}


@router.get("/question-types")
async def get_question_types():
    return {"types": ["multiple_choice", "short_answer", "essay", "true_false", "standard"]}


@router.get("/resource-status")
async def get_resource_status(year: str, subject: str):
    year_key = year.lower().strip().replace(" ", "_")
    if year_key in {"1", "year1"}: year_key = "year_1"
    elif year_key in {"2", "year2"}: year_key = "year_2"
    elif year_key in {"3", "year3"}: year_key = "year_3"
    subject_token = subject.lower().strip()
    if ":" in subject_token:
        _, subject_token = subject_token.split(":", 1)
    subject_slug = re.sub(r"[^a-z0-9_]+", "_", subject_token).strip("_")
    from app.services.curriculum_fetcher import CurriculumResourceFetcher
    fetcher = CurriculumResourceFetcher()
    return {"year": year_key, "subject_slug": subject_slug, "status": fetcher.get_subject_resource_status(year_key, subject_slug)}


@router.post("/mark-practice", response_model=PracticeMarkResponse)
async def mark_practice(request: PracticeMarkRequest):
    try:
        result = await generator.mark_practice_answers(request.items)
        return PracticeMarkResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quiz/create", response_model=LiveQuizCreateResponse)
async def create_live_quiz(request: LiveQuizCreateRequest):
    player = request.player_name.strip()
    if not player: raise HTTPException(status_code=400, detail="Name required")
    
    subject_token = str(request.subject).lower().strip()
    year_key = "year_1"
    subject_slug = subject_token
    if ":" in subject_token:
        year_key, subject_slug = subject_token.split(":", 1)
    subject_id = re.sub(r"[^a-z0-9_]+", "_", subject_slug).strip("_")

    from app.services.curriculum_fetcher import CurriculumResourceFetcher
    fetcher = CurriculumResourceFetcher()
    await fetcher.ensure_subject_resources(year_key=year_key, subject_slug=subject_id, resource_types=["past_questions", "textbooks"])
    
    try:
        subject_enum = Subject(subject_id)
    except ValueError:
        subject_enum = Subject(SUBJECT_ALIASES.get(subject_id, Subject.ELECTIVES.value))

    questions = await generator.generate_questions(
        subject=subject_enum,
        question_type=request.question_type,
        num_questions=request.num_questions,
        difficulty_level=request.difficulty_level,
        year_key=year_key,
        subject_slug=subject_id,
        subject_label=_resolve_subject_label(year_key, subject_id),
        semester=request.semester or "all_year",
    )

    code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    async with quiz_lock:
        quiz_sessions[code] = {
            "code": code,
            "created_at": time.time(),
            "time_limit": request.time_limit,
            "host": player,
            "players": {player.lower(): {"name": player, "submitted": False, "score": 0.0, "percentage": 0.0}},
            "questions": [q.model_dump() for q in questions],
            "answers": {},
        }
    return LiveQuizCreateResponse(code=code, host_player=player, total_questions=len(questions))


@router.post("/quiz/join")
async def join_live_quiz(request: LiveQuizJoinRequest):
    code = request.code.strip().upper()
    player = request.player_name.strip()
    async with quiz_lock:
        session = quiz_sessions.get(code)
        if not session: raise HTTPException(status_code=404, detail="Code not found")
        player_key = player.lower()
        if player_key not in session["players"]:
            session["players"][player_key] = {"name": player, "submitted": False, "score": 0.0, "percentage": 0.0}
    return {"status": "joined", "code": code, "player_name": player}


@router.get("/quiz/{code}/state")
async def get_live_quiz_state(code: str):
    quiz_code = code.strip().upper()
    async with quiz_lock:
        session = quiz_sessions.get(quiz_code)
        if not session: raise HTTPException(status_code=404, detail="Code not found")
        public_questions = [{"question_text": q.get("question_text"), "question_type": q.get("question_type"), "options": q.get("options")} for q in session["questions"]]
        leaderboard = [{"player": stats.get("name", name), **stats} for name, stats in session["players"].items()]
    leaderboard.sort(key=lambda x: x["percentage"], reverse=True)
    return {
        "code": quiz_code,
        "host": session["host"],
        "questions": public_questions,
        "leaderboard": leaderboard,
        "time_limit": session.get("time_limit", 5),
        "created_at": session.get("created_at", time.time()),
    }


@router.post("/quiz/{code}/submit")
async def submit_live_quiz(code: str, request: LiveQuizSubmitRequest):
    quiz_code = code.strip().upper()
    player = request.player_name.strip()
    player_key = player.lower()
    async with quiz_lock:
        session = quiz_sessions.get(quiz_code)
        if not session or player_key not in session["players"]:
            raise HTTPException(status_code=404, detail="Session or player not found")
        questions = session["questions"]

    from app.models import PracticeMarkItem
    items = [PracticeMarkItem(
        question_text=q.get("question_text", ""),
        question_type=q.get("question_type", "multiple_choice"),
        correct_answer=q.get("correct_answer", ""),
        explanation=q.get("explanation", ""),
        marking_scheme=q.get("marking_scheme", ""),
        options=q.get("options"),
        student_answer=request.answers[i] if i < len(request.answers) else ""
    ) for i, q in enumerate(questions)]

    result = await generator.mark_practice_answers(items)
    async with quiz_lock:
        session = quiz_sessions.get(quiz_code)
        session["answers"][player_key] = result
        session["players"][player_key].update({
            "submitted": True,
            "score": result["score_obtained"],
            "percentage": result["percentage"],
        })
    return {"status": "submitted", "result": result}


from fastapi import Depends
from app.routes.auth import get_current_user
from app.models import AuthUser, ExamHistorySaveRequest, ExamHistoryResponse
from app.services.auth_service import AuthService

history_auth_service = AuthService()

@router.post("/history/exams", response_model=dict)
async def save_exam_history(request: ExamHistorySaveRequest, current_user: AuthUser = Depends(get_current_user)):
    try:
        history_auth_service.save_exam_history(
            user_id=current_user.id,
            exam_type=request.exam_type,
            subject=request.subject,
            score=request.score_obtained,
            total=request.total_questions,
            percentage=request.percentage,
            details_json=request.details_json,
        )
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/exams", response_model=list[ExamHistoryResponse])
async def get_exam_history(current_user: AuthUser = Depends(get_current_user)):
    try:
        records = history_auth_service.get_exam_history(current_user.id, limit=20)
        return records
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-pdf")
async def generate_questions_pdf(request: Dict):
    """Generate and return a professional PDF for the questions."""
    try:
        subject_name = request.get("subject_name", "Examination")
        questions_data = request.get("questions", [])
        organized_papers_data = request.get("organized_papers")
        year = str(request.get("year", "2026"))
        
        # Convert dicts back to Question objects
        questions = [Question(**q) for q in questions_data]
        
        organized_papers = None
        if organized_papers_data:
            organized_papers = {k: [Question(**q) for q in v] for k, v in organized_papers_data.items() if v}
            
        pdf_buffer = pdf_generator.generate_exam_pdf(
            subject_name=subject_name,
            questions=questions,
            organized_papers=organized_papers,
            year=year
        )
        
        filename = f"{subject_name.replace(' ', '_')}_Mock_Exam.pdf"
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.error(f"Error generating PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-professional", response_model=GeneratedQuestions)
async def generate_professional_mock(request: QuestionGenerationRequest):
    """Generate a likely WASSCE paper from textbook topics and past-paper structure."""
    try:
        start_time = time.time()

        subject_token = str(request.subject).lower().strip()
        year_key = "year_3"
        subject_slug = subject_token
        if ":" in subject_token:
            year_key, subject_slug = subject_token.split(":", 1)

        if request.year:
            request_year = request.year.lower().strip().replace(" ", "_")
            if request_year in {"year_1", "year_2", "year_3"}:
                year_key = request_year
            elif request_year in {"1", "year1"}:
                year_key = "year_1"
            elif request_year in {"2", "year2"}:
                year_key = "year_2"
            elif request_year in {"3", "year3"}:
                year_key = "year_3"

        subject_slug = re.sub(r"[^a-z0-9_]+", "_", subject_slug).strip("_")
        subject_label = _resolve_subject_label(year_key if year_key != "year_3" else "year_1", subject_slug)

        result = await likely_wassce_generator.generate_exam(
            subject_slug=subject_slug,
            subject_label=subject_label,
            year_key=year_key,
        )

        organized_papers = result.get("organized_papers") or {}
        questions = []
        for paper_key in ["paper_1", "paper_2", "paper_3"]:
            questions.extend(organized_papers.get(paper_key, []))

        return GeneratedQuestions(
            questions=questions,
            organized_papers=organized_papers,
            generation_time=time.time() - start_time,
            model_used="structured_exam_builder",
            source_used=result.get("generation_mode", "exam_structured"),
            source_details={
                "subject": subject_slug,
                "subject_label": subject_label,
                "year": year_key,
                "topics": result.get("topics"),
                "paper_structure": result.get("paper_structure"),
                "generation_mode": result.get("generation_mode", "exam_structured"),
            },
        )
    except Exception as e:
        logger.error(f"Error in professional mock generation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
