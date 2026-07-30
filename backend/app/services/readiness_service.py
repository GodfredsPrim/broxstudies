from datetime import datetime, timedelta, timezone
from typing import Optional

from app.services.auth_service import AuthService


WEIGHTS = {
    "practice_results": 0.25,
    "mock_results": 0.30,
    "mastery": 0.25,
    "topic_coverage": 0.10,
    "revision_activity": 0.10,
}


def _clamp(value: float) -> float:
    return max(0.0, min(100.0, value))


def calculate_readiness(components: dict[str, float]) -> int:
    """Pure deterministic score. No model-generated or inferred percentages."""
    return round(sum(_clamp(float(components.get(key, 0))) * weight for key, weight in WEIGHTS.items()))


class ReadinessService:
    def __init__(self, db: Optional[AuthService] = None) -> None:
        self.db = db or AuthService()

    def calculate_for_user(self, user_id: int) -> dict:
        with self.db._connect() as conn:
            practice_rows = self.db._execute(
                conn,
                """SELECT percentage, total_questions FROM exam_history
                   WHERE user_id=? AND LOWER(exam_type)='practice'""",
                (user_id,),
            ).fetchall()
            mock_rows = self.db._execute(
                conn,
                "SELECT percentage, total_questions FROM mock_attempts WHERE user_id=?",
                (user_id,),
            ).fetchall()
            mastery_rows = self.db._execute(
                conn,
                """SELECT subject, topic, correct_count, attempt_count, mastery_score
                   FROM topic_mastery WHERE user_id=? ORDER BY mastery_score DESC, topic ASC""",
                (user_id,),
            ).fetchall()
            profile = self.db._execute(
                conn,
                "SELECT subjects_json FROM learning_profiles WHERE user_id=?",
                (user_id,),
            ).fetchone()
            revision_rows = self.db._execute(
                conn,
                """SELECT completed, plan_date FROM study_plan_items
                   WHERE user_id=?""",
                (user_id,),
            ).fetchall()

        def weighted_result(rows) -> float:
            denominator = sum(max(0, int(row["total_questions"] or 0)) for row in rows)
            if denominator <= 0:
                return 0.0
            return round(
                sum(float(row["percentage"] or 0) * max(0, int(row["total_questions"] or 0)) for row in rows)
                / denominator,
                1,
            )

        practice_score = weighted_result(practice_rows)
        mock_score = weighted_result(mock_rows)
        mastery_attempts = sum(max(0, int(row["attempt_count"] or 0)) for row in mastery_rows)
        mastery_score = (
            round(
                sum(float(row["mastery_score"] or 0) * max(0, int(row["attempt_count"] or 0)) for row in mastery_rows)
                / mastery_attempts,
                1,
            )
            if mastery_attempts
            else 0.0
        )

        import json
        configured_subjects = json.loads(profile["subjects_json"] or "[]") if profile else []
        distinct_topics = len({(str(row["subject"]).lower(), str(row["topic"]).lower()) for row in mastery_rows})
        distinct_subjects = len({str(row["subject"]).lower() for row in mastery_rows})
        coverage_goal = max(10, len(configured_subjects or []) * 5, distinct_subjects * 5)
        coverage_score = round(min(100, distinct_topics / coverage_goal * 100), 1)

        cutoff = (datetime.now(timezone.utc) - timedelta(days=28)).date()
        recent_revision = []
        for row in revision_rows:
            try:
                if datetime.fromisoformat(str(row["plan_date"])).date() >= cutoff:
                    recent_revision.append(row)
            except ValueError:
                continue
        completed_revision = sum(1 for row in recent_revision if bool(row["completed"]))
        revision_score = round(completed_revision / len(recent_revision) * 100, 1) if recent_revision else 0.0

        components = {
            "practice_results": practice_score,
            "mock_results": mock_score,
            "mastery": mastery_score,
            "topic_coverage": coverage_score,
            "revision_activity": revision_score,
        }
        strong = [
            {"subject": row["subject"], "topic": row["topic"], "score": int(row["mastery_score"])}
            for row in mastery_rows if int(row["mastery_score"] or 0) >= 70
        ][:5]
        weak = [
            {"subject": row["subject"], "topic": row["topic"], "score": int(row["mastery_score"])}
            for row in reversed(mastery_rows) if int(row["mastery_score"] or 0) < 70
        ][:5]
        weakest_component = min(components, key=components.get)
        if weak:
            next_action = {
                "title": f"Revise {weak[0]['topic']}",
                "description": f"Your recorded mastery is {weak[0]['score']}%. Complete a targeted practice set, then retry the topic.",
                "action": "/practice",
            }
        elif weakest_component == "mock_results":
            next_action = {"title": "Complete a timed mock", "description": "No strong mock evidence is available yet.", "action": "/wassce"}
        elif weakest_component == "revision_activity":
            next_action = {"title": "Complete today's revision item", "description": "Revision consistency is the lowest score component.", "action": "/learning"}
        else:
            next_action = {"title": "Broaden topic coverage", "description": "Practice a curriculum topic not yet represented in your mastery records.", "action": "/practice"}

        return {
            "overall_score": calculate_readiness(components),
            "components": [
                {
                    "key": key,
                    "label": key.replace("_", " ").title(),
                    "score": value,
                    "weight": round(WEIGHTS[key] * 100),
                    "weighted_points": round(value * WEIGHTS[key], 1),
                }
                for key, value in components.items()
            ],
            "strong_topics": strong,
            "weak_topics": weak,
            "recommended_next_action": next_action,
            "formula": "practice 25% + mocks 30% + mastery 25% + topic coverage 10% + revision activity 10%",
            "data_counts": {
                "practice_sessions": len(practice_rows),
                "mock_examinations": len(mock_rows),
                "mastery_topics": len(mastery_rows),
                "coverage_goal_topics": coverage_goal,
                "revision_items_28d": len(recent_revision),
                "revision_items_completed_28d": completed_revision,
            },
        }


readiness_service = ReadinessService()
