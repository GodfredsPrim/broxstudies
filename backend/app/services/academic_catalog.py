from __future__ import annotations

import json
import re
from dataclasses import dataclass

from app.config import settings
from app.models import AcademicLevel, normalize_academic_level_value


KNOWN_SUBJECTS = {
    AcademicLevel.SHS.value: {
        "year_1": [
            "Additional Mathematics", "Agricultural Science", "Agriculture", "Applied Technology", "Arabic",
            "Art and Design Foundation", "Arts and Design Studio", "Aviation and Aerospace Engineering", "Biology",
            "Biomedical Science", "Business Management", "Accounting", "Chemistry", "Computing",
            "Core Physical Education and Health", "Design and Communication Technology", "Economics",
            "Elective Physical Education and Health", "Engineering", "English Language", "Geography",
            "Ghanaian Language", "Government", "History", "Management in Living", "Food and Nutrition",
            "Clothing and Textiles", "Information Communication Technology", "Intervention English",
            "Intervention Mathematics", "Literature-in-English", "Manufacturing Engineering", "Mathematics",
            "Music", "Performing Arts", "Physics", "Religious Studies (Islamic)",
            "Religious Studies (Christian)", "Robotics", "General Science",
            "Religious and Moral Education", "Social Studies", "Spanish", "French",
        ],
        "year_2": [
            "Additional Mathematics", "Agricultural Science", "Agriculture", "Automotive and Metal Technology",
            "Building Construction and Wood Technology", "Electrical and Electronic Technology", "Arabic",
            "Art and Design Foundation", "Arts and Design Studio", "Aviation and Aerospace Engineering", "Biology",
            "Biomedical Science", "Accounting", "Business Management", "Chemistry",
            "Christian Religious Studies", "Computing", "Core Physical Education and Health",
            "Design and Communication Technology", "Economics", "Elective Physical Education and Health",
            "Engineering", "English Language", "French", "General Science", "Geography",
            "Ghanaian Language", "Government", "History", "Clothing and Textiles", "Food and Nutrition",
            "Management in Living", "Information Communication Technology", "Islamic Religious Studies",
            "Literature-in-English", "Manufacturing Engineering", "Mathematics", "Music",
            "Performing Arts", "Physics", "Religious and Moral Education", "Robotics",
            "Social Studies", "Spanish",
        ],
    },
    AcademicLevel.TVET.value: {
        "year_1": [
            "Automotive Engineering", "Electrical Engineering", "Mechanical Engineering",
            "Welding and Fabrication", "Electronics Engineering", "Mechatronics", "Industrial Mechanics",
            "Plumbing and Gas Technology", "Building Construction", "Wood Technology", "Furniture Technology",
            "Architectural Draughtmanship", "Catering and Hospitality", "Fashion Design Technology", "Textiles",
            "Beauty Therapy", "Hair Technology", "Graphic Design", "Multimedia Technology", "Painting",
            "Tourism Management", "Computer Hardware and Software", "Agric Mechanization", "Small Engines",
            "Heavy Duty Mechanics", "Heavy Duty Operation Forklift", "Autobody Repairs",
            "Refrideration and Air Conditioning", "Jewellry", "Leather Work",
            "English Language", "Maths", "Science", "Social Studies", "Technical Drawing",
            "Entrepreneurship", "ICT",
        ],
        "year_2": [
            "Automotive Engineering", "Electrical Engineering", "Mechanical Engineering",
            "Welding and Fabrication", "Electronics Engineering", "Mechatronics", "Industrial Mechanics",
            "Plumbing and Gas Technology", "Building Construction", "Wood Technology", "Furniture Technology",
            "Architectural Draughtmanship", "Catering and Hospitality", "Fashion Design Technology", "Textiles",
            "Beauty Therapy", "Hair Technology", "Graphic Design", "Multimedia Technology", "Painting",
            "Tourism Management", "Computer Hardware and Software", "Agric Mechanization", "Small Engines",
            "Heavy Duty Mechanics", "Heavy Duty Operation Forklift", "Autobody Repairs",
            "Refrideration and Air Conditioning", "Jewellry", "Leather Work",
            "English Language", "Maths", "Science", "Social Studies", "Technical Drawing",
            "Entrepreneurship", "ICT",
        ],
        "year_3": [
            "Automotive Engineering", "Electrical Engineering", "Mechanical Engineering",
            "Welding and Fabrication", "Electronics Engineering", "Mechatronics", "Industrial Mechanics",
            "Plumbing and Gas Technology", "Building Construction", "Wood Technology", "Furniture Technology",
            "Architectural Draughtmanship", "Catering and Hospitality", "Fashion Design Technology", "Textiles",
            "Beauty Therapy", "Hair Technology", "Graphic Design", "Multimedia Technology", "Painting",
            "Tourism Management", "Computer Hardware and Software", "Agric Mechanization", "Small Engines",
            "Heavy Duty Mechanics", "Heavy Duty Operation Forklift", "Autobody Repairs",
            "Refrideration and Air Conditioning", "Jewellry", "Leather Work",
            "English Language", "Maths", "Science", "Social Studies", "Technical Drawing",
            "Entrepreneurship", "ICT",
        ],
    },
}

