import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.config import settings
from app.services.auth_service import AuthService


TOPIC_TAXONOMY = {
    "algebra": ("algebra", "equation", "factor", "polynomial"),
    "geometry": ("angle", "circle", "triangle", "bearing", "construction"),
    "statistics": ("mean", "median", "frequency", "histogram", "statistics"),
    "probability": ("probability", "chance", "random"),
    "comprehension": ("passage", "comprehension", "summary"),
    "grammar": ("grammar", "clause", "sentence", "vocabulary"),
    "scientific inquiry": ("experiment", "observation", "hypothesis", "apparatus"),
    "energy and forces": ("energy", "force", "motion", "electricity"),
    "matter and reactions": ("matter", "reaction", "acid", "atom", "compound"),
    "civic responsibility": ("citizen", "constitution", "government", "democracy"),
    "economy and development": ("economy", "development", "trade", "population"),
    "digital systems": ("computer", "network", "database", "algorithm", "software"),
}

COMPETENCIES = {
    "recall": ("state", "name", "identify", "define", "list"),
    "understanding": ("explain", "describe", "summarise", "distinguish"),
    "application": ("calculate", "solve", "determine", "construct", "use"),
    "analysis": ("analyse", "analyze", "compare", "evaluate", "justify", "discuss"),
}


def _question_type(text: str, declared: str = "") -> str:
    declared = declared.lower().replace(" ", "_")
    if declared in {"multiple_choice", "essay", "short_answer", "true_false"}:
        return declared
    if re.search(r"\([A-D]\)|\bA\.\s.+\bB\.\s", text, re.I | re.S):
        return "multiple_choice"
    if re.search(r"\b(discuss|evaluate|analyse|analyze|essay|write)\b", text, re.I):
        return "essay"
    return "short_answer"


def extract_features(items: list[dict]) -> dict:
    topic_counts: Counter[str] = Counter()
    competency_counts: Counter[str] = Counter()
    type_counts: Counter[str] = Counter()
    paper_counts: Counter[str] = Counter()
    for item in items:
        text = str(item.get("text") or item.get("question_text") or "")
        lower = text.lower()
        for topic, keywords in TOPIC_TAXONOMY.items():
            if any(keyword in lower for keyword in keywords):
                topic_counts[topic] += 1
        for competency, verbs in COMPETENCIES.items():
            if any(re.search(rf"\b{re.escape(verb)}\b", lower) for verb in verbs):
                competency_counts[competency] += 1
        type_counts[_question_type(text, str(item.get("question_type") or ""))] += 1
        paper = str(item.get("paper") or "")
        if not paper:
            match = re.search(r"\bpaper\s*([123])\b", lower)
            paper = f"paper_{match.group(1)}" if match else (
                "paper_1" if _question_type(text, str(item.get("question_type") or "")) == "multiple_choice" else "paper_2"
            )
        paper_counts[paper] += 1
    return {
        "topics": dict(topic_counts),
        "competencies": dict(competency_counts),
        "question_types": dict(type_counts),
        "paper_counts": dict(paper_counts),
        "question_count": len(items),
    }


def _distribution_similarity(predicted: dict[str, int], actual: dict[str, int]) -> float:
    keys = set(predicted) | set(actual)
    p_total, a_total = sum(predicted.values()), sum(actual.values())
    if not p_total or not a_total:
        return 0.0
    distance = 0.5 * sum(abs(predicted.get(key, 0) / p_total - actual.get(key, 0) / a_total) for key in keys)
    return round(max(0, 1 - distance) * 100, 1)


