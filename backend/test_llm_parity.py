#!/usr/bin/env python3
"""
Test script to verify DeepSeek LLM parity with OpenAI for question generation.
Ensures DeepSeek produces identical JSON response formats and handles same prompts.
"""

import asyncio
import json
import logging
from typing import Dict, Any

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI

from app.config import settings
from app.models import QuestionType

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class LLMParityTester:
    """Test class to verify DeepSeek and OpenAI produce identical response formats."""

    def __init__(self):
        self.openai_llm = ChatOpenAI(
            model="gpt-4o-mini",
            api_key=settings.OPENAI_API_KEY,
            temperature=0.3,
            max_tokens=4000,
        )

        self.deepseek_llm = ChatOpenAI(
            model="deepseek-chat",
            api_key=settings.DEEPSEEK_API_KEY,
            base_url="https://api.deepseek.com/v1",
            temperature=0.3,
            max_tokens=4000,
        )

    def _create_test_prompt(self, question_type: QuestionType) -> str:
        """Create a test prompt for the given question type."""
        if question_type == QuestionType.MULTIPLE_CHOICE:
            return """Generate 2 multiple choice questions about Physics (Electricity) for WASSCE.

Requirements:
- Each question must have exactly 4 options (A, B, C, D)
- Include the correct answer letter
- Provide a brief explanation
- Questions should be at WASSCE difficulty level

Return ONLY a JSON array in this exact format:
[
  {
    "question_text": "What is the SI unit of electric current?",
    "options": ["Volt", "Ampere", "Ohm", "Watt"],
    "correct_answer": "B",
    "explanation": "The SI unit of electric current is Ampere (A)."
  }
]"""
        else:
            return """Generate 1 essay question about Physics (Electricity) for WASSCE.

Requirements:
- Question should require detailed explanation
- Include model answer and explanation
- Questions should be at WASSCE difficulty level

Return ONLY a JSON array in this exact format:
[
  {
    "question_text": "Explain the principles of electromagnetic induction and discuss its practical applications.",
    "correct_answer": "Electromagnetic induction is the process by which a changing magnetic field induces an electromotive force (EMF) in a conductor...",
    "explanation": "This question tests understanding of Faraday's law and Lenz's law, requiring students to explain both theoretical principles and real-world applications."
  }
]"""

    async def _call_llm(self, llm: ChatOpenAI, prompt: str) -> Dict[str, Any]:
        """Call LLM and return parsed response."""
        try:
            messages = [HumanMessage(content=prompt)]
            response = await llm.ainvoke(messages)
            content = response.content.strip()

            # Clean markdown code blocks
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]

            content = content.strip()

            # Parse JSON
            parsed = json.loads(content)
            if not isinstance(parsed, list):
                raise ValueError("Response must be a JSON array")

            return {
                "success": True,
                "data": parsed,
                "raw_content": content
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "raw_content": content if 'content' in locals() else None
            }

    async def test_parity(self, question_type: QuestionType) -> Dict[str, Any]:
        """Test that both LLMs produce identical response formats."""
        prompt = self._create_test_prompt(question_type)

        logger.info(f"Testing {question_type.value} questions...")

        # Test both LLMs
        openai_result = await self._call_llm(self.openai_llm, prompt)
        deepseek_result = await self._call_llm(self.deepseek_llm, prompt)

        results = {
            "question_type": question_type.value,
            "openai": openai_result,
            "deepseek": deepseek_result,
            "parity_check": {
                "both_succeeded": openai_result["success"] and deepseek_result["success"],
                "format_match": False,
                "field_match": False
            }
        }

        # Check parity if both succeeded
        if results["parity_check"]["both_succeeded"]:
            openai_data = openai_result["data"]
            deepseek_data = deepseek_result["data"]

            # Check array length
            if len(openai_data) == len(deepseek_data):
                results["parity_check"]["format_match"] = True

                # Check field structure (first item only for simplicity)
                if openai_data and deepseek_data:
                    openai_item = openai_data[0]
                    deepseek_item = deepseek_data[0]

                    required_fields = ["question_text", "correct_answer", "explanation"]
                    if question_type == QuestionType.MULTIPLE_CHOICE:
                        required_fields.append("options")

                    openai_fields = set(openai_item.keys())
                    deepseek_fields = set(deepseek_item.keys())

                    if openai_fields == deepseek_fields and all(field in openai_fields for field in required_fields):
                        results["parity_check"]["field_match"] = True

        return results


async def main():
    """Run parity tests for both question types."""
    tester = LLMParityTester()

    results = []

    # Test multiple choice
    mc_results = await tester.test_parity(QuestionType.MULTIPLE_CHOICE)
    results.append(mc_results)

    # Test essay
    essay_results = await tester.test_parity(QuestionType.ESSAY)
    results.append(essay_results)

    # Print results
    print("\n=== LLM PARITY TEST RESULTS ===")
    for result in results:
        print(f"\n{result['question_type'].upper()} QUESTIONS:")
        print(f"OpenAI Success: {result['openai']['success']}")
        print(f"DeepSeek Success: {result['deepseek']['success']}")
        print(f"Both Succeeded: {result['parity_check']['both_succeeded']}")
        print(f"Format Match: {result['parity_check']['format_match']}")
        print(f"Field Match: {result['parity_check']['field_match']}")

        if not result['openai']['success']:
            print(f"OpenAI Error: {result['openai']['error']}")
        if not result['deepseek']['success']:
            print(f"DeepSeek Error: {result['deepseek']['error']}")

    # Overall assessment
    all_passed = all(r['parity_check']['both_succeeded'] and r['parity_check']['field_match'] for r in results)
    print(f"\nOVERALL RESULT: {'PASS' if all_passed else 'FAIL'}")
    print("DeepSeek is ready for production!" if all_passed else "DeepSeek needs fixes to match OpenAI behavior.")


if __name__ == "__main__":
    asyncio.run(main())