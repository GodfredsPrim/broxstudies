import pytest

from app.services.backtesting_service import run_backtest_from_papers


PAPERS = {
    2021: [
        {"text": "Solve the algebraic equation.", "question_type": "short_answer", "paper": "paper_2"},
        {"text": "Identify the mean from A. 2 B. 3 C. 4 D. 5", "question_type": "multiple_choice", "paper": "paper_1"},
    ],
    2022: [
        {"text": "Calculate the probability of the event.", "question_type": "short_answer", "paper": "paper_2"},
        {"text": "State the algebraic factor.", "question_type": "multiple_choice", "paper": "paper_1"},
    ],
    2023: [
        {"text": "Solve the algebraic equation.", "question_type": "short_answer", "paper": "paper_2"},
        {"text": "Calculate the mean.", "question_type": "multiple_choice", "paper": "paper_1"},
    ],
}


def test_backtest_excludes_hidden_year_and_scores_real_paper():
    result = run_backtest_from_papers("mathematics", 2023, PAPERS)
    assert result["training_years"] == [2021, 2022]
    assert result["exclusion_confirmed"] is True
    assert 2023 not in result["training_years"]
    assert set(result["metrics"]) == {
        "topic_overlap",
        "competency_alignment",
        "question_type_similarity",
        "paper_format_accuracy",
    }
    assert result["metrics"]["question_type_similarity"] == 100
    assert result["metrics"]["paper_format_accuracy"] == 100


def test_backtest_requires_hidden_and_earlier_real_papers():
    with pytest.raises(ValueError):
        run_backtest_from_papers("mathematics", 2024, PAPERS)
    with pytest.raises(ValueError):
        run_backtest_from_papers("mathematics", 2021, PAPERS)