def run_backtest_from_papers(subject: str, hidden_year: int, papers_by_year: dict[int, list[dict]]) -> dict:
    training_years = sorted(year for year in papers_by_year if year < hidden_year)
    if hidden_year not in papers_by_year:
        raise ValueError(f"No hidden real paper is available for {subject} {hidden_year}.")
    if not training_years:
        raise ValueError(f"No examination papers earlier than {hidden_year} are available for training.")

    training_items = [item for year in training_years for item in papers_by_year[year]]
    predicted = extract_features(training_items)
    actual = extract_features(papers_by_year[hidden_year])
    predicted_topics = [name for name, _ in Counter(predicted["topics"]).most_common(10)]
    actual_topics = set(actual["topics"])
    topic_overlap = round(len(set(predicted_topics) & actual_topics) / len(actual_topics) * 100, 1) if actual_topics else 0.0

    predicted_competencies = set(predicted["competencies"])
    actual_competencies = set(actual["competencies"])
    competency_alignment = (
        round(len(predicted_competencies & actual_competencies) / len(actual_competencies) * 100, 1)
        if actual_competencies else 0.0
    )
    question_type_similarity = _distribution_similarity(predicted["question_types"], actual["question_types"])
    paper_shape_similarity = _distribution_similarity(predicted["paper_counts"], actual["paper_counts"])
    predicted_avg_count = predicted["question_count"] / len(training_years)
    count_accuracy = (
        max(0.0, 1 - abs(predicted_avg_count - actual["question_count"]) / actual["question_count"]) * 100
        if actual["question_count"] else 0.0
    )
    paper_format_accuracy = round((paper_shape_similarity + count_accuracy) / 2, 1)

    return {
        "subject": subject,
        "hidden_year": hidden_year,
        "training_years": training_years,
        "exclusion_confirmed": hidden_year not in training_years,
        "predicted_topics": predicted_topics,
        "actual_topics": sorted(actual_topics),
        "predicted_question_types": predicted["question_types"],
        "actual_question_types": actual["question_types"],
        "predicted_paper_counts": predicted["paper_counts"],
        "actual_paper_counts": actual["paper_counts"],
        "metrics": {
            "topic_overlap": topic_overlap,
            "competency_alignment": competency_alignment,
            "question_type_similarity": question_type_similarity,
            "paper_format_accuracy": paper_format_accuracy,
        },
        "methodology": "Predictions use only papers with years earlier than the hidden year. The hidden real paper is opened only for scoring.",
    }


class BacktestingService:
    def __init__(self, db: Optional[AuthService] = None, cache_path: Optional[Path] = None) -> None:
        self.db = db or AuthService()
        self.cache_path = cache_path or settings.DATA_DIR / "vector_store" / "questions_cache.json"
        self._ensure_table()

    def _ensure_table(self) -> None:
        id_type = "SERIAL PRIMARY KEY" if self.db.is_postgres else "INTEGER PRIMARY KEY AUTOINCREMENT"
        with self.db._connect() as conn:
            self.db._execute(
                conn,
                f"""CREATE TABLE IF NOT EXISTS backtest_runs (
                    id {id_type}, subject TEXT NOT NULL, hidden_year INTEGER NOT NULL,
                    training_years_json TEXT NOT NULL, result_json TEXT NOT NULL,
                    run_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL
                )""",
            )

    def load_papers(self) -> dict[str, dict[int, list[dict]]]:
        if not self.cache_path.exists():
            return {}
        try:
            payload = json.loads(self.cache_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        result: dict[str, dict[int, list[dict]]] = {}
        for subject, items in payload.get("subjects", {}).items():
            for item in items:
                year_text = str(item.get("year") or "")
                match = re.search(r"(19|20)\d{2}", year_text)
                if not match:
                    continue
                year = int(match.group())
                result.setdefault(subject, {}).setdefault(year, []).append(item)
        return result

    def catalog(self) -> list[dict]:
        return [
            {"subject": subject, "years": sorted(years)}
            for subject, years in sorted(self.load_papers().items())
            if len(years) >= 2
        ]

    def run(self, subject: str, hidden_year: int, admin_user_id: int) -> dict:
        all_papers = self.load_papers()
        subject_key = next((key for key in all_papers if key.lower() == subject.lower()), None)
        if not subject_key:
            raise ValueError("No historical examination dataset is available for this subject.")
        result = run_backtest_from_papers(subject_key, hidden_year, all_papers[subject_key])
        now = datetime.now(timezone.utc).isoformat()
        with self.db._connect() as conn:
            query = """INSERT INTO backtest_runs
                       (subject, hidden_year, training_years_json, result_json, run_by_user_id, created_at)
                       VALUES (?, ?, ?, ?, ?, ?)"""
            if self.db.is_postgres:
                query += " RETURNING id"
            cursor = self.db._execute(
                conn,
                query,
                (subject_key, hidden_year, json.dumps(result["training_years"]), json.dumps(result), admin_user_id, now),
            )
            run_id = cursor.fetchone()["id"] if self.db.is_postgres else cursor.lastrowid
        return {"id": run_id, "created_at": now, **result}

    def history(self, limit: int = 50) -> list[dict]:
        with self.db._connect() as conn:
            rows = self.db._execute(
                conn,
                "SELECT id, result_json, created_at FROM backtest_runs ORDER BY created_at DESC LIMIT ?",
                (max(1, min(limit, 100)),),
            ).fetchall()
        return [{"id": row["id"], "created_at": row["created_at"], **json.loads(row["result_json"])} for row in rows]


backtesting_service = BacktestingService()
