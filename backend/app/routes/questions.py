import asyncio
import time
import random
import string
import logging
import re
import json
from pathlib import Path
from typing import Optional, Dict, List

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse

from app.config import settings
from app.models import (
    AcademicLevel,
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
from app.services.academic_catalog import is_tvet_subject_slug
from app.services.batch_loader import BatchLoader
from app.services.likely_wassce_generator import LikelyWASSCEGenerator
from app.services.question_generator import QuestionGenerator
from app.services.world_class_engine import WorldClassEngine
from app.services.pdf_generator import PDFGenerator
from app.routes.auth import get_optional_user
from app.models import AuthUser

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


_TVET_TRADE_SUBJECTS = [
    "Automotive Engineering",
    "Electrical Engineering",
    "Mechanical Engineering",
    "Welding and Fabrication",
    "Electronics Engineering",
    "Mechatronics",
    "Industrial Mechanics",
    "Plumbing and Gas Technology",
    "Building Construction",
    "Wood Technology",
    "Furniture Technology",
    "Architectural Draughtmanship",
    "Catering and Hospitality",
    "Fashion Design Technology",
    "Textiles",
    "Beauty Therapy",
    "Hair Technology",
    "Graphic Design",
    "Multimedia Technology",
    "Painting",
    "Tourism Management",
    "Computer Hardware and Software",
    "Agric Mechanization",
    "Small Engines",
    "Heavy Duty Mechanics",
    "Heavy Duty Operation Forklift",
    "Autobody Repairs",
    "Refrideration and Air Conditioning",
    "Jewellry",
    "Leather Work",
]

_TVET_COMMON_SUBJECTS = [
    "English Language",
    "Maths",
    "Science",
    "Social Studies",
    "Technical Drawing",
    "Entrepreneurship",
    "ICT",
]

TVET_FALLBACK_SUBJECTS = {
    "year_1": _TVET_TRADE_SUBJECTS + _TVET_COMMON_SUBJECTS,
    "year_2": _TVET_TRADE_SUBJECTS + _TVET_COMMON_SUBJECTS,
    "year_3": _TVET_TRADE_SUBJECTS + _TVET_COMMON_SUBJECTS,
}

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
async def generate_questions(request: QuestionGenerationRequest, user: Optional[AuthUser] = Depends(get_optional_user)):
    """Start an asynchronous question generation job."""
    try:
        # Create the job
        from app.services.generation_service import generation_service
        
        request_data = {
            "subject": str(request.subject),
            "year": request.year,
            "question_type": request.question_type,
            "num_questions": request.num_questions,
            "difficulty_level": request.difficulty_level,
            "topics": request.topics,
            "semester": request.semester,
        }
        
        user_id = user.id if user else None
        job_id = generation_service.auth_service.create_generation_job(user_id, request_data)
        
        # Start the background task
        asyncio.create_task(generation_service.start_generation_job(job_id))
        
        return {
            "job_id": job_id,
            "status": "pending",
            "message": "Question generation started. Check status with GET /api/questions/jobs/{job_id}"
        }
        
    except Exception as e:
        logger.error(f"Error starting generation job: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/{job_id}")
async def get_generation_job_status(job_id: str, user: Optional[AuthUser] = Depends(get_optional_user)):
    """Get the status of a generation job."""
    from app.services.generation_service import generation_service
    
    job = generation_service.auth_service.get_generation_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check if user owns this job (or is admin)
    if job['user_id'] and user and job['user_id'] != user.id and not getattr(user, 'is_admin', False):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return job


@router.get("/jobs")
async def get_user_generation_jobs(user: Optional[AuthUser] = Depends(get_optional_user)):
    """Get generation jobs for the current user."""
    from app.services.generation_service import generation_service
    
    user_id = user.id if user else None
    jobs = generation_service.auth_service.get_user_generation_jobs(user_id)
    return {"jobs": jobs}


@router.get("/subjects")
async def get_subjects():
    """Get subjects from site catalog (Year 1, Year 2 and Year 3)."""
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

                    is_tvet = is_tvet_subject_slug(slug)
                    subjects_list.append(
                        {
                            "id": subject_id,
                            "name": name,
                            "year": (
                                f"TVET Year {year_key.split('_')[1]}" if is_tvet else year_key.replace("_", " ").title()
                            ),
                            "academic_level": AcademicLevel.TVET.value if is_tvet else AcademicLevel.SHS.value,
                        }
                    )
        except Exception as e:
            logger.error(f"Error reading subjects catalog: {str(e)}")

    if not subjects_list:
        # Fallback values if site catalog is empty or missing.
        # This list includes a broader set of SHS electives so subjects like Robotics appear in the UI.
        known_subjects = {
            "year_1": [
                "Additional Mathematics", "Agricultural Science", "Agriculture", "Applied Technology", "Arabic",
                "Art and Design Foundation", "Arts and Design Studio", "Aviation and Aerospace Engineering",
                "Biology", "Biomedical Science", "Business Management", "Accounting", "Chemistry", "Computing",
                "Core Physical Education and Health (PEH)", "Design and Communication Technology",
                "Economics", "Elective Physical Education and Health (PEH)", "Engineering", "English Language",
                "Food and Nutrition", "Clothing and Textiles", "Geography", "Government", "History",
                "Information Communication Technology (ICT)", "Intervention English", "Intervention Mathematics",
                "Literature-in-English", "Management in Living", "Manufacturing Engineering", "Mathematics",
                "Music", "Performing Arts", "Physics", "Religious Studies (Islamic)", "Religious Studies (Christian)",
                "Robotics", "General Science", "Religious and Moral Education", "Social Studies", "Spanish", "French",
            ],
            "year_2": [
                "Additional Mathematics", "Agricultural Science", "Agriculture", "Automotive and Metal Technology",
                "Building Construction and Wood Technology", "Electrical and Electronic Technology", "Arabic",
                "Art and Design Foundation", "Biology", "Biomedical Science", "Business Management", "Accounting",
                "Chemistry", "Economics", "English Language", "French", "Geography", "Government", "History",
                "Information Communication and Technology (ICT)", "Literature-in-English", "Manufacturing Engineering",
                "Mathematics", "Music", "Physics", "Social Studies", "Design and Communication Technology",
                "Engineering", "Food and Nutrition", "Clothing and Textiles", "Aviation and Aerospace Engineering",
            ],
            "year_3": [
                "Additional Mathematics", "Agricultural Science", "Agriculture", "Automotive and Metal Technology",
                "Building Construction and Wood Technology", "Electrical and Electronic Technology", "Arabic",
                "Art and Design Foundation", "Biology", "Biomedical Science", "Business Management", "Accounting",
                "Chemistry", "Economics", "English Language", "French", "Geography", "Government", "History",
                "Information Communication and Technology (ICT)", "Literature-in-English", "Manufacturing Engineering",
                "Mathematics", "Music", "Physics", "Social Studies", "Design and Communication Technology",
                "Engineering", "Food and Nutrition", "Clothing and Textiles", "Aviation and Aerospace Engineering",
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
                        "academic_level": AcademicLevel.SHS.value,
                    }
                )

    for year_key, names in TVET_FALLBACK_SUBJECTS.items():
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
                    "year": f"TVET Year {year_key.split('_')[1]}",
                    "academic_level": AcademicLevel.TVET.value,
                }
            )

    subjects_list.sort(key=lambda x: (x.get("academic_level", "shs"), x["year"], x["name"]))
    return {"subjects": subjects_list}


