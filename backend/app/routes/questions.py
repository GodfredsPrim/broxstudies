import asyncio
import time
import random
import string

from fastapi import APIRouter, HTTPException

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
)
from app.services.batch_loader import BatchLoader
from app.services.question_generator import QuestionGenerator
from app.services.world_class_engine import WorldClassEngine

router = APIRouter()
generator = QuestionGenerator()
world_class = WorldClassEngine()
quiz_sessions: dict = {}
quiz_lock = asyncio.Lock()


def _resolve_subject_label(year_key: str, subject_slug: str) -> str:
    import json
    import re

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
    if year_key == "year_1" and slug.startswith("year1_"):
        return slug[len("year1_"):]
    if year_key == "year_2" and slug.startswith("year2_"):
        return slug[len("year2_"):]
    return slug


@router.get("/loading-progress")
async def get_loading_progress():
    """Get real-time document loading progress."""
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
    """Load remaining documents in the background."""

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
    """Generate questions based on past question patterns."""
    try:
        from app.models import Subject, SUBJECT_ALIASES
        import logging
        import re
        
        logger = logging.getLogger(__name__)
        
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

        if not year_key:
            year_key = "year_1"

        subject_id = re.sub(r"[^a-z0-9_]+", "_", subject_slug).strip("_")

        # Ensure selected subject resources are present locally; download only this subject if missing.
        from app.services.curriculum_fetcher import CurriculumResourceFetcher
        fetcher = CurriculumResourceFetcher()
        fetch_summary = await fetcher.ensure_subject_resources(
            year_key=year_key,
            subject_slug=subject_id,
            resource_types=["past_questions", "textbooks", "teacher_resources"],
        )
        logger.info(f"On-demand resource check: {fetch_summary}")
        source_status = generator.get_source_status(year_key=year_key, subject_slug=subject_id)
        if source_status.get("source_used") == "none_found":
            raise HTTPException(
                status_code=404,
                detail=f"No source material found for {subject_id} in {year_key}. Try another subject or refresh resources.",
            )
        
        # Check if it's already a valid Subject
        try:
            subject_enum = Subject(subject_id)
        except ValueError:
            # Try aliases
            if subject_id in SUBJECT_ALIASES:
                subject_enum = Subject(SUBJECT_ALIASES[subject_id])
            else:
                # Default to electives for unmapped subjects
                logger.warning(f"Unknown subject '{subject_id}', defaulting to electives")
                subject_enum = Subject.ELECTIVES

        questions = await generator.generate_questions(
            subject=subject_enum,
            question_type=request.question_type,
            num_questions=request.num_questions,
            difficulty_level=request.difficulty_level,
            topics=request.topics,
            year_key=year_key,
            subject_slug=subject_id,
            subject_label=_resolve_subject_label(year_key, subject_id),
        )

        generation_time = time.time() - start_time
        curriculum = world_class.build_curriculum_map(questions, _resolve_subject_label(year_key, subject_id))
        quality = world_class.build_quality_report(questions)
        world_class.record_telemetry_event(
            "question_generation",
            {
                "year": year_key,
                "subject": subject_id,
                "source": source_status.get("source_used"),
                "quality_score": quality.get("quality_score"),
            },
        )

        return GeneratedQuestions(
            questions=questions,
            generation_time=generation_time,
            model_used=settings.resolved_llm_model,
            source_used=source_status.get("source_used"),
            source_details={
                **source_status,
                "fetch_summary": fetch_summary,
                "curriculum_map": curriculum,
                "quality_report": quality,
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subjects")
async def get_subjects():
    """Get subjects from site catalog (Year 1 and Year 2)."""
    import json
    import re
    from app.services.curriculum_fetcher import CurriculumResourceFetcher

    catalog_path = settings.SITE_RESOURCE_DIR / "subjects_catalog.json"
    subjects_list = []
    seen = set()

    def _catalog_is_stale_or_empty() -> bool:
        if not catalog_path.exists():
            return True
        try:
            import json
            with open(catalog_path, "r", encoding="utf-8") as f:
                payload = json.load(f)
            years = payload.get("years", {})
            return (len(years.get("year_1", [])) + len(years.get("year_2", []))) < 8
        except Exception:
            return True

    if _catalog_is_stale_or_empty():
        fetcher = CurriculumResourceFetcher()
        asyncio.create_task(fetcher.fetch_years_subjects())

    if catalog_path.exists():
        with open(catalog_path, "r", encoding="utf-8") as f:
            catalog = json.load(f)

        years = catalog.get("years", {})
        for year_key in ["year_1", "year_2"]:
            for subject_info in years.get(year_key, []):
                name = subject_info.get("name", "").strip()
                if not name:
                    continue
                raw_url = subject_info.get("url", "")
                slug = _subject_slug_from_url(raw_url, year_key)
                if not slug:
                    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
                subject_id = f"{year_key}:{slug}"
                dedupe_key = subject_id
                if dedupe_key in seen:
                    continue
                seen.add(dedupe_key)

                subjects_list.append(
                    {
                        "id": subject_id,
                        "name": name,
                        "year": "Year 1" if year_key == "year_1" else "Year 2",
                    }
                )

    if not subjects_list:
        # Fallback values if site catalog scrape is empty/unavailable.
        known_subjects = {
            "year_1": [
                "Additional Mathematics", "Agricultural Science", "Agriculture", "Applied Technology", "Arabic",
                "Art and Design Foundation", "Arts and Design Studio", "Aviation and Aerospace Engineering", "Biology",
                "Biomedical Science", "Business Management", "Accounting", "Chemistry", "Computing",
                "Core Physical Education and Health", "Design and Communication Technology", "Economics",
                "Elective Physical Education and Health", "Engineering", "English Language", "Geography",
                "Ghanaian Language", "Government", "History", "Management in Living", "Food and Nutrition",
                "Clothing and Textiles", "Information Communication Technology", "Intervention English",
                "Intervention Mathematics", "Literature-in-English", "Manufacturing Engineering", "Mathematics",
                "Music", "Performing Arts", "Physics", "Religious Studies (Islamic)",
                "Religious Studies (Christian)", "Robotics", "General Science",
                "Religious and Moral Education", "Social Studies", "Spanish", "French",
            ],
            "year_2": [
                "Additional Mathematics", "Agricultural Science", "Agriculture", "Automotive and Metal Technology",
                "Building Construction and Wood Technology", "Electrical and Electronic Technology", "Arabic",
                "Art and Design Foundation", "Arts and Design Studio", "Aviation and Aerospace Engineering", "Biology",
                "Biomedical Science", "Accounting", "Business Management", "Chemistry",
                "Christian Religious Studies", "Computing", "Core Physical Education and Health",
                "Design and Communication Technology", "Economics", "Elective Physical Education and Health",
                "Engineering", "English Language", "French", "General Science", "Geography",
                "Ghanaian Language", "Government", "History", "Clothing and Textiles", "Food and Nutrition",
                "Management in Living", "Information Communication Technology", "Islamic Religious Studies",
                "Literature-in-English", "Manufacturing Engineering", "Mathematics", "Music",
                "Performing Arts", "Physics", "Religious and Moral Education", "Robotics",
                "Social Studies", "Spanish",
            ],
        }

        for year_key, names in known_subjects.items():
            for name in names:
                slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
                subjects_list.append(
                    {
                        "id": f"{year_key}:{slug}",
                        "name": name,
                        "year": "Year 1" if year_key == "year_1" else "Year 2",
                    }
                )

    subjects_list.sort(key=lambda x: (x["year"], x["name"]))
    return {"subjects": subjects_list}


@router.get("/question-types")
async def get_question_types():
    """Get available question types."""
    return {
        "types": [
            "multiple_choice",
            "short_answer",
            "essay",
            "true_false",
            "standard",
        ]
    }


@router.get("/resource-status")
async def get_resource_status(year: str, subject: str):
    """Get local cache status for a selected year+subject."""
    import re
    from app.services.curriculum_fetcher import CurriculumResourceFetcher

    year_key = year.lower().strip().replace(" ", "_")
    if year_key in {"1", "year1"}:
        year_key = "year_1"
    elif year_key in {"2", "year2"}:
        year_key = "year_2"
    if year_key not in {"year_1", "year_2"}:
        raise HTTPException(status_code=400, detail="Invalid year")

    subject_token = subject.lower().strip()
    if ":" in subject_token:
        token_year, token_subject = subject_token.split(":", 1)
        if token_year in {"year_1", "year_2"}:
            year_key = token_year
        subject_token = token_subject

    subject_slug = re.sub(r"[^a-z0-9_]+", "_", subject_token).strip("_")
    fetcher = CurriculumResourceFetcher()
    return {
        "year": year_key,
        "subject_slug": subject_slug,
        "status": fetcher.get_subject_resource_status(year_key, subject_slug),
    }


@router.post("/mark-practice", response_model=PracticeMarkResponse)
async def mark_practice(request: PracticeMarkRequest):
    """Mark student practice answers with objective + AI grading."""
    try:
        result = await generator.mark_practice_answers(request.items)
        if request.student_id:
            subject_key = request.subject or "general"
            world_class.update_student_mastery(request.student_id, subject_key, float(result.get("percentage", 0.0)))
        world_class.record_telemetry_event(
            "practice_marking",
            {
                "student_id": request.student_id or "anonymous",
                "subject": request.subject or "general",
                "percentage": result.get("percentage", 0.0),
            },
        )
        return PracticeMarkResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/curriculum/coverage")
async def get_curriculum_coverage(subject: str):
    """Get aggregate curriculum coverage from student activity signals."""
    return world_class.get_teacher_insights(subject)


@router.get("/students/{student_id}/mastery")
async def get_student_mastery(student_id: str):
    """Get adaptive mastery profile for a student."""
    return world_class.get_student_profile(student_id)


@router.get("/teacher/insights")
async def get_teacher_insights(subject: str):
    """Teacher-oriented class insight view."""
    return world_class.get_teacher_insights(subject)


@router.get("/system/reliability")
async def get_reliability():
    """Operational reliability snapshot."""
    return world_class.get_reliability_snapshot()


@router.post("/quiz/create", response_model=LiveQuizCreateResponse)
async def create_live_quiz(request: LiveQuizCreateRequest):
    """Create a live quiz room with generated questions and a shareable code."""
    from app.models import Subject, SUBJECT_ALIASES
    import re
    from app.services.curriculum_fetcher import CurriculumResourceFetcher

    player = request.player_name.strip()
    if not player:
        raise HTTPException(status_code=400, detail="Player name is required")

    subject_token = str(request.subject).lower().strip()
    year_key = None
    subject_slug = subject_token
    if ":" in subject_token:
        year_key, subject_slug = subject_token.split(":", 1)
    if request.year:
        y = request.year.lower().strip().replace(" ", "_")
        if y in {"year_1", "year_2"}:
            year_key = y
        elif y in {"1", "year1"}:
            year_key = "year_1"
        elif y in {"2", "year2"}:
            year_key = "year_2"
    if not year_key:
        year_key = "year_1"
    subject_id = re.sub(r"[^a-z0-9_]+", "_", subject_slug).strip("_")

    fetcher = CurriculumResourceFetcher()
    await fetcher.ensure_subject_resources(
        year_key=year_key,
        subject_slug=subject_id,
        resource_types=["past_questions", "textbooks", "teacher_resources"],
    )
    source_status = generator.get_source_status(year_key=year_key, subject_slug=subject_id)
    if source_status.get("source_used") == "none_found":
        raise HTTPException(status_code=404, detail="No source material found for selected subject")

    try:
        subject_enum = Subject(subject_id)
    except ValueError:
        subject_enum = Subject(SUBJECT_ALIASES.get(subject_id, Subject.ELECTIVES.value))

    questions = await generator.generate_questions(
        subject=subject_enum,
        question_type=request.question_type,
        num_questions=request.num_questions,
        difficulty_level=request.difficulty_level,
        topics=None,
        year_key=year_key,
        subject_slug=subject_id,
        subject_label=_resolve_subject_label(year_key, subject_id),
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
            "answers": {},  # player -> marking response
        }
    return LiveQuizCreateResponse(code=code, host_player=player, total_questions=len(questions))


@router.post("/quiz/join")
async def join_live_quiz(request: LiveQuizJoinRequest):
    code = request.code.strip().upper()
    player = request.player_name.strip()
    if not code or not player:
        raise HTTPException(status_code=400, detail="Code and player name are required")
    async with quiz_lock:
        session = quiz_sessions.get(code)
        if not session:
            raise HTTPException(status_code=404, detail="Quiz code not found")
        player_key = player.lower()
        if player_key not in session["players"]:
            session["players"][player_key] = {"name": player, "submitted": False, "score": 0.0, "percentage": 0.0}
    return {"status": "joined", "code": code, "player_name": player}


@router.get("/quiz/{code}/state")
async def get_live_quiz_state(code: str):
    quiz_code = code.strip().upper()
    async with quiz_lock:
        session = quiz_sessions.get(quiz_code)
        if not session:
            raise HTTPException(status_code=404, detail="Quiz code not found")
        public_questions = []
        for q in session["questions"]:
            public_questions.append(
                {
                    "question_text": q.get("question_text"),
                    "question_type": q.get("question_type"),
                    "options": q.get("options"),
                }
            )
                )

    subjects_list.sort(key=lambda x: (x["year"], x["name"]))
    return {"subjects": subjects_list}


@router.get("/question-types")
async def get_question_types():
    """Get available question types."""
    return {
        "types": [
            "multiple_choice",
            "short_answer",
            "essay",
            "true_false",
            "standard",
        ]
    }


@router.get("/resource-status")
async def get_resource_status(year: str, subject: str):
    """Get local cache status for a selected year+subject."""
    import re
    from app.services.curriculum_fetcher import CurriculumResourceFetcher

    year_key = year.lower().strip().replace(" ", "_")
    if year_key in {"1", "year1"}:
        year_key = "year_1"
    elif year_key in {"2", "year2"}:
        year_key = "year_2"
    if year_key not in {"year_1", "year_2"}:
        raise HTTPException(status_code=400, detail="Invalid year")

    subject_token = subject.lower().strip()
    if ":" in subject_token:
        token_year, token_subject = subject_token.split(":", 1)
        if token_year in {"year_1", "year_2"}:
            year_key = token_year
        subject_token = token_subject

    subject_slug = re.sub(r"[^a-z0-9_]+", "_", subject_token).strip("_")
    fetcher = CurriculumResourceFetcher()
    return {
        "year": year_key,
        "subject_slug": subject_slug,
        "status": fetcher.get_subject_resource_status(year_key, subject_slug),
    }


@router.post("/mark-practice", response_model=PracticeMarkResponse)
async def mark_practice(request: PracticeMarkRequest):
    """Mark student practice answers with objective + AI grading."""
    try:
        result = await generator.mark_practice_answers(request.items)
        if request.student_id:
            subject_key = request.subject or "general"
            world_class.update_student_mastery(request.student_id, subject_key, float(result.get("percentage", 0.0)))
        world_class.record_telemetry_event(
            "practice_marking",
            {
                "student_id": request.student_id or "anonymous",
                "subject": request.subject or "general",
                "percentage": result.get("percentage", 0.0),
            },
        )
        return PracticeMarkResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/curriculum/coverage")
async def get_curriculum_coverage(subject: str):
    """Get aggregate curriculum coverage from student activity signals."""
    return world_class.get_teacher_insights(subject)


@router.get("/students/{student_id}/mastery")
async def get_student_mastery(student_id: str):
    """Get adaptive mastery profile for a student."""
    return world_class.get_student_profile(student_id)


@router.get("/teacher/insights")
async def get_teacher_insights(subject: str):
    """Teacher-oriented class insight view."""
    return world_class.get_teacher_insights(subject)


@router.get("/system/reliability")
async def get_reliability():
    """Operational reliability snapshot."""
    return world_class.get_reliability_snapshot()


@router.post("/quiz/create", response_model=LiveQuizCreateResponse)
async def create_live_quiz(request: LiveQuizCreateRequest):
    """Create a live quiz room with generated questions and a shareable code."""
    from app.models import Subject, SUBJECT_ALIASES
    import re
    from app.services.curriculum_fetcher import CurriculumResourceFetcher

    player = request.player_name.strip()
    if not player:
        raise HTTPException(status_code=400, detail="Player name is required")

    subject_token = str(request.subject).lower().strip()
    year_key = None
    subject_slug = subject_token
    if ":" in subject_token:
        year_key, subject_slug = subject_token.split(":", 1)
    if request.year:
        y = request.year.lower().strip().replace(" ", "_")
        if y in {"year_1", "year_2"}:
            year_key = y
        elif y in {"1", "year1"}:
            year_key = "year_1"
        elif y in {"2", "year2"}:
            year_key = "year_2"
    if not year_key:
        year_key = "year_1"
    subject_id = re.sub(r"[^a-z0-9_]+", "_", subject_slug).strip("_")

    fetcher = CurriculumResourceFetcher()
    await fetcher.ensure_subject_resources(
        year_key=year_key,
        subject_slug=subject_id,
        resource_types=["past_questions", "textbooks", "teacher_resources"],
    )
    source_status = generator.get_source_status(year_key=year_key, subject_slug=subject_id)
    if source_status.get("source_used") == "none_found":
        raise HTTPException(status_code=404, detail="No source material found for selected subject")

    try:
        subject_enum = Subject(subject_id)
    except ValueError:
        subject_enum = Subject(SUBJECT_ALIASES.get(subject_id, Subject.ELECTIVES.value))

    questions = await generator.generate_questions(
        subject=subject_enum,
        question_type=request.question_type,
        num_questions=request.num_questions,
        difficulty_level=request.difficulty_level,
        topics=None,
        year_key=year_key,
        subject_slug=subject_id,
        subject_label=_resolve_subject_label(year_key, subject_id),
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
            "answers": {},  # player -> marking response
        }
    return LiveQuizCreateResponse(code=code, host_player=player, total_questions=len(questions))


@router.post("/quiz/join")
async def join_live_quiz(request: LiveQuizJoinRequest):
    code = request.code.strip().upper()
    player = request.player_name.strip()
    if not code or not player:
        raise HTTPException(status_code=400, detail="Code and player name are required")
    async with quiz_lock:
        session = quiz_sessions.get(code)
        if not session:
            raise HTTPException(status_code=404, detail="Quiz code not found")
        player_key = player.lower()
        if player_key not in session["players"]:
            session["players"][player_key] = {"name": player, "submitted": False, "score": 0.0, "percentage": 0.0}
    return {"status": "joined", "code": code, "player_name": player}


@router.get("/quiz/{code}/state")
async def get_live_quiz_state(code: str):
    quiz_code = code.strip().upper()
    async with quiz_lock:
        session = quiz_sessions.get(quiz_code)
        if not session:
            raise HTTPException(status_code=404, detail="Quiz code not found")
        public_questions = []
        for q in session["questions"]:
            public_questions.append(
                {
                    "question_text": q.get("question_text"),
                    "question_type": q.get("question_type"),
                    "options": q.get("options"),
                }
            )
        leaderboard = [
            {"player": name, **stats}
            for name, stats in session["players"].items()
        ]
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
        if not session:
            raise HTTPException(status_code=404, detail="Quiz code not found")
        if player_key not in session["players"]:
            raise HTTPException(status_code=404, detail="Player not in quiz room")
        questions = session["questions"]

    items = []
    for idx, q in enumerate(questions):
        items.append(
            PracticeMarkItem(
                question_text=q.get("question_text", ""),
                question_type=q.get("question_type", "multiple_choice"),
                correct_answer=q.get("correct_answer", ""),
                explanation=q.get("explanation", ""),
                options=q.get("options"),
                student_answer=request.answers[idx] if idx < len(request.answers) else "",
            )
        )

    result = await generator.mark_practice_answers(items)
    async with quiz_lock:
        session = quiz_sessions.get(quiz_code)
        if not session:
            raise HTTPException(status_code=404, detail="Quiz code not found")
        session["answers"][player_key] = result
        session["players"][player_key] = {
            "name": session["players"][player_key]["name"],
            "submitted": True,
            "score": result["score_obtained"],
            "percentage": result["percentage"],
        }

    return {"status": "submitted", "result": result}
