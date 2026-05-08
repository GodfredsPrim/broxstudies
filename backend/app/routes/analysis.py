import asyncio

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


_TVET_TOPICS = {
    # Common academic subjects
    "ict": ["MS Word Processing", "MS Excel Spreadsheets", "MS PowerPoint Presentations", "Internet Connectivity and Emerging Technologies"],
    "computer_hardware_and_software": ["MS Word Processing", "MS Excel Spreadsheets", "MS PowerPoint Presentations", "Internet Connectivity and Emerging Technologies"],
    "maths": ["Plane Geometry and Construction", "Mensuration and Trigonometry", "Surds Indices and Logarithm", "Statistics and Probability", "Sequence and Series", "Matrices and Calculus"],
    "english_language": ["Reading Comprehension", "Writing Skills", "Grammar and Language Use", "Oral Communication and Presentation", "Literature and Creative Writing", "Business English"],
    "science": ["Matter and Its Properties", "Forces and Motion", "Heat and Temperature", "Electricity and Magnetism", "Chemical Reactions", "Living Things and Their Environment", "Ecology and Environmental Science"],
    "social_studies": ["Ghana and Its History", "Government and Citizenship", "Ghana's Natural Resources", "Economic Development", "Population and Development", "Social Issues and Values", "Africa and the World"],
    "technical_drawing": ["Drawing Instruments and Materials", "Plane Geometry", "Solid Geometry", "Orthographic Projection", "Isometric Drawing", "Building Drawing", "Electrical and Electronics Drawing"],
    "entrepreneurship": ["Introduction to Entrepreneurship", "Business Planning and Development", "Marketing and Sales", "Financial Management", "Business Operations and Management", "Legal Aspects of Business", "ICT in Business"],
    # Trade subjects
    "agric_mechanization": ["Introduction to Agricultural Mechanization", "Operation and Maintenance of Primary Tillage Equipment", "Operation and Maintenance of Secondary Tillage Equipment", "Operation and Maintenance of Planting Equipment", "Crop Protection Operations", "Harvesting Operations", "Post-Harvest Processing Equipment", "Surface Irrigation Installation", "Sprinkler Irrigation Installation", "Drip Irrigation Installation", "Occupational Safety", "ICT in Agricultural Mechanization", "Fabrication of Basic Parts"],
    "architectural_draughtmanship": ["History of Architecture and Pioneers", "Introduction to Architectural Drawing", "Geometric Drawing Techniques", "Orthographic Projections", "Building Drawing", "Measured Drawings", "Services Green Buildings and Intelligent Buildings", "Physical Modelling", "Basic Programming for Architectural Draughting"],
    "automotive_engineering": ["Engine Systems and Operation", "Fuel and Exhaust Systems", "Transmission and Drivetrain Systems", "Braking and Steering Systems", "Automotive Electrical and Electronic Systems", "Vehicle Maintenance and Safety"],
    "electrical_engineering": ["Basic Electrical Concepts and Units", "Electrical Wiring Systems", "Electrical Installation and Testing", "Electronic Components and Circuits", "Motor Control Systems", "Electrical Safety Practices"],
    "mechanical_engineering": ["Engineering Materials and Properties", "Workshop Technology", "Mechanical Principles", "Machine Elements and Components", "Hydraulics and Pneumatics", "Engineering Drawing and Interpretation"],
    "welding_and_fabrication": ["Welding Safety and Protective Equipment", "Welding Processes and Equipment", "Welded Joints and Positions", "Metal Cutting and Fabrication", "Blueprint Reading and Interpretation", "Weld Quality Inspection"],
    "electronics_engineering": ["Electronic Components and Circuits", "Direct Current and Alternating Current", "Digital Electronics", "Microprocessors and Microcontrollers", "PCB Design and Assembly", "Fault Finding and Troubleshooting"],
    "mechatronics": ["Mechanical Systems", "Electronic Control Systems", "Programmable Logic Controllers", "Sensors and Actuators", "Robotics and Automation", "System Integration and Testing"],
    "industrial_mechanics": ["Machine Components and Maintenance", "Hydraulic Systems", "Pneumatic Systems", "Electrical Maintenance", "Technical Documentation", "Workshop Safety"],
    "plumbing_and_gas_technology": ["Plumbing Systems and Components", "Pipe Fitting and Jointing", "Water Supply Installation", "Drainage and Sanitation Systems", "Gas Installation and Safety", "Safety Regulations and Standards"],
    "catering_and_hospitality": ["Kitchen Safety and Hygiene", "Nutrition and Food Science", "Cooking Methods and Techniques", "Pastry and Bakery Production", "Food and Beverage Service", "Hospitality Management"],
    "fashion_design_technology": ["Fabric Types and Properties", "Pattern Making and Drafting", "Cutting and Sewing Techniques", "Fashion Design Principles", "Garment Construction and Finishing", "Clothing Care and Business Skills"],
    "beauty_therapy": ["Skin Structure and Analysis", "Facial Treatments and Skincare", "Hair Removal Techniques", "Manicure and Pedicure", "Makeup Application and Techniques", "Salon Management and Safety"],
    "hair_technology": ["Hair and Scalp Analysis", "Cutting and Trimming Techniques", "Chemical Services", "Hair Styling Techniques", "Salon Management", "Health and Safety in Salon"],
    "building_construction": ["Bricklaying and Blockwork", "Concrete Work and Formwork", "Roofing Systems", "Plastering and Rendering", "Drainage Systems", "Safety on Construction Sites"],
    "wood_technology": ["Wood Properties and Classification", "Woodworking Tools and Equipment", "Joinery Techniques", "Furniture and Cabinet Making", "Wood Finishing", "Workshop Safety"],
    "furniture_technology": ["Design Principles and Materials", "Woodworking Joints and Connections", "Cabinet Making", "Upholstery and Padding", "Surface Finishing", "Workshop Safety"],
    "graphic_design": ["Design Principles and Elements", "Typography and Layout", "Colour Theory and Application", "Digital Design Software", "Print Production", "Brand Identity and Packaging"],
    "multimedia_technology": ["Digital Photography", "Video Production and Editing", "Audio Recording and Mixing", "Computer Animation", "Web Content Creation", "Post-Production Techniques"],
    "painting": ["Surface Preparation", "Paint Types and Properties", "Brush and Roller Techniques", "Spray Painting", "Decorative Finishes", "Health and Safety in Painting"],
    "tourism_management": ["Introduction to Tourism and Hospitality", "Customer Service and Communication", "Tour Operations and Planning", "Hospitality Services", "Tourism Marketing", "Ghana's Tourism Resources"],
    "small_engines": ["Engine Principles and Components", "Fuel Systems and Carburetion", "Ignition and Starting Systems", "Engine Maintenance and Repair", "Troubleshooting", "Safety Practices"],
    "heavy_duty_mechanics": ["Heavy Equipment Identification and Safety", "Engine Systems and Overhaul", "Hydraulic and Transmission Systems", "Undercarriage and Frame Systems", "Preventive Maintenance", "Safety and Documentation"],
    "heavy_duty_operation_forklift": ["Forklift Safety Regulations", "Load Assessment and Handling", "Equipment Inspection and Maintenance", "Warehouse Operations"],
    "autobody_repairs": ["Damage Assessment and Estimation", "Panel Beating and Metalwork", "Welding and Cutting", "Surface Preparation and Painting", "Rust Treatment and Prevention", "Safety Practices"],
    "jewellry": ["Jewelry Design and Sketching", "Metalwork and Casting Techniques", "Gemstone Identification and Setting", "Jewelry Polishing and Finishing", "Business and Marketing Skills"],
    "leather_work": ["Leather Types and Properties", "Cutting and Stitching Techniques", "Pattern Making", "Dyeing and Surface Finishing", "Product Design and Development"],
    "refrideration_and_air_conditioning": ["Refrigeration Principles and Cycles", "Refrigerants and Safety", "Refrigeration Components and Systems", "Air Conditioning Systems", "System Installation and Commissioning", "Fault Diagnosis and Repair"],
}

