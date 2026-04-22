import unittest

from app.models import Question, QuestionType, Subject
from app.services.likely_wassce_generator import LikelyWASSCEGenerator, SectionBlueprint


class LikelyWASSCEGeneratorTests(unittest.TestCase):
    def test_normalize_generated_mcq_moves_choices_out_of_question_text(self):
        generator = LikelyWASSCEGenerator()

        normalized = generator._normalize_generated_item(
            {
                "question_text": (
                    "15.\n"
                    "The speed of sound at 25 'C in air is 320 m s-1. Determine its value at 120 'C.\n"
                    "A. 379 m s-1\n"
                    "B. 334 m s-1\n"
                    "C. 350 m s-1\n"
                    "D. 368 m s-1\n"
                    "MCQ Question 43\n"
                    "Multiple Choice\n"
                    "A: 379 m s-1"
                ),
                "options": [
                    "A: 379 m s-1",
                    "B: 334 m s-1",
                    "C: 350 m s-1",
                    "D: 368 m s-1",
                ],
                "correct_answer": "A: 379 m s-1",
                "explanation": "Use v proportional to sqrt(T).",
            },
            QuestionType.MULTIPLE_CHOICE,
        )

        self.assertIn("The speed of sound", normalized["question_text"])
        self.assertNotIn("A. 379", normalized["question_text"])
        self.assertEqual(normalized["options"], ["379 m s-1", "334 m s-1", "350 m s-1", "368 m s-1"])
        self.assertEqual(normalized["correct_answer"], "A")

    def test_infer_paper_key_does_not_treat_paper_2_set_1_as_paper_1(self):
        generator = LikelyWASSCEGenerator()

        inferred = generator._infer_paper_key('2020 WASSCE ELECTIVE MATHS PAPER 2 SET 1.pdf')

        self.assertEqual(inferred, 'paper_2')

    def test_merge_question_lists_preserves_order_and_removes_duplicates(self):
        generator = LikelyWASSCEGenerator()
        q1 = Question(
            subject=Subject.MATHEMATICS,
            question_type=QuestionType.MULTIPLE_CHOICE,
            question_text="1. Solve 2x = 10.",
            options=["2", "3", "5", "10"],
            correct_answer="C",
            explanation="x = 5",
            difficulty_level="medium",
            year_generated=2026,
            pattern_confidence=0.9,
        )
        q2 = Question(
            subject=Subject.MATHEMATICS,
            question_type=QuestionType.MULTIPLE_CHOICE,
            question_text="2. Find the value of y if y + 4 = 9.",
            options=["3", "4", "5", "6"],
            correct_answer="C",
            explanation="y = 5",
            difficulty_level="medium",
            year_generated=2026,
            pattern_confidence=0.9,
        )
        duplicate_q1 = Question(**q1.model_dump())

        merged = generator._merge_question_lists([q1, q2], [duplicate_q1])

        self.assertEqual([item.question_text for item in merged], [q1.question_text, q2.question_text])

    def test_dedupe_questions_removes_same_stem_even_with_different_numbers(self):
        generator = LikelyWASSCEGenerator()
        q1 = Question(
            subject=Subject.MATHEMATICS,
            question_type=QuestionType.MULTIPLE_CHOICE,
            question_text="1. Solve x + 4 = 9.",
            options=["3", "4", "5", "6"],
            correct_answer="C",
            explanation="x = 5",
            difficulty_level="medium",
            year_generated=2026,
            pattern_confidence=0.9,
        )
        q2 = Question(
            subject=Subject.MATHEMATICS,
            question_type=QuestionType.MULTIPLE_CHOICE,
            question_text="7. Solve x + 4 = 9.",
            options=["3", "4", "5", "6"],
            correct_answer="C",
            explanation="x = 5",
            difficulty_level="medium",
            year_generated=2026,
            pattern_confidence=0.9,
        )

        deduped = generator._dedupe_questions([q1, q2])

        self.assertEqual(len(deduped), 1)
        self.assertEqual(deduped[0].question_text, q1.question_text)

    def test_slice_section_questions_uses_blueprint_offsets(self):
        generator = LikelyWASSCEGenerator()
        blueprint = [
            SectionBlueprint("paper_2", "section_a", "Section A", QuestionType.ESSAY, 2),
            SectionBlueprint("paper_2", "section_b", "Section B", QuestionType.ESSAY, 1),
        ]
        questions = [
            Question(
                subject=Subject.ENGLISH,
                question_type=QuestionType.ESSAY,
                question_text=f"Question {index}",
                correct_answer="Answer",
                explanation="Explanation",
                difficulty_level="medium",
                year_generated=2026,
                pattern_confidence=0.9,
            )
            for index in range(1, 4)
        ]

        section_b = generator._slice_section_questions(questions, blueprint, blueprint[1])

        self.assertEqual(len(section_b), 1)
        self.assertEqual(section_b[0].question_text, "Question 3")

    def test_normalize_blueprint_forces_40_mcqs_and_minimum_theory_count(self):
        generator = LikelyWASSCEGenerator()
        blueprint = [
            SectionBlueprint("paper_1", "section_a", "Section A", QuestionType.MULTIPLE_CHOICE, 50),
            SectionBlueprint("paper_2", "section_a", "Section A", QuestionType.ESSAY, 4),
        ]

        normalized = generator._normalize_blueprint(blueprint)

        paper_1_total = sum(item.expected_count for item in normalized if item.paper_key == "paper_1")
        paper_2_total = sum(item.expected_count for item in normalized if item.paper_key == "paper_2")

        self.assertEqual(paper_1_total, 40)
        self.assertGreaterEqual(paper_2_total, 6)

    def test_question_meets_standard_rejects_weak_mcq(self):
        generator = LikelyWASSCEGenerator()
        section = SectionBlueprint("paper_1", "section_a", "Section A", QuestionType.MULTIPLE_CHOICE, 40)
        weak_question = Question(
            subject=Subject.MATHEMATICS,
            question_type=QuestionType.MULTIPLE_CHOICE,
            question_text="Solve.",
            options=["1", "2", "3"],
            correct_answer="A",
            explanation="Short",
            difficulty_level="medium",
            year_generated=2026,
            pattern_confidence=0.9,
        )

        self.assertFalse(generator._question_meets_standard(weak_question, section))

    def test_default_blueprint_for_accounting_has_no_practical(self):
        generator = LikelyWASSCEGenerator()

        blueprint = generator._build_default_blueprint("accounting")

        self.assertEqual([item.paper_key for item in blueprint], ["paper_1", "paper_2"])

    def test_resource_match_score_rejects_religious_archive_for_accounting(self):
        generator = LikelyWASSCEGenerator()

        accounting_score = generator._resource_match_score("accounting", "Accounting")
        crs_score = generator._resource_match_score("accounting", "Christian Religious Studies")

        self.assertGreaterEqual(accounting_score, 2)
        self.assertLess(crs_score, 2)


if __name__ == "__main__":
    unittest.main()
