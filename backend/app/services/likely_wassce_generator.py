import asyncio
import hashlib
import io
import json
import logging
import random
import re
import zipfile
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from PyPDF2 import PdfReader

from app.config import settings
from app.models import Question, QuestionType, Subject, SUBJECT_ALIASES

logger = logging.getLogger(__name__)


@dataclass
class SectionBlueprint:
    paper_key: str
    section_key: str
    title: str
    question_type: QuestionType
    expected_count: int
    source_year: str = ""
    source_file: str = ""
    samples: List[str] = field(default_factory=list)
    answer_samples: List[str] = field(default_factory=list)


@dataclass
class CandidateQuestion:
    paper_key: str
    section_key: str
    section_title: str
    question_type: QuestionType
    source_year: str
    source_file: str
    number: int
    text: str
    options: Optional[List[str]] = None
    answer: str = ""
    explanation: str = ""
    topic_score: float = 0.0


class LikelyWASSCEGenerator:
    """Generate likely WASSCE papers from textbook topics and past-paper structure."""

    TARGET_PAPER_1_COUNT = 40
    MIN_PAPER_2_COUNT = 6
    PRACTICAL_MIN_COUNT = 3

    def __init__(self) -> None:
        self.data_dir = settings.DATA_DIR
        self.textbook_root = settings.SITE_RESOURCE_DIR / "textbooks"
        self.past_root = settings.DATA_DIR / "past_questions"
        self._llm: Optional[ChatOpenAI] = None
        self._exclude_hashes: Set[str] = set()

    @staticmethod
    def hash_question(question_text: str) -> str:
        """Stable hash of a question's stem — used for 24h anti-repeat matching."""
        normalized = re.sub(r"\s+", " ", (question_text or "").strip().lower())
        normalized = re.sub(r"^\d+\s*[.)]\s*", "", normalized)
        return hashlib.md5(normalized.encode("utf-8")).hexdigest()

    async def generate_exam(
        self,
        subject_slug: str,
        subject_label: str,
        year_key: str,
        exclude_hashes: Optional[Set[str]] = None,
    ) -> Dict[str, Any]:
        self._exclude_hashes = set(exclude_hashes or ())
        archive_path = self._find_subject_archive(subject_slug)
        if year_key == "year_3":
            return await self._generate_year_3_exam(subject_slug, subject_label, archive_path)

        topics = self.extract_topics_from_textbooks(year_key, subject_slug)
        if not archive_path:
            organized = await self._build_textbook_only_exam(
                subject_slug=subject_slug,
                subject_label=subject_label,
                year_key=year_key,
                topics=topics,
            )
            return {
                "organized_papers": organized,
                "topics": topics,
                "paper_structure": self._serialize_blueprint(self._build_default_blueprint(subject_slug)),
                "year_mode": year_key,
                "generation_mode": "textbook_guided",
            }

        try:
            blueprint, candidates = self._analyze_subject_archives(subject_slug, archive_path)
        except ValueError:
            logger.warning(
                f"Blueprint extraction failed for {subject_slug} ({archive_path.name if archive_path else 'no archive'}); "
                f"falling back to textbook-only exam."
            )
            organized = await self._build_textbook_only_exam(
                subject_slug=subject_slug,
                subject_label=subject_label,
                year_key=year_key,
                topics=topics,
            )
            return {
                "organized_papers": organized,
                "topics": topics,
                "paper_structure": self._serialize_blueprint(self._build_default_blueprint(subject_slug)),
                "year_mode": year_key,
                "generation_mode": "textbook_guided_fallback",
            }

        organized = await self._build_exam_for_topics(
            subject_slug=subject_slug,
            subject_label=subject_label,
            year_key=year_key,
            topics=topics,
            blueprint=blueprint,
            candidates=candidates,
        )
        return {
            "organized_papers": organized,
            "topics": topics,
            "paper_structure": self._serialize_blueprint(blueprint),
            "year_mode": year_key,
            "generation_mode": "exam_structured",
        }

    async def _generate_year_3_exam(self, subject_slug: str, subject_label: str, archive_path: Optional[Path]) -> Dict[str, Any]:
        year_1_topics = self.extract_topics_from_textbooks("year_1", subject_slug)
        year_2_topics = self.extract_topics_from_textbooks("year_2", subject_slug)
        combined_topics = self._dedupe_preserve_order(year_1_topics + year_2_topics)

        if not archive_path:
            organized = await self._build_textbook_only_exam(
                subject_slug=subject_slug,
                subject_label=subject_label,
                year_key="year_3",
                topics=combined_topics,
            )
            return {
                "organized_papers": organized,
                "topics": {
                    "year_1": year_1_topics,
                    "year_2": year_2_topics,
                    "year_3_combined": combined_topics,
                },
                "paper_structure": self._serialize_blueprint(self._build_default_blueprint(subject_slug)),
                "year_mode": "year_3",
                "generation_mode": "textbook_guided",
            }

        try:
            blueprint, candidates = self._analyze_subject_archives(subject_slug, archive_path)
        except ValueError:
            logger.warning(
                f"Blueprint extraction failed for {subject_slug} ({archive_path.name if archive_path else 'no archive'}); "
                f"falling back to textbook-only Year 3 exam."
            )
            organized = await self._build_textbook_only_exam(
                subject_slug=subject_slug,
                subject_label=subject_label,
                year_key="year_3",
                topics=combined_topics,
            )
            return {
                "organized_papers": organized,
                "topics": {
                    "year_1": year_1_topics,
                    "year_2": year_2_topics,
                    "year_3_combined": combined_topics,
                },
                "paper_structure": self._serialize_blueprint(self._build_default_blueprint(subject_slug)),
                "year_mode": "year_3",
                "generation_mode": "textbook_guided_fallback",
            }

        year_1_exam, year_2_exam = await asyncio.gather(
            self._build_exam_for_topics(
                subject_slug=subject_slug,
                subject_label=subject_label,
                year_key="year_1",
                topics=year_1_topics,
                blueprint=blueprint,
                candidates=candidates,
            ),
            self._build_exam_for_topics(
                subject_slug=subject_slug,
                subject_label=subject_label,
                year_key="year_2",
                topics=year_2_topics,
                blueprint=blueprint,
                candidates=candidates,
            ),
        )

        organized = await self._combine_year_papers(
            subject_slug=subject_slug,
            subject_label=subject_label,
            combined_topics=combined_topics,
            blueprint=blueprint,
            year_1_exam=year_1_exam,
            year_2_exam=year_2_exam,
        )

        return {
            "organized_papers": organized,
            "topics": {
                "year_1": year_1_topics,
                "year_2": year_2_topics,
                "year_3_combined": combined_topics,
            },
            "paper_structure": self._serialize_blueprint(blueprint),
            "year_mode": "year_3",
            "generation_mode": "exam_structured",
        }

    def extract_topics_from_textbooks(self, year_key: str, subject_slug: str) -> List[str]:
        subject_dir = self.textbook_root / year_key / subject_slug
        if not subject_dir.exists():
            return []

        topics: List[str] = []
        for pdf_path in sorted(subject_dir.glob("*.pdf")):
            if self._is_non_content_pdf(pdf_path.name):
                continue
            heading_topics = self._extract_topics_from_pdf(pdf_path)
            if heading_topics:
                topics.extend(heading_topics)
                continue

            filename_topic = self._topic_from_filename(pdf_path.stem)
            if filename_topic:
                topics.append(filename_topic)

        return self._dedupe_preserve_order([topic for topic in topics if topic])

    def _extract_topics_from_pdf(self, pdf_path: Path) -> List[str]:
        try:
            reader = PdfReader(str(pdf_path))
            text = ""
            for page in reader.pages[:6]:
                text += (page.extract_text() or "") + "\n"
        except Exception:
            return []

        patterns = [
            r"(?mi)^\s*SECTION\s+\d+\s+([A-Z][A-Za-z0-9 ,&/\-]{3,})\s*$",
            r"(?mi)^\s*CHAPTER\s+\d+[:.\s-]+([A-Z][A-Za-z0-9 ,&/\-]{3,})\s*$",
            r"(?mi)^\s*UNIT\s+\d+[:.\s-]+([A-Z][A-Za-z0-9 ,&/\-]{3,})\s*$",
            r"(?mi)^\s*TOPIC\s+\d+[:.\s-]+([A-Z][A-Za-z0-9 ,&/\-]{3,})\s*$",
        ]

        found: List[str] = []
        for pattern in patterns:
            found.extend(match.strip() for match in re.findall(pattern, text))

        if found:
            return self._dedupe_preserve_order([self._clean_topic_text(topic) for topic in found])

        for line in text.splitlines():
            clean = self._clean_topic_text(line)
            if not clean:
                continue
            if 5 <= len(clean) <= 80 and not re.search(r"(introduction|objectives|contents|review exercise)", clean, re.I):
                if re.search(r"[A-Za-z]{4,}", clean):
                    return [clean]
        return []

    def _analyze_subject_archives(self, subject_slug: str, archive_path: Path) -> tuple[list[SectionBlueprint], list[CandidateQuestion]]:
        paper_groups = self._group_subject_files(archive_path)
        blueprint: List[SectionBlueprint] = []
        candidates: List[CandidateQuestion] = []
        preferred_year: Optional[str] = None

        for paper_key in ["paper_1", "paper_2", "paper_3"]:
            paper_files = paper_groups.get(paper_key, {})
            question_files = paper_files.get("questions", [])
            solution_files = paper_files.get("solutions", [])
            if not question_files:
                continue

            parsed_sections = []
            chosen_question = None
            ordered_question_files = self._order_representative_files(question_files, preferred_year)
            for question_file in ordered_question_files:
                question_text = self._read_pdf_from_container(archive_path, question_file["path"])
                if not question_text.strip():
                    continue

                parsed_sections = self._parse_paper_sections(
                    paper_key=paper_key,
                    source_year=question_file["year"],
                    source_file=question_file["path"],
                    full_text=question_text,
                )
                if parsed_sections:
                    chosen_question = question_file
                    break

            if not parsed_sections:
                continue

            if preferred_year is None and chosen_question:
                preferred_year = chosen_question["year"]

            chosen_solution = self._pick_solution_file(solution_files, chosen_question["year"] if chosen_question else None)
            answers = self._extract_answers_from_solution(
                archive_path=archive_path,
                paper_key=paper_key,
                solution_path=chosen_solution["path"] if chosen_solution else None,
            )

            for section in parsed_sections:
                section_questions = section["questions"]
                if not section_questions:
                    continue

                sample_texts = [item["text"] for item in section_questions[:3]]
                answer_samples = []
                for item in section_questions[:3]:
                    answer_text = answers.get(str(item["number"]), "")
                    if answer_text:
                        answer_samples.append(answer_text)

                expected_count = max(item["number"] for item in section_questions)

                blueprint.append(
                    SectionBlueprint(
                        paper_key=paper_key,
                        section_key=section["section_key"],
                        title=section["title"],
                        question_type=section["question_type"],
                        expected_count=expected_count,
                        source_year=chosen_question["year"] if chosen_question else section["source_year"],
                        source_file=chosen_question["path"] if chosen_question else section["source_file"],
                        samples=sample_texts,
                        answer_samples=answer_samples,
                    )
                )

                for item in section_questions:
                    candidates.append(
                        CandidateQuestion(
                            paper_key=paper_key,
                            section_key=section["section_key"],
                            section_title=section["title"],
                            question_type=section["question_type"],
                            source_year=chosen_question["year"] if chosen_question else section["source_year"],
                            source_file=chosen_question["path"] if chosen_question else section["source_file"],
                            number=item["number"],
                            text=item["text"],
                            options=item.get("options"),
                            answer=answers.get(str(item["number"]), ""),
                            explanation=answers.get(str(item["number"]), ""),
                        )
                    )

        if not blueprint:
            raise ValueError(f"Could not extract a WASSCE paper structure for '{subject_slug}'.")

        return self._normalize_blueprint(blueprint), candidates

    async def _build_exam_for_topics(
        self,
        subject_slug: str,
        subject_label: str,
        year_key: str,
        topics: List[str],
        blueprint: List[SectionBlueprint],
        candidates: List[CandidateQuestion],
    ) -> Dict[str, List[Question]]:
        organized: Dict[str, List[Question]] = {"paper_1": [], "paper_2": [], "paper_3": []}
        subject_enum = self._subject_enum(subject_slug)

        for section in blueprint:
            section_questions = await self._generate_missing_questions(
                subject_slug=subject_slug,
                subject_label=subject_label,
                year_key=year_key,
                section=section,
                topics=topics,
                missing_count=section.expected_count,
                subject_enum=subject_enum,
            )

            if len(section_questions) < section.expected_count:
                fallback_candidates = self._rank_candidates_for_topics(candidates, section, topics)
                for candidate in fallback_candidates:
                    if len(section_questions) >= section.expected_count:
                        break
                    section_questions.append(self._candidate_to_question(candidate, subject_enum))

            section_questions = await self._ensure_section_standard(
                section_questions=section_questions,
                subject_slug=subject_slug,
                subject_label=subject_label,
                year_key=year_key,
                section=section,
                topics=topics,
                subject_enum=subject_enum,
            )
            organized[section.paper_key].extend(section_questions[: section.expected_count])

        return {key: value for key, value in organized.items() if value}

    async def _combine_year_papers(
        self,
        subject_slug: str,
        subject_label: str,
        combined_topics: List[str],
        blueprint: List[SectionBlueprint],
        year_1_exam: Dict[str, List[Question]],
        year_2_exam: Dict[str, List[Question]],
    ) -> Dict[str, List[Question]]:
        subject_enum = self._subject_enum(subject_slug)
        organized: Dict[str, List[Question]] = {"paper_1": [], "paper_2": [], "paper_3": []}

        for section in blueprint:
            y1_section = self._slice_section_questions(year_1_exam.get(section.paper_key, []), blueprint, section)
            y2_section = self._slice_section_questions(year_2_exam.get(section.paper_key, []), blueprint, section)
            merged = self._merge_question_lists(y1_section, y2_section)

            if len(merged) < section.expected_count:
                fillers = await self._generate_missing_questions(
                    subject_slug=subject_slug,
                    subject_label=subject_label,
                    year_key="year_3",
                    section=section,
                    topics=combined_topics,
                    missing_count=section.expected_count - len(merged),
                    subject_enum=subject_enum,
                )
                merged.extend(fillers)

            merged = await self._ensure_section_standard(
                section_questions=merged,
                subject_slug=subject_slug,
                subject_label=subject_label,
                year_key="year_3",
                section=section,
                topics=combined_topics,
                subject_enum=subject_enum,
            )
            organized[section.paper_key].extend(merged[: section.expected_count])

        return {key: value for key, value in organized.items() if value}

    def _slice_section_questions(
        self,
        questions: List[Question],
        blueprint: List[SectionBlueprint],
        target_section: SectionBlueprint,
    ) -> List[Question]:
        offset = 0
        for section in blueprint:
            if section.paper_key != target_section.paper_key:
                continue
            if section.section_key == target_section.section_key:
                return questions[offset: offset + section.expected_count]
            offset += section.expected_count
        return []

    def _merge_question_lists(self, year_1_questions: List[Question], year_2_questions: List[Question]) -> List[Question]:
        combined: List[Question] = []
        seen = set()
        for question in year_1_questions + year_2_questions:
            key = re.sub(r"\s+", " ", question.question_text.strip().lower())
            if key in seen:
                continue
            seen.add(key)
            combined.append(question)
        return combined

    async def _build_textbook_only_exam(
        self,
        subject_slug: str,
        subject_label: str,
        year_key: str,
        topics: List[str],
    ) -> Dict[str, List[Question]]:
        subject_enum = self._subject_enum(subject_slug)
        blueprint = self._build_default_blueprint(subject_slug)
        organized: Dict[str, List[Question]] = {"paper_1": [], "paper_2": [], "paper_3": []}

        for section in blueprint:
            generated = await self._generate_missing_questions(
                subject_slug=subject_slug,
                subject_label=subject_label,
                year_key=year_key,
                section=section,
                topics=topics,
                missing_count=section.expected_count,
                subject_enum=subject_enum,
            )
            standardized = await self._ensure_section_standard(
                section_questions=generated,
                subject_slug=subject_slug,
                subject_label=subject_label,
                year_key=year_key,
                section=section,
                topics=topics,
                subject_enum=subject_enum,
            )
            organized[section.paper_key].extend(standardized[: section.expected_count])

        return {key: value for key, value in organized.items() if value}

    def _build_default_blueprint(self, subject_slug: str) -> List[SectionBlueprint]:
        blueprint = [
            SectionBlueprint(
                paper_key="paper_1",
                section_key="section_a",
                title="Paper 1: Objective Test",
                question_type=QuestionType.MULTIPLE_CHOICE,
                expected_count=self.TARGET_PAPER_1_COUNT,
            ),
            SectionBlueprint(
                paper_key="paper_2",
                section_key="section_a",
                title="Paper 2: Theory",
                question_type=QuestionType.ESSAY,
                expected_count=self.MIN_PAPER_2_COUNT,
            ),
        ]

        if self._subject_supports_practical(subject_slug):
            blueprint.append(
                SectionBlueprint(
                    paper_key="paper_3",
                    section_key="section_a",
                    title="Paper 3: Practical / Alternative",
                    question_type=QuestionType.SHORT_ANSWER,
                    expected_count=self.PRACTICAL_MIN_COUNT,
                )
            )

        return blueprint

    def _normalize_blueprint(self, blueprint: List[SectionBlueprint]) -> List[SectionBlueprint]:
        """Preserve the actual counts extracted from the subject's past paper.

        Each section's `expected_count` is whatever the real WASSCE paper showed
        (e.g. 50 MCQs for English, 40 for Maths, 8 theory for History). We only
        apply a minimum of 1 and a cap to catch PDF parse blowups.
        """
        MAX_MCQ = 80
        MAX_THEORY = 20
        MAX_PRACTICAL = 10

        grouped: Dict[str, List[SectionBlueprint]] = {"paper_1": [], "paper_2": [], "paper_3": []}
        for section in blueprint:
            grouped.setdefault(section.paper_key, []).append(section)

        normalized: List[SectionBlueprint] = []

        paper_1_sections = grouped.get("paper_1", [])
        if paper_1_sections:
            for section in paper_1_sections:
                capped = max(1, min(section.expected_count, MAX_MCQ))
                normalized.append(replace(section, expected_count=capped))
        else:
            normalized.append(
                SectionBlueprint(
                    paper_key="paper_1",
                    section_key="section_a",
                    title="Paper 1: Objective Test",
                    question_type=QuestionType.MULTIPLE_CHOICE,
                    expected_count=self.TARGET_PAPER_1_COUNT,
                )
            )

        paper_2_sections = grouped.get("paper_2", [])
        if paper_2_sections:
            for section in paper_2_sections:
                capped = max(1, min(section.expected_count, MAX_THEORY))
                normalized.append(replace(section, expected_count=capped))
        else:
            normalized.append(
                SectionBlueprint(
                    paper_key="paper_2",
                    section_key="section_a",
                    title="Paper 2: Theory",
                    question_type=QuestionType.ESSAY,
                    expected_count=self.MIN_PAPER_2_COUNT,
                )
            )

        for section in grouped.get("paper_3", []):
            capped = max(1, min(section.expected_count, MAX_PRACTICAL))
            normalized.append(replace(section, expected_count=capped))

        return normalized

    def _rank_candidates_for_topics(
        self,
        candidates: List[CandidateQuestion],
        section: SectionBlueprint,
        topics: List[str],
    ) -> List[CandidateQuestion]:
        filtered = [
            candidate for candidate in candidates
            if candidate.paper_key == section.paper_key and candidate.section_key == section.section_key
            and self.hash_question(candidate.text) not in self._exclude_hashes
        ]
        for candidate in filtered:
            candidate.topic_score = self._topic_relevance_score(candidate.text, topics)

        # Shuffle first so candidates with identical topic_score come out in a
        # random order — prevents the same questions surfacing every request.
        random.shuffle(filtered)

        ranked = sorted(
            filtered,
            key=lambda item: (
                item.topic_score > 0,
                item.topic_score,
                random.random(),
            ),
            reverse=True,
        )

        selected = [item for item in ranked if item.topic_score > 0]
        if selected:
            random.shuffle(selected)
            return selected
        return []

    def _topic_relevance_score(self, text: str, topics: List[str]) -> float:
        normalized = re.sub(r"[^a-z0-9\s]", " ", text.lower())
        score = 0.0
        for topic in topics:
            words = [word for word in re.split(r"\W+", topic.lower()) if len(word) > 3]
            if not words:
                continue
            matches = sum(1 for word in words if word in normalized)
            if matches:
                score += matches / len(words)
        return score

    async def _generate_missing_questions(
        self,
        subject_slug: str,
        subject_label: str,
        year_key: str,
        section: SectionBlueprint,
        topics: List[str],
        missing_count: int,
        subject_enum: Subject,
    ) -> List[Question]:
        if missing_count <= 0:
            return []

        generated: List[Question] = []
        attempts = 0
        while len(generated) < missing_count and attempts < 3:
            attempts += 1
            prompt = self._build_generation_prompt(
                subject_slug=subject_slug,
                subject_label=subject_label,
                year_key=year_key,
                section=section,
                topics=topics,
                missing_count=missing_count - len(generated),
            )

            response = await self._call_openai(prompt)
            payload = self._parse_json_array(response)

            for item in payload[: missing_count - len(generated)]:
                normalized = self._normalize_generated_item(item, section.question_type)
                if self.hash_question(normalized["question_text"]) in self._exclude_hashes:
                    continue
                generated.append(
                    Question(
                        subject=subject_enum,
                        question_type=section.question_type,
                        question_text=normalized["question_text"],
                        options=normalized["options"],
                        correct_answer=normalized["correct_answer"],
                        explanation=normalized["explanation"],
                        difficulty_level="medium",
                        year_generated=2026,
                        pattern_confidence=0.88,
                    )
                )
            generated = self._dedupe_questions(generated)
        return generated

    async def _ensure_section_standard(
        self,
        section_questions: List[Question],
        subject_slug: str,
        subject_label: str,
        year_key: str,
        section: SectionBlueprint,
        topics: List[str],
        subject_enum: Subject,
    ) -> List[Question]:
        deduped = self._dedupe_questions(section_questions)
        accepted = [question for question in deduped if self._question_meets_standard(question, section)]

        shortfall = section.expected_count - len(accepted)
        if shortfall > 0:
            top_up = await self._generate_missing_questions(
                subject_slug=subject_slug,
                subject_label=subject_label,
                year_key=year_key,
                section=section,
                topics=topics,
                missing_count=shortfall,
                subject_enum=subject_enum,
            )
            accepted.extend([question for question in top_up if self._question_meets_standard(question, section)])

        if len(accepted) < section.expected_count:
            accepted.extend(question for question in deduped if question not in accepted)

        return self._dedupe_questions(accepted)

    def _question_meets_standard(self, question: Question, section: SectionBlueprint) -> bool:
        stem = (question.question_text or "").strip()
        explanation = (question.explanation or "").strip()
        answer = (question.correct_answer or "").strip()

        if len(stem) < 18:
            return False

        if section.question_type == QuestionType.MULTIPLE_CHOICE:
            options = question.options or []
            if len(options) != 4 or any(not (option or "").strip() for option in options):
                return False
            if self._normalize_correct_answer(answer, options) not in {"A", "B", "C", "D"}:
                return False
            return len(explanation) >= 12

        minimum_answer = 28 if section.question_type == QuestionType.ESSAY else 18
        minimum_explanation = 36 if section.question_type == QuestionType.ESSAY else 24
        return len(answer) >= minimum_answer and len(explanation) >= minimum_explanation

    def _build_generation_prompt(
        self,
        subject_slug: str,
        subject_label: str,
        year_key: str,
        section: SectionBlueprint,
        topics: List[str],
        missing_count: int,
    ) -> str:
        sampled_topics = self._sample_topics(topics, missing_count)
        topic_block = ", ".join(sampled_topics) or "Use the strongest curriculum topics from the textbook."
        sample_questions = json.dumps(self._sample_reference_text(section.samples, 3), ensure_ascii=False)
        sample_answers = json.dumps(self._sample_reference_text(section.answer_samples, 3), ensure_ascii=False)
        textbook_excerpts = json.dumps(self._sample_reference_text(self._load_textbook_excerpts(year_key, subject_slug), 4), ensure_ascii=False)
        seed_token = random.randint(10000, 99999)
        randomness_mode = random.choice(
            ["topic rotation", "novel scenario building", "fresh numeric variation", "mixed-skill sequencing"]
        )
        source_mode = (
            "Use the scanned textbook excerpts as the main source because no verified past-paper archive is available."
            if not section.source_file
            else "Use the representative past paper for structure and the scanned textbook excerpts for topic depth."
        )

        option_rule = (
            'Include exactly four options in "options" and return the correct option letter in "correct_answer".'
            if section.question_type == QuestionType.MULTIPLE_CHOICE
            else 'Do not include "options". Put the official-style marking points in "correct_answer" and a fuller rubric in "explanation".'
        )

        return f"""Create a likely WASSCE exam section for BroxStudies.

Generate exactly {missing_count} questions for:
- Subject: {subject_label}
- Level source: {year_key.replace('_', ' ').title()}
- Section: {section.title}
- Paper: {section.paper_key.replace('_', ' ').title()}
- Question type: {section.question_type.value}
- Representative past paper: {section.source_file} ({section.source_year})

Requirements:
1. {source_mode}
2. Match the exact mode of setting, structure, tone, and difficulty required for WASSCE-style papers.
3. Keep the questions in a natural exam flow, from simpler to more demanding.
4. Base the content on these textbook topics: {topic_block}
5. Use these scanned textbook excerpts as source material: {textbook_excerpts}
6. Match the format of these official sample questions when available: {sample_questions}
7. Match the style of these official answer excerpts when available: {sample_answers}
8. If no sample questions are available, write subject-accurate WASSCE-standard questions directly from the scanned textbook material.
9. {option_rule}
10. Paper 1 must contain exam-standard objective items, and theory or practical sections must include solid mark-worthy answers.
11. Randomization seed: {seed_token}. Use {randomness_mode}. Avoid repeating archived stems verbatim.
12. Wrap ALL mathematical expressions in $...$ (inline) or $$...$$ (display) using LaTeX syntax so they render properly — fractions as \\frac{{a}}{{b}}, powers as x^{{2}}, square roots as \\sqrt{{x}}, Greek letters as \\theta, \\pi, degree symbols as 30^{{\\circ}}. Never emit raw ASCII math like sqrt(x) or x^2 outside of $...$.
13. Return valid JSON only as an array.

JSON format:
[
  {{
    "question_text": "question text",
    "options": ["A", "B", "C", "D"],
    "correct_answer": "A",
    "explanation": "rubric or solution"
  }}
]
"""

    async def _call_openai(self, prompt: str) -> str:
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is required for Likely WASSCE generation.")

        if self._llm is None:
            kwargs: Dict[str, Any] = {
                "model": settings.OPENAI_MODEL,
                "api_key": settings.OPENAI_API_KEY,
                "temperature": 0.85,
                "request_timeout": 120.0,
                "max_retries": 3,
            }
            if settings.OPENAI_BASE_URL:
                kwargs["base_url"] = settings.OPENAI_BASE_URL
            self._llm = ChatOpenAI(**kwargs)

        message = await self._llm.ainvoke([HumanMessage(content=prompt)])
        return message.content

    def _load_textbook_excerpts(self, year_key: str, subject_slug: str, max_items: int = 6, max_chars: int = 1200) -> List[str]:
        excerpts: List[str] = []
        for source in self._find_textbook_sources(year_key, subject_slug)[:max_items]:
            text = self._read_textbook_excerpt(source, max_chars=max_chars)
            if text:
                excerpts.append(f"{source.name}: {text}")
        return excerpts

    def _find_textbook_sources(self, year_key: str, subject_slug: str) -> List[Path]:
        sources: List[Path] = []

        site_dir = self.textbook_root / year_key / subject_slug
        if site_dir.exists():
            sources.extend(sorted(site_dir.glob("*.pdf")))

        legacy_roots = [
            self.data_dir / "textbooks" / "ALL SUBJECTS NOTE (YEAR 1)",
            self.data_dir / "textbooks" / "ALL SUBJECT NOTE (YEAR 2)",
            self.data_dir / "textbooks" / "ALL SUBJECT NOTE (YEAR 2)" / "ALL SUBJECT NOTE (YEAR 2)",
        ]

        if year_key == "year_3":
            candidate_years = ["year_1", "year_2"]
        else:
            candidate_years = [year_key]

        for candidate_year in candidate_years:
            year_hint = "year 1" if candidate_year == "year_1" else "year 2"
            for root in legacy_roots:
                if not root.exists():
                    continue
                for item in root.iterdir():
                    if item.is_dir():
                        continue
                    score = self._resource_match_score(subject_slug, item.stem)
                    if score >= 2 and year_hint in str(root).lower():
                        sources.append(item)

        unique: List[Path] = []
        seen = set()
        for source in sources:
            key = str(source).lower()
            if key in seen:
                continue
            seen.add(key)
            unique.append(source)
        return unique

    def _read_textbook_excerpt(self, path: Path, max_chars: int = 1200) -> str:
        try:
            if path.suffix.lower() == ".pdf":
                reader = PdfReader(str(path))
                parts = [(page.extract_text() or "").strip() for page in reader.pages[:5]]
                return " ".join(part for part in parts if part)[:max_chars]
            if path.suffix.lower() == ".zip":
                with zipfile.ZipFile(path, "r") as archive:
                    members = [name for name in archive.namelist() if name.lower().endswith(".pdf")]
                    for member in members[:2]:
                        with archive.open(member) as file_obj:
                            reader = PdfReader(io.BytesIO(file_obj.read()))
                            parts = [(page.extract_text() or "").strip() for page in reader.pages[:4]]
                            text = " ".join(part for part in parts if part).strip()
                            if text:
                                return text[:max_chars]
        except Exception:
            return ""
        return ""

    def _parse_json_array(self, response: str) -> List[Dict[str, Any]]:
        start = response.find("[")
        end = response.rfind("]") + 1
        if start == -1 or end <= 0:
            return []
        try:
            payload = json.loads(response[start:end])
            return payload if isinstance(payload, list) else []
        except Exception:
            return []

    def _candidate_to_question(self, candidate: CandidateQuestion, subject_enum: Subject) -> Question:
        normalized = self._normalize_generated_item(
            {
                "question_text": candidate.text,
                "options": candidate.options,
                "correct_answer": candidate.answer or "See explanation",
                "explanation": candidate.explanation or candidate.answer or "Official answer not extracted.",
            },
            candidate.question_type,
        )
        correct_answer = candidate.answer or "See explanation"
        explanation = candidate.explanation or candidate.answer or "Official answer not extracted."
        return Question(
            subject=subject_enum,
            question_type=candidate.question_type,
            question_text=normalized["question_text"],
            options=normalized["options"],
            correct_answer=normalized["correct_answer"] or correct_answer,
            explanation=normalized["explanation"] or explanation,
            difficulty_level="medium",
            year_generated=int(candidate.source_year) if candidate.source_year.isdigit() else 2026,
            pattern_confidence=0.96,
        )

    def _find_subject_archive(self, subject_slug: str) -> Optional[Path]:
        if not self.past_root.exists():
            return None

        best_path = None
        best_score = -1.0
        for item in self.past_root.iterdir():
            score = self._resource_match_score(subject_slug, item.stem)
            if score > best_score:
                best_score = score
                best_path = item
        return best_path if best_score >= 2 else None

    def _resource_match_score(self, subject_slug: str, candidate_name: str) -> float:
        slug_tokens = [token for token in re.split(r"[^a-z0-9]+", subject_slug.lower()) if token]
        candidate_tokens = [token for token in re.split(r"[^a-z0-9]+", candidate_name.lower()) if token]
        candidate_text = " ".join(candidate_tokens)

        if not slug_tokens or not candidate_tokens:
            return 0.0

        score = 0.0
        for token in slug_tokens:
            if token in candidate_tokens:
                score += 2.0
            elif token in candidate_text:
                score += 0.5

        if "integrated" in slug_tokens and "science" in slug_tokens and "general science" in candidate_text:
            score += 1.5
        if "ict" in slug_tokens and "computing" in candidate_text:
            score += 1.0
        if "mathematics" in slug_tokens and "additional" in candidate_text and "additional" not in slug_tokens:
            score -= 2.0
        if "religious" in candidate_text and "religious" not in slug_tokens:
            score -= 2.0

        return score

    def _group_subject_files(self, archive_path: Path) -> Dict[str, Dict[str, List[Dict[str, str]]]]:
        grouped: Dict[str, Dict[str, List[Dict[str, str]]]] = {
            "paper_1": {"questions": [], "solutions": []},
            "paper_2": {"questions": [], "solutions": []},
            "paper_3": {"questions": [], "solutions": []},
        }

        for path_str in self._iter_subject_pdf_paths(archive_path):
            key = path_str.lower()
            if "passco" in key:
                continue
            paper_key = self._infer_paper_key(path_str)
            if not paper_key:
                continue
            bucket = "solutions" if "solution" in key or "answer" in key else "questions"
            year_match = re.search(r"20\d{2}", path_str)
            year = year_match.group(0) if year_match else "0000"
            grouped[paper_key][bucket].append({"path": path_str, "year": year})

        for paper_key in grouped:
            # Randomize which past paper is picked as representative so repeated
            # requests don't always use the most recent year.
            random.shuffle(grouped[paper_key]["questions"])
            random.shuffle(grouped[paper_key]["solutions"])

        return grouped

    def _order_representative_files(
        self,
        question_files: List[Dict[str, str]],
        preferred_year: Optional[str],
    ) -> List[Dict[str, str]]:
        # Shuffle within year buckets so repeated requests for the same subject
        # pick a different past paper each time, keeping generation non-deterministic.
        shuffled = list(question_files)
        random.shuffle(shuffled)

        if not preferred_year:
            return shuffled

        same_year = [item for item in shuffled if item["year"] == preferred_year]
        other_years = [item for item in shuffled if item["year"] != preferred_year]
        return same_year + other_years

    def _iter_subject_pdf_paths(self, archive_path: Path) -> List[str]:
        if archive_path.is_dir():
            return [str(path.relative_to(archive_path)).replace("\\", "/") for path in archive_path.rglob("*.pdf")]
        if archive_path.suffix.lower() == ".zip":
            with zipfile.ZipFile(archive_path, "r") as archive:
                return [name for name in archive.namelist() if name.lower().endswith(".pdf")]
        return []

    def _read_pdf_from_container(self, archive_path: Path, relative_path: str) -> str:
        try:
            if archive_path.is_dir():
                pdf_path = archive_path / relative_path
                reader = PdfReader(str(pdf_path))
            else:
                with zipfile.ZipFile(archive_path, "r") as archive:
                    with archive.open(relative_path) as file_obj:
                        reader = PdfReader(io.BytesIO(file_obj.read()))

            text_parts = []
            for page in reader.pages:
                try:
                    page_text = page.extract_text() or ""
                except Exception:
                    page_text = ""
                text_parts.append(page_text)
            return "\n".join(text_parts)
        except Exception:
            return ""

    def _infer_paper_key(self, name: str) -> Optional[str]:
        lowered = name.lower()
        if re.search(r"paper\s*1", lowered) or "objective" in lowered or re.search(r"(?<!paper\s)(?<!set\s)\b1\.pdf$", lowered):
            return "paper_1"
        if re.search(r"paper\s*2", lowered) or "theory" in lowered or "structured" in lowered or re.search(r"\b2\.pdf$", lowered):
            return "paper_2"
        if re.search(r"paper\s*3", lowered) or "practical" in lowered or "alternative" in lowered or re.search(r"\b3\.pdf$", lowered):
            return "paper_3"
        return None

    def _parse_paper_sections(
        self,
        paper_key: str,
        source_year: str,
        source_file: str,
        full_text: str,
    ) -> List[Dict[str, Any]]:
        if not full_text.strip():
            return []

        question_type = QuestionType.MULTIPLE_CHOICE if paper_key == "paper_1" else (
            QuestionType.SHORT_ANSWER if paper_key == "paper_3" else QuestionType.ESSAY
        )

        section_matches = list(re.finditer(r"(?im)^\s*SECTION\s+([A-C])(?:\s*[:.\-]\s*|\s+)([^\n]*)", full_text))
        sections: List[Dict[str, Any]] = []

        if section_matches:
            for index, match in enumerate(section_matches):
                start = match.end()
                end = section_matches[index + 1].start() if index + 1 < len(section_matches) else len(full_text)
                label = match.group(1).upper()
                title_tail = (match.group(2) or "").strip(" :-")
                title = f"Section {label}" + (f": {title_tail}" if title_tail else "")
                section_questions = self._extract_question_blocks(full_text[start:end], question_type)
                if section_questions:
                    sections.append(
                        {
                            "paper_key": paper_key,
                            "section_key": f"section_{label.lower()}",
                            "title": title,
                            "question_type": question_type,
                            "source_year": source_year,
                            "source_file": source_file,
                            "questions": section_questions,
                        }
                    )
        else:
            section_questions = self._extract_question_blocks(full_text, question_type)
            if section_questions:
                sections.append(
                    {
                        "paper_key": paper_key,
                        "section_key": "section_a",
                        "title": "Section A",
                        "question_type": question_type,
                        "source_year": source_year,
                        "source_file": source_file,
                        "questions": section_questions,
                    }
                )

        return sections

    def _extract_question_blocks(self, text: str, question_type: QuestionType) -> List[Dict[str, Any]]:
        pattern = re.compile(r"(?m)^\s*(\d{1,2})[.)]\s+")
        matches = list(pattern.finditer(text))
        if not matches:
            return []

        blocks: List[Dict[str, Any]] = []
        for index, match in enumerate(matches):
            start = match.start()
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            number = int(match.group(1))
            block = text[start:end].strip()
            if len(block) < 3:
                continue
            options = self._extract_options(block) if question_type == QuestionType.MULTIPLE_CHOICE else None
            blocks.append({"number": number, "text": block, "options": options})

        return blocks

    def _pick_solution_file(self, solution_files: List[Dict[str, str]], preferred_year: Optional[str]) -> Optional[Dict[str, str]]:
        if not solution_files:
            return None
        if preferred_year:
            for item in solution_files:
                if item["year"] == preferred_year:
                    return item
        return solution_files[0]

    def _extract_options(self, block: str) -> Optional[List[str]]:
        option_matches = re.findall(r"\(([A-D])\)\s*([^\n]+)", block)
        if option_matches:
            return [match[1].strip() for match in option_matches[:4]]

        line_options = re.findall(r"(?m)^\s*([A-D])[.)]\s+(.+)$", block)
        if line_options:
            return [match[1].strip() for match in line_options[:4]]
        return None

    def _extract_answers_from_solution(
        self,
        archive_path: Path,
        paper_key: str,
        solution_path: Optional[str],
    ) -> Dict[str, str]:
        if not solution_path:
            return {}
        text = self._read_pdf_from_container(archive_path, solution_path)
        if not text.strip():
            return {}

        answers: Dict[str, str] = {}
        if paper_key == "paper_1":
            for match in re.finditer(r"(?m)(\d{1,2})\s*[:.)-]?\s*([A-D])\b", text):
                answers[match.group(1)] = match.group(2)
            return answers

        parts = re.split(r"(?m)^\s*(\d{1,2})[.)]\s+", text)
        for index in range(1, len(parts), 2):
            number = parts[index]
            answer_block = parts[index + 1].strip() if index + 1 < len(parts) else ""
            if answer_block:
                answers[number] = answer_block[:2500]
        return answers

    def _serialize_blueprint(self, blueprint: List[SectionBlueprint]) -> List[Dict[str, Any]]:
        return [
            {
                "paper_key": section.paper_key,
                "section_key": section.section_key,
                "title": section.title,
                "question_type": section.question_type.value,
                "expected_count": section.expected_count,
            }
            for section in blueprint
        ]

    def _subject_enum(self, subject_slug: str) -> Subject:
        normalized = SUBJECT_ALIASES.get(subject_slug, SUBJECT_ALIASES.get(subject_slug.replace("_", " "), subject_slug))
        try:
            return Subject(normalized)
        except Exception:
            return Subject.ELECTIVES

    def _subject_supports_practical(self, subject_slug: str) -> bool:
        practical_subject_terms = {
            "biology",
            "chemistry",
            "physics",
            "integrated_science",
            "science",
            "food_and_nutrition",
            "clothing_and_textiles",
            "elective_ict",
            "ict",
            "agriculture",
            "agricultural_science",
        }
        normalized = subject_slug.lower()
        return any(term in normalized for term in practical_subject_terms)

    def _is_non_content_pdf(self, filename: str) -> bool:
        return bool(re.search(r"(guidelines|user.?guide|tablet)", filename, re.I))

    def _topic_from_filename(self, stem: str) -> str:
        clean = re.sub(r"(?i)\b(?:lm|sv|lv|book|section|chapter|unit|\d+)\b", " ", stem.replace("_", " ").replace("-", " "))
        clean = re.sub(r"\s+", " ", clean).strip()
        return self._clean_topic_text(clean)

    def _clean_topic_text(self, text: str) -> str:
        clean = re.sub(r"\s+", " ", text).strip(" .:-")
        if not clean:
            return ""
        return clean.title()

    def _dedupe_preserve_order(self, items: List[str]) -> List[str]:
        seen = set()
        result = []
        for item in items:
            key = item.lower()
            if key in seen:
                continue
            seen.add(key)
            result.append(item)
        return result

    def _dedupe_questions(self, questions: List[Question]) -> List[Question]:
        deduped: List[Question] = []
        seen = set()
        for question in questions:
            key = self._question_identity(question)
            if key in seen:
                continue
            seen.add(key)
            deduped.append(question)
        return deduped

    def _sample_topics(self, topics: List[str], missing_count: int) -> List[str]:
        cleaned = [topic for topic in self._dedupe_preserve_order(topics) if topic]
        if not cleaned:
            return []
        pool_size = min(len(cleaned), max(4, min(12, missing_count * 2)))
        if len(cleaned) <= pool_size:
            return cleaned
        return random.sample(cleaned, pool_size)

    def _sample_reference_text(self, items: List[str], limit: int) -> List[str]:
        cleaned = [item for item in items if item]
        if len(cleaned) <= limit:
            return cleaned
        return random.sample(cleaned, limit)

    def _question_identity(self, question: Question) -> str:
        stem = re.sub(r"\s+", " ", (question.question_text or "").strip().lower())
        stem = re.sub(r"^\d+\s*[.)]\s*", "", stem)
        return stem

    def _normalize_generated_item(self, item: Dict[str, Any], question_type: QuestionType) -> Dict[str, Any]:
        question_text = self._clean_ocr_text(item.get("question_text") or item.get("question") or "")
        explanation = self._clean_ocr_text(item.get("explanation", ""))
        correct_answer = self._clean_ocr_text(item.get("correct_answer", ""))

        options = item.get("options") if question_type == QuestionType.MULTIPLE_CHOICE else None
        normalized_options = self._normalize_options(options or [])

        if question_type == QuestionType.MULTIPLE_CHOICE:
            question_text = self._strip_options_from_stem(question_text)
            question_text = self._strip_answer_key_from_stem(question_text)
            if not normalized_options:
                extracted_options = self._extract_options(question_text) or []
                normalized_options = self._normalize_options(extracted_options)
                question_text = self._strip_options_from_stem(question_text)
            correct_answer = self._normalize_correct_answer(correct_answer, normalized_options)
        else:
            normalized_options = None

        return {
            "question_text": question_text.strip(),
            "options": normalized_options,
            "correct_answer": correct_answer.strip(),
            "explanation": explanation.strip(),
        }

    def _normalize_options(self, options: List[str]) -> List[str]:
        normalized: List[str] = []
        for option in options:
            cleaned = self._clean_ocr_text(str(option))
            cleaned = re.sub(r"^\s*(?:\(?[A-D]\)?[.:)]\s*|Option\s+[A-D][.:]?\s*)", "", cleaned, flags=re.I)
            cleaned = cleaned.strip()
            if cleaned:
                normalized.append(cleaned)
        return normalized[:4]

    def _strip_options_from_stem(self, text: str) -> str:
        text = re.sub(r"(?is)\n?\s*(?:\(?A\)?[.:)]\s*.*?\n\s*\(?B\)?[.:)]\s*.*)$", "", text)
        text = re.sub(r"(?im)^\s*(?:\(?[A-D]\)?[.:)]\s*.*)$", "", text)
        text = re.sub(r"(?im)^\s*Option\s+[A-D][.:]?\s*.*$", "", text)
        return re.sub(r"\n{3,}", "\n\n", text).strip()

    def _strip_answer_key_from_stem(self, text: str) -> str:
        text = re.sub(r"(?im)^\s*MCQ Question\s+\d+\s*$", "", text)
        text = re.sub(r"(?im)^\s*Multiple Choice\s*$", "", text)
        text = re.sub(r"(?im)^\s*[A-D]\s*:\s*.*$", "", text)
        return re.sub(r"\n{3,}", "\n\n", text).strip()

    def _normalize_correct_answer(self, correct_answer: str, options: List[str]) -> str:
        if not correct_answer:
            return ""
        answer = correct_answer.strip()
        letter_match = re.match(r"^\s*([A-D])\b", answer, flags=re.I)
        if letter_match:
            return letter_match.group(1).upper()
        for index, option in enumerate(options[:4]):
            if answer.lower() == option.lower():
                return chr(65 + index)
        return answer

    def _clean_ocr_text(self, text: str) -> str:
        cleaned = str(text or "")
        replacements = {
            "\r": "\n",
            "\u2018": "'",
            "\u2019": "'",
            "\u201c": '"',
            "\u201d": '"',
            "\u2212": "-",
            "\u2013": "-",
            "\u2014": "-",
            "\ufb01": "fi",
            "\ufb02": "fl",
            "\u00a0": " ",
        }
        for old, new in replacements.items():
            cleaned = cleaned.replace(old, new)
        cleaned = re.sub(r"[ \t]+", " ", cleaned)
        cleaned = re.sub(r" *\n *", "\n", cleaned)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()
