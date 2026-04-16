import json
import random
import logging
import asyncio
import io
import re
import zipfile
from pathlib import Path

from langchain_openai import ChatOpenAI
from PyPDF2 import PdfReader

from app.config import settings
from app.models import Question, QuestionType, Subject, PracticeMarkItem

logger = logging.getLogger(__name__)


class QuestionGenerator:
    def __init__(self):
        self.llms: dict[float, ChatOpenAI] = {}

    async def generate_questions(
        self,
        subject: Subject,
        question_type: QuestionType,
        num_questions: int,
        difficulty_level=None,
        topics=None,
        year_key: str = "year_1",
        subject_slug: str = "",
        subject_label: str | None = None,
        semester: str = "all_year",
    ):
        """Generate questions based on patterns from past questions."""
        if question_type == QuestionType.STANDARD:
            logger.info(f"Generating full standard exam (40 MCQ + 6 Theory) for {subject.value}")
            try:
                # Parallel generation to handle the large standard request faster
                mcq_task = asyncio.create_task(
                    self._generate_single_batch(subject, QuestionType.MULTIPLE_CHOICE, 40, difficulty_level, topics, year_key, subject_slug, subject_label, semester)
                )
                theory_task = asyncio.create_task(
                    self._generate_single_batch(subject, QuestionType.ESSAY, 6, difficulty_level, topics, year_key, subject_slug, subject_label, semester)
                )
                mcq_questions, theory_questions = await asyncio.gather(mcq_task, theory_task)
                return mcq_questions + theory_questions
            except Exception as e:
                logger.error(f"Error generating standard exam: {str(e)}")
                raise Exception(f"Error generating standard exam: {str(e)}")

        return await self._generate_single_batch(
            subject, question_type, num_questions, difficulty_level, topics, year_key, subject_slug, subject_label, semester
        )

    async def _generate_single_batch(
        self,
        subject: Subject,
        question_type: QuestionType,
        num_questions: int,
        difficulty_level,
        topics,
        year_key: str,
        subject_slug: str,
        subject_label: str | None,
        semester: str = "all_year",
    ):
        try:
            logger.info(f"Generating {num_questions} {difficulty_level or 'medium'} level {question_type.value} questions for {subject.value}")
            prompt = self._build_prompt(
                subject,
                question_type,
                num_questions,
                difficulty_level,
                topics,
                year_key,
                subject_slug,
                subject_label,
                semester,
            )
            response = await asyncio.wait_for(self._call_llm(prompt), timeout=120.0)
            questions = self._parse_response(response, subject, question_type, num_questions)
            return await self._validate_and_repair_questions(questions, subject, question_type)
        except asyncio.TimeoutError:
            error_msg = "Question generation took too long (timeout after 120 seconds). Please try again."
            logger.error(error_msg)
            raise Exception(error_msg)
        except Exception as e:
            logger.error(f"Error generating questions: {str(e)}")
            raise Exception(f"Error generating questions: {str(e)}")

    def _get_llm(self, temperature: float = 0.85) -> ChatOpenAI:
        if temperature in self.llms:
            return self.llms[temperature]
        api_key = settings.resolved_llm_api_key
        if not api_key:
            raise ValueError(
                "No LLM API key configured. Set OPENAI_API_KEY, or set DEEPSEEK_API_KEY "
                "for question generation with an OpenAI-compatible chat endpoint."
            )

        kwargs = {
            "model": settings.resolved_llm_model,
            "api_key": api_key,
            "temperature": temperature,
            "request_timeout": 120.0,  # Add timeout
            "max_retries": 3,  # Retry on failure
        }
        if settings.resolved_llm_base_url:
            kwargs["base_url"] = settings.resolved_llm_base_url

        logger.info(f"Initializing LLM: {settings.resolved_llm_model} (temperature={temperature})")
        llm = ChatOpenAI(**kwargs)
        self.llms[temperature] = llm
        return llm

    def _build_prompt(
        self,
        subject: Subject,
        question_type: QuestionType,
        num_questions: int,
        difficulty: str,
        topics: list,
        year_key: str,
        subject_slug: str,
        subject_label: str | None,
        semester: str = "all_year",
    ) -> str:
        """Build the prompt for question generation."""
        difficulty = difficulty or random.choice(["easy", "medium", "hard"])
        topic_list = topics or ["General"]
        topic_text = ", ".join(topic_list)
        past_context, textbook_context, teacher_context = self._load_resource_context(year_key, subject_slug)
        past_block = past_context if past_context else "No matching past-question file found. Use textbook-only mode."
        textbook_block = textbook_context if textbook_context else (
            "Skipped: past-question excerpts are available for this subject."
            if past_context
            else "No matching textbook excerpts found."
        )
        teacher_block = teacher_context if teacher_context else "No teacher resource excerpts found."

        display_subject = subject_label or subject_slug.replace("_", " ").title() or subject.value

        # WAEC specific prompt augmentations for Essays
        essay_augmentation = ""
        if question_type == QuestionType.ESSAY:
            essay_augmentation = """
*** CRITICAL WAEC ESSAY STRUCTURE REQUIRED ***
You MUST structure each essay question EXACTLY like a real WASSCE examination paper.
Every single essay question MUST contain deeply nested sub-questions. Do not write a simple one-sentence essay question.
Format example:
"1. (a) (i) Define the term... (ii) State two functions of...
    (b) Using the principle of... calculate..."
Make sure the sub-questions are logically related but test different cognitive levels (recall vs application).
"""

        math_augmentation = ""
        subject_search = (subject_label or subject_slug).lower()
        if any(kw in subject_search for kw in ["math", "physics", "accounting"]):
            math_augmentation = """
*** CRITICAL QUANTITATIVE RULE ***
You MUST generate purely quantitative, computational problems. Do NOT generate generic book explanations, theory, definitions, or "What is" questions for this subject. All generated questions must require solving for a numerical or algebraic value, strictly following the format and style of the Past Question Excerpts.
"""

        semester_context = ""
        if semester == "semester_1":
            semester_context = "\nFOCUS: First Semester (Sem 1) curriculum topics only."
        elif semester == "semester_2":
            semester_context = "\nFOCUS: Second Semester (Sem 2) curriculum topics and final exam preparation topics."

        return f"""Generate {num_questions} distinct {difficulty} level {question_type.value.replace('_', ' ')} questions for Ghana SHS {display_subject} ({year_key.replace('_', ' ').title()}){semester_context}.

Requirements:
1. Follow the pattern and style of typical Ghana SHS exam questions.
2. Be appropriate for secondary school students.
3. Have a clear, single correct answer or highly robust explanation marking guide.
4. Include a detailed explanation marking guide to allow accurate automated grading.
5. Cover these topics when relevant: {topic_text}.
6. PRIORITY: use past-question excerpts first for style/structure, and use textbook excerpts for topical coverage.
7. If past-question excerpts are available, do NOT use textbook excerpts at all; derive questions from past-question patterns only.
8. If past-question excerpts are unavailable for this subject, generate from textbook excerpts only.
9. Use teacher resource notes to improve tips/tricks and exam strategy where available.

*** CRITICAL RANDOMIZATION DIRECTIVE ***
Seed Token: {random.randint(10000, 99999)}
Creative Strategy: {random.choice(["lateral thinking", "deep application", "conceptual variation", "uncommon scenarios"])}
Instruction: If the provided topics list is "General", you MUST spontaneously select a specific, random sub-topic from the Provided Excerpts below to focus on. Ensure that multiple generations for the same subject result in completely different topical coverage.
You MUST generate completely unique, novel and varied questions. ABSOLUTELY AVOID repeating standardized textbook examples or common exam tropes. 
- Randomize numerical values and units.
- Focus on diverse sub-topics from the curriculum.
- Ensure zero repetition of phrasing or patterns across generations.
- Use variety in question stems (e.g., 'Analyze...', 'Justify...', 'Determine...', 'Construct...').

*** YEAR 3 WASSCE PREPARATION RULE ***
If the requested year is Year 3, you MUST strictly and accurately follow the structure, tone, and specific patterns found in the Provided Past Question Excerpts. Do NOT generate synthetic theory questions if past patterns for that topic are available. All Year 3 questions must feel like actual examination content.
{essay_augmentation}
{math_augmentation}
Past Question Excerpts:
{past_block}

Textbook Excerpts:
{textbook_block}

Teacher Resource Excerpts:
{teacher_block}

Return valid JSON only as an array of exactly {num_questions} objects with this structure:
[
  {{
    "question": "The question text here (including any structured (a)(i) formats)",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "Option A (or leave empty for essays)",
    "explanation": "Detailed marking rubric or explanation to be used for grading",
    "difficulty": "{difficulty}",
    "topic": "Topic name"
  }}
]

Only include "options" for multiple choice questions (omit for essay). Each question must be distinct and follow a strictly randomized selection of topics from the sources provided. Do not include markdown or extra commentary. Produce valid JSON only."""

    def _load_resource_context(self, year_key: str, subject_slug: str) -> tuple[str, str, str]:
        """Load context from site resources and fallback past questions."""
        years_to_check = [year_key]
        if year_key == "year_3":
            # Mixed resource: pull from all SHS years if year 3 is selected
            years_to_check = ["year_1", "year_2", "year_3"]

        past_snippets = []
        textbook_snippets = []
        teacher_snippets = []

        for yk in years_to_check:
            textbooks_dir = settings.SITE_RESOURCE_DIR / "textbooks" / yk / subject_slug
            past_dir = settings.SITE_RESOURCE_DIR / "past_questions" / yk / subject_slug
            teacher_dir = settings.SITE_RESOURCE_DIR / "teacher_resources" / yk / subject_slug

            past_context = self._extract_excerpts_from_directory(past_dir, max_docs=2)
            if not past_context:
                past_context = self._extract_excerpts_from_legacy_past_questions(subject_slug, max_docs=1)
            
            if past_context:
                past_snippets.append(f"--- {yk.replace('_', ' ').title()} Past Questions ---\n{past_context}")

            # Mix textbook and teacher notes for better topical coverage
            textbook_context = self._extract_excerpts_from_directory(textbooks_dir, max_docs=1)
            if textbook_context:
                textbook_snippets.append(f"--- {yk.replace('_', ' ').title()} Textbook ---\n{textbook_context}")

            teacher_context = self._extract_excerpts_from_directory(teacher_dir, max_docs=1)
            if teacher_context:
                teacher_snippets.append(f"--- {yk.replace('_', ' ').title()} Teacher Notes ---\n{teacher_context}")

        return (
            "\n\n".join(past_snippets) if past_snippets else "",
            "\n\n".join(textbook_snippets) if textbook_snippets else "",
            "\n\n".join(teacher_snippets) if teacher_snippets else ""
        )

    def get_source_status(self, year_key: str, subject_slug: str) -> dict:
        """Return which resource source is available for generation."""
        site_past_dir = settings.SITE_RESOURCE_DIR / "past_questions" / year_key / subject_slug
        site_textbook_dir = settings.SITE_RESOURCE_DIR / "textbooks" / year_key / subject_slug
        site_teacher_dir = settings.SITE_RESOURCE_DIR / "teacher_resources" / year_key / subject_slug

        has_site_past = site_past_dir.exists() and any(site_past_dir.rglob("*.pdf"))
        has_site_textbook = site_textbook_dir.exists() and any(site_textbook_dir.rglob("*.pdf"))
        has_site_teacher = site_teacher_dir.exists() and any(site_teacher_dir.rglob("*.pdf"))
        has_legacy_past = bool(self._extract_excerpts_from_legacy_past_questions(subject_slug, max_docs=1))

        has_past = has_site_past or has_legacy_past
        has_textbook = has_site_textbook

        if has_past:
            source_used = "past_questions_only"
        elif has_textbook:
            source_used = "textbook_only"
        else:
            source_used = "none_found"

        return {
            "source_used": source_used,
            "has_site_past": has_site_past,
            "has_legacy_past": has_legacy_past,
            "has_site_textbook": has_site_textbook,
            "has_site_teacher": has_site_teacher,
        }

    def _extract_excerpts_from_directory(self, root: Path, max_docs: int = 2, max_chars: int = 900) -> str:
        if not root.exists():
            return ""

        snippets = []
        pdf_files = list(root.rglob("*.pdf"))
        random.shuffle(pdf_files)
        pdf_files = pdf_files[:max_docs]
        for pdf_path in pdf_files:
            text = self._read_pdf_excerpt(pdf_path, max_chars=max_chars)
            if text:
                snippets.append(f"- ({pdf_path.name}) {text}")

        return "\n".join(snippets)

    def _extract_excerpts_from_legacy_past_questions(self, subject_slug: str, max_docs: int = 2) -> str:
        legacy_dir = settings.DATA_DIR / "past_questions"
        if not legacy_dir.exists():
            return ""

        terms = [term for term in subject_slug.split("_") if term]
        candidates = []
        for item in sorted(legacy_dir.iterdir()):
            name_key = re.sub(r"[^a-z0-9]+", "_", item.stem.lower()).strip("_")
            if any(term in name_key for term in terms):
                candidates.append(item)

        snippets = []
        for item in candidates[:max_docs]:
            if item.suffix.lower() == ".pdf":
                text = self._read_pdf_excerpt(item)
                if text:
                    snippets.append(f"- ({item.name}) {text}")
            elif item.suffix.lower() == ".zip":
                text = self._read_first_pdf_from_zip(item)
                if text:
                    snippets.append(f"- ({item.name}) {text}")

        return "\n".join(snippets)

    def _read_pdf_excerpt(self, pdf_path: Path, max_chars: int = 900) -> str:
        try:
            reader = PdfReader(str(pdf_path))
            text_parts = []
            for page in reader.pages[:4]:
                text_parts.append((page.extract_text() or "").strip())
            combined = " ".join(part for part in text_parts if part)
            return combined[:max_chars]
        except Exception:
            return ""

    def _read_first_pdf_from_zip(self, zip_path: Path, max_chars: int = 900) -> str:
        try:
            with zipfile.ZipFile(zip_path, "r") as archive:
                pdf_members = [m for m in archive.namelist() if m.lower().endswith(".pdf")]
                if not pdf_members:
                    return ""
                with archive.open(pdf_members[0]) as pdf_file:
                    reader = PdfReader(io.BytesIO(pdf_file.read()))
                    text_parts = []
                    for page in reader.pages[:4]:
                        text_parts.append((page.extract_text() or "").strip())
                    combined = " ".join(part for part in text_parts if part)
                    return combined[:max_chars]
        except Exception:
            return ""

    async def _call_llm(self, prompt: str, temperature: float = 0.85) -> str:
        """Call the LLM to generate a response."""
        try:
            logger.debug("Calling LLM with prompt...")
            from langchain_core.messages import HumanMessage
            message = await self._get_llm(temperature=temperature).ainvoke([HumanMessage(content=prompt)])
            logger.info("LLM response received successfully")
            return message.content
        except Exception as e:
            logger.error(f"LLM call failed: {str(e)}")
            raise

    async def _validate_and_repair_questions(
        self,
        questions: list[Question],
        subject: Subject,
        question_type: QuestionType,
    ) -> list[Question]:
        if not questions:
            return questions

        repaired_questions: list[Question] = []
        for start in range(0, len(questions), 10):
            batch = questions[start:start + 10]
            repaired_questions.extend(
                await self._repair_question_batch(batch, subject, question_type)
            )
        return repaired_questions

    async def _repair_question_batch(
        self,
        questions: list[Question],
        subject: Subject,
        question_type: QuestionType,
    ) -> list[Question]:
        serialized_questions = [
            {
                "question": question.question_text,
                "options": question.options,
                "correct_answer": question.correct_answer,
                "explanation": question.explanation,
                "difficulty": question.difficulty_level,
            }
            for question in questions
        ]

        prompt = (
            "Review the following generated exam questions for internal consistency. "
            "Check that each correct_answer matches the options and the explanation, and that the explanation's final conclusion agrees with the correct_answer. "
            "If any item is inconsistent, fix it. Preserve the question style and difficulty. "
            "Return valid JSON only as an array with the same number of objects and keys.\n"
            f"Subject: {subject.value}\n"
            f"Question type: {question_type.value}\n"
            f"Questions:\n{json.dumps(serialized_questions, ensure_ascii=False)}"
        )

        try:
            response = await asyncio.wait_for(self._call_llm(prompt, temperature=0.1), timeout=90.0)
            json_start = response.find("[")
            json_end = response.rfind("]") + 1
            reviewed = json.loads(response[json_start:json_end])
            if not isinstance(reviewed, list) or len(reviewed) != len(questions):
                return questions

            repaired = []
            for original, item in zip(questions, reviewed):
                repaired.append(
                    Question(
                        subject=original.subject,
                        question_type=original.question_type,
                        question_text=item.get("question", original.question_text),
                        options=item.get("options", original.options) if original.question_type == QuestionType.MULTIPLE_CHOICE else original.options,
                        correct_answer=item.get("correct_answer", original.correct_answer),
                        explanation=item.get("explanation", original.explanation),
                        difficulty_level=item.get("difficulty", original.difficulty_level),
                        year_generated=original.year_generated,
                        pattern_confidence=original.pattern_confidence,
                    )
                )
            return repaired
        except Exception:
            logger.warning("Question consistency review failed; returning original questions.")
            return questions

    def _normalize_answer(self, text: str) -> str:
        return re.sub(r"\s+", " ", (text or "").strip().lower())

    def _mcq_match(self, student_answer: str, correct_answer: str, options: list[str] | None) -> bool:
        s = self._normalize_answer(student_answer)
        c = self._normalize_answer(correct_answer)
        if not s:
            return False
        if s == c:
            return True

        # Accept letter choices like A/B/C/D
        if options:
            letters = ["a", "b", "c", "d", "e", "f"]
            for idx, option in enumerate(options):
                if idx >= len(letters):
                    break
                letter = letters[idx]
                opt_norm = self._normalize_answer(option)
                if c in {letter, f"option {letter}", opt_norm} and s in {letter, f"option {letter}", opt_norm}:
                    return True
        return False

    async def mark_practice_answers(self, items: list[PracticeMarkItem]) -> dict:
        if not items:
            return {"total_questions": 0, "score_obtained": 0.0, "percentage": 0.0, "results": []}

        results = []
        open_items = []
        for idx, item in enumerate(items):
            if item.question_type in {QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE}:
                is_correct = self._mcq_match(item.student_answer, item.correct_answer, item.options)
                score = 1.0 if is_correct else 0.0
                feedback = "Correct." if is_correct else f"Not correct. Review: {item.explanation or item.correct_answer}"
                results.append(
                    {
                        "index": idx,
                        "score": score,
                        "is_correct": is_correct,
                        "feedback": feedback,
                        "expected_answer": item.correct_answer,
                        "student_answer": item.student_answer,
                    }
                )
            else:
                open_items.append((idx, item))

        if open_items:
            graded_open = await self._grade_open_items(open_items)
            results.extend(graded_open)

        results.sort(key=lambda r: r["index"])
        score_obtained = sum(r["score"] for r in results)
        total_questions = len(items)
        percentage = (score_obtained / total_questions) * 100 if total_questions else 0.0

        return {
            "total_questions": total_questions,
            "score_obtained": round(score_obtained, 2),
            "percentage": round(percentage, 2),
            "results": results,
        }

    async def _grade_open_items(self, open_items: list[tuple[int, PracticeMarkItem]]) -> list[dict]:
        payload = []
        for idx, item in open_items:
            payload.append(
                {
                    "index": idx,
                    "question": item.question_text,
                    "expected_answer": item.correct_answer,
                    "marking_guide": item.explanation or "",
                    "student_answer": item.student_answer,
                }
            )

        prompt = (
            "You are marking student practice answers. Return valid JSON array only. "
            "For each item provide index, score (0 to 1), and short feedback.\n"
            f"Items:\n{json.dumps(payload, ensure_ascii=False)}\n"
            "Format: [{\"index\":0,\"score\":0.75,\"feedback\":\"...\"}]"
        )

        try:
            llm_response = await asyncio.wait_for(self._call_llm(prompt), timeout=90.0)
            start = llm_response.find("[")
            end = llm_response.rfind("]") + 1
            parsed = json.loads(llm_response[start:end])
            graded = []
            by_idx = {idx: item for idx, item in open_items}
            for item in parsed:
                idx = int(item.get("index"))
                score = float(item.get("score", 0.0))
                score = max(0.0, min(1.0, score))
                src = by_idx.get(idx)
                if src is None:
                    continue
                graded.append(
                    {
                        "index": idx,
                        "score": score,
                        "is_correct": score >= 0.7,
                        "feedback": str(item.get("feedback", "Marked by AI.")),
                        "expected_answer": src.correct_answer,
                        "student_answer": src.student_answer,
                    }
                )
            if graded:
                return graded
        except Exception:
            pass

        # Fallback heuristic if LLM grading fails.
        fallback = []
        for idx, item in open_items:
            student = self._normalize_answer(item.student_answer)
            expected = self._normalize_answer(item.correct_answer)
            score = 1.0 if student and student in expected else 0.0
            fallback.append(
                {
                    "index": idx,
                    "score": score,
                    "is_correct": score >= 0.7,
                    "feedback": "Auto-marked with fallback rules.",
                    "expected_answer": item.correct_answer,
                    "student_answer": item.student_answer,
                }
            )
        return fallback

    def _parse_response(
        self,
        response: str,
        subject: Subject,
        question_type: QuestionType,
        num_questions: int,
    ) -> list[Question]:
        """Parse the LLM response into Question objects."""
        try:
            json_start = response.find("[")
            json_end = response.rfind("]") + 1
            if json_start == -1 or json_end == 0:
                raise ValueError("LLM response did not contain a JSON array")

            data = json.loads(response[json_start:json_end])
            if not isinstance(data, list) or not data:
                raise ValueError("LLM response did not contain any questions")

            questions = []
            for item in data[:num_questions]:
                item_qtype = question_type
                options = item.get("options") if question_type == QuestionType.MULTIPLE_CHOICE else None

                questions.append(
                    Question(
                        subject=subject,
                        question_type=item_qtype,
                        question_text=item.get("question", ""),
                        options=options,
                        correct_answer=item.get("correct_answer", ""),
                        explanation=item.get("explanation", ""),
                        difficulty_level=item.get("difficulty", "medium"),
                        year_generated=2026,
                        pattern_confidence=0.85,
                    )
                )

            if not questions:
                raise ValueError("No questions could be parsed from LLM response")

            return questions
        except Exception as e:
            raise Exception(f"Error parsing response: {str(e)}")
