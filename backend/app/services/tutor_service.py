import logging
import asyncio
from typing import Optional, List
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from pathlib import Path
import re
from app.config import settings
from app.models import TutorResponse, Subject, SUBJECT_ALIASES

logger = logging.getLogger(__name__)

class TutorService:
    def __init__(self):
        self.llm = None

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

    async def get_explanation(self, question: str, subject: str, context: Optional[str] = None) -> TutorResponse:
        """Get a specific textbook definition/concept for a student question."""
        try:
            llm = self._get_llm()
            
            # Resolve subject and load textbook context
            year_key = "year_1"
            subject_id = subject.lower().strip()
            if ":" in subject_id:
                year_key, subject_id = subject_id.split(":", 1)
            
            # Normalize subject_id
            subject_id = re.sub(r"[^a-z0-9_]+", "_", subject_id).strip("_")
            subject_id = SUBJECT_ALIASES.get(subject_id, subject_id)
            
            textbook_dir = settings.SITE_RESOURCE_DIR / "textbooks" / year_key / subject_id
            textbook_context = self._extract_excerpts_from_directory(textbook_dir, max_docs=3)
            
            if not textbook_context:
                textbook_context = "No direct textbook excerpts found for this specific subject. Please use general SHS academic standards."

            system_prompt = f"""
You are a highly focused Ghana SHS Textbook Retrieval Assistant. 
Your ONLY task is to provide the 'MAIN CONCEPT' for the student's question based strictly on the provided textbook context.

STRICT RULES:
1. OUTPUT: ONLY provide the 'MAIN CONCEPT'. No introduction, no additional explanation, no 'Fast Facts'.
2. SOURCE: You MUST base your answer on the provided Textbook Excerpts. If the answer is not there, use standard Ghana WASSCE curriculum definitions.
3. FORMAT: 
   - Start your response directly with the definition.
   - Do NOT use markdown symbols like **bold**, ## headers, or -- dashes.
   - Keep it to 1-2 clear, authoritative sentences.
4. TONALITY: Academic, formal, and precise.

Textbook Excerpts:
{textbook_context}
"""
            
            subject_context = f"Subject: {subject}\n" if subject else "Subject: General SHS Topics\n"
            student_context = f"Student Context: {context}\n" if context else ""
            
            user_msg = f"Question: {question}"
            
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_msg)
            ]
            
            # Use asyncio.wait_for for safety
            response = await asyncio.wait_for(llm.ainvoke(messages), timeout=60.0)
            content = response.content
            
            # Parse follow-ups if present
            explanation = content
            related = []
            if "[FOLLOW_UPS]" in content:
                parts = content.split("[FOLLOW_UPS]")
                explanation = parts[0].strip()
                if len(parts) > 1:
                    related = [q.strip().strip("- ") for q in parts[1].strip().split("\n") if q.strip()]

            return TutorResponse(
                explanation=explanation,
                related_questions=related[:3]
            )
            
        except asyncio.TimeoutError:
            logger.error("Tutor request timed out.")
            return TutorResponse(explanation="Timeout: Unable to retrieve textbook insight right now.")
        except Exception as e:
            logger.error(f"Error in TutorService: {str(e)}")
            return TutorResponse(explanation=f"Textbook Error: {str(e)}")

    def _extract_excerpts_from_directory(self, root: Path, max_docs: int = 2, max_chars: int = 900) -> str:
        """Extract small excerpts from subject files for RAG."""
        if not root.exists():
            return ""
        
        excerpts = []
        files = list(root.glob("*.txt"))[:max_docs]
        if not files:
            files = list(root.glob("*.pdf"))[:max_docs] # Logic for raw files would go here, assuming .txt for now
            
        for f in files:
            try:
                with open(f, "r", encoding="utf-8") as file:
                    content = file.read(max_chars)
                    excerpts.append(f"Source: {f.name}\nContent: {content}...")
            except:
                continue
        return "\n\n".join(excerpts)
