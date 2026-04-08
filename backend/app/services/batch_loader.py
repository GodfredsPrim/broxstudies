import json
import logging
import tempfile
import zipfile
from pathlib import Path

from app.config import settings
from app.models import Subject
from app.services.pdf_processor import PDFProcessor
from app.services.rag_engine import RAGEngine

logger = logging.getLogger(__name__)


class BatchLoader:
    """Loads local PDF data and reuses cached results for unchanged files."""

    def __init__(self):
        self.pdf_processor = PDFProcessor()
        self.rag_engine = RAGEngine()
        self.manifest_path = settings.VECTOR_STORE_DIR / "load_manifest.json"
        self._manifest = self._load_manifest()

    async def load_all_documents(self, data_dir: Path, loading_state=None, selective=True, max_subjects=5):
        """Smart loading strategy with manifest-based reuse."""
        try:
            if settings.LAZY_LOAD and selective:
                logger.info("⚡ Lazy load mode: syllabi only on startup for instant response")
                total_items = self._estimate_total_items(data_dir, include_past_questions=False, include_textbooks=False)
                self._reset_loading_state(loading_state, total_items)
                results = {
                    "syllabi": await self._load_directory(data_dir / "syllabi", "syllabus", loading_state),
                    "past_questions": {
                        "type": "past_question",
                        "total_files": 0,
                        "successful": 0,
                        "failed": 0,
                        "files": [],
                        "status": "deferred",
                    },
                    "textbooks": {
                        "type": "textbook",
                        "total_files": 0,
                        "successful": 0,
                        "failed": 0,
                        "files": [],
                        "status": "deferred",
                    },
                }
            elif settings.LOAD_SYLLABI_ONLY and selective:
                logger.info("Ultra-fast mode: loading syllabi only")
                total_items = self._estimate_total_items(data_dir, include_past_questions=False, include_textbooks=False)
                self._reset_loading_state(loading_state, total_items)
                results = {
                    "syllabi": await self._load_directory(data_dir / "syllabi", "syllabus", loading_state),
                    "past_questions": {
                        "type": "past_question",
                        "total_files": 0,
                        "successful": 0,
                        "failed": 0,
                        "files": [],
                        "status": "skipped",
                    },
                    "textbooks": {
                        "type": "textbook",
                        "total_files": 0,
                        "successful": 0,
                        "failed": 0,
                        "files": [],
                        "status": "skipped",
                    },
                }
            elif settings.SELECTIVE_LOAD and selective:
                logger.info("Fast mode: loading syllabi plus a limited set of past questions")
                total_items = self._estimate_total_items(
                    data_dir,
                    include_past_questions=True,
                    include_textbooks=False,
                    max_subjects=settings.MAX_INITIAL_SUBJECTS,
                )
                self._reset_loading_state(loading_state, total_items)
                results = {
                    "syllabi": await self._load_directory(data_dir / "syllabi", "syllabus", loading_state),
                    "past_questions": await self._load_directory_limited(
                        data_dir / "past_questions",
                        "past_question",
                        loading_state,
                        max_subjects=settings.MAX_INITIAL_SUBJECTS,
                    ),
                    "textbooks": {
                        "type": "textbook",
                        "total_files": 0,
                        "successful": 0,
                        "failed": 0,
                        "files": [],
                        "status": "skipped",
                    },
                }
            else:
                logger.info("Standard mode: loading all documents")
                total_items = self._estimate_total_items(data_dir)
                self._reset_loading_state(loading_state, total_items)
                results = {
                    "syllabi": await self._load_directory(data_dir / "syllabi", "syllabus", loading_state),
                    "past_questions": await self._load_directory(data_dir / "past_questions", "past_question", loading_state),
                    "textbooks": await self._load_directory(data_dir / "textbooks", "textbook", loading_state),
                }

            self._save_manifest()
            logger.info("Initial batch loading complete")
            return results
        except Exception as e:
            logger.error(f"Error during batch loading: {str(e)}")
            raise

    def _load_manifest(self):
        if not self.manifest_path.exists():
            return {}

        try:
            with open(self.manifest_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            logger.warning("Could not read load manifest; starting with an empty cache")
            return {}

    def _save_manifest(self):
        self.manifest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.manifest_path, "w", encoding="utf-8") as f:
            json.dump(self._manifest, f, indent=2)

    def _reset_loading_state(self, loading_state, total_files: int):
        if not loading_state:
            return

        loading_state.total_files = total_files
        loading_state.loaded_files = 0
        loading_state.current_file = ""
        loading_state.current_category = ""
        loading_state.percentage = 0
        loading_state.results = None

    def _start_item(self, loading_state, file_type: str, current_file: str):
        if not loading_state:
            return

        loading_state.current_category = file_type
        loading_state.current_file = current_file

    def _finish_item(self, loading_state):
        if not loading_state:
            return

        loading_state.loaded_files += 1
        if loading_state.total_files > 0:
            loading_state.percentage = int((loading_state.loaded_files / loading_state.total_files) * 100)
        else:
            loading_state.percentage = 0

    def _estimate_total_items(
        self,
        data_dir: Path,
        include_past_questions: bool = True,
        include_textbooks: bool = True,
        max_subjects: int | None = None,
    ) -> int:
        total = self._count_top_level_items(data_dir / "syllabi")

        if include_past_questions:
            total += self._count_top_level_items(data_dir / "past_questions", pdf_limit=3 if max_subjects else None, zip_limit=max_subjects)

        if include_textbooks:
            total += self._count_top_level_items(data_dir / "textbooks")

        return total

    def _count_top_level_items(self, dir_path: Path, pdf_limit: int | None = None, zip_limit: int | None = None) -> int:
        if not dir_path.exists():
            return 0

        pdf_count = len(list(dir_path.rglob("*.pdf")))
        zip_count = len(list(dir_path.rglob("*.zip")))
        if pdf_limit is not None:
            pdf_count = min(pdf_count, pdf_limit)
        if zip_limit is not None:
            zip_count = min(zip_count, zip_limit)
        return pdf_count + zip_count

    def _get_manifest_key(self, path: Path) -> str:
        return str(path.resolve()).lower()

    def _get_signature(self, path: Path) -> dict:
        stat = path.stat()
        return {"size": stat.st_size, "mtime": stat.st_mtime}

    def _subject_cache_exists(self, subject_value: str | None) -> bool:
        if not subject_value:
            return True
        return (settings.VECTOR_STORE_DIR / f"Subject.{subject_value.upper()}.cache").exists()

    def _get_cached_entry(self, path: Path):
        key = self._get_manifest_key(path)
        entry = self._manifest.get(key)
        if not entry:
            return None

        current_signature = self._get_signature(path)
        if entry.get("signature") != current_signature:
            return None
        if not self._subject_cache_exists(entry.get("subject")):
            return None
        return entry

    def _store_cached_entry(self, path: Path, subject: Subject, summary: dict, entries: list | None = None):
        self._manifest[self._get_manifest_key(path)] = {
            "signature": self._get_signature(path),
            "subject": subject.value if isinstance(subject, Subject) else str(subject),
            "summary": summary,
            "entries": entries or [],
        }

    async def _load_directory(self, dir_path: Path, file_type: str, loading_state=None):
        results = {
            "type": file_type,
            "total_files": 0,
            "successful": 0,
            "failed": 0,
            "files": [],
        }

        if not dir_path.exists():
            logger.warning(f"Directory not found: {dir_path}")
            return results

        pdf_files = sorted(dir_path.rglob("*.pdf"))
        zip_files = sorted(dir_path.rglob("*.zip"))
        results["total_files"] = len(pdf_files) + len(zip_files)

        for pdf_file in pdf_files:
            await self._process_pdf_item(pdf_file, file_type, results, loading_state)

        for zip_file in zip_files:
            await self._process_zip_item(zip_file, file_type, results, loading_state)

        return results

    async def _load_directory_limited(self, dir_path: Path, file_type: str, loading_state=None, max_subjects=3):
        results = {
            "type": file_type,
            "total_files": 0,
            "successful": 0,
            "failed": 0,
            "skipped": 0,
            "files": [],
            "status": "partial",
        }

        if not dir_path.exists():
            logger.warning(f"Directory not found: {dir_path}")
            return results

        pdf_files = sorted(dir_path.rglob("*.pdf"))
        zip_files = sorted(dir_path.rglob("*.zip"))
        selected_pdfs = pdf_files[:3]
        selected_zips = zip_files[:max_subjects]

        results["total_files"] = len(selected_pdfs) + len(selected_zips)
        results["skipped"] = max(0, len(pdf_files) - len(selected_pdfs)) + max(0, len(zip_files) - len(selected_zips))

        for pdf_file in selected_pdfs:
            await self._process_pdf_item(pdf_file, file_type, results, loading_state)

        for zip_file in selected_zips:
            await self._process_zip_item(zip_file, file_type, results, loading_state)

        logger.info(
            f"Fast loading complete for {file_type}: {results['successful']} loaded, {results['skipped']} skipped"
        )
        return results

    async def _process_pdf_item(self, pdf_file: Path, file_type: str, results: dict, loading_state=None):
        self._start_item(loading_state, file_type, pdf_file.name)

        cached_entry = self._get_cached_entry(pdf_file)
        if cached_entry:
            summary = dict(cached_entry.get("summary", {}))
            summary["cached"] = True
            results["successful"] += 1
            results["files"].append(summary)
            logger.info(f"Reused cached result for {pdf_file.name}")
            self._finish_item(loading_state)
            return

        try:
            subject = self._extract_subject_from_filename(pdf_file)
            processed_data = await self.pdf_processor.process_pdf(str(pdf_file), file_type, subject)
            await self.rag_engine.add_documents(processed_data["chunks"], subject)

            summary = {
                "name": pdf_file.name,
                "subject": subject.value,
                "chunks": processed_data["num_chunks"],
                "pages": processed_data["num_pages"],
                "source": "direct",
            }
            results["successful"] += 1
            results["files"].append(summary)
            self._store_cached_entry(pdf_file, subject, summary)
            logger.info(f"Loaded {pdf_file.name}")
        except Exception as e:
            results["failed"] += 1
            results["files"].append({"name": pdf_file.name, "error": str(e), "source": "direct"})
            logger.error(f"Failed to load {pdf_file.name}: {str(e)}")
        finally:
            self._finish_item(loading_state)

    async def _process_zip_item(self, zip_file: Path, file_type: str, results: dict, loading_state=None):
        self._start_item(loading_state, file_type, zip_file.name)

        cached_entry = self._get_cached_entry(zip_file)
        if cached_entry:
            cached_files = [dict(item, cached=True) for item in cached_entry.get("entries", [])]
            results["successful"] += 1
            results["files"].extend(cached_files)
            logger.info(f"Reused cached result for {zip_file.name}")
            self._finish_item(loading_state)
            return

        try:
            entries = []
            subject = self._extract_subject_from_filename(zip_file)

            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                with zipfile.ZipFile(zip_file, "r") as zip_ref:
                    zip_ref.extractall(temp_path)

                extracted_pdfs = sorted(temp_path.rglob("*.pdf"))
                if not extracted_pdfs:
                    raise ValueError("No PDFs found in ZIP")

                for pdf_path in extracted_pdfs:
                    self._start_item(loading_state, file_type, f"{zip_file.name}/{pdf_path.name}")
                    processed_data = await self.pdf_processor.process_pdf(str(pdf_path), file_type, subject)
                    await self.rag_engine.add_documents(processed_data["chunks"], subject)
                    entries.append(
                        {
                            "name": f"{zip_file.name}/{pdf_path.name}",
                            "subject": subject.value,
                            "chunks": processed_data["num_chunks"],
                            "pages": processed_data["num_pages"],
                            "source": "zip",
                        }
                    )

            results["successful"] += 1
            results["files"].extend(entries)
            self._store_cached_entry(zip_file, subject, {"name": zip_file.name, "source": "zip"}, entries)
            logger.info(f"Loaded {zip_file.name}")
        except zipfile.BadZipFile as e:
            results["failed"] += 1
            results["files"].append({"name": zip_file.name, "error": f"Invalid ZIP file: {str(e)}", "source": "zip"})
            logger.error(f"Invalid ZIP file {zip_file.name}: {str(e)}")
        except Exception as e:
            results["failed"] += 1
            results["files"].append({"name": zip_file.name, "error": str(e), "source": "zip"})
            logger.error(f"Failed to process {zip_file.name}: {str(e)}")
        finally:
            self._finish_item(loading_state)

    def _extract_subject_from_filename(self, file_path: Path) -> Subject:
        """Extract subject from filename."""
        filename_lower = " ".join(part.lower() for part in file_path.parts)

        subject_map = {
            "math": Subject.MATHEMATICS,
            "english": Subject.ENGLISH,
            "science": Subject.SCIENCE,
            "physics": Subject.SCIENCE,
            "chemistry": Subject.SCIENCE,
            "biology": Subject.SCIENCE,
            "social": Subject.SOCIAL_STUDIES,
            "ict": Subject.ICT,
            "computing": Subject.ICT,
            "music": Subject.ELECTIVES,
            "art": Subject.ELECTIVES,
            "french": Subject.ELECTIVES,
            "arabic": Subject.ELECTIVES,
            "pe": Subject.ELECTIVES,
        }

        for keyword, subject in subject_map.items():
            if keyword in filename_lower:
                return subject

        return Subject.MATHEMATICS

    async def load_remaining_documents(self, data_dir: Path, loading_state=None):
        """Load past questions and textbooks on-demand (lazy loading)."""
        logger.info("📚 Starting deferred document loading...")
        try:
            results = {
                "past_questions": await self._load_directory(data_dir / "past_questions", "past_question", loading_state),
                "textbooks": await self._load_directory(data_dir / "textbooks", "textbook", loading_state),
            }
            self._save_manifest()
            logger.info("✅ Deferred document loading complete")
            return results
        except Exception as e:
            logger.error(f"Error during deferred loading: {str(e)}")
            raise