YEAR_ALIASES = {
    "year_1": "year_1",
    "year1": "year_1",
    "1": "year_1",
    "shs1": "year_1",
    "shs_year_1": "year_1",
    "year_2": "year_2",
    "year2": "year_2",
    "2": "year_2",
    "shs2": "year_2",
    "shs_year_2": "year_2",
    "year_3": "year_3",
    "year3": "year_3",
    "3": "year_3",
    "level_1": "year_1",
    "level1": "year_1",
    "1st_level": "year_1",
    "nc1": "year_1",
    "nc_i": "year_1",
    "level_2": "year_2",
    "level2": "year_2",
    "2nd_level": "year_2",
    "nc2": "year_2",
    "nc_ii": "year_2",
    "ncii": "year_2",
}


@dataclass
class AcademicContext:
    academic_level: str
    year_key: str
    subject_slug: str
    subject_label: str
    subject_id: str
    year_label: str


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (value or "").strip().lower()).strip("_") or "general_studies"


def is_tvet_subject_slug(subject_slug: str) -> bool:
    normalized_slug = slugify(subject_slug)
    for year_subjects in KNOWN_SUBJECTS.get(AcademicLevel.TVET.value, {}).values():
        for name in year_subjects:
            if slugify(name) == normalized_slug:
                return True
    return False


def normalize_academic_level(value: str | AcademicLevel | None = None) -> str:
    normalized = normalize_academic_level_value(value)
    if isinstance(normalized, AcademicLevel):
        return normalized.value
    if normalized == AcademicLevel.TVET.value:
        return AcademicLevel.TVET.value
    return AcademicLevel.SHS.value


def normalize_year_key(value: str | None = None, academic_level: str | AcademicLevel | None = None) -> str:
    level = normalize_academic_level(academic_level)
    normalized = str(value or "").strip().lower().replace(" ", "_").replace("-", "_")
    if normalized in YEAR_ALIASES:
        return YEAR_ALIASES[normalized]
    return "year_2" if level == AcademicLevel.TVET.value else "year_1"


def infer_academic_level_from_year(year_key: str, academic_level: str | AcademicLevel | None = None) -> str:
    return normalize_academic_level(academic_level)


def format_year_label(academic_level: str | AcademicLevel, year_key: str) -> str:
    level = normalize_academic_level(academic_level)
    if level == AcademicLevel.TVET.value:
        return year_key.replace("year_", "TVET Year ").title()
    if year_key == "year_2":
        return "SHS Year 2"
    if year_key == "year_3":
        return "SHS Year 3"
    return "SHS Year 1"


def build_subject_id(academic_level: str | AcademicLevel, year_key: str, subject_slug: str) -> str:
    level = normalize_academic_level(academic_level)
    return f"{level}:{year_key}:{slugify(subject_slug)}"


