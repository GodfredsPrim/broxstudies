"""
Question Generator — uses DeepSeek V3 (deepseek-chat) to create exam questions
from retrieved context (RAG) for Ghana SHS syllabi.
"""

import os
import json
from typing import List
from openai import OpenAI
from dotenv import load_dotenv

from models.schemas import Question, QuestionFormat
from services.embeddings import search_similar

load_dotenv()

deepseek_client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY", ""),
    base_url="https://api.deepseek.com",
)

# ── Prompt templates ───────────────────────────────────────────────────

SYSTEM_PROMPT = """You are **BisaME Osuani**, an expert Ghana SHS exam coach.
You create high-quality practice questions that match the WAEC / WASSCE standard.
Always align with the Ghana Education Service (GES) syllabus.

Rules:
- For MCQ: provide exactly 4 options labelled A–D.
- For Essay: provide a model answer outline with at least 3 key points.
- For MockExam: create a balanced mix of MCQ and structured questions.
- Include a concise but educational explanation for every answer.
- Assign a confidence_score (0.0–1.0) indicating how well sources support the question.
- Return ONLY valid JSON — no markdown fences, no extra text.
"""

MCQ_USER_TEMPLATE = """Generate {n} multiple-choice questions on **{topic}** for **{subject}** (Ghana SHS).

Use this context from past papers and textbooks:
---
{context}
---

Return a JSON array where each element follows this schema:
{{
  "text": "question text",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "answer": "A",
  "explanation": "...",
  "topic": "{topic}",
  "subject": "{subject}",
  "confidence_score": 0.0,
  "format": "MCQ"
}}
"""

ESSAY_USER_TEMPLATE = """Generate {n} essay/structured questions on **{topic}** for **{subject}** (Ghana SHS).

Use this context:
---
{context}
---

Return a JSON array where each element follows this schema:
{{
  "text": "question text",
  "options": [],
  "answer": "model answer outline",
  "explanation": "marking guide notes",
  "topic": "{topic}",
  "subject": "{subject}",
  "confidence_score": 0.0,
  "format": "Essay"
}}
"""


def _build_context(subject: str, topic: str) -> str:
    """Retrieve relevant chunks via semantic search."""
    docs = search_similar(query=topic, subject=subject, limit=6)
    if not docs:
        return "(No additional context available — generate from general SHS knowledge.)"
    return "\n\n".join(d.get("content", "") for d in docs)


def generate_questions(
    subject: str,
    topic: str,
    fmt: QuestionFormat = QuestionFormat.MCQ,
    num_questions: int = 5,
) -> List[Question]:
    """Call DeepSeek V3 to generate exam questions using RAG context."""

    context = _build_context(subject, topic)

    # Pick template
    if fmt == QuestionFormat.ESSAY:
        user_msg = ESSAY_USER_TEMPLATE.format(
            n=num_questions, topic=topic, subject=subject, context=context
        )
    else:
        user_msg = MCQ_USER_TEMPLATE.format(
            n=num_questions, topic=topic, subject=subject, context=context
        )

    response = deepseek_client.chat.completions.create(
        model="deepseek-chat",
        temperature=0.5,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    data = json.loads(raw)

    # GPT may wrap array in an object key
    if isinstance(data, dict):
        data = list(data.values())[0] if data else []

    questions = []
    for item in data:
        questions.append(Question(**item))

    return questions
