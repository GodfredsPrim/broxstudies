from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

LOCAL_BOOK_CATALOG: List[Dict[str, Any]] = [
    {
        "id": "ghanaian-beautyful-ones",
        "title": "The Beautyful Ones Are Not Yet Born",
        "author": "Ayi Kwei Armah",
        "category": "ghanaian",
        "rating": 4.8,
        "description": "A powerful Ghanaian novel about corruption, dignity, and post-independence life in Accra.",
        "pages": 277,
        "isbn": "9780141187806",
        "publication_year": "1968",
        "source": "Ghanaian Classics",
    },
    {
        "id": "ghanaian-things-fall-apart",
        "title": "Things Fall Apart",
        "author": "Chinua Achebe",
        "category": "african",
        "rating": 4.9,
        "description": "A classic African novel that explores tradition, change, and the impact of colonial rule.",
        "pages": 209,
        "isbn": "9780141180283",
        "publication_year": "1958",
        "source": "African Classics",
    },
    {
        "id": "ghanaian-anowa",
        "title": "Anowa",
        "author": "Ama Ata Aidoo",
        "category": "ghanaian",
        "rating": 4.6,
        "description": "A powerful Ghanaian play about love, independence, and the cost of social expectations.",
        "pages": 120,
        "isbn": "9780435905673",
        "publication_year": "1970",
        "source": "Ghanaian Drama",
    },
    {
        "id": "ghanaian-our-sister-killjoy",
        "title": "Our Sister Killjoy",
        "author": "Ama Ata Aidoo",
        "category": "ghanaian",
        "rating": 4.5,
        "description": "A novel that follows a young Ghanaian woman through Europe and questions identity, culture, and freedom.",
        "pages": 160,
        "isbn": "9780571199857",
        "publication_year": "1977",
        "source": "Ghanaian Literature",
    },
    {
        "id": "ghanaian-business-101",
        "title": "Entrepreneurship for Young Ghanaians",
        "author": "Ama K. Oppong",
        "category": "entrepreneur",
        "rating": 4.4,
        "description": "A practical guide to starting a small business in Ghana, with tips on planning, finance, and marketing.",
        "pages": 240,
        "isbn": "9789988776655",
        "publication_year": "2022",
        "source": "Education & Business",
    },
    {
        "id": "ghanaian-maths-shs",
        "title": "Basic Mathematics for SHS",
        "author": "Dr. Isaac K. Mensah",
        "category": "subject",
        "rating": 4.7,
        "description": "A student-friendly mathematics book for senior high school covering algebra, geometry, and exam practice.",
        "pages": 384,
        "isbn": "9789988776600",
        "publication_year": "2021",
        "source": "SHS Textbook",
    },
    {
        "id": "ghanaian-wassce-physics",
        "title": "WASSCE Physics Past Questions",
        "author": "Ghana Education Service",
        "category": "subject",
        "rating": 4.3,
        "description": "Collection of past WASSCE Physics questions with answers to help SHS students prepare for exams.",
        "pages": 220,
        "isbn": "9789988776617",
        "publication_year": "2020",
        "source": "Exam Prep",
    },
    {
        "id": "novel-girl-with-louding-voice",
        "title": "The Girl with the Louding Voice",
        "author": "Abi Daré",
        "category": "african",
        "rating": 4.7,
        "description": "A moving story about a young Nigerian girl who refuses to be silenced and fights for education.",
        "pages": 368,
        "isbn": "9780143131834",
        "publication_year": "2020",
        "source": "Modern African Fiction",
    },
    {
        "id": "storybook-anansi-stories",
        "title": "Anansi Stories from Ghana",
        "author": "Traditional",
        "category": "storybook",
        "rating": 4.8,
        "description": "A collection of beloved Ghanaian folk tales that teach wisdom, bravery, and humour.",
        "pages": 180,
        "isbn": "9780143507185",
        "publication_year": "2010",
        "source": "Folklore",
    },
    {
        "id": "entrepreneur-lean-startup",
        "title": "The Lean Startup",
        "author": "Eric Ries",
        "category": "entrepreneur",
        "rating": 4.6,
        "description": "A classic guide to building scalable businesses with fast experimentation and customer-focused design.",
        "pages": 320,
        "isbn": "9780307887894",
        "publication_year": "2011",
        "source": "Entrepreneurship",
    },
    {
        "id": "novel-half-of-a-yellow-sun",
        "title": "Half of a Yellow Sun",
        "author": "Chimamanda Ngozi Adichie",
        "category": "african",
        "rating": 4.8,
        "description": "A historical novel set during the Nigerian civil war, blending love, politics, and human courage.",
        "pages": 433,
        "isbn": "9780393328465",
        "publication_year": "2006",
        "source": "African Literature",
    },
    {
        "id": "global-alchemist",
        "title": "The Alchemist",
        "author": "Paulo Coelho",
        "category": "novel",
        "rating": 4.7,
        "description": "A modern classic about a shepherd's journey to find treasure and discover his destiny.",
        "pages": 208,
        "isbn": "9780061122415",
        "publication_year": "1988",
        "source": "Global Classics",
    },
    {
        "id": "global-to-kill-a-mockingbird",
        "title": "To Kill a Mockingbird",
        "author": "Harper Lee",
        "category": "novel",
        "rating": 4.9,
        "description": "A Pulitzer Prize-winning story of justice, race, and growing up in the American South.",
        "pages": 336,
        "isbn": "9780061120084",
        "publication_year": "1960",
        "source": "Modern Classics",
    },
    {
        "id": "global-atomic-habits",
        "title": "Atomic Habits",
        "author": "James Clear",
        "category": "entrepreneur",
        "rating": 4.8,
        "description": "A practical guide to building better habits and making small changes that lead to big results.",
        "pages": 320,
        "isbn": "9780735211292",
        "publication_year": "2018",
        "source": "Personal Development",
    },
    {
        "id": "global-long-walk-to-freedom",
        "title": "Long Walk to Freedom",
        "author": "Nelson Mandela",
        "category": "african",
        "rating": 4.9,
        "description": "The autobiography of Nelson Mandela, tracing his life from childhood to prison to leadership.",
        "pages": 656,
        "isbn": "9780316548182",
        "publication_year": "1995",
        "source": "African History",
    },
    {
        "id": "global-purple-hibiscus",
        "title": "Purple Hibiscus",
        "author": "Chimamanda Ngozi Adichie",
        "category": "african",
        "rating": 4.7,
        "description": "A moving novel about family, faith, and freedom in postcolonial Nigeria.",
        "pages": 290,
        "isbn": "9780307455925",
        "publication_year": "2003",
        "source": "African Fiction",
    },
]

