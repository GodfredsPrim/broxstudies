import logging
import asyncio
from typing import Optional, List
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from app.config import settings
from app.models import TutorResponse

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

    async def get_explanation(self, question: str, subject: Optional[str] = None, context: Optional[str] = None) -> TutorResponse:
        """Get a quick, high-quality explanation for a student question."""
        try:
            llm = self._get_llm()
            
            system_prompt = """
You are a highly intelligent and supportive AI tutor for Ghanaian Senior High School (SHS) students. 
Your goal is to provide perfectly organized, clear, and easy-to-read explanations.

ORGANIZATION RULES:
1. Structure: ALWAYS use the following sections in your response:
   - **MAIN CONCEPT**: A clear 1-sentence definition of the topic.
   - **EXPLANATION**: A step-by-step or bulleted breakdown. Focus on "Why" and "How".
   - **FAST FACT/TIP**: A small, interesting piece of information or a WASSCE trick for this topic.
   - **SUMMARY**: 1-2 sentences summarizing the most important part.

2. Formatting:
   - Use **Bold** for emphasis on key terms.
   - Use bullet points for lists.
   - Separate sections with a clear line of dashes if needed, but primarily use the headers above.
   - Avoid long walls of text. Keep paragraphs short (max 3 sentences).

3. Tonality: Encouraging, Ghanaian-friendly, and professional. Use local examples where applicable.

4. Follow-ups: Suggest exactly 3 logical follow-up questions at the very end, after the marker '[FOLLOW_UPS]'.
"""
            
            subject_context = f"Subject: {subject}\n" if subject else "Subject: General SHS Topics\n"
            student_context = f"Student Context: {context}\n" if context else ""
            
            user_msg = f"{subject_context}{student_context}Question: {question}"
            
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
            return TutorResponse(explanation="I'm sorry, I took too long to think of an explanation. Please try again!")
        except Exception as e:
            logger.error(f"Error in TutorService: {str(e)}")
            return TutorResponse(explanation=f"I encountered an error while trying to help: {str(e)}")