_BASIC_TOPICS = {
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
            "computing": ["Algorithms", "Data Structures", "Programming Languages", "Computer Systems",
                          "Networking And The Internet", "Web Development Basics", "Cybersecurity",
                          "Artificial Intelligence And Machine Learning", "Operating Systems",
                          "Human-Computer Interaction"],
            "business_management": ["Business Environment", "Management Functions", "Marketing", "Finance", "Operations"],
            "accounting": ["Financial Accounting", "Cost Accounting", "Management Accounting", "Auditing"],
            "business-studies-accounting": ["Financial Accounting", "Cost Accounting", "Management Accounting", "Business Finance"],
            "business-studies-business-management": ["Business Environment", "Management Functions", "Marketing", "Operations Management"],
            "agricultural_science": ["Crop Production", "Animal Husbandry", "Soil Science", "Farm Management"],
            "food_and_nutrition": ["Nutrition", "Food Science", "Meal Planning", "Food Preservation"],
            "clothing_and_textiles": ["Textile Fibers", "Fashion Design", "Sewing Techniques", "Textile Production"],
        }

def _get_fallback_topics(subject: str) -> list:
    subject_key = subject.lower().replace("-", "_").replace(" ", "_")
    # Check TVET-specific topics first, then general SHS topics
    for lookup in (_TVET_TOPICS, _BASIC_TOPICS):
        topics = lookup.get(subject_key)
        if topics:
            return topics
    for lookup in (_TVET_TOPICS, _BASIC_TOPICS):
        for key, t in lookup.items():
            if key in subject_key or subject_key in key:
                return t
    return []


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

        # Fall back to curated list when textbooks are unavailable (e.g. Render cold start)
        if not topics:
            topics = _get_fallback_topics(subject)
            # For SHS subjects, kick off a background download so the NEXT request has PDFs
            if academic_level == "SHS" and year_key != "year_3":
                async def _bg_fetch(yk: str, slug: str) -> None:
                    try:
                        from app.services.curriculum_fetcher import CurriculumResourceFetcher
                        f = CurriculumResourceFetcher()
                        await f.ensure_subject_resources(yk, slug, ["textbooks"])
                    except Exception:
                        pass
                asyncio.create_task(_bg_fetch(year_key, subject_slug))

        return {"subject": subject, "year": year_key, "topics": topics}
    except Exception as e:
        logger.error(f"Error getting topics for {subject} ({year}): {str(e)}")
        return {"subject": subject, "topics": _get_fallback_topics(subject) or ["General Topics"]}

@router.post("/index")
async def rebuild_index():
    """Rebuild the vector index"""
    try:
        result = await rag_engine.rebuild_index()
        return {"status": "success", "message": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
