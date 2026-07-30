from app.services.impact_service import calculate_score_changes


def test_score_changes_use_first_and_latest_real_results():
    rows = [
        {"id": 1, "user_id": 1, "subject": "Maths", "percentage": 40, "created_at": "2026-01-01"},
        {"id": 2, "user_id": 1, "subject": "Maths", "percentage": 55, "created_at": "2026-02-01"},
        {"id": 3, "user_id": 1, "subject": "Maths", "percentage": 70, "created_at": "2026-03-01"},
        {"id": 4, "user_id": 2, "subject": "Science", "percentage": 80, "created_at": "2026-01-01"},
        {"id": 5, "user_id": 2, "subject": "Science", "percentage": 70, "created_at": "2026-02-01"},
        {"id": 6, "user_id": 3, "subject": "English", "percentage": 65, "created_at": "2026-01-01"},
    ]
    result = calculate_score_changes(rows)
    assert result == {
        "average_percentage_point_change": 10.0,
        "learners_improved": 1,
        "learners_declined": 1,
        "learner_subject_comparisons": 2,
    }


def test_score_changes_do_not_invent_change_from_single_result():
    result = calculate_score_changes([
        {"id": 1, "user_id": 1, "subject": "Maths", "percentage": 90, "created_at": "2026-01-01"},
    ])
    assert result["average_percentage_point_change"] == 0
    assert result["learner_subject_comparisons"] == 0
