from app.services.readiness_service import WEIGHTS, calculate_readiness


def test_readiness_formula_is_deterministic():
    components = {
        "practice_results": 80,
        "mock_results": 70,
        "mastery": 60,
        "topic_coverage": 50,
        "revision_activity": 40,
    }
    assert WEIGHTS == {
        "practice_results": 0.25,
        "mock_results": 0.30,
        "mastery": 0.25,
        "topic_coverage": 0.10,
        "revision_activity": 0.10,
    }
    assert calculate_readiness(components) == 65
    assert calculate_readiness(components) == calculate_readiness(dict(components))


def test_readiness_clamps_invalid_component_ranges():
    assert calculate_readiness({key: 200 for key in WEIGHTS}) == 100
    assert calculate_readiness({key: -20 for key in WEIGHTS}) == 0
