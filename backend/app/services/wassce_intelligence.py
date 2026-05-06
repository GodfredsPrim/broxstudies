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

    # Hardcoded hints for TVET slugs that don't share tokens with their folder names
    _TVET_FOLDER_HINTS: dict = {
        "motor_vehicle": "HEAVY DUTY MECHANICS",
        "motor vehicle": "HEAVY DUTY MECHANICS",
        "carpentry": "BUILDING CONSTRUCTION",
        "bricklaying": "BUILDING CONSTRUCTION",
        "food_production": "CATERING AND HOSPITALITY",
        "food production": "CATERING AND HOSPITALITY",
        "food_beverage": "CATERING AND HOSPITALITY",
        "hospitality_services": "CATERING AND HOSPITALITY",
        "hospitality services": "CATERING AND HOSPITALITY",
        "catering": "CATERING AND HOSPITALITY",
        "ict_support": "COMPUTER HARDWARE AND SOFTWARE",
        "ict support": "COMPUTER HARDWARE AND SOFTWARE",
        "information_and_communication": "COMPUTER HARDWARE AND SOFTWARE",
        "information_communication": "COMPUTER HARDWARE AND SOFTWARE",
        "computer_hardware": "COMPUTER HARDWARE AND SOFTWARE",
        "sheet_metal": "WELDING AND FABRICATION",
        "sheet metal": "WELDING AND FABRICATION",
        "agricultural": "AGRIC MECHANIZATION",
        "agriculture": "AGRIC MECHANIZATION",
        "crop_production": "AGRIC MECHANIZATION",
        "agric_mechanization": "AGRIC MECHANIZATION",
        "refrigeration": "REFRIDERATION AND AIR CONDITIONING",
        "refridgeration": "REFRIDERATION AND AIR CONDITIONING",
        "air_conditioning": "REFRIDERATION AND AIR CONDITIONING",
        "autobody": "AUTOBODY REPAIRS",
        "auto_body": "AUTOBODY REPAIRS",
        "forklift": "HEAVY DUTY OPERATION FORKLIFT",
        "architectural_draughtmanship": "ARCHITECTURAL DRAUGHTMANSHIP",
        "architecture_draughtmanship": "ARCHITECTURAL DRAUGHTMANSHIP",
    }

    # Syllabi directory has slightly different folder names in some cases
    _TVET_SYLLABUS_FOLDER_OVERRIDES: dict = {
        "architectural_draughtmanship": "ARCHITECTURE DRAUGHTMANSHIP",
        "architecture_draughtmanship": "ARCHITECTURE DRAUGHTMANSHIP",
        "electronics_engineering": "ELECTRONICS TECHNOLOGY",
        "textiles": "TEXTILE",
        "refrideration_and_air_conditioning": "REFRIDGERATION AND AIR CONDITIONING",
        "refrigeration_and_air_conditioning": "REFRIDGERATION AND AIR CONDITIONING",
    }

    def _read_docx_text(self, docx_path: Path, max_chars: int = 1500) -> str:
        """Extract text from a .docx file using zipfile + XML (no python-docx needed)."""
        try:
            with zipfile.ZipFile(docx_path, 'r') as zp:
                if 'word/document.xml' not in zp.namelist():
                    return ""
                xml_bytes = zp.read('word/document.xml')
            xml_text = xml_bytes.decode('utf-8', errors='replace')
            texts = re.findall(r'<w:t[^>]*>([^<]+)</w:t>', xml_text)
            full_text = ' '.join(texts)
            full_text = re.sub(r'\s+', ' ', full_text).strip()
            return full_text[:max_chars]
        except Exception:
            return ""

    def find_tvet_textbook_dir(self, subject_slug: str) -> Optional[Path]:
        """Fuzzy-match a subject slug to a TVET textbook directory."""
        if not self.tvet_textbooks_dir.exists():
            return None

        slug_norm = subject_slug.lower().replace('_', ' ')
        for hint_key, folder_name in self._TVET_FOLDER_HINTS.items():
            if hint_key in slug_norm:
                candidate = self.tvet_textbooks_dir / folder_name
                if candidate.exists():
                    logger.info(f"TVET hint match: {subject_slug} -> {folder_name}")
                    return candidate

        def _tokens(s: str) -> set:
            words = re.sub(r'[^a-z0-9]+', ' ', s.lower()).split()
            noise = {'and', 'the', 'in', 'for', 'of', 'a', 'an', 'to', 'level', 'nc', 'ii', 'i',
                     'advanced', 'services', 'management', 'technology', 'engineering', 'design'}
            return set(words) - noise

        slug_tokens = _tokens(subject_slug)
        if not slug_tokens:
            return None

        best_dir: Optional[Path] = None
        best_score = 0.0
        for folder in sorted(self.tvet_textbooks_dir.iterdir()):
            if not folder.is_dir():
                continue
            folder_tokens = _tokens(folder.name)
            if not folder_tokens:
                continue
            overlap = len(slug_tokens & folder_tokens)
            if overlap == 0:
                continue
            score = overlap / max(len(slug_tokens), len(folder_tokens))
            if score > best_score:
                best_score = score
                best_dir = folder

        if best_score >= 0.25 and best_dir:
            logger.info(f"TVET fuzzy match ({best_score:.2f}): {subject_slug} -> {best_dir.name}")
            return best_dir
        logger.warning(f"No TVET folder matched for {subject_slug}")
        return None

    def find_tvet_syllabus_dir(self, subject_slug: str) -> Optional[Path]:
        """Fuzzy-match a subject slug to a TVET syllabi directory."""
        if not self.tvet_syllabi_dir.exists():
            return None

        slug_norm = subject_slug.lower().replace('_', ' ')

        # Check override map first (handles folder name differences between textbooks and syllabi)
        override = self._TVET_SYLLABUS_FOLDER_OVERRIDES.get(subject_slug.lower())
        if override:
            candidate = self.tvet_syllabi_dir / override
            if candidate.exists():
                return candidate

        # Reuse same hint keys (most map to same folder name)
        for hint_key, folder_name in self._TVET_FOLDER_HINTS.items():
            if hint_key in slug_norm:
                candidate = self.tvet_syllabi_dir / folder_name
                if candidate.exists():
                    return candidate

        def _tokens(s: str) -> set:
            words = re.sub(r'[^a-z0-9]+', ' ', s.lower()).split()
            noise = {'and', 'the', 'in', 'for', 'of', 'a', 'an', 'to', 'level', 'nc', 'ii', 'i',
                     'advanced', 'services', 'management', 'technology', 'engineering', 'design'}
            return set(words) - noise

        slug_tokens = _tokens(subject_slug)
        if not slug_tokens:
            return None

        best_dir: Optional[Path] = None
        best_score = 0.0
        for folder in sorted(self.tvet_syllabi_dir.iterdir()):
            if not folder.is_dir():
                continue
            folder_tokens = _tokens(folder.name)
            if not folder_tokens:
                continue
            overlap = len(slug_tokens & folder_tokens)
            if overlap == 0:
                continue
            score = overlap / max(len(slug_tokens), len(folder_tokens))
            if score > best_score:
                best_score = score
                best_dir = folder

        if best_score >= 0.25 and best_dir:
            logger.info(f"TVET syllabus fuzzy match ({best_score:.2f}): {subject_slug} -> {best_dir.name}")
            return best_dir
        return None

    def _topics_from_tvet_dir(self, tvet_dir: Path) -> List[str]:
        """Extract topic names from TVET docx unit filenames."""
        topics = []
        seen: set = set()
        for docx_file in sorted(tvet_dir.glob("*.docx")):
            stem = docx_file.stem
            # Step 1: Strip "LM_XXX_NC II_" or similar prefix before UNIT
            title = re.sub(r'^LM_.*?(?=UNIT)', '', stem, flags=re.I)
            # Step 2: Strip "UNIT N (NC I/II)? [-:_ ]" separators
            title = re.sub(
                r'^UNIT\s+\d+(?:\s+NC\s+I{1,3}[Ii]?)?\s*[-:_\s]\s*', '', title, flags=re.I
            ).strip()
            # Step 3: Remaining cleanup
            title = re.sub(r'\s*\(\d+\)\s*$', '', title)     # trailing " (1)"
            title = re.sub(r'[-_]+$', '', title)              # trailing dashes/underscores
            title = re.sub(r'\s+[Ss]ub\s*$', '', title)      # trailing " Sub"
            title = re.sub(r'\s*_\s*', ' ', title)           # inner underscores → space
            title = re.sub(r'\s+', ' ', title).strip()
            key = title.upper()
            if title and len(title) >= 3 and key not in seen:
                topics.append(self._proper_title(title))
                seen.add(key)
        return topics

    def _find_textbook_zip(self, year: str, subject_slug: str, academic_level: str) -> Optional[Path]:
        """Locate the textbook ZIP for a given year and subject, strictly within year-specific dirs."""
        shs_dirs_y1 = [self.textbooks_dir / "ALL SUBJECTS NOTE (YEAR 1)"]
        shs_dirs_y2 = [
            self.textbooks_dir / "ALL SUBJECT NOTE (YEAR 2)" / "ALL SUBJECT NOTE (YEAR 2)",
            self.textbooks_dir / "ALL SUBJECT NOTE (YEAR 2)",
        ]

        year_norm = year.lower()
        if year_norm in ("year_1", "1"):
            shs_dirs = shs_dirs_y1
        elif year_norm in ("year_3", "year3", "3"):
            shs_dirs = shs_dirs_y1 + shs_dirs_y2
        else:
            shs_dirs = shs_dirs_y2

        if academic_level == "TVET":
            tvet_dirs = [self.tvet_textbooks_dir] if self.tvet_textbooks_dir.exists() else []
            search_dirs = tvet_dirs + shs_dirs
        else:
            search_dirs = shs_dirs

        def _norm(s: str) -> str:
            return re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()

        def _matches(slug: str, filename: str) -> bool:
            n_slug = _norm(slug)
            n_file = _norm(Path(filename).stem)
            if n_slug in n_file or n_file in n_slug:
                return True
            slug_tokens = set(n_slug.split())
            file_tokens = set(n_file.split())
            # exclude noise words
            noise = {'note', 'notes', 'and', 'the', 'in', 'for', 'of'}
            slug_key = slug_tokens - noise
            file_key = file_tokens - noise
            if not slug_key:
                return False
            return bool(slug_key & file_key) and (slug_key <= file_key or file_key <= slug_key)

        for search_dir in search_dirs:
            if not search_dir.exists():
                continue
            for zip_file in sorted(search_dir.glob("*.zip")):
                if _matches(subject_slug, zip_file.name):
                    logger.info(f"Matched {subject_slug} -> {zip_file}")
                    return zip_file
        return None

    def _clean_toc_line(self, raw: str) -> str:
        """Strip page numbers, TOC leaders and leading roman numerals from one TOC line."""
        # Normalise curly/smart apostrophes to ASCII
        line = raw.replace('’', "'").replace('‘', "'")
        # Strip leading LOWERCASE roman numeral glued to uppercase word (e.g. "ivCONTENTS", "vCONVERTING")
        # Use only lowercase [ivxl] to avoid stripping capital I from words like IDENTITY
        line = re.sub(r'^[ivxl]{1,6}(?=[A-Z])', '', line)
        # Strip leading standalone roman numeral with space (lowercase only)
        line = re.sub(r'^\s*[ivxl]{1,6}\s+', '', line)
        # Replace U+2026 HORIZONTAL ELLIPSIS leaders (most common: "… … … 3")
        line = re.sub(r'…+', ' ', line)
        # Replace U+FFFD (replacement char) groups used as TOC dot leaders "? ? ? ? 3"
        line = re.sub(r'(�[\s�]*)+', ' ', line)
        # Replace spaced-dot leaders  ". . . . 3"
        line = re.sub(r'(\s*\.\s*){2,}', ' ', line)
        # Replace dense dot/dash leaders "....." "-----"
        line = re.sub(r'[.\-_~]{3,}', ' ', line)
        line = re.sub(r'\s+', ' ', line).strip()
        # Strip trailing page number (optional roman prefix + arabic, or just roman)
        line = re.sub(r'\s+[ivxlIVXL]{0,4}\d{1,4}$', '', line).strip()
        line = re.sub(r'\s+[ivxlIVXL]{1,6}$', '', line).strip()
        # Strip leading colon/semicolon artefacts
        line = re.sub(r'^[\s:;]+', '', line)
        # Discard lines where a page-number ran into the next entry: "TOPIC 3NExtEntry"
        if re.search(r'\d+[ivxlIVXL]+[A-Z]', line):
            return ''
        return line

    @staticmethod
    def _proper_title(s: str) -> str:
        """Title-case that doesn't capitalise after apostrophe (Earth's not Earth'S)."""
        return re.sub(r"'([A-Z])", lambda m: "'" + m.group(1).lower(), s.title())

    def _parse_toc_from_text(self, full_text: str) -> List[str]:
        """Parse Table of Contents lines from extracted PDF text, return clean topic strings."""
        # Prefer a standalone CONTENTS heading line (e.g. "ivTABLE OF CONTENTS\n")
        # rather than the word "contents" embedded in a sentence
        toc_match = re.search(
            r'(?:^|\n)[^\S\n]{0,4}[ivxl\d]{0,8}[^\S\n]{0,2}'
            r'(?:TABLE\s+OF\s+)?CONTENTS[^\S\n]*\n',
            full_text, re.I,
        )
        if not toc_match:
            toc_match = re.search(r'CONTENTS', full_text, re.I)
        toc_text = full_text[toc_match.start():] if toc_match else full_text

        # Detect the actual foreword PROSE body (not just the TOC entry "FOREWORD ??? V").
        # Foreword body: FOREWORD immediately followed by \n then prose (starts uppercase+lowercase).
        # TOC entry has � leaders between FOREWORD and page number, blocking \s*\n match.
        # Page numbers/roman numerals may be glued before FOREWORD ("51ivvFOREWORD"), so no ^ anchor.
        fw_prose = re.search(
            r'[ivxl\d]{0,8}FOREWORD\s*\n\s*[A-Z][a-z].{60}',
            toc_text
        )
        if fw_prose:
            toc_text = toc_text[:fw_prose.start()]

        SKIP_RE = re.compile(
            r'\b(FOREWORD|PREFACE|ACKNOWLEDGEMENTS?|ACKNOWLEDGMENTS?|'
            r'TABLE\s+OF\s+CONTENTS|INDEX|COPYRIGHT|MINISTRY|ASSOCIATION|'
            r'ISBN|REPUBLIC|REVIEW\s+QUESTIONS?|REFERENCES?|'
            r'BIBLIOGRAPHY|BIBLIOGRAPHIES|GLOSSARY|APPENDIX|ANNEXURE)\b',
            re.I
        )

        topics: List[str] = []
        seen: set = set()

        for raw_line in toc_text.split('\n'):
            line = self._clean_toc_line(raw_line)

            if not line or len(line) < 5:
                continue
            if line.upper() == 'CONTENTS':
                continue
            if SKIP_RE.search(line):
                continue
            if re.match(r'^[\d\s]+$', line):
                continue
            # Ignore long lines — body prose, not headings
            if len(line) > 120:
                continue

            # Priority 1 — SECTION / UNIT / CHAPTER / TOPIC N: title
            m = re.match(r'^(?:SECTION|UNIT|CHAPTER|TOPIC)\s+\d+[:.)]?\s*(.+)', line, re.I)
            if m:
                topic = self._proper_title(re.sub(r'\s+', ' ', m.group(1)).strip())
                if len(topic) >= 4 and topic not in seen:
                    topics.append(topic)
                    seen.add(topic)
                continue

            # Priority 2 — ALL-CAPS heading ≤ 120 chars
            if re.match(r"^[A-Z][A-Z0-9\s,&/()'.\-]{5,}$", line) and len(line) <= 120:
                topic = self._proper_title(line)
                if len(topic) >= 5 and topic not in seen:
                    topics.append(topic)
                    seen.add(topic)
                continue

            # Priority 3 — Title/sentence-case heading ≤ 100 chars
            if re.match(r"^[A-Z][a-zA-Z0-9\s,&/()'.\-]{7,}$", line) and len(line) <= 100:
                topic = line.strip()
                if len(topic) >= 6 and topic not in seen:
                    topics.append(topic)
                    seen.add(topic)

        return topics


    def _cache_is_fresh_tvet(self, cache_file: Path, tvet_dir: Path) -> bool:
        """Return True when the TVET topic cache is still valid (no docx added, removed, or modified)."""
        try:
            cache_mtime = cache_file.stat().st_mtime
            # Directory mtime changes on any file add or delete
            if tvet_dir.stat().st_mtime > cache_mtime:
                return False
            # Individual file modifications (e.g. in-place replace)
            return not any(f.stat().st_mtime > cache_mtime for f in tvet_dir.glob("*.docx"))
        except Exception:
            return False

    def extract_topics_from_textbook(self, year: str, subject_slug: str, academic_level: str = "SHS") -> List[str]:
        """Extract topics from uploaded textbook materials."""
        cache_dir = self.tvet_cache_dir if academic_level == "TVET" else self.cache_dir
        cache_file = cache_dir / f"topics_{year}_{subject_slug}.json"

        logger.info(f"Extracting topics for {subject_slug} ({year}) - {academic_level}")

        # ── TVET: unit filenames are the topics ──────────────────────────────
        if academic_level == "TVET":
            tvet_dir = self.find_tvet_textbook_dir(subject_slug)
            if not tvet_dir:
                logger.warning(f"No TVET textbook dir for {subject_slug}")
                return []
            # Use cache only when no docx has been added, removed, or modified since last scan
            if cache_file.exists() and self._cache_is_fresh_tvet(cache_file, tvet_dir):
                try:
                    cached = json.loads(cache_file.read_text(encoding='utf-8'))
                    if cached:
                        return cached
                except Exception:
                    pass
            topics = self._topics_from_tvet_dir(tvet_dir)
            if topics:
                cache_file.write_text(json.dumps(topics), encoding='utf-8')
                logger.info(f"Extracted {len(topics)} TVET topics for {subject_slug} from {tvet_dir.name}")
            return topics

        # ── SHS: parse TOC from ZIP ──────────────────────────────────────────
        # Honor non-empty cache for SHS (ZIP sources rarely change)
        if cache_file.exists():
            try:
                cached = json.loads(cache_file.read_text(encoding='utf-8'))
                if cached:
                    return cached
            except Exception:
                pass

        zip_path = self._find_textbook_zip(year, subject_slug, academic_level)
        if not zip_path:
            logger.warning(f"No textbook ZIP found for {subject_slug} ({year})")
            return []

        try:
            with zipfile.ZipFile(zip_path, 'r') as zp:
                pdf_files = sorted(f for f in zp.namelist() if f.lower().endswith('.pdf'))
                if not pdf_files:
                    return []
                with zp.open(pdf_files[0]) as pdf_f:
                    reader = PdfReader(io.BytesIO(pdf_f.read()))
                    full_text = ""
                    for i in range(min(15, len(reader.pages))):
                        try:
                            full_text += reader.pages[i].extract_text() or ""
                        except Exception:
                            continue

            topics = self._parse_toc_from_text(full_text)
            if topics:
                cache_file.write_text(json.dumps(topics), encoding='utf-8')
                logger.info(f"Extracted {len(topics)} topics for {subject_slug} ({year})")
            return topics
        except Exception as e:
            logger.error(f"Error extracting topics for {subject_slug} from {zip_path}: {e}")
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
