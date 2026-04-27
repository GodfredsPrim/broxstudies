import logging
import asyncio
from typing import Optional, List
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from pathlib import Path
import re
from app.config import settings
from app.models import TutorResponse, Subject, SUBJECT_ALIASES

logger = logging.getLogger(__name__)

class TutorService:
    def __init__(self):
        self.llm = None
        self.math_subject_tokens = {
            "mathematics",
            "core_mathematics",
            "additional_mathematics",
            "physics",
            "chemistry",
            "elective_mathematics",
        }

    def _get_llm(self) -> ChatOpenAI:
        if self.llm is not None:
            return self.llm
            
        api_key = settings.resolved_llm_api_key
        if not api_key:
            raise ValueError("LLM API key (OPENAI_API_KEY or DEEPSEEK_API_KEY) not configured.")
            
        self.llm = ChatOpenAI(
            model=settings.resolved_llm_model,
            openai_api_key=api_key,
            base_url=settings.resolved_llm_base_url,
            temperature=0.7,
            max_tokens=2000
        )
        return self.llm

    def _normalize_subject_details(self, subject: Optional[str]) -> tuple[str, str, str]:
        year_key = "year_1"
        subject_id = (subject or "general").lower().strip() or "general"
        if ":" in subject_id:
            year_key, subject_id = subject_id.split(":", 1)

        subject_id = re.sub(r"[^a-z0-9_]+", "_", subject_id).strip("_")
        subject_id = SUBJECT_ALIASES.get(subject_id, subject_id) or "general"
        return year_key, subject_id, (subject or "General SHS Topics")

    def _is_math_like_request(self, question: str, subject_id: str, context: Optional[str] = None) -> bool:
        haystack = " ".join(filter(None, [question.lower(), context.lower() if context else "", subject_id]))
        math_terms = [
            "solve", "calculate", "simplify", "evaluate", "differentiate", "integrate",
            "equation", "algebra", "geometry", "simultaneous", "probability", "ratio",
            "working", "show your working", "find x", "factorize", "expand", "log",
            "matrix", "trigonometry", "mensuration", "surd", "graph"
        ]
        has_math_term = any(term in haystack for term in math_terms)
        has_numeric_pattern = bool(re.search(r"\d", haystack) and re.search(r"[+\-*/=^()]", haystack))
        return subject_id in self.math_subject_tokens or has_math_term or has_numeric_pattern

    def _is_definitional_request(self, question: str) -> bool:
        q = question.lower().strip()
        patterns = [
            r"\bwhat is\b",
            r"\bwhat are\b",
            r"\bdefine\b",
            r"\bdefinition of\b",
            r"\bmeaning of\b",
            r"\bgive (me )?(the )?formula\b",
            r"\bformula (for|of)\b",
            r"\bwrite (the )?formula\b",
            r"\bchemical formula\b",
            r"\bstructural formula\b",
            r"\bsymbol for\b",
        ]
        return any(re.search(pattern, q) for pattern in patterns)

    def _is_full_overview_requested(self, question: str) -> bool:
        q = question.lower()
        return any(phrase in q for phrase in [
            "full overview", "full explanation", "in detail", "detailed", "more detail",
            "detailed overview", "explain in detail", "give more details", "explain fully"
        ])

    def _extract_excerpts_from_directory(self, root: Path, max_docs: int = 2, max_chars: int = 900) -> str:
        """Extract small excerpts from subject files for RAG."""
        if not root.exists():
            return ""

        excerpts = []
        files = list(root.glob("*.txt"))[:max_docs]
        if not files:
            files = list(root.glob("*.pdf"))[:max_docs]  # Logic for raw files would go here, assuming .txt for now

        for f in files:
            try:
                with open(f, "r", encoding="utf-8") as file:
                    content = file.read(max_chars)
                    excerpts.append(f"Source: {f.name}\nContent: {content}...")
            except Exception:
                continue
        return "\n\n".join(excerpts)

    def _build_system_prompt(
        self,
        *,
        question: str,
        subject_label: str,
        subject_id: str,
        textbook_context: str,
        context: Optional[str],
        is_image_request: bool = False,
        is_main_concept_only: bool = False,
    ) -> tuple[str, str]:
        is_math_like = self._is_math_like_request(question, subject_id, context)
        mode = "math_step_by_step" if is_math_like else "concept_coach"
        request_kind = "image-based study help" if is_image_request else "text-based study help"

        if self._is_definitional_request(question) and not self._is_full_overview_requested(question):
            is_main_concept_only = True
            is_math_like = False

        if is_main_concept_only:
            prompt = f"""
You are BroxStudies's Ghana SHS Study Coach. The student wants the MAIN CONCEPT ONLY.

HARD RULES:
1. Maximum TWO sentences. Never three. Never more.
2. Give only the core idea — the "what it is" in one sentence, optionally "why it matters" in a second.
3. No intro phrases ("Here is", "Certainly", "In summary"), no bullet points, no headings, no lists, no examples, no steps, no tips.
4. No filler adjectives. Use precise Ghana SHS / WASSCE-standard vocabulary.
5. The response must be a complete thought — do not cut off mid-sentence.
6. If the student asks for a formula, output the formula in standard notation directly with no surrounding dollar signs or markdown. For example, use C6H12O6 or H2O, not $C_6H_{12}O_6$.
7. Use LaTeX delimiters $..$ (inline) or $$..$$ (block) only for complex mathematical expressions that need formatting. Do not wrap simple chemical or plain formula notation in $...$.

Subject: {subject_label}
Additional student context: {context or 'None'}

Helpful textbook context:
{textbook_context}
"""
            return prompt.strip(), "core_concept"

        if is_math_like:
            prompt = f"""
You are BroxStudies's Ghana SHS Study Coach helping with {request_kind}.

Your job:
1. If there is an image, first read the question accurately.
2. If the student asks a mathematics, calculation, or working-style question, solve it step by step.
3. Show the method clearly before the final answer.
4. Use Ghana SHS / WASSCE-friendly language and keep the explanation teachable.
5. If the image is unclear, say exactly what is unclear and make a best effort from what is visible.

Response rules:
- Start with a short direct answer or concept summary.
- Then include a heading exactly named: Step-by-step
- Under that heading, provide numbered steps in plain text.
- Then include a heading exactly named: Final Answer
- Do not use markdown tables.
- MATH FORMATTING: You MUST use standard LaTeX delimiters ($ .. $ for inline, $$ .. $$ for blocks) for all mathematical symbols, equations, and formulas. NEVER use plain text for math.

Subject: {subject_label}
Additional student context: {context or 'None'}

Helpful textbook context:
{textbook_context}
"""
        else:
            prompt = f"""
You are fun2learn online's Ghana SHS Study Coach helping with {request_kind}.

Your job is to provide a comprehensive, clear, and engaging explanation of the student's topic.
Adopt the tone of a high-end personal tutor who is thorough but stays on point.

Response rules:
- Provide a high-quality explanation that covers definitions, key principles, and real-world significance.
- Use Ghana SHS / WASSCE-friendly terminology.
- Use paragraph breaks to separate distinct ideas for better readability.
- Do NOT use generic conversational filler.
- Do not use markdown tables.
- When asked for a formula, provide the exact formula using standard scientific notation (for example C6H12O6 or H2O) and avoid unnecessary dollar signs or markdown wrappers.
- Use LaTeX delimiters ($ .. $ for inline, $$ .. $$ for blocks) only for complex mathematical expressions that truly require rendering.

Subject: {subject_label}
Additional student context: {context or 'None'}

Helpful textbook context:
{textbook_context}
"""

        return prompt.strip(), mode

    def _parse_response(self, content: str, mode: str) -> TutorResponse:
        extracted_text = None
        study_tips: List[str] = []
        steps: List[str] = []
        confidence_note = None

        def extract_section(title: str) -> Optional[str]:
            pattern = rf"{re.escape(title)}\s*:?\s*(.*?)(?=\n[A-Z][A-Za-z -]+:?\s|\Z)"
            match = re.search(pattern, content, flags=re.IGNORECASE | re.DOTALL)
            if match:
                return match.group(1).strip()
            return None

        explanation = content.strip()
        main_blocks = []

        # Try to find structured sections (primarily for math)
        has_sections = False
        for title in ["Main Idea", "Explanation", "Step-by-step", "Final Answer"]:
            section = extract_section(title)
            if section:
                has_sections = True
                if title.lower() == "step-by-step":
                    raw_steps = [line.strip(" -\t") for line in section.splitlines() if line.strip()]
                    steps = [re.sub(r"^\d+[.)]\s*", "", line).strip() for line in raw_steps]
                else:
                    main_blocks.append(section)

        extracted_section = extract_section("Extracted Question")
        if extracted_section:
            extracted_text = extracted_section

        tips_section = extract_section("Study Tips")
        if tips_section:
            tip_lines = [line.strip() for line in tips_section.splitlines() if line.strip()]
            study_tips = [re.sub(r"^[-*]\s*", "", line).strip() for line in tip_lines][:3]

        if "unclear" in content.lower() or "blurry" in content.lower():
            confidence_note = "Some parts of the prompt/image may have been unclear, so the answer may be based on the visible portions."

        if has_sections and main_blocks:
            explanation = "\n\n".join(main_blocks).strip()

        return TutorResponse(
            explanation=explanation,
            related_questions=[],
            mode=mode,
            extracted_text=extracted_text,
            study_tips=study_tips or None,
            steps=steps or None,
            confidence_note=confidence_note,
        )

    async def get_explanation(
        self, 
        question: str, 
        subject: str, 
        context: Optional[str] = None,
        is_main_concept_only: bool = False,
        history: Optional[List] = None
    ) -> TutorResponse:
        """Get a subject-aware explanation for a student question."""
        logger.info(f"🤖 Tutor Request Start - Subject: {subject}, Main Concept: {is_main_concept_only}")
        try:
            llm = self._get_llm()
            year_key, subject_id, subject_label = self._normalize_subject_details(subject)
            textbook_dir = settings.SITE_RESOURCE_DIR / "textbooks" / year_key / subject_id
            textbook_context = self._extract_excerpts_from_directory(textbook_dir, max_docs=3)

            if not textbook_context:
                textbook_context = "No direct textbook excerpts found for this specific subject. Please use general SHS academic standards."

            system_prompt, mode = self._build_system_prompt(
                question=question,
                subject_label=subject_label,
                subject_id=subject_id,
                textbook_context=textbook_context,
                context=context,
                is_main_concept_only=is_main_concept_only
            )
            user_msg = f"Question: {question}"

            messages = [SystemMessage(content=system_prompt)]
            
            # Inject history if available
            if history:
                for msg in history:
                    if msg.role == "user":
                        messages.append(HumanMessage(content=msg.content))
                    elif msg.role == "ai":
                        messages.append(AIMessage(content=msg.content))
            
            messages.append(HumanMessage(content=user_msg))

            response = await asyncio.wait_for(llm.ainvoke(messages), timeout=60.0)
            content = response.content if isinstance(response.content, str) else str(response.content)
            
            # Terminal Verification Log
            logger.info(f"📊 TERMINAL VERIFICATION (Tutor) - Content: {content[:100]}...")
            
            parsed = self._parse_response(content, mode)
            
            if mode != "core_concept":
                parsed.related_questions = self._build_related_questions(question, subject_label, mode)
            
            logger.info("✅ Tutor Request Success")
            return parsed
        except asyncio.TimeoutError:
            logger.error("Tutor request timed out.")
            return TutorResponse(explanation="Timeout: Unable to retrieve textbook insight right now.")
        except Exception as e:
            logger.error(f"Error in TutorService: {str(e)}")
            return TutorResponse(explanation=f"Textbook Error: {str(e)}")

    async def get_image_explanation(
        self,
        *,
        question: str,
        image_base64: str,
        subject: Optional[str] = None,
        context: Optional[str] = None,
        filename: Optional[str] = None,
        content_type: Optional[str] = None,
        is_main_concept_only: bool = False,
        history: Optional[List] = None,
    ) -> TutorResponse:
        """Interpret a study image and explain it with OCR-like reasoning."""
        try:
            llm = self._get_llm()
            year_key, subject_id, subject_label = self._normalize_subject_details(subject)
            textbook_dir = settings.SITE_RESOURCE_DIR / "textbooks" / year_key / subject_id
            textbook_context = self._extract_excerpts_from_directory(textbook_dir, max_docs=3)
            if not textbook_context:
                textbook_context = "No direct textbook excerpts found for this specific subject. Please use general SHS academic standards."

            system_prompt, mode = self._build_system_prompt(
                question=question or "Interpret this study image and help me solve it.",
                subject_label=subject_label,
                subject_id=subject_id,
                textbook_context=textbook_context,
                context=context,
                is_image_request=True,
                is_main_concept_only=is_main_concept_only
            )

            mime_type = content_type or "image/png"
            user_prompt = (
                f"Student question: {question or 'Please interpret the uploaded image and teach me the answer.'}\n"
                f"Filename: {filename or 'uploaded-image'}\n"
                "Please read the image, extract the important question text, and then answer helpfully."
            )
            messages = [SystemMessage(content=system_prompt)]
            
            if history:
                for msg in history:
                    if msg.role == "user":
                        messages.append(HumanMessage(content=msg.content))
                    elif msg.role == "ai":
                        messages.append(AIMessage(content=msg.content))

            messages.append(
                HumanMessage(
                    content=[
                        {"type": "text", "text": user_prompt},
                        {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{image_base64}"}},
                    ]
                )
            )

            response = await asyncio.wait_for(llm.ainvoke(messages), timeout=90.0)
            content = response.content if isinstance(response.content, str) else str(response.content)
            parsed = self._parse_response(content, mode)
            if mode != "core_concept":
                parsed.related_questions = self._build_related_questions(question or "this problem", subject_label, mode)
            return parsed
        except asyncio.TimeoutError:
            logger.error("Tutor image request timed out.")
            return TutorResponse(explanation="Timeout: Unable to interpret the image right now.")
        except Exception as e:
            logger.error(f"Error in TutorService image flow: {str(e)}")
            return TutorResponse(explanation=f"Image Study Error: {str(e)}")

    def _build_related_questions(self, question: str, subject_label: str, mode: str) -> List[str]:
        if mode == "math_step_by_step":
            return [
                f"Can you show a shorter exam method for this {subject_label} question?",
                "Give me another similar problem to try on my own.",
                "What common mistake should I avoid in this kind of calculation?",
            ]
        return [
            f"Give me a past-question style example in {subject_label}.",
            "Explain it in simpler words for revision.",
            "Test me with three quick questions on this topic.",
        ]
