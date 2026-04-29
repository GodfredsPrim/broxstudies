import os
import re
import json
import zipfile
import io
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
from PyPDF2 import PdfReader

from app.config import settings

logger = logging.getLogger(__name__)

class WassceIntelligenceService:
    """Service to analyze WASSCE/NAPTEXT materials (textbooks, past questions, solutions)."""

    def __init__(self):
        self.data_dir = settings.DATA_DIR
        self.syllabi_dir = self.data_dir / "syllabi"
        self.textbooks_dir = self.data_dir / "textbooks"
        self.past_questions_dir = self.data_dir / "past_questions"
        self.tvet_data_dir = self.data_dir / "tvet"
        self.tvet_syllabi_dir = self.tvet_data_dir / "syllabi"
        self.tvet_textbooks_dir = self.tvet_data_dir / "textbooks"
        self.tvet_past_questions_dir = self.tvet_data_dir / "past_questions"
        self.cache_dir = self.data_dir / "intelligence_cache"
        self.tvet_cache_dir = self.tvet_data_dir / "intelligence_cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.tvet_cache_dir.mkdir(parents=True, exist_ok=True)

        # Standardized Ghana SHS WASSCE exam structures
        self.standard_exam_structures = {
            "SHS": {
                # Core Mathematics - Paper 2 has exactly 13 questions
                "core_mathematics": {
                    "paper_1": 50,  # 50 MCQs
                    "paper_2": {"section_a": 10, "section_b": 3},  # Total 13 questions
                    "paper_3": 0  # No Paper 3
                },
                "mathematics": {  # Additional Mathematics
                    "paper_1": 50,  # 50 MCQs
                    "paper_2": {"section_a": 10, "section_b": 3},  # Total 13 questions
                    "paper_3": 0
                },
                # Science subjects
                "physics": {
                    "paper_1": 50,
                    "paper_2": {"section_a": 5, "section_b": 5, "section_c": 3},  # Total 13 questions
                    "paper_3": 1  # Practical
                },
                "chemistry": {
                    "paper_1": 50,
                    "paper_2": {"section_a": 5, "section_b": 5, "section_c": 3},  # Total 13 questions
                    "paper_3": 1  # Practical
                },
                "biology": {
                    "paper_1": 50,
                    "paper_2": {"section_a": 5, "section_b": 5, "section_c": 3},  # Total 13 questions
                    "paper_3": 1  # Practical
                },
                # Social Science subjects
                "economics": {
                    "paper_1": 50,
                    "paper_2": {"section_a": 8, "section_b": 5},  # Total 13 questions
                    "paper_3": 0
                },
                "geography": {
                    "paper_1": 50,
                    "paper_2": {"section_a": 8, "section_b": 5},  # Total 13 questions
                    "paper_3": 0
                },
                "government": {
                    "paper_1": 50,
                    "paper_2": {"section_a": 8, "section_b": 5},  # Total 13 questions
                    "paper_3": 0
                },
                "history": {
                    "paper_1": 50,
                    "paper_2": {"section_a": 8, "section_b": 5},  # Total 13 questions
                    "paper_3": 0
                },
                # Language subjects
                "english_language": {
                    "paper_1": 50,
                    "paper_2": {"section_a": 5, "section_b": 8},  # Total 13 questions
                    "paper_3": 0
                },
                "literature_in_english": {
                    "paper_1": 50,
                    "paper_2": {"section_a": 5, "section_b": 8},  # Total 13 questions
                    "paper_3": 0
                },
                # Religious Studies
                "christian_religious_studies": {
                    "paper_1": 50,
                    "paper_2": {"section_a": 8, "section_b": 5},  # Total 13 questions
                    "paper_3": 0
                },
                "islamic_religious_studies": {
                    "paper_1": 50,
                    "paper_2": {"section_a": 8, "section_b": 5},  # Total 13 questions
                    "paper_3": 0
                },
                # Business subjects
                "accounting": {
                    "paper_1": 50,
                    "paper_2": {"section_a": 8, "section_b": 5},  # Total 13 questions
                    "paper_3": 0
                },
                "business_management": {
                    "paper_1": 50,
                    "paper_2": {"section_a": 8, "section_b": 5},  # Total 13 questions
                    "paper_3": 0
                },
                # Agricultural Science
                "agricultural_science": {
                    "paper_1": 50,
                    "paper_2": {"section_a": 5, "section_b": 5, "section_c": 3},  # Total 13 questions
                    "paper_3": 1  # Practical
                },
                # Default structure for other subjects
                "default": {
                    "paper_1": 50,
                    "paper_2": {"section_a": 8, "section_b": 5},  # Total 13 questions
                    "paper_3": 0
                }
            },
            "TVET": {
                # TVET subjects typically have different structures
                "default": {
                    "paper_1": 40,
                    "paper_2": {"section_a": 5, "section_b": 5},
                    "paper_3": 1
                }
            }
        }

    def extract_topics_from_textbook(self, year: str, subject_slug: str, academic_level: str = "SHS") -> List[str]:
        """Extract topics from the textbook Table of Contents."""
        cache_dir = self.tvet_cache_dir if academic_level == "TVET" else self.cache_dir
        textbooks_dir = self.tvet_textbooks_dir if academic_level == "TVET" else self.textbooks_dir
        cache_file = cache_dir / f"topics_{year}_{subject_slug}.json"
        if cache_file.exists():
            with open(cache_file, 'r') as f:
                return json.load(f)

        logger.info(f"Extracting topics for {subject_slug} ({year}) - {academic_level}")
        
        # Determine textbook path
        year_folder = "ALL SUBJECTS NOTE (YEAR 1)" if "year_1" in year.lower() else "ALL SUBJECT NOTE (YEAR 2)"
        if academic_level == "TVET":
            # For TVET, assume different structure or same for now
            year_folder = "Year 1" if "year_1" in year.lower() else "Year 2"
        potential_zip = textbooks_dir / year_folder / f"{subject_slug.replace('_', ' ').title()}.zip"
        
        # Fallback search if title case fails
        if not potential_zip.exists():
            try:
                for item in (textbooks_dir / year_folder).iterdir():
                    if subject_slug.lower() in item.name.lower():
                        potential_zip = item
                        break
            except FileNotFoundError:
                pass
        
        if not potential_zip.exists():
            # For TVET, fallback to SHS data if TVET data doesn't exist
            if academic_level == "TVET":
                logger.info(f"TVET data not found for {subject_slug}, falling back to SHS data")
                shs_textbooks_dir = self.textbooks_dir
                shs_year_folder = "ALL SUBJECTS NOTE (YEAR 1)" if "year_1" in year.lower() else "ALL SUBJECT NOTE (YEAR 2)"
                potential_zip = shs_textbooks_dir / shs_year_folder / f"{subject_slug.replace('_', ' ').title()}.zip"
                if not potential_zip.exists():
                    for item in (shs_textbooks_dir / shs_year_folder).iterdir():
                        if subject_slug.lower() in item.name.lower():
                            potential_zip = item
                            break
            if not potential_zip.exists():
                logger.warning(f"No textbook data found for {subject_slug} - {academic_level}")
                return []

        topics = []
        try:
            with zipfile.ZipFile(potential_zip, 'r') as zp:
                pdf_files = [f for f in zp.namelist() if f.lower().endswith('.pdf')]
                if not pdf_files:
                    return []
                
                with zp.open(pdf_files[0]) as pdf_f:
                    reader = PdfReader(io.BytesIO(pdf_f.read()))
                    # Extract from first 15 pages (usually TOC is here)
                    full_text = ""
                    for i in range(min(15, len(reader.pages))):
                        full_text += reader.pages[i].extract_text() or ""
                    
                    # Pattern matching for common SHS textbook TOC styles
                    # e.g. "SECTION 1 NUMBER SETS", "UNIT 1: ...", "CHAPTER ONE ..."
                    topics = re.findall(r'(?:SECTION|UNIT|CHAPTER|TOPIC)\s+\d+[:.]?\s+([A-Z\s,]{4,})', full_text)
                    if not topics:
                        # Fallback: look for uppercase lines that resemble titles
                        lines = full_text.split('\n')
                        for line in lines:
                            clean = line.strip()
                            if len(clean) > 5 and clean.isupper() and not any(x in clean for x in ['FOREWORD', 'PREFACE', 'ACKNOWLEDGEMENT', 'CONTENTS']):
                                topics.append(clean)
            
            # Refine topics
            topics = [t.strip().title() for t in topics if len(t.strip()) > 3]
            topics = list(dict.fromkeys(topics)) # Deduplicate
            
            with open(cache_file, 'w') as f:
                json.dump(topics, f)
                
            return topics
        except Exception as e:
            logger.error(f"Error extracting topics for {subject_slug}: {str(e)}")
            return []

    def analyze_paper_structure(self, subject_slug: str, academic_level: str = "SHS") -> Dict[str, Any]:
        """Return standardized Ghana SHS WASSCE exam structure for the subject."""
        # Use standardized structures for Ghana SHS exams
        level_structures = self.standard_exam_structures.get(academic_level.upper(), {})
        
        # Check if subject has a specific structure, otherwise use default
        subject_structure = level_structures.get(subject_slug, level_structures.get("default", {
            "paper_1": 50,
            "paper_2": {"section_a": 8, "section_b": 5},
            "paper_3": 0
        }))
        
        logger.info(f"Using standardized {academic_level} structure for {subject_slug}: {subject_structure}")
        return subject_structure
    def extract_answers_from_solution(self, subject_slug: str, paper_type: str) -> Dict[str, str]:
        """Extract answer mapping from a solution PDF."""
        # This is high-complexity, but essentially looks for "1. A", "2. B" etc. in Solution PDFs
        answers = {}
        potential_zip = self.past_questions_dir / f"{subject_slug.replace('_', ' ').title()}.zip"
        if not potential_zip.exists():
            return {}

        try:
            with zipfile.ZipFile(potential_zip, 'r') as zp:
                sol_files = [f for f in zp.namelist() if 'SOLUTION' in f.upper() and (paper_type.upper() in f.upper() or (paper_type == 'paper_1' and 'OBJECTIVE' in f.upper()))]
                if not sol_files:
                    return {}
                
                with zp.open(sol_files[0]) as f:
                    reader = PdfReader(io.BytesIO(f.read()))
                    all_text = ""
                    for p in reader.pages:
                        all_text += p.extract_text() or ""
                    
                    if paper_type == 'paper_1':
                        # Pattern like "1. A" or "1.C"
                        found = re.findall(r'(\d+)\s*[:.]\s*([A-D])|(\d+)\s+([A-D])\s+', all_text)
                        for matches in found:
                            # Regex with multiple groups can be tricky
                            q_num = matches[0] or matches[2]
                            ans = matches[1] or matches[3]
                            if q_num and ans:
                                answers[q_num] = ans
                    else:
                        # Theory answers are harder to map with regex, usually returned as full blocks
                        # We split by question numbers or "Solution" markers
                        parts = re.split(r'\n(\d+)\.', all_text)
                        if len(parts) > 1:
                            for i in range(1, len(parts), 2):
                                q_num = parts[i]
                                ans_text = parts[i+1].strip() if i+1 < len(parts) else ""
                                if q_num and ans_text:
                                    answers[q_num] = ans_text[:2000] # Cap length
            return answers
        except Exception:
            return {}
