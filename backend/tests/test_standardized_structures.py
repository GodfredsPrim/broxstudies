import unittest
from app.services.wassce_intelligence import WassceIntelligenceService

class StandardizedExamStructureTest(unittest.TestCase):
    def setUp(self):
        self.intel = WassceIntelligenceService()

    def test_core_mathematics_structure(self):
        """Test that Core Mathematics has exactly 13 questions in Paper 2."""
        structure = self.intel.analyze_paper_structure("core_mathematics", "SHS")
        
        # Paper 1 should have 50 MCQs
        self.assertEqual(structure["paper_1"], 50)
        
        # Paper 2 should have sections totaling 13 questions
        paper_2 = structure["paper_2"]
        self.assertIn("section_a", paper_2)
        self.assertIn("section_b", paper_2)
        self.assertEqual(paper_2["section_a"], 10)
        self.assertEqual(paper_2["section_b"], 3)
        
        # Total Paper 2 questions should be 13
        total_paper_2 = sum(paper_2.values())
        self.assertEqual(total_paper_2, 13)
        
        # No Paper 3
        self.assertEqual(structure["paper_3"], 0)

    def test_physics_structure(self):
        """Test that Physics has the correct structure with practicals."""
        structure = self.intel.analyze_paper_structure("physics", "SHS")
        
        self.assertEqual(structure["paper_1"], 50)
        
        paper_2 = structure["paper_2"]
        total_paper_2 = sum(paper_2.values())
        self.assertEqual(total_paper_2, 13)  # 5 + 5 + 3
        
        self.assertEqual(structure["paper_3"], 1)  # Has practical

    def test_default_structure(self):
        """Test that unknown subjects get the default structure."""
        structure = self.intel.analyze_paper_structure("unknown_subject", "SHS")
        
        self.assertEqual(structure["paper_1"], 50)
        
        paper_2 = structure["paper_2"]
        total_paper_2 = sum(paper_2.values())
        self.assertEqual(total_paper_2, 13)  # 8 + 5

if __name__ == "__main__":
    unittest.main()