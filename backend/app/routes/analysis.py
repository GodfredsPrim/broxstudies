from fastapi import APIRouter, HTTPException
from app.models import Subject, AnalysisResult
from app.services.academic_catalog import is_tvet_subject_slug
from app.services.rag_engine import RAGEngine
import logging

logger = logging.getLogger(__name__)
router = APIRouter()
rag_engine = RAGEngine()

def _normalize_year_key(year: str) -> str:
    year_key = year.lower().strip().replace(" ", "_")
    if year_key in {"1", "year1"}:
        return "year_1"
    if year_key in {"2", "year2"}:
        return "year_2"
    if year_key in {"3", "year3"}:
        return "year_3"
    return year_key

@router.get("/patterns/{subject}")
async def analyze_patterns(subject: Subject):
    """Analyze patterns in past questions for a subject"""
    try:
        patterns = await rag_engine.analyze_patterns(subject)
        
        return AnalysisResult(
            subject=subject,
            total_past_questions_analyzed=patterns.get("total_questions", 0),
            common_topics=patterns.get("common_topics", []),
            question_patterns=patterns.get("patterns", {}),
            difficulty_distribution=patterns.get("difficulty", {}),
            topic_frequency=patterns.get("topic_frequency", {})
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Maps catalog/frontend slugs → textbook file slugs used in the cache
_SLUG_MAP = {
    "mathematics":                              "core_mathematics",
    "chemistry":                                "chemistry_note",
    "geography":                                "geography_note",
    "information_and_communication_technology_ict": "ict",
    "home_economics_food_and_nutrition":        "food_and_nutrition",
    "home_economics_clothing_and_textiles":     "clothing_and_textiles",
    "home_economics_management_in_living":      "management_in_living",
    "religious_and_moral_education":            "rme",
    "arts_and_design_studio":                   "art_and_design_studio",
    "performing_arts":                          "performing_art",
    "aviation_and_aerospace_engineering":       "aviation_and_aerospace",
    "agricultural_science":                     "agriculture_science",
    "agriculture":                              "agriculture_science",
    "building_construction_and_wood_technology": "building_construction_in_woodwork_technology",
    "electrical_and_electronic_technology":     "electronics_and_electrons_technology",
    "business_studies_business_management":     "business_management",
    "core_physical_education_and_health_peh":   "core_peh",
    "elective_physical_education_and_health_peh": "elective_physical_education_and_health",
    "french":                                   "french_year_2",
    "religious_studies":                        "islamic_religious_studies",
    "religious_studies_islamic":                "islamic_religious_studies",
    "ghanaian_language_akuapem_twi":            "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "ghanaian_language_asante_twi":             "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "ghanaian_language_ewe":                    "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "ghanaian_language_ga":                     "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "ghanaian_language_nzema":                  "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "ghanaian_language_dangme":                 "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "ghanaian_language_dagaare":                "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "ghanaian_language_dagbani":                "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "ghanaian_language_mfantse":                "ghanaian_language_twi_ewe_ga_nzema_akuapem",
}


@router.get("/topics/{subject}")
async def get_topics(subject: str, year: str = "year_1"):
    """Get topics extracted from textbook table of contents, strictly per year."""
    try:
        from app.services.wassce_intelligence import WassceIntelligenceService
        intel = WassceIntelligenceService()

        subject_slug = subject.lower().replace("-", "_").replace(" ", "_")
        subject_slug = _SLUG_MAP.get(subject_slug, subject_slug)
        year_key = _normalize_year_key(year)
        academic_level = "TVET" if is_tvet_subject_slug(subject_slug) else "SHS"

        if year_key == "year_3":
            # Year 3 (WASSCE) covers the full 3-year curriculum — combine Year 1 + Year 2
            topics_y1 = intel.extract_topics_from_textbook("year_1", subject_slug, academic_level)
            topics_y2 = intel.extract_topics_from_textbook("year_2", subject_slug, academic_level)
            combined = topics_y1 + [t for t in topics_y2 if t not in topics_y1]
            topics = sorted(combined)
        else:
            # Year 1, Year 2, Level 1, Level 2 — strictly their own textbooks
            topics = intel.extract_topics_from_textbook(year_key, subject_slug, academic_level)

        # Computing PDFs are image-only — use curriculum-aligned fallback
        if not topics and 'computing' in subject_slug:
            topics = [
                "Problem Solving And Algorithms", "Data Types And Variables",
                "Control Structures", "Functions And Procedures",
                "Arrays And Data Structures", "Object-Oriented Programming",
                "File Handling", "Database Concepts",
                "Networking And The Internet", "Web Development Basics",
                "Cybersecurity", "Artificial Intelligence And Machine Learning",
                "Computer Hardware", "Operating Systems",
                "Human-Computer Interaction",
            ]

        return {"subject": subject, "year": year_key, "topics": topics}
    except Exception as e:
        logger.error(f"Error getting topics for {subject} ({year}): {str(e)}")
        basic_topics = {
            "mathematics": ["Number Systems", "Algebra", "Geometry", "Statistics", "Calculus", "Trigonometry"],
            "additional_mathematics": ["Advanced Algebra", "Calculus", "Vectors", "Matrices", "Statistics"],
            "english": ["Literature", "Comprehension", "Grammar", "Composition", "Vocabulary"],
            "integrated_science": ["Physics", "Chemistry", "Biology", "Ecology", "Energy"],
            "physics": ["Mechanics", "Electricity", "Magnetism", "Waves", "Optics", "Modern Physics"],
            "chemistry": ["Atomic Structure", "Chemical Bonding", "Acids and Bases", "Organic Chemistry", "Electrochemistry"],
            "biology": ["Cell Biology", "Genetics", "Ecology", "Human Physiology", "Evolution"],
            "social_studies": ["History", "Geography", "Civics", "Economics", "Culture"],
            "history": ["Ancient Civilizations", "Colonialism", "Independence Movements", "Modern History"],
            "geography": ["Physical Geography", "Human Geography", "Map Reading", "Environmental Issues"],
            "government": ["Political Systems", "Constitutions", "International Relations", "Human Rights"],
            "economics": ["Microeconomics", "Macroeconomics", "Trade", "Development Economics"],
            "ict": ["Programming", "Database", "Networking", "Web Design", "Hardware"],
            "computing": ["Algorithms", "Data Structures", "Programming Languages", "Computer Systems"],
            "business_management": ["Business Environment", "Management Functions", "Marketing", "Finance", "Operations"],
            "accounting": ["Financial Accounting", "Cost Accounting", "Management Accounting", "Auditing"],
            "business-studies-accounting": ["Financial Accounting", "Cost Accounting", "Management Accounting", "Business Finance"],
            "business-studies-business-management": ["Business Environment", "Management Functions", "Marketing", "Operations Management"],
            "agricultural_science": ["Crop Production", "Animal Husbandry", "Soil Science", "Farm Management"],
            "food_and_nutrition": ["Nutrition", "Food Science", "Meal Planning", "Food Preservation"],
            "clothing_and_textiles": ["Textile Fibers", "Fashion Design", "Sewing Techniques", "Textile Production"],
        }
        # Try to match subject name variations
        subject_key = subject.lower().replace("-", "_").replace(" ", "_")
        fallback_topics = basic_topics.get(subject_key)
        if not fallback_topics:
            # Try partial matches
            for key, topics in basic_topics.items():
                if key in subject_key or subject_key in key:
                    fallback_topics = topics
                    break
        
        return {"subject": subject, "topics": fallback_topics or ["General Topics"]}

@router.post("/index")
async def rebuild_index():
    """Rebuild the vector index"""
    try:
        result = await rag_engine.rebuild_index()
        return {"status": "success", "message": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
