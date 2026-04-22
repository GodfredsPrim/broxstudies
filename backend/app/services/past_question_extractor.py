import json
import re
import logging
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from PyPDF2 import PdfReader
import threading

from app.config import settings
from app.models import Question, QuestionType, Subject

logger = logging.getLogger(__name__)

# Module-level cache to avoid re-extracting on every request
_extractor_cache = None
_cache_lock = threading.Lock()

@dataclass
class ExtractedQuestion:
    """Represents a question extracted from a PDF"""
    text: str
    question_type: QuestionType
    options: Optional[List[str]] = None
    correct_answer: str = ""
    explanation: str = ""
    marking_scheme: str = ""  # Full marking scheme for this question
    subject: str = ""
    year: str = ""
    source_file: str = ""

class PastQuestionExtractor:
    """Service to extract individual questions from past question PDFs and chief examiners reports"""
    
    # Class-level singleton and cache
    _instance = None
    _initialized = False

    def __new__(cls):
        """Implement singleton pattern to avoid re-extracting on every request"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        # Only initialize once
        if PastQuestionExtractor._initialized:
            return
            
        self.extracted_questions_cache: Dict[str, List[ExtractedQuestion]] = {}
        self.chief_examiners_questions: List[ExtractedQuestion] = []
        
        # Try to load from disk cache first
        cache_file = settings.DATA_DIR / "vector_store" / "questions_cache.json"
        if cache_file.exists():
            logger.info("Loading cached questions from disk...")
            self._load_from_cache_file(cache_file)
        else:
            # If no cache, extract all questions (only happens once)
            logger.info("No cache found, extracting questions from PDFs...")
            self._load_all_questions()
            # Save cache for next time
            self._save_cache_file(cache_file)
        
        PastQuestionExtractor._initialized = True

    def _ensure_loaded(self):
        """Questions are loaded in __init__ already"""
        pass

    def _load_from_cache_file(self, cache_file: Path) -> bool:
        """Load questions from disk cache"""
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Reconstruct ExtractedQuestion objects from cache
                for subject_slug, questions_data in data.get('subjects', {}).items():
                    self.extracted_questions_cache[subject_slug] = [
                        ExtractedQuestion(**q) for q in questions_data
                    ]
                self.chief_examiners_questions = [
                    ExtractedQuestion(**q) for q in data.get('chief_examiners', [])
                ]
                logger.info(f"Loaded {sum(len(q) for q in self.extracted_questions_cache.values())} cached questions")
                return True
        except Exception as e:
            logger.warning(f"Failed to load cache file: {str(e)}")
            return False

    def _save_cache_file(self, cache_file: Path):
        """Save extracted questions to disk cache"""
        try:
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            data = {
                'subjects': {
                    subject: [
                        {
                            'text': q.text,
                            'question_type': q.question_type.value,
                            'options': q.options,
                            'correct_answer': q.correct_answer,
                            'explanation': q.explanation,
                            'subject': q.subject,
                            'year': q.year,
                            'source_file': q.source_file
                        }
                        for q in questions
                    ]
                    for subject, questions in self.extracted_questions_cache.items()
                },
                'chief_examiners': [
                    {
                        'text': q.text,
                        'question_type': q.question_type.value,
                        'options': q.options,
                        'correct_answer': q.correct_answer,
                        'explanation': q.explanation,
                        'subject': q.subject,
                        'year': q.year,
                        'source_file': q.source_file
                    }
                    for q in self.chief_examiners_questions
                ]
            }
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
            logger.info(f"Saved questions cache to {cache_file}")
        except Exception as e:
            logger.error(f"Failed to save cache file: {str(e)}")

    def _load_all_questions(self):
        try:
            # Load from past questions (ZIP files)
            past_dir = settings.DATA_DIR / "past_questions"
            if past_dir.exists():
                for zip_file in past_dir.glob("*.zip"):
                    subject_name = zip_file.stem  # Remove .zip extension
                    # Convert to slug for cache key
                    subject_slug = re.sub(r'[^a-z0-9]+', '_', subject_name.lower()).strip('_')
                    questions = self._extract_questions_from_zip(zip_file, subject_slug)
                    if questions:
                        cache_key = subject_slug
                        self.extracted_questions_cache[cache_key] = questions

            # Load from chief examiners reports as general exam-standard examples
            cer_dir = settings.DATA_DIR / "chief_examiners_report"
            if cer_dir.exists():
                for pdf_file in cer_dir.glob("*.pdf"):
                    questions = self._extract_questions_from_pdf(pdf_file, "chief_examiners", "all_years")
                    if questions:
                        self.chief_examiners_questions.extend(questions)

            logger.info(
                f"Loaded {sum(len(q) for q in self.extracted_questions_cache.values())} subject-specific questions "
                f"and {len(self.chief_examiners_questions)} chief examiners examples"
            )

        except Exception as e:
            logger.error(f"Error loading questions: {str(e)}")

    def _extract_questions_from_zip(self, zip_path: Path, subject_slug: str) -> List[ExtractedQuestion]:
        """Extract questions from all PDFs in a ZIP file"""
        questions = []
        try:
            import zipfile
            import tempfile
            import os

            with tempfile.TemporaryDirectory() as temp_dir:
                with zipfile.ZipFile(zip_path, 'r') as archive:
                    pdf_members = [m for m in archive.namelist() if m.lower().endswith('.pdf')]
                    for pdf_member in pdf_members:
                        try:
                            # Extract to temporary file
                            archive.extract(pdf_member, temp_dir)
                            temp_pdf_path = Path(temp_dir) / pdf_member
                            
                            # Extract year from filename if possible
                            year = "unknown"
                            if "20" in pdf_member:
                                year_match = re.search(r'20\d{2}', pdf_member)
                                if year_match:
                                    year = year_match.group(0)

                            pdf_questions = self._extract_questions_from_pdf(temp_pdf_path, subject_slug, year)
                            questions.extend(pdf_questions)
                            
                            # Clean up
                            if temp_pdf_path.exists():
                                temp_pdf_path.unlink()
                                
                        except Exception as e:
                            logger.warning(f"Error extracting from {pdf_member} in {zip_path.name}: {str(e)}")
                            continue
        except Exception as e:
            logger.error(f"Error processing ZIP file {zip_path}: {str(e)}")

        return questions

    def _extract_questions_from_pdf(self, pdf_path: Path, subject: str, year: str) -> List[ExtractedQuestion]:
        """Extract individual questions from a PDF file"""
        try:
            reader = PdfReader(str(pdf_path))
            return self._extract_questions_from_reader(reader, subject, year, str(pdf_path))
        except Exception as e:
            logger.error(f"Error extracting questions from {pdf_path}: {str(e)}")
            return []

    def _extract_questions_from_pdf_stream(self, pdf_stream, subject: str, year: str, source_file: str) -> List[ExtractedQuestion]:
        """Extract individual questions from a PDF stream"""
        try:
            reader = PdfReader(pdf_stream)
            return self._extract_questions_from_reader(reader, subject, year, source_file)
        except Exception as e:
            logger.error(f"Error extracting questions from stream {source_file}: {str(e)}")
            return []

    def _extract_questions_from_reader(self, reader, subject: str, year: str, source_file: str) -> List[ExtractedQuestion]:
        """Extract questions from a PDF reader, preserving their original format"""
        questions = []
        
        try:
            # Extract ALL text from the PDF (don't limit pages - need the full exam paper)
            full_text = ""
            for page_num in range(len(reader.pages)):
                try:
                    text = reader.pages[page_num].extract_text()
                    if text:
                        full_text += text + "\n"
                except Exception as e:
                    logger.warning(f"Error extracting page {page_num} from {source_file}: {str(e)}")
                    continue
            
            if not full_text.strip():
                return questions
            
            # Extract marking scheme first
            marking_scheme = self._extract_marking_scheme(full_text)
            
            # Split questions by detecting numbered patterns (1., 2., 3., etc.)
            # This preserves the actual question structure
            questions_text = re.split(r'\n(?=\d+\.)', full_text)
            
            for question_text in questions_text:
                question_text = question_text.strip()
                if not question_text or len(question_text) < 50:  # Skip very short lines
                    continue
                
                # Detect question type
                question_type = self._detect_question_type(question_text)
                
                # Extract options if it's MCQ
                options = None
                correct_answer = ""
                if question_type == QuestionType.MULTIPLE_CHOICE:
                    options = self._extract_options(question_text)
                
                # Extract marking scheme for this question
                question_marking = self._get_question_marking_scheme(question_text, marking_scheme)
                
                # Create the question object with the FULL, ORIGINAL text
                question = ExtractedQuestion(
                    text=question_text,
                    question_type=question_type,
                    options=options,
                    correct_answer=correct_answer,
                    subject=subject,
                    year=year,
                    source_file=source_file,
                    marking_scheme=question_marking
                )
                questions.append(question)
                    
        except Exception as e:
            logger.error(f"Error processing PDF text from {source_file}: {str(e)}")
        
        logger.info(f"Extracted {len(questions)} questions from {source_file}")
        return questions
    
    def _detect_question_type(self, question_text: str) -> QuestionType:
        """Detect if a question is MCQ or essay based on content"""
        # Check for answer options (A), (B), (C), (D) or similar patterns
        if re.search(r'\([A-D]\)', question_text) or re.search(r'[A-D]\.\s+', question_text):
            return QuestionType.MULTIPLE_CHOICE
        # Check for "Discuss", "Explain", "Write", etc. which indicate essays
        elif re.search(r'\b(discuss|explain|write|describe|analyze|evaluate|compare)\b', question_text, re.IGNORECASE):
            return QuestionType.ESSAY
        else:
            # Default to essay for structured questions
            return QuestionType.ESSAY
    
    def _extract_options(self, question_text: str) -> Optional[List[str]]:
        """Extract multiple choice options if present"""
        options = []
        # Look for patterns like (A) text (B) text (C) text (D) text
        option_pattern = r'\([A-D]\)\s*([^\n()]+)'
        matches = re.findall(option_pattern, question_text)
        if matches and len(matches) >= 2:  # At least 2 options
            return matches[:4]  # Max 4 options
        return None

    def _parse_question_text(self, question_text: str, options: List[str], subject: str, year: str, source_file: str) -> Optional[ExtractedQuestion]:
        """Parse question text and determine question type"""
        try:
            if not question_text.strip():
                return None

            # Determine question type
            if options and len(options) >= 2:
                question_type = QuestionType.MULTIPLE_CHOICE
            else:
                question_type = QuestionType.ESSAY

            return ExtractedQuestion(
                text=question_text.strip(),
                question_type=question_type,
                options=options if options else None,
                subject=subject,
                year=year,
                source_file=source_file
            )

        except Exception as e:
            logger.error(f"Error parsing question: {str(e)}")
            return None

    def get_random_questions_for_subject(self, subject_slug: str, num_questions: int = 46, question_type: Optional[QuestionType] = None) -> List[Question]:
        """Get random questions for a subject, pooled from different years and sources."""
        self._ensure_loaded()
        try:
            # Map common subject names to cache keys
            subject_mapping = {
                'mathematics': 'core_mathematics',
                'core_mathematics': 'core_mathematics',
                'english': 'english_language',
                'english_language': 'english_language',
                'science': 'integrated_science',
                'integrated_science': 'integrated_science',
                'social_studies': 'social_studies',
                'ict': 'elective_ict',
                'chemistry': 'chemistry',
                'physics': 'physics',
                'biology': 'biology',
            }
            
            cache_key = subject_mapping.get(subject_slug, subject_slug)
            
            if cache_key not in self.extracted_questions_cache:
                for key in self.extracted_questions_cache.keys():
                    if subject_slug in key or key in subject_slug:
                        cache_key = key
                        break
                else:
                    return []

            all_pool = self.extracted_questions_cache[cache_key]
            
            # Sampling Strategy: Group by year to ensure variety
            by_year = {}
            for q in all_pool:
                year = q.year or "unknown"
                if year not in by_year:
                    by_year[year] = []
                by_year[year].append(q)
            
            # Filter pool if type requested
            if question_type:
                all_pool = [q for q in all_pool if q.question_type == question_type]

            import random
            
            # If we want a mixed WASSCE mock (standard 46), we sample across years
            selected_extracted = []
            available_years = list(by_year.keys())
            
            if len(all_pool) > num_questions:
                # Balanced sampling across years
                q_per_year = max(1, num_questions // len(available_years)) if available_years else num_questions
                for year in available_years:
                    year_pool = by_year[year]
                    if question_type:
                        year_pool = [q for q in year_pool if q.question_type == question_type]
                    
                    sampled = random.sample(year_pool, min(len(year_pool), q_per_year))
                    selected_extracted.extend(sampled)
                
                # Fill remaining if any
                remaining = num_questions - len(selected_extracted)
                if remaining > 0:
                    leftover_pool = [q for q in all_pool if q not in selected_extracted]
                    selected_extracted.extend(random.sample(leftover_pool, min(len(leftover_pool), remaining)))
            else:
                selected_extracted = all_pool

            # Convert to Question model format
            result = []
            for i, q in enumerate(selected_extracted):
                result.append(Question(
                    id=f"pq_{i+1}",
                    subject=self._normalize_subject(subject_slug),
                    question_type=q.question_type,
                    question_text=q.text,
                    options=q.options,
                    correct_answer=q.correct_answer or "See explanation",
                    explanation=q.explanation or f"Source: WASSCE Past Question ({q.year})",
                    marking_scheme=q.marking_scheme,
                    difficulty_level="medium",
                    year_generated=int(q.year) if q.year.isdigit() else 2024,
                    pattern_confidence=0.95
                ))

            logger.info(f"Pooled {len(result)} questions across {len(available_years)} years for {subject_slug}")
            return result

        except Exception as e:
            logger.error(f"Error getting pooled questions for {subject_slug}: {str(e)}")
            return []

    def _extract_marking_scheme(self, full_text: str) -> Dict[str, str]:
        """Extract marking scheme from the PDF text"""
        marking_scheme = {}
        
        # Look for marking scheme section
        marking_patterns = [
            r'MARKING SCHEME\s*\n(.*?)(?:\n\s*\n|\n[A-Z]{3,}|\Z)',
            r'ANSWERS?\s*\n(.*?)(?:\n\s*\n|\n[A-Z]{3,}|\Z)',
            r'MARKING\s*\n(.*?)(?:\n\s*\n|\n[A-Z]{3,}|\Z)',
        ]
        
        for pattern in marking_patterns:
            match = re.search(pattern, full_text, re.DOTALL | re.IGNORECASE)
            if match:
                marking_text = match.group(1).strip()
                # Split by question numbers
                question_matches = re.findall(r'(\d+)\.\s*(.*?)(?=\n\d+\.|$)', marking_text, re.DOTALL)
                for q_num, answer in question_matches:
                    marking_scheme[q_num] = answer.strip()
                break
        
        return marking_scheme

    def _get_question_marking_scheme(self, question_text: str, marking_scheme: Dict[str, str]) -> str:
        """Get the marking scheme for a specific question"""
        # Extract question number from the beginning
        q_num_match = re.match(r'^(\d+)\.', question_text.strip())
        if q_num_match:
            q_num = q_num_match.group(1)
            return marking_scheme.get(q_num, "")
        return ""

    def _normalize_subject(self, subject_slug: str) -> Subject:
        """Normalize subject slug to Subject enum"""
        from app.models import SUBJECT_ALIASES

        normalized = SUBJECT_ALIASES.get(subject_slug.lower().replace('_', ' '), subject_slug)
        try:
            return Subject(normalized)
        except ValueError:
            return Subject.MATHEMATICS  # fallback

    def get_available_subjects(self) -> List[str]:
        """Get list of subjects that have extracted questions"""
        self._ensure_loaded()
        return sorted(list(self.extracted_questions_cache.keys()))