import json
import time
from pathlib import Path
from typing import Any

from app.config import settings


class WorldClassEngine:
    """Cross-phase foundation layer for curriculum alignment, mastery, and telemetry."""

    CURRICULUM_KEYWORDS = {
        "numeracy": ["algebra", "equation", "ratio", "percentage", "graph", "statistics", "probability"],
        "literacy": ["comprehension", "grammar", "essay", "summary", "passage", "vocabulary"],
        "science_inquiry": ["experiment", "hypothesis", "observation", "energy", "force", "reaction"],
        "social_civic": ["government", "citizen", "policy", "economy", "history", "society"],
        "digital_literacy": ["algorithm", "program", "computer", "network", "database", "coding"],
    }

    def __init__(self):
        self.base_dir = settings.DATA_DIR / "world_class"
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.profiles_file = self.base_dir / "student_profiles.json"
        self.telemetry_file = self.base_dir / "telemetry.json"

    def _load_json(self, path: Path, fallback: Any):
        if not path.exists():
            return fallback
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return fallback

    def _save_json(self, path: Path, payload: Any):
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

    def build_curriculum_map(self, questions: list, subject_label: str):
        mapped = []
        coverage = {k: 0 for k in self.CURRICULUM_KEYWORDS}
        for i, q in enumerate(questions):
            text = (q.question_text or "").lower()
            tags = []
            for strand, keys in self.CURRICULUM_KEYWORDS.items():
                if any(k in text for k in keys):
                    tags.append(strand)
                    coverage[strand] += 1
            mapped.append(
                {
                    "question_index": i,
                    "subject": subject_label,
                    "tags": tags or ["general_competency"],
                }
            )
        return {"question_tags": mapped, "coverage": coverage}

    def build_quality_report(self, questions: list):
        seen = set()
        duplicates = 0
        too_short = 0
        for q in questions:
            text = (q.question_text or "").strip().lower()
            if len(text) < 25:
                too_short += 1
            if text in seen:
                duplicates += 1
            seen.add(text)
        return {
            "total_questions": len(questions),
            "duplicates": duplicates,
            "too_short": too_short,
            "quality_score": max(0, 100 - (duplicates * 20) - (too_short * 10)),
        }

    def record_telemetry_event(self, event_type: str, payload: dict):
        data = self._load_json(self.telemetry_file, {"events": []})
        data["events"].append({"event_type": event_type, "timestamp": int(time.time()), "payload": payload})
        data["events"] = data["events"][-300:]
        self._save_json(self.telemetry_file, data)

    def update_student_mastery(self, student_id: str, subject: str, percentage: float):
        profiles = self._load_json(self.profiles_file, {})
        student = profiles.get(student_id, {"streak": 0, "last_active": 0, "subjects": {}})
        now = int(time.time())
        if now - int(student.get("last_active", 0)) <= 60 * 60 * 48:
            student["streak"] = int(student.get("streak", 0)) + 1
        else:
            student["streak"] = 1
        student["last_active"] = now

        subj = student["subjects"].get(subject, {"attempts": 0, "avg_score": 0.0, "latest_score": 0.0})
        attempts = subj["attempts"] + 1
        subj["avg_score"] = round(((subj["avg_score"] * subj["attempts"]) + percentage) / attempts, 2)
        subj["attempts"] = attempts
        subj["latest_score"] = round(percentage, 2)
        student["subjects"][subject] = subj
        profiles[student_id] = student
        self._save_json(self.profiles_file, profiles)
        return student

    def get_student_profile(self, student_id: str):
        profiles = self._load_json(self.profiles_file, {})
        return profiles.get(student_id, {"streak": 0, "subjects": {}})

    def get_teacher_insights(self, subject: str):
        profiles = self._load_json(self.profiles_file, {})
        scores = []
        for _, student in profiles.items():
            subj = student.get("subjects", {}).get(subject)
            if subj:
                scores.append(float(subj.get("latest_score", 0.0)))
        avg = round(sum(scores) / len(scores), 2) if scores else 0.0
        at_risk = len([s for s in scores if s < 45.0])
        return {
            "subject": subject,
            "students_with_attempts": len(scores),
            "average_latest_score": avg,
            "at_risk_students": at_risk,
            "recommended_intervention": "Focus remediation on weak strands and assign adaptive medium/easy practice."
            if at_risk
            else "Maintain challenge with mixed-difficulty timed practice.",
        }

    def get_reliability_snapshot(self):
        telemetry = self._load_json(self.telemetry_file, {"events": []})
        events = telemetry.get("events", [])
        return {
            "event_count": len(events),
            "recent_events": events[-10:],
            "status": "stable" if len(events) > 0 else "warming_up",
        }