@router.get("/question-types")
async def get_question_types():
    return {"types": ["multiple_choice", "short_answer", "essay", "true_false", "standard"]}


@router.get("/resource-status")
async def get_resource_status(year: str, subject: str):
    year_key = year.lower().strip().replace(" ", "_")
    if year_key in {"1", "year1"}: year_key = "year_1"
    elif year_key in {"2", "year2"}: year_key = "year_2"
    elif year_key in {"3", "year3", "year_3"}: year_key = "year_3"
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


_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
_MAX_FILE_BYTES = 8 * 1024 * 1024   # 8 MB per file
_MAX_TOTAL_BYTES = 24 * 1024 * 1024  # 24 MB total


@router.post("/grade-answers-pdf")
async def grade_answers_pdf(
    files: List[UploadFile] = File(...),
    questions_json: str = Form(...),
    subject: Optional[str] = Form(None),
):
    """Upload answer sheet(s) — PDF or photos — and grade against provided questions."""
    try:
        if not questions_json:
            raise HTTPException(status_code=400, detail="Questions JSON is required")
        try:
            questions_data = json.loads(questions_json)
            questions = questions_data.get('questions', [])
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid questions JSON")

        # Classify each file
        pdf_files: List[UploadFile] = []
        image_files: List[UploadFile] = []
        for f in files:
            name_lower = (f.filename or "").lower()
            ext = "." + name_lower.rsplit(".", 1)[-1] if "." in name_lower else ""
            ct = (f.content_type or "").lower().split(";")[0].strip()
            if ext == ".pdf" or ct == "application/pdf":
                pdf_files.append(f)
            elif ct in _IMAGE_MIMES or ext in _IMAGE_EXTS:
                image_files.append(f)
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file type: {f.filename}. Use PDF, JPEG, PNG, or WEBP."
                )

        if pdf_files and image_files:
            raise HTTPException(status_code=400, detail="Please upload either PDF(s) or image(s), not both together.")

        # ── Image path: vision LLM ────────────────────────────────────────
        if image_files:
            import base64
            images = []
            total_bytes = 0
            for f in image_files:
                content = await f.read()
                if len(content) > _MAX_FILE_BYTES:
                    raise HTTPException(status_code=400, detail=f"{f.filename} exceeds 8 MB limit.")
                total_bytes += len(content)
                if total_bytes > _MAX_TOTAL_BYTES:
                    raise HTTPException(status_code=400, detail="Total upload size exceeds 24 MB.")
                ct = (f.content_type or "image/jpeg").lower().split(";")[0].strip()
                data_uri = f"data:{ct};base64,{base64.b64encode(content).decode()}"
                images.append({"data_uri": data_uri, "filename": f.filename})

            grading_result = await generator.grade_uploaded_answer_images(questions, images)
            return {
                "filename": ", ".join(f.filename for f in image_files),
                "extracted_text": f"Graded {len(image_files)} image(s) via vision AI.",
                "grading_result": grading_result,
            }

        # ── PDF path: text extraction ────────────────────────────────────
        if not pdf_files:
            raise HTTPException(status_code=400, detail="No files provided.")

        import tempfile
        import os
        combined_text = ""
        for f in pdf_files:
            content = await f.read()
            if len(content) > _MAX_FILE_BYTES:
                raise HTTPException(status_code=400, detail=f"{f.filename} exceeds 8 MB limit.")
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            try:
                from app.services.pdf_processor import PDFProcessor
                result = await PDFProcessor().process_pdf(tmp_path, "answer_sheet", subject)
                combined_text += result.get("text", "") + "\n"
            finally:
                os.unlink(tmp_path)

        grading_result = await generator.grade_uploaded_answers(questions, combined_text)
        return {
            "filename": ", ".join(f.filename for f in pdf_files),
            "extracted_text": combined_text[:500] + "..." if len(combined_text) > 500 else combined_text,
            "grading_result": grading_result,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error grading uploaded answers: {str(e)}")
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
    if year_key in {"1", "year1"}: year_key = "year_1"
    elif year_key in {"2", "year2"}: year_key = "year_2"
    elif year_key in {"3", "year3", "year_3"}: year_key = "year_3"
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
async def generate_professional_mock(
    request: QuestionGenerationRequest,
    current_user: Optional[AuthUser] = Depends(get_optional_user),
):
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
            elif request_year in {"3", "year3", "year_3"}:
                year_key = "year_3"

        subject_slug = re.sub(r"[^a-z0-9_]+", "_", subject_slug).strip("_")
        subject_label = _resolve_subject_label(year_key if year_key != "year_3" else "year_1", subject_slug)

        # TVET subjects use locally uploaded textbooks — no SHS curriculum fetcher needed
        if not is_tvet_subject_slug(subject_slug):
            from app.services.curriculum_fetcher import CurriculumResourceFetcher
            fetcher = CurriculumResourceFetcher()
            try:
                if year_key == "year_3":
                    await asyncio.gather(
                        fetcher.ensure_subject_resources(year_key="year_1", subject_slug=subject_slug, resource_types=["textbooks"]),
                        fetcher.ensure_subject_resources(year_key="year_2", subject_slug=subject_slug, resource_types=["textbooks"]),
                    )
                else:
                    await fetcher.ensure_subject_resources(year_key=year_key, subject_slug=subject_slug, resource_types=["textbooks"])
            except Exception as fetch_err:
                logger.warning(f"Textbook fetch failed for {subject_slug} ({year_key}): {fetch_err}. Proceeding with whatever is cached.")

        exclude_hashes: set[str] = set()
        if current_user:
            try:
                exclude_hashes = history_auth_service.get_recent_question_hashes(
                    user_id=current_user.id,
                    subject_slug=subject_slug,
                    hours=24,
                )
            except Exception as hash_err:
                logger.warning(f"Could not fetch recent-question hashes for user {current_user.id}: {hash_err}")

        result = await likely_wassce_generator.generate_exam(
            subject_slug=subject_slug,
            subject_label=subject_label,
            year_key=year_key,
            exclude_hashes=exclude_hashes,
        )

        organized_papers = result.get("organized_papers") or {}
        questions = []
        for paper_key in ["paper_1", "paper_2", "paper_3"]:
            questions.extend(organized_papers.get(paper_key, []))

        if current_user and questions:
            try:
                new_hashes = [likely_wassce_generator.hash_question(q.question_text) for q in questions]
                history_auth_service.record_generated_questions(
                    user_id=current_user.id,
                    subject_slug=subject_slug,
                    question_hashes=new_hashes,
                )
            except Exception as record_err:
                logger.warning(f"Could not record generated-question hashes for user {current_user.id}: {record_err}")

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