CATEGORY_LABELS = {
    "all": "All Books",
    "novel": "Novels",
    "storybook": "Story Books",
    "entrepreneur": "Entrepreneurship",
    "subject": "Subject Books",
    "african": "African Books",
    "ghanaian": "Ghanaian Books",
}


class BookLibraryService:
    OPENLIBRARY_BASE_URL = "https://openlibrary.org"
    SEARCH_LIMIT = 18

    async def search_books(self, query: Optional[str] = None, category: str = "all") -> List[Dict[str, Any]]:
        query_text = (query or "").strip().lower()
        results: List[Dict[str, Any]] = []

        for book in LOCAL_BOOK_CATALOG:
            if category != "all":
                if category == "african":
                    if book["category"] not in ("african", "ghanaian"):
                        continue
                elif category == "ghanaian":
                    if book["category"] != "ghanaian":
                        continue
                elif book["category"] != category:
                    continue

            if query_text:
                searchable = " ".join(
                    [
                        str(book.get("title", "")),
                        str(book.get("author", "")),
                        str(book.get("description", "")),
                        str(book.get("category", "")),
                        str(book.get("source", "")),
                    ]
                ).lower()
                if query_text not in searchable:
                    continue

            results.append(book)

        if len(results) < self.SEARCH_LIMIT:
            remote_results = await self._search_openlibrary(query_text=query_text, category=category)
            for remote_book in remote_results:
                if any(
                    existing["title"].lower() == remote_book["title"].lower()
                    and existing["author"].lower() == remote_book["author"].lower()
                    for existing in results
                ):
                    continue
                results.append(remote_book)
                if len(results) >= self.SEARCH_LIMIT:
                    break

        return results[: self.SEARCH_LIMIT]

    async def _search_openlibrary(self, query_text: str, category: str) -> List[Dict[str, Any]]:
        if not query_text:
            default_category_queries = {
                "all": "bestsellers",
                "ghanaian": "Ghanaian literature",
                "african": "African literature",
                "subject": "school textbook",
                "entrepreneur": "business entrepreneurship",
                "storybook": "children's stories",
                "novel": "classic novels",
            }
            query_text = default_category_queries.get(category, "bestsellers")
        elif category != "all":
            category_terms = {
                "ghanaian": "Ghanaian literature",
                "african": "African literature",
                "subject": "textbook",
                "entrepreneur": "entrepreneurship",
                "storybook": "children's stories",
                "novel": "novels",
            }
            if category in category_terms:
                query_text = f"{query_text} {category_terms[category]}"

        results: List[Dict[str, Any]] = []

        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                response = await client.get(
                    f"{self.OPENLIBRARY_BASE_URL}/search.json",
                    params={"q": query_text, "limit": self.SEARCH_LIMIT},
                )
                response.raise_for_status()
                data = response.json()
                for doc in data.get("docs", []):
                    title = doc.get("title")
                    if not title:
                        continue

                    key = doc.get("key")
                    if not key:
                        continue

                    author = " & ".join(doc.get("author_name", ["Unknown Author"]))
                    openlib_id = f"openlib:{key}"
                    cover_url = None
                    cover_id = doc.get("cover_i")
                    if cover_id:
                        cover_url = f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg"

                    description = doc.get("first_sentence") or doc.get("subtitle") or doc.get("subject")
                    if isinstance(description, list):
                        description = description[0]
                    description = description or "Library entry from OpenLibrary."

                    results.append(
                        {
                            "id": openlib_id,
                            "title": title,
                            "author": author,
                            "category": "novel",
                            "rating": 4.2,
                            "description": description,
                            "pages": None,
                            "isbn": None,
                            "publication_year": str(doc.get("first_publish_year", "")) if doc.get("first_publish_year") else None,
                            "cover_url": cover_url,
                            "source": "OpenLibrary",
                        }
                    )
                    if len(results) >= self.SEARCH_LIMIT:
                        break
        except Exception as e:
            logger.warning("OpenLibrary search failed: %s", e)

        return results

    async def get_book(self, book_id: str) -> Optional[Dict[str, Any]]:
        for book in LOCAL_BOOK_CATALOG:
            if book["id"] == book_id:
                return book

        if book_id.startswith("openlib:"):
            key = book_id.split("openlib:", 1)[1]
            if not key.startswith("/"):
                key = f"/{key}"
            try:
                async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                    response = await client.get(f"{self.OPENLIBRARY_BASE_URL}{key}.json")
                    response.raise_for_status()
                    data = response.json()

                    title = data.get("title") or "OpenLibrary Book"
                    description = data.get("description")
                    if isinstance(description, dict):
                        description = description.get("value")
                    description = description or "A rich book entry from OpenLibrary."

                    authors = []
                    for author_entry in data.get("authors", []):
                        author_key = author_entry.get("author", {}).get("key")
                        if author_key:
                            author_resp = await client.get(f"{self.OPENLIBRARY_BASE_URL}{author_key}.json")
                            if author_resp.is_success:
                                author_name = author_resp.json().get("name")
                                if author_name:
                                    authors.append(author_name)
                    author = " & ".join(authors) if authors else "OpenLibrary Author"

                    cover_url = None
                    cover_id = data.get("covers")
                    if isinstance(cover_id, list) and cover_id:
                        cover_url = f"https://covers.openlibrary.org/b/id/{cover_id[0]}-M.jpg"

                    return {
                        "id": book_id,
                        "title": title,
                        "author": author,
                        "category": "novel",
                        "rating": 4.2,
                        "description": description,
                        "pages": None,
                        "isbn": None,
                        "publication_year": str(data.get("created", {}).get("value", "")).split("T")[0] if isinstance(data.get("created"), dict) else None,
                        "cover_url": cover_url,
                        "source": "OpenLibrary",
                    }
            except Exception as e:
                logger.warning("Failed to load OpenLibrary book detail: %s", e)

        return None

    async def generate_quiz(self, book_id: str, num_questions: int = 4) -> Dict[str, Any]:
        book = await self.get_book(book_id)
        if not book:
            raise ValueError("Book not found")

        category_answer = CATEGORY_LABELS.get(book.get("category", ""), book.get("category", "Other").capitalize())
        topic_answer = "Ghana" if book.get("category") in ("ghanaian", "african") else "General study"
        read_goal = (
            "subject mastery" if book.get("category") == "subject" else "entrepreneurial skills" if book.get("category") == "entrepreneur" else "literature and culture"
        )

        quiz_questions = [
            {
                "question": f"Who is the author of '{book['title']}'?",
                "type": "short_answer",
                "options": None,
                "answer": book["author"],
            },
            {
                "question": f"Which category best describes '{book['title']}'?",
                "type": "multiple_choice",
                "options": [
                    category_answer,
                    "Story Books",
                    "Entrepreneurship",
                    "Subject Books",
                ],
                "answer": category_answer,
            },
            {
                "question": f"This book is especially valuable for students studying which region or country?",
                "type": "short_answer",
                "options": None,
                "answer": topic_answer,
            },
            {
                "question": f"What does reading '{book['title']}' help you improve?",
                "type": "multiple_choice",
                "options": [
                    read_goal,
                    "Physical fitness",
                    "Cooking skills",
                    "Graphic design",
                ],
                "answer": read_goal,
            },
        ]

        return {
            "book_id": book_id,
            "title": book["title"],
            "questions": quiz_questions[:max(1, min(num_questions, len(quiz_questions)))],
            "source": book.get("source", "Internal Library"),
        }