def is_remote_curriculum_supported(academic_level: str | AcademicLevel, year_key: str) -> bool:
    level = normalize_academic_level(academic_level)
    return level == AcademicLevel.SHS.value and year_key in {"year_1", "year_2"}


def _load_catalog_years() -> dict:
    catalog_path = settings.SITE_RESOURCE_DIR / "subjects_catalog.json"
    if not catalog_path.exists():
        return {}
    try:
        with open(catalog_path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return payload.get("years", {})
    except Exception:
        return {}


def resolve_subject_label(year_key: str, subject_slug: str, academic_level: str | AcademicLevel = AcademicLevel.SHS) -> str:
    level = infer_academic_level_from_year(year_key, academic_level)
    safe_slug = slugify(subject_slug)

    if is_remote_curriculum_supported(level, year_key):
        for subject in _load_catalog_years().get(year_key, []):
            name = (subject.get("name") or "").strip()
            if slugify(name) == safe_slug:
                return name
            raw_url = (subject.get("url") or "").strip().lower()
            if raw_url.endswith(safe_slug) or raw_url.endswith(f"_{safe_slug}"):
                return name

    for name in KNOWN_SUBJECTS.get(level, {}).get(year_key, []):
        if slugify(name) == safe_slug:
            return name

    return safe_slug.replace("_", " ").title()


def parse_subject_reference(subject: str, year: str | None = None, academic_level: str | AcademicLevel | None = None) -> AcademicContext:
    tokens = [token.strip() for token in str(subject or "").split(":") if token.strip()]
    resolved_level = normalize_academic_level(academic_level)

    if tokens and slugify(tokens[0]) in {AcademicLevel.SHS.value, AcademicLevel.TVET.value}:
        resolved_level = slugify(tokens.pop(0))

    year_token = year
    if tokens and slugify(tokens[0]) in YEAR_ALIASES:
        year_token = tokens.pop(0)

    resolved_year = normalize_year_key(year_token, resolved_level)
    resolved_level = infer_academic_level_from_year(resolved_year, resolved_level)

    subject_token = tokens[0] if tokens else subject
    subject_slug = slugify(subject_token)
    subject_label = resolve_subject_label(resolved_year, subject_slug, resolved_level)

    return AcademicContext(
        academic_level=resolved_level,
        year_key=resolved_year,
        subject_slug=subject_slug,
        subject_label=subject_label,
        subject_id=build_subject_id(resolved_level, resolved_year, subject_slug),
        year_label=format_year_label(resolved_level, resolved_year),
    )


def get_subject_options() -> list[dict]:
    subjects_list: list[dict] = []
    seen: set[str] = set()
    years_from_catalog = _load_catalog_years()

    for year_key in ["year_1", "year_2"]:
        for subject in years_from_catalog.get(year_key, []):
            name = (subject.get("name") or "").strip()
            if not name:
                continue
            subject_slug = slugify(name)
            subject_id = build_subject_id(AcademicLevel.SHS.value, year_key, subject_slug)
            if subject_id in seen:
                continue
            seen.add(subject_id)
            subjects_list.append(
                {
                    "id": subject_id,
                    "name": name,
                    "year": format_year_label(AcademicLevel.SHS.value, year_key),
                    "year_key": year_key,
                    "academic_level": AcademicLevel.SHS.value,
                }
            )

    for level, years in KNOWN_SUBJECTS.items():
        for year_key, names in years.items():
            for name in names:
                subject_id = build_subject_id(level, year_key, name)
                if subject_id in seen:
                    continue
                seen.add(subject_id)
                subjects_list.append(
                    {
                        "id": subject_id,
                        "name": name,
                        "year": format_year_label(level, year_key),
                        "year_key": year_key,
                        "academic_level": level,
                    }
                )

    subjects_list.sort(key=lambda item: (item["academic_level"], item["year_key"], item["name"]))
    return subjects_list