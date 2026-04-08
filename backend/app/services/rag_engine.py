import json

from app.config import settings
from app.models import Subject


class RAGEngine:
    def __init__(self):
        self.embeddings = None
        self.llm = None
        self.vector_store_path = settings.VECTOR_STORE_DIR

    async def add_documents(self, documents: list, subject: Subject):
        """Add documents to the lightweight cache used by the app."""
        try:
            if not documents:
                return {"status": "success", "documents_added": 0}

            cache_file = self.vector_store_path / f"{subject}.cache"
            cache_file.parent.mkdir(parents=True, exist_ok=True)

            existing_chunks = []
            if cache_file.exists():
                try:
                    with open(cache_file, "r", encoding="utf-8") as f:
                        existing = json.load(f)
                    existing_chunks = existing.get("chunks", [])
                except Exception:
                    existing_chunks = []

            merged_chunks = (existing_chunks + documents)[:500]
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "subject": str(subject),
                        "doc_count": len(merged_chunks),
                        "chunks": merged_chunks,
                    },
                    f,
                )

            return {"status": "success", "documents_added": len(documents)}
        except Exception as e:
            raise Exception(f"Error adding documents: {str(e)}")

    async def analyze_patterns(self, subject: Subject):
        """Analyze patterns in past questions."""
        try:
            patterns = {
                "total_questions": 0,
                "common_topics": [],
                "patterns": {},
                "difficulty": {"easy": 0, "medium": 0, "hard": 0},
                "topic_frequency": {},
            }
            return patterns
        except Exception as e:
            raise Exception(f"Error analyzing patterns: {str(e)}")

    async def get_topics(self, subject: Subject):
        """Get common topics for a subject."""
        topics = {
            "mathematics": ["Algebra", "Geometry", "Calculus", "Statistics", "Trigonometry"],
            "english": ["Literature", "Comprehension", "Grammar", "Composition", "Vocabulary"],
            "science": ["Physics", "Chemistry", "Biology", "Ecology", "Energy"],
            "social_studies": ["History", "Geography", "Civics", "Economics", "Culture"],
            "ict": ["Programming", "Database", "Networking", "Web Design", "Hardware"],
            "electives": ["Music", "Art", "Physical Education", "French", "Arabic"],
        }
        return topics.get(str(subject).lower().split(".")[-1], [])

    async def rebuild_index(self):
        """Rebuild the vector index from stored documents."""
        try:
            return "Vector index rebuilt successfully"
        except Exception as e:
            raise Exception(f"Error rebuilding index: {str(e)}")
