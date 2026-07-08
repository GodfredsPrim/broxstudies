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
    # Named Ghanaian language subjects from the site catalog
    "asante_twi":                               "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "akuapem_twi":                              "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "dangme":                                   "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "dagaare":                                  "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "dagbanli":                                 "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "ewe":                                      "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "ga":                                       "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "gonja":                                    "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "gurene":                                   "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "kasem":                                    "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "mfantse":                                  "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "nzema":                                    "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "ghanaian_language":                        "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "ghanaian_language_gonja":                  "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "ghanaian_language_gurene":                 "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "ghanaian_language_kasem":                  "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    "ghanaian_language_dagbanli":               "ghanaian_language_twi_ewe_ga_nzema_akuapem",
    # Other catalog slugs without their own curated lists
    "general_science":                          "integrated_science",
    "art_and_design_foundation":                "art_and_design_studio",
    "automotive_and_metal_technology":          "automotive_engineering",
    "applied_technology":                       "engineering",
    "intervention_english":                     "english",
    "intervention_mathematics":                 "core_mathematics",
    "religious_studies_christian":              "christian_religious_studies",
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
    # ── Core / Compulsory ────────────────────────────────────────────────
    "mathematics": [
        "Number and Numeration Systems",
        "Algebraic Expressions and Equations",
        "Plane Geometry and Construction",
        "Mensuration and Trigonometry",
        "Coordinate Geometry and Straight Lines",
        "Statistics and Probability",
        "Vectors and Transformations",
        "Matrices and Determinants",
        "Sequences and Series",
        "Inequalities and Linear Programming",
    ],
    "core_mathematics": [
        "Number and Numeration Systems",
        "Algebraic Expressions and Equations",
        "Plane Geometry and Construction",
        "Mensuration and Trigonometry",
        "Coordinate Geometry and Straight Lines",
        "Statistics and Probability",
        "Vectors and Transformations",
        "Matrices and Determinants",
        "Sequences and Series",
        "Inequalities and Linear Programming",
    ],
    "additional_mathematics": [
        "Binary Operations",
        "Sets and Functions",
        "Surds, Indices and Logarithms",
        "Sequences and Series",
        "Matrices and Determinants",
        "Straight Lines and Coordinate Geometry",
        "Vectors in Two Dimensions",
        "Trigonometric Functions",
        "Differentiation and Integration",
        "Statistics and Probability",
        "Permutations and Combinations",
    ],
    "english": [
        "Reading and Comprehension",
        "Summary Writing",
        "Essay and Composition Writing",
        "Letter and Report Writing",
        "Grammar and Language Structures",
        "Oral Communication and Listening",
        "Literary Appreciation: Prose",
        "Literary Appreciation: Poetry",
        "Literary Appreciation: Drama",
        "Vocabulary and Lexis",
    ],
    "english_language": [
        "Reading and Comprehension",
        "Summary Writing",
        "Essay and Composition Writing",
        "Letter and Report Writing",
        "Grammar and Language Structures",
        "Oral Communication and Listening",
        "Literary Appreciation: Prose",
        "Literary Appreciation: Poetry",
        "Literary Appreciation: Drama",
        "Vocabulary and Lexis",
    ],
    "integrated_science": [
        "Scientific Methods and Laboratory Safety",
        "Matter and Its Properties",
        "Forces, Motion and Energy",
        "Waves, Sound and Light",
        "Electricity and Magnetism",
        "Chemical Reactions and Equations",
        "Acids, Bases and Salts",
        "Cell Biology and Living Things",
        "Ecology and the Environment",
        "Human Biology and Health",
        "Reproduction in Plants and Animals",
    ],
    "social_studies": [
        "Identity, Culture and Values",
        "The Ghanaian Family and Society",
        "Governance and Democracy in Ghana",
        "Ghana's Natural Resources",
        "Economic Development and Globalisation",
        "Population and Development",
        "Social Issues: Drug Abuse, Teenage Pregnancy, Peer Pressure",
        "Human Rights and Responsibilities",
        "Africa and the World",
        "Environmental Issues and Sustainability",
    ],
    # ── Science Electives ────────────────────────────────────────────────
    "physics": [
        "Mechanics: Motion and Forces",
        "Work, Energy and Power",
        "Thermal Physics and Heat Transfer",
        "Wave Motion and Sound",
        "Light and Optics",
        "Electricity and Electric Circuits",
        "Magnetism and Electromagnetism",
        "Atomic and Nuclear Physics",
        "Electronics",
        "Gravitational Fields",
    ],
    "chemistry": [
        "Atomic Structure and the Periodic Table",
        "Chemical Bonding",
        "The Mole Concept and Chemical Equations",
        "States of Matter and Gas Laws",
        "Acids, Bases and Salts",
        "Electrochemistry",
        "Organic Chemistry",
        "Industrial Chemistry",
        "Chemical Equilibrium and Kinetics",
        "Environmental Chemistry",
    ],
    "chemistry_note": [
        "Atomic Structure and the Periodic Table",
        "Chemical Bonding",
        "The Mole Concept and Chemical Equations",
        "States of Matter and Gas Laws",
        "Acids, Bases and Salts",
        "Electrochemistry",
        "Organic Chemistry",
        "Industrial Chemistry",
        "Chemical Equilibrium and Kinetics",
        "Environmental Chemistry",
    ],
    "biology": [
        "Cell Structure and Organisation",
        "Nutrition in Plants and Animals",
        "Photosynthesis and Respiration",
        "Transport Systems in Plants and Animals",
        "Homeostasis and Excretion",
        "Reproduction in Plants and Animals",
        "Genetics and Heredity",
        "Evolution and Classification",
        "Ecology and the Environment",
        "Microorganisms, Diseases and Health",
    ],
    # ── Arts / Social Sciences ───────────────────────────────────────────
    "history": [
        "Pre-Colonial African History and Culture",
        "European Contacts and the Slave Trade",
        "Colonial Rule in West Africa",
        "Nationalist Movements and Independence",
        "Ghana After Independence",
        "Modern African History",
        "The World Wars and Their Impact",
        "International Relations",
    ],
    "geography": [
        "Introduction to Geography and Map Reading",
        "Earth's Structure, Rocks and Weathering",
        "Landforms and Drainage",
        "Climate and Weather",
        "Soils and Vegetation",
        "Population and Settlement",
        "Agriculture and Food Production",
        "Economic Activities: Industry and Trade",
        "Environmental Issues and Sustainability",
        "Regional Geography of Ghana and Africa",
    ],
    "geography_note": [
        "Introduction to Geography and Map Reading",
        "Earth's Structure, Rocks and Weathering",
        "Landforms and Drainage",
        "Climate and Weather",
        "Soils and Vegetation",
        "Population and Settlement",
        "Agriculture and Food Production",
        "Economic Activities: Industry and Trade",
        "Environmental Issues and Sustainability",
        "Regional Geography of Ghana and Africa",
    ],
    "government": [
        "The Concept of the State and Government",
        "Types of Government and Political Systems",
        "Constitutions and Constitutional Development",
        "The Executive Branch",
        "The Legislature",
        "The Judiciary",
        "Local Government and Decentralisation",
        "Electoral Systems and Political Parties",
        "Human Rights and Fundamental Freedoms",
        "International Relations and Organisations",
    ],
    "economics": [
        "Basic Economic Concepts and Problems",
        "The Price Mechanism: Demand and Supply",
        "Theory of Production and Costs",
        "Market Structures",
        "National Income and Economic Growth",
        "Money, Banking and Financial Institutions",
        "Government Finance and Taxation",
        "International Trade and Balance of Payments",
        "Development Economics",
        "Inflation, Unemployment and Economic Policies",
    ],
    # ── Business / ICT ───────────────────────────────────────────────────
    "ict": [
        "Introduction to ICT and Computer Systems",
        "Computer Hardware and Software",
        "Word Processing Applications",
        "Spreadsheet Applications",
        "Database Management Systems",
        "Internet and Electronic Services",
        "Multimedia and Presentation Software",
        "Programming Concepts and Logic",
        "Networking and Communication",
        "Information Security and Ethics",
    ],
    "computing": [
        "Algorithms and Problem Solving",
        "Programming Fundamentals",
        "Data Structures",
        "Computer Networks and the Internet",
        "Database Systems",
        "Web Development Basics",
        "Cybersecurity and Ethics",
        "Artificial Intelligence and Machine Learning",
        "Operating Systems",
        "Human-Computer Interaction",
    ],
    "business_management": [
        "Introduction to Business and Entrepreneurship",
        "Forms of Business Organisation",
        "Business Planning and Strategy",
        "Marketing and Sales Management",
        "Human Resource Management",
        "Financial Management and Accounting",
        "Operations and Production Management",
        "Business Communication",
        "Business Ethics and Corporate Responsibility",
        "Global Business Environment",
    ],
    "accounting": [
        "Introduction to Accounting",
        "Double-Entry Bookkeeping",
        "Books of Original Entry",
        "Ledger Accounts and Trial Balance",
        "Trading, Profit and Loss Account",
        "Balance Sheet and Cash Flow Statement",
        "Control Accounts and Bank Reconciliation",
        "Accounting for Depreciation",
        "Partnership Accounts",
        "Limited Company Accounts",
        "Cost and Management Accounting",
    ],
    "business-studies-accounting": [
        "Introduction to Accounting",
        "Double-Entry Bookkeeping",
        "Books of Original Entry",
        "Ledger Accounts and Trial Balance",
        "Financial Statements",
        "Control Accounts",
        "Depreciation and Provisions",
        "Partnership Accounts",
        "Company Accounts",
        "Cost Accounting",
    ],
    "business-studies-business-management": [
        "Introduction to Business",
        "Forms of Business Organisation",
        "Business Planning",
        "Marketing Management",
        "Human Resource Management",
        "Financial Management",
        "Operations Management",
        "Business Ethics",
        "ICT in Business",
    ],
    "business_studies_business_management": [
        "Introduction to Business",
        "Forms of Business Organisation",
        "Business Planning",
        "Marketing Management",
        "Human Resource Management",
        "Financial Management",
        "Operations Management",
        "Business Ethics",
        "ICT in Business",
    ],
    # ── Agriculture ──────────────────────────────────────────────────────
    "agricultural_science": [
        "Introduction to Agriculture and Crop Science",
        "Soil Science and Soil Fertility",
        "Crop Production: Cereals and Legumes",
        "Crop Production: Roots, Tubers and Vegetables",
        "Animal Production: Livestock Management",
        "Animal Production: Poultry and Aquaculture",
        "Farm Mechanization and Irrigation",
        "Pest, Disease and Weed Management",
        "Agricultural Economics and Farm Management",
        "Post-Harvest Technology and Agribusiness",
    ],
    "agriculture": [
        "Introduction to Agriculture and Crop Science",
        "Soil Science and Soil Fertility",
        "Crop Production: Cereals and Legumes",
        "Crop Production: Roots, Tubers and Vegetables",
        "Animal Production: Livestock Management",
        "Animal Production: Poultry and Aquaculture",
        "Farm Mechanization and Irrigation",
        "Pest, Disease and Weed Management",
        "Agricultural Economics and Farm Management",
        "Post-Harvest Technology and Agribusiness",
    ],
    "agriculture_science": [
        "Introduction to Agriculture and Crop Science",
        "Soil Science and Soil Fertility",
        "Crop Production: Cereals and Legumes",
        "Crop Production: Roots, Tubers and Vegetables",
        "Animal Production: Livestock Management",
        "Animal Production: Poultry and Aquaculture",
        "Farm Mechanization and Irrigation",
        "Pest, Disease and Weed Management",
        "Agricultural Economics and Farm Management",
        "Post-Harvest Technology and Agribusiness",
    ],
    # ── Home Economics ───────────────────────────────────────────────────
    "food_and_nutrition": [
        "Nutrients and Their Functions",
        "Food Sources and Classification",
        "Meal Planning and Balanced Diet",
        "Food Preparation Methods and Equipment",
        "Food Safety, Hygiene and Sanitation",
        "Food Preservation and Processing",
        "Consumer Education and Food Labelling",
        "Special Diets and Therapeutic Nutrition",
        "Cookery Skills and Practical Work",
    ],
    "clothing_and_textiles": [
        "Textile Fibres: Natural and Synthetic",
        "Yarn and Fabric Construction",
        "Dyeing and Printing of Fabrics",
        "Clothing Design and Pattern Making",
        "Clothing Construction Techniques",
        "Garment Finishing and Embellishment",
        "Clothing Care and Maintenance",
        "Fashion Illustration and Design",
        "Consumer Education in Clothing",
    ],
    "management_in_living": [
        "Resource Management in the Home",
        "Home Management and Organisation",
        "Child Care and Development",
        "Housing, Interior Design and Decoration",
        "Consumer Education and Financial Literacy",
        "Health, Sanitation and Waste Management",
        "Family Life and Relationships",
        "Care of the Elderly and Special Needs",
    ],
    "home_economics_management_in_living": [
        "Resource Management in the Home",
        "Home Management and Organisation",
        "Child Care and Development",
        "Housing, Interior Design and Decoration",
        "Consumer Education and Financial Literacy",
        "Health, Sanitation and Waste Management",
        "Family Life and Relationships",
        "Care of the Elderly and Special Needs",
    ],
    # ── Religious / Moral Education ──────────────────────────────────────
    "rme": [
        "Beliefs About God in African Religion, Christianity and Islam",
        "The Family and Its Importance",
        "Moral Values: Honesty, Integrity and Responsibility",
        "Religious Practices and Worship",
        "Festivals, Customs and Traditions",
        "Social Issues: Drug Abuse, Teenage Pregnancy and Peer Pressure",
        "Human Rights and Social Justice",
        "Religion and National Development",
        "Environmental Ethics",
    ],
    "religious_and_moral_education": [
        "Beliefs About God in African Religion, Christianity and Islam",
        "The Family and Its Importance",
        "Moral Values: Honesty, Integrity and Responsibility",
        "Religious Practices and Worship",
        "Festivals, Customs and Traditions",
        "Social Issues: Drug Abuse, Teenage Pregnancy and Peer Pressure",
        "Human Rights and Social Justice",
        "Religion and National Development",
        "Environmental Ethics",
    ],
    "religious_studies": [
        "Beliefs (Aqeedah) in Islam",
        "The Five Pillars of Islam",
        "The Quran: Revelation and Recitation",
        "Hadith and Sunnah of the Prophet",
        "Islamic History and Civilisation",
        "Islamic Ethics and Moral Values",
        "Islamic Jurisprudence (Fiqh)",
        "Islam and Society",
        "Contemporary Issues in Islam",
    ],
    "religious_studies_islamic": [
        "Beliefs (Aqeedah) in Islam",
        "The Five Pillars of Islam",
        "The Quran: Revelation and Recitation",
        "Hadith and Sunnah of the Prophet",
        "Islamic History and Civilisation",
        "Islamic Ethics and Moral Values",
        "Islamic Jurisprudence (Fiqh)",
        "Islam and Society",
        "Contemporary Issues in Islam",
    ],
    "islamic_religious_studies": [
        "Beliefs (Aqeedah) in Islam",
        "The Five Pillars of Islam",
        "The Quran: Revelation and Recitation",
        "Hadith and Sunnah of the Prophet",
        "Islamic History and Civilisation",
        "Islamic Ethics and Moral Values",
        "Islamic Jurisprudence (Fiqh)",
        "Islam and Society",
        "Contemporary Issues in Islam",
    ],
    "christian_religious_studies": [
        "The Creation Stories and the Fall of Man",
        "The Call and Faith of Abraham",
        "Moses, the Exodus and the Covenant",
        "Leadership in Israel: Joshua, David and Solomon",
        "The Prophets: Amos, Hosea, Isaiah and Jeremiah",
        "The Birth, Baptism and Temptation of Jesus",
        "The Teachings and Parables of Jesus",
        "The Death, Resurrection and Ascension of Jesus",
        "The Early Church and the Ministry of Paul",
        "Christian Ethics and Contemporary Moral Issues",
    ],
    "literature_in_english": [
        "Elements of Prose Fiction: Plot, Character and Setting",
        "The African Novel: Themes and Techniques",
        "The Non-African Novel",
        "Elements of Drama: Structure, Dialogue and Stagecraft",
        "African Drama",
        "Non-African Drama: Shakespeare and Others",
        "Elements of Poetry: Form, Rhythm and Sound Devices",
        "African Poetry",
        "Non-African Poetry",
        "Figures of Speech and Literary Devices",
        "Unseen Prose and Poetry Appreciation",
    ],
    "music": [
        "Rudiments of Music: Notation, Scales and Keys",
        "Intervals, Chords and Harmony",
        "Rhythm, Metre and Time Signatures",
        "Melody Writing and Composition",
        "Ghanaian Traditional Music and Instruments",
        "African Art Music and Popular Music (Highlife)",
        "Western Art Music: Periods and Composers",
        "Musical Forms and Analysis",
        "Aural Perception and Sight Reading",
        "Music Technology and the Music Industry",
    ],
    "robotics": [
        "Introduction to Robotics and Automation",
        "Robot Anatomy: Sensors, Actuators and Effectors",
        "Electronics for Robotics: Circuits and Microcontrollers",
        "Programming Robots: Algorithms and Control Flow",
        "Mechanisms: Gears, Motors and Motion Transmission",
        "Robot Navigation and Obstacle Avoidance",
        "Artificial Intelligence and Machine Vision in Robotics",
        "Robot Design and Prototyping",
        "Applications of Robotics in Industry and Society",
        "Safety and Ethics in Robotics",
    ],
    "spanish": [
        "Listening and Oral Communication in Spanish",
        "Reading Comprehension in Spanish",
        "Essay and Letter Writing in Spanish",
        "Spanish Grammar: Tenses and Structures",
        "Spanish Vocabulary and Expressions",
        "Hispanic Culture and Civilisation",
        "Conversation and Practical Spanish",
        "Translation: Spanish-English and English-Spanish",
    ],
    "arabic": [
        "Listening and Oral Communication in Arabic",
        "Reading Comprehension in Arabic",
        "Arabic Composition and Letter Writing",
        "Arabic Grammar (Nahw) and Morphology (Sarf)",
        "Arabic Vocabulary and Expressions",
        "Arabic Literature: Prose and Poetry",
        "Arab and Islamic Culture and Civilisation",
        "Translation: Arabic-English and English-Arabic",
    ],
    "design_and_communication_technology": [
        "The Design Process and Design Thinking",
        "Freehand Sketching and Drawing Techniques",
        "Geometric Construction and Plane Geometry",
        "Orthographic and Pictorial Projection",
        "Building and Engineering Drawing",
        "Graphic Communication and Presentation",
        "Materials and Their Working Properties",
        "Computer-Aided Design (CAD)",
        "Product Design and Manufacture",
        "Safety in the Workshop and Studio",
    ],
    "engineering": [
        "Introduction to Engineering and the Engineering Design Process",
        "Engineering Materials and Their Properties",
        "Statics: Forces, Moments and Equilibrium",
        "Dynamics: Motion and Energy",
        "Electrical Circuits and Systems",
        "Thermodynamics and Fluid Mechanics Basics",
        "Engineering Drawing and CAD",
        "Manufacturing Processes",
        "Control Systems and Automation",
        "Engineering Ethics, Safety and Society",
    ],
    "biomedical_science": [
        "Introduction to Biomedical Science and Careers",
        "Cell Biology and Histology",
        "Human Anatomy and Physiology Systems",
        "Biochemistry: Biomolecules and Metabolism",
        "Microbiology and Infection Control",
        "Immunology and the Body's Defence Systems",
        "Haematology and Blood Science",
        "Medical Laboratory Techniques and Instrumentation",
        "Disease Processes and Diagnostics",
        "Biomedical Ethics and Patient Safety",
    ],
    # ── Arts and Culture ─────────────────────────────────────────────────
    "arts_and_design_studio": [
        "Elements and Principles of Art and Design",
        "Drawing: Observational and Technical",
        "Painting Techniques and Media",
        "Graphic Design and Typography",
        "Sculpture and Ceramics",
        "Printmaking",
        "Textile Arts and Batik",
        "Photography and Digital Arts",
        "Art History and Appreciation",
        "Portfolio and Exhibition Preparation",
    ],
    "art_and_design_studio": [
        "Elements and Principles of Art and Design",
        "Drawing: Observational and Technical",
        "Painting Techniques and Media",
        "Graphic Design and Typography",
        "Sculpture and Ceramics",
        "Printmaking",
        "Textile Arts and Batik",
        "Photography and Digital Arts",
        "Art History and Appreciation",
        "Portfolio and Exhibition Preparation",
    ],
    "performing_arts": [
        "Music Theory: Notation and Rhythm",
        "Vocal Music and Choral Performance",
        "Instrumental Music and Ensemble",
        "Dance: Traditional and Contemporary Forms",
        "Drama: Script Writing and Theatrical Performance",
        "Stage Craft and Production Design",
        "Ghanaian and African Performing Arts Heritage",
        "Contemporary Performing Arts",
        "Performance and Stage Management",
    ],
    "performing_art": [
        "Music Theory: Notation and Rhythm",
        "Vocal Music and Choral Performance",
        "Instrumental Music and Ensemble",
        "Dance: Traditional and Contemporary Forms",
        "Drama: Script Writing and Theatrical Performance",
        "Stage Craft and Production Design",
        "Ghanaian and African Performing Arts Heritage",
        "Contemporary Performing Arts",
        "Performance and Stage Management",
    ],
    "ghanaian_language_twi_ewe_ga_nzema_akuapem": [
        "Oral Communication and Conversation",
        "Reading Fluency and Comprehension",
        "Written Expression and Composition",
        "Grammar and Language Structures",
        "Vocabulary and Idiomatic Usage",
        "Literature: Prose and Narratives",
        "Literature: Poetry and Song",
        "Culture, Customs and Proverbs",
        "Translation and Language Transfer",
    ],
    # ── Technical / Engineering ──────────────────────────────────────────
    "aviation_and_aerospace": [
        "Introduction to Aviation and Aerospace",
        "Aircraft Structures and Components",
        "Aircraft Propulsion Systems",
        "Meteorology and Weather for Pilots",
        "Air Navigation and Flight Planning",
        "Aviation Communication and Procedures",
        "Air Traffic Control Basics",
        "Aviation Safety, Regulations and ICAO Standards",
        "Space Technology and Exploration",
        "Career Opportunities in Aviation and Aerospace",
    ],
    "aviation_and_aerospace_engineering": [
        "Introduction to Aviation and Aerospace",
        "Aircraft Structures and Components",
        "Aircraft Propulsion Systems",
        "Meteorology and Weather for Pilots",
        "Air Navigation and Flight Planning",
        "Aviation Communication and Procedures",
        "Air Traffic Control Basics",
        "Aviation Safety, Regulations and ICAO Standards",
        "Space Technology and Exploration",
        "Career Opportunities in Aviation and Aerospace",
    ],
    "building_construction_in_woodwork_technology": [
        "Safety on Construction Sites",
        "Building Materials and Properties",
        "Foundations and Substructure",
        "Walls: Masonry and Brickwork",
        "Roofing Systems and Materials",
        "Floors, Stairs and Finishes",
        "Woodwork Tools and Equipment",
        "Joinery and Carpentry Techniques",
        "Furniture Design and Construction",
        "Wood Finishing and Surface Treatment",
    ],
    "building_construction_and_wood_technology": [
        "Safety on Construction Sites",
        "Building Materials and Properties",
        "Foundations and Substructure",
        "Walls: Masonry and Brickwork",
        "Roofing Systems and Materials",
        "Floors, Stairs and Finishes",
        "Woodwork Tools and Equipment",
        "Joinery and Carpentry Techniques",
        "Furniture Design and Construction",
        "Wood Finishing and Surface Treatment",
    ],
    "electronics_and_electrons_technology": [
        "Basic Electrical Concepts and Quantities",
        "Direct Current Circuits",
        "Alternating Current Circuits",
        "Electronic Components: Diodes, Transistors and ICs",
        "Rectification and Power Supplies",
        "Amplifiers and Signal Processing",
        "Digital Electronics: Logic Gates and Boolean Algebra",
        "Electronic Communication Systems",
        "Electrical Installations and Safety",
        "Fault Finding and Testing",
    ],
    "electrical_and_electronic_technology": [
        "Basic Electrical Concepts and Quantities",
        "Direct Current Circuits",
        "Alternating Current Circuits",
        "Electronic Components: Diodes, Transistors and ICs",
        "Rectification and Power Supplies",
        "Amplifiers and Signal Processing",
        "Digital Electronics: Logic Gates and Boolean Algebra",
        "Electronic Communication Systems",
        "Electrical Installations and Safety",
        "Fault Finding and Testing",
    ],
    # ── Physical Education and Health ────────────────────────────────────
    "core_peh": [
        "Physical Fitness and Health",
        "Track and Field Athletics",
        "Ball Games: Football, Basketball and Volleyball",
        "Swimming and Water Safety",
        "Gymnastics and Dance",
        "Health Education: Nutrition and Disease Prevention",
        "First Aid and Emergency Procedures",
        "Outdoor and Recreational Activities",
    ],
    "core_physical_education_and_health_peh": [
        "Physical Fitness and Health",
        "Track and Field Athletics",
        "Ball Games: Football, Basketball and Volleyball",
        "Swimming and Water Safety",
        "Gymnastics and Dance",
        "Health Education: Nutrition and Disease Prevention",
        "First Aid and Emergency Procedures",
        "Outdoor and Recreational Activities",
    ],
    "elective_physical_education_and_health": [
        "Advanced Physical Fitness and Training",
        "Sports Anatomy and Physiology",
        "Sports Skills and Tactics: Athletics",
        "Sports Skills and Tactics: Team Sports",
        "Sports Skills and Tactics: Individual Sports",
        "Sports Psychology and Mental Training",
        "Sports Management and Organisation",
        "Sports Medicine and Injury Prevention",
        "Exercise Science and Coaching",
    ],
    "elective_physical_education_and_health_peh": [
        "Advanced Physical Fitness and Training",
        "Sports Anatomy and Physiology",
        "Sports Skills and Tactics: Athletics",
        "Sports Skills and Tactics: Team Sports",
        "Sports Skills and Tactics: Individual Sports",
        "Sports Psychology and Mental Training",
        "Sports Management and Organisation",
        "Sports Medicine and Injury Prevention",
        "Exercise Science and Coaching",
    ],
    # ── Languages ────────────────────────────────────────────────────────
    "french": [
        "Listening and Oral Communication",
        "Reading Comprehension in French",
        "Essay and Letter Writing in French",
        "French Grammar: Tenses and Structures",
        "French Vocabulary and Expressions",
        "French Culture and Civilisation",
        "Conversation and Practical French",
        "Business French",
    ],
    "french_year_2": [
        "Listening and Oral Communication",
        "Reading Comprehension in French",
        "Essay and Letter Writing in French",
        "French Grammar: Tenses and Structures",
        "French Vocabulary and Expressions",
        "French Culture and Civilisation",
        "Conversation and Practical French",
        "Business French",
    ],
}

def _get_fallback_topics(subject: str, academic_level: str = "SHS") -> list:
    subject_key = subject.lower().replace("-", "_").replace(" ", "_")
    mapped_key = _SLUG_MAP.get(subject_key, subject_key)
    # Check the requested level's curated lists first so shared subjects
    # (e.g. English Language, Social Studies) get level-appropriate topics.
    lookups = (_TVET_TOPICS, _BASIC_TOPICS) if academic_level == "TVET" else (_BASIC_TOPICS, _TVET_TOPICS)
    for lookup in lookups:
        topics = lookup.get(subject_key) or lookup.get(mapped_key)
        if topics:
            return topics
    for lookup in lookups:
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
            topics = _get_fallback_topics(subject, academic_level)
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
