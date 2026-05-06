import asyncio
import logging
import re
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import json

from app.services.auth_service import AuthService
from app.services.question_generator import QuestionGenerator
from app.models import GeneratedQuestions, Subject, SUBJECT_ALIASES, QuestionType

logger = logging.getLogger(__name__)

from app.config import settings

class GenerationService:
    def __init__(self):
        self.auth_service = AuthService()
        self.question_generator = QuestionGenerator()
        self._running_jobs = set()  # Track running job IDs to prevent duplicates

    async def start_generation_job(self, job_id: str) -> None:
        """Start processing a generation job asynchronously."""
        if job_id in self._running_jobs:
            logger.warning(f"Job {job_id} is already running")
            return

        self._running_jobs.add(job_id)
        
        try:
            # Get the job
            job = self.auth_service.get_generation_job(job_id)
            if not job:
                logger.error(f"Job {job_id} not found")
                return

            if job['status'] != 'pending':
                logger.warning(f"Job {job_id} is not in pending status: {job['status']}")
                return

            # Update status to processing
            self.auth_service.update_generation_job_status(job_id, 'processing')

            # Process the generation request
            request_data = job['request_data']
            
            try:
                # Call the synchronous generation method
                result = await self._generate_questions_async(request_data)
                
                # Update job with success
                self.auth_service.update_generation_job_status(
                    job_id, 
                    'completed', 
                    result_data=result.model_dump() if hasattr(result, 'model_dump') else result
                )
                
                logger.info(f"Job {job_id} completed successfully")
                
            except Exception as e:
                logger.error(f"Job {job_id} failed: {str(e)}")
                self.auth_service.update_generation_job_status(
                    job_id, 
                    'failed', 
                    error_message=str(e)
                )
                
        finally:
            self._running_jobs.discard(job_id)

    async def _generate_questions_async(self, request_data: Dict[str, Any]) -> GeneratedQuestions:
        """Async wrapper for question generation."""
        import time
        start_time = time.time()
        
        # This runs the synchronous generation in a thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        
        # Import here to avoid circular imports
        from app.routes.questions import _resolve_subject_label
        from app.services.batch_loader import BatchLoader
        from app.services.likely_wassce_generator import LikelyWASSCEGenerator
        from app.services.world_class_engine import WorldClassEngine
        from app.services.curriculum_fetcher import CurriculumResourceFetcher
        
        # Reconstruct the generation logic from the questions route
        subject_token = str(request_data.get('subject', '')).lower().strip()
        year_key = None
        subject_slug = subject_token

        if ":" in subject_token:
            year_key, subject_slug = subject_token.split(":", 1)

        if request_data.get('year'):
            request_year = request_data['year'].lower().strip().replace(" ", "_")
            if request_year in {"year_1", "year_2", "year_3"}:
                year_key = request_year
            elif request_year in {"1", "year1"}:
                year_key = "year_1"
            elif request_year in {"2", "year2"}:
                year_key = "year_2"
            elif request_year in {"3", "year3", "year_3"}:
                year_key = "year_3"

        if not year_key:
            year_key = "year_1"

        subject_id = re.sub(r"[^a-z0-9_]+", "_", subject_slug).strip("_")

        # Check if this is a request for "likely wassce questions"
        is_likely_wassce = request_data.get('question_type') == "standard" and request_data.get('num_questions') == 46

        world_class = WorldClassEngine()
        likely_wassce_generator = LikelyWASSCEGenerator()
        fetcher = CurriculumResourceFetcher()
        
        source_status = self.question_generator.get_source_status(year_key=year_key, subject_slug=subject_id)
        fetch_summary = {}

        # For WASSCE-style standardized past-paper requests
        if not is_likely_wassce:
            fetch_summary = await fetcher.ensure_subject_resources(
                year_key=year_key,
                subject_slug=subject_id,
                resource_types=["past_questions", "textbooks", "teacher_resources", "syllabi"],
            )
            source_status = self.question_generator.get_source_status(year_key=year_key, subject_slug=subject_id)
            if source_status.get("source_used") == "none_found":
                logger.info(f"No source material found for {subject_id}, will fallback to AI knowledge")
                source_status["source_used"] = "ai_generated"
        
        try:
            from app.models import Subject
            subject_enum = Subject(subject_id)
        except ValueError:
            subject_enum = Subject(SUBJECT_ALIASES.get(subject_id, Subject.ELECTIVES.value))

        # Convert question_type string to QuestionType enum
        question_type_str = request_data.get('question_type', 'multiple_choice')
        try:
            question_type_enum = QuestionType(question_type_str)
        except ValueError:
            question_type_enum = QuestionType.MULTIPLE_CHOICE

        organized_papers = None
        if is_likely_wassce:
            # Use past question extractor for likely WASSCE questions
            from app.services.past_question_extractor import PastQuestionExtractor
            extractor = PastQuestionExtractor()

            questions = extractor.get_random_questions_for_subject(
                subject_slug=subject_id,
                num_questions=request_data.get('num_questions', 10),
                question_type=None
            )

            if not questions:
                logger.warning(f"No past questions found for {subject_id}, falling back to AI generation")
                questions = await self.question_generator.generate_questions(
                    subject=subject_enum,
                    question_type=question_type_enum,
                    num_questions=request_data.get('num_questions', 10),
                    difficulty_level=request_data.get('difficulty_level', 'medium'),
                    topics=request_data.get('topics'),
                    year_key=year_key,
                )
        else:
            # Regular AI generation
            questions = await self.question_generator.generate_questions(
                subject=subject_enum,
                question_type=question_type_enum,
                num_questions=request_data.get('num_questions', 10),
                difficulty_level=request_data.get('difficulty_level', 'medium'),
                topics=request_data.get('topics'),
                year_key=year_key,
            )

        return GeneratedQuestions(
            questions=questions,
            generation_time=time.time() - start_time,
            model_used=settings.resolved_llm_model,
            source_used=source_status.get("source_used", "ai_generated"),
        )

# Global instance
generation_service = GenerationService()