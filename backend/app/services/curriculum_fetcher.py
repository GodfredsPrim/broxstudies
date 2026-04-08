"""
Service for fetching curriculum resources from Ministry of Education Ghana website
"""

import httpx
import asyncio
import logging
import json
import re
from pathlib import Path
from typing import List, Dict, Optional
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from datetime import datetime

from app.config import settings

logger = logging.getLogger(__name__)

class CurriculumResourceFetcher:
    """Fetches curriculum resources from curriculumresources.edu.gh"""
    
    BASE_URL = "https://curriculumresources.edu.gh"
    TIMEOUT = 30
    
    YEAR_PAGES = {
        "year_1": f"{BASE_URL}/year1",
        "year_2": f"{BASE_URL}/year2",
    }
    CATALOG_PATH = settings.SITE_RESOURCE_DIR / "subjects_catalog.json"
    
    def __init__(self):
        self.session = None
        self.fetched_resources = []
    
    async def get_session(self) -> httpx.AsyncClient:
        """Get or create async HTTP client"""
        if self.session is None:
            self.session = httpx.AsyncClient(timeout=self.TIMEOUT, follow_redirects=True)
        return self.session
    
    async def close_session(self):
        """Close HTTP session"""
        if self.session:
            await self.session.aclose()
            self.session = None
    
    async def fetch_years_subjects(self) -> Dict[str, List[Dict]]:
        """
        Fetch all available subjects for each year
        Returns: {year: [{"name": "subject_name", "url": "subject_url"}, ...]}
        """
        results = {}
        session = await self.get_session()
        
        try:
            for year_key, year_url in self.YEAR_PAGES.items():
                logger.info(f"📚 Fetching subjects for {year_key}...")
                
                try:
                    response = await session.get(year_url)
                    response.raise_for_status()
                    
                    soup = BeautifulSoup(response.text, "html.parser")
                    subjects = await self._parse_subjects_from_page(soup, year_url)
                    results[year_key] = subjects
                    logger.info(f"✅ Found {len(subjects)} subjects for {year_key}")
                    
                except Exception as e:
                    logger.error(f"❌ Error fetching {year_key}: {str(e)}")
                    results[year_key] = []

            self._save_subject_catalog(results)
            return results
        
        except Exception as e:
            logger.error(f"❌ Error fetching years subjects: {str(e)}")
            return {}

    def _save_subject_catalog(self, subjects_by_year: Dict[str, List[Dict]]) -> None:
        """Persist site subjects so question endpoints can align with site years/subjects."""
        settings.SITE_RESOURCE_DIR.mkdir(parents=True, exist_ok=True)
        payload = {
            "source": self.BASE_URL,
            "updated_at": datetime.utcnow().isoformat() + "Z",
            "years": subjects_by_year,
        }
        with open(self.CATALOG_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

    def _slugify(self, value: str) -> str:
        normalized = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
        return normalized or "unknown_subject"

    def _load_catalog(self) -> Dict[str, List[Dict]]:
        if not self.CATALOG_PATH.exists():
            return {}
        try:
            with open(self.CATALOG_PATH, "r", encoding="utf-8") as f:
                payload = json.load(f)
            return payload.get("years", {})
        except Exception:
            return {}

    async def _resolve_subject_info(self, year_key: str, subject_slug: str) -> Optional[Dict]:
        years = self._load_catalog()
        if year_key not in years or not years[year_key]:
            years = await self.fetch_years_subjects()

        for subject in years.get(year_key, []):
            name_slug = self._slugify(subject.get("name", ""))
            url_slug = self._subject_slug_from_url(subject.get("url", ""), year_key)
            if name_slug == subject_slug or url_slug == subject_slug:
                return subject
        return None
    
    async def _parse_subjects_from_page(self, soup: BeautifulSoup, year_url: str) -> List[Dict]:
        """Parse subjects from a year page"""
        subjects = []
        seen_urls = set()
        year_token = "year1" if year_url.rstrip("/").endswith("year1") else "year2"

        def add_subject(name: str, href: str):
            if not href:
                return
            subject_url = urljoin(year_url, href)
            parsed = urlparse(subject_url)
            path = parsed.path.lower()
            if "#elementor-action" in subject_url.lower():
                return
            if path.rstrip("/") in ["/year1", "/year2"]:
                return
            slug_guess = self._subject_slug_from_url(subject_url)
            if slug_guess in {"year1", "year2", ""}:
                return
            if subject_url in seen_urls:
                return
            cleaned_name = (name or "").strip()
            generic_names = {
                "view", "menu", "instagram", "tiktok", "twitter", "skip to content", "close", "open",
            }
            if (not cleaned_name) or (cleaned_name.lower() in generic_names):
                cleaned_name = self._name_from_subject_url(subject_url)
            if not cleaned_name:
                return
            seen_urls.add(subject_url)
            subjects.append({"name": cleaned_name, "url": subject_url})

        # Strategy 1: table rows (old structure)
        for row in soup.find_all("tr"):
            cells = row.find_all("td")
            if len(cells) >= 2:
                subject_name = cells[0].get_text(strip=True)
                link = cells[1].find("a")
                if link and link.get("href"):
                    add_subject(subject_name, link.get("href"))

        # Strategy 2: generic anchor scan (new card/grid structures)
        for link in soup.find_all("a", href=True):
            href = link.get("href", "")
            full_url = urljoin(year_url, href)
            path = urlparse(full_url).path.lower()
            if f"/{year_token}_" not in path and f"/{year_token}/" not in path:
                continue
            if any(skip in path for skip in ["/wp-content/", "/tag/", "/category/", "/author/"]):
                continue
            text = link.get_text(" ", strip=True)
            add_subject(text, href)

        return subjects

    def _name_from_subject_url(self, subject_url: str) -> str:
        slug = self._subject_slug_from_url(subject_url)
        slug = slug.replace("-", " ").replace("_", " ").strip()
        if not slug:
            return ""
        return " ".join(part.capitalize() for part in slug.split())

    def _subject_slug_from_url(self, subject_url: str, year_key: str | None = None) -> str:
        path = urlparse(subject_url).path.strip("/").lower()
        slug = path.split("/")[-1]
        for prefix in ["year1_", "year2_", "year_1_", "year_2_"]:
            if slug.startswith(prefix):
                return slug[len(prefix):]
        if year_key:
            if year_key == "year_1" and slug.startswith("year1_"):
                return slug[len("year1_"):]
            if year_key == "year_2" and slug.startswith("year2_"):
                return slug[len("year2_"):]
        return slug
    
    async def fetch_subject_resources(self, subject_url: str) -> Dict:
        """
        Fetch available resources (syllabi, past questions, textbooks, teacher resources) for a subject
        """
        session = await self.get_session()
        resources = {
            "syllabi": [],
            "past_questions": [],
            "textbooks": [],
            "teacher_resources": [],
        }
        
        try:
            response = await session.get(subject_url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, "html.parser")
            
            # Extract resource links
            links = soup.find_all("a", href=True)
            
            for link in links:
                href = link.get("href", "")
                text = link.get_text(strip=True).lower()
                
                # Filter for resource links
                href_lower = href.lower()
                if ".pdf" in href_lower:
                    full_url = urljoin(subject_url, href)
                    
                    if any(term in text for term in ["syllabus", "curriculum"]):
                        resources["syllabi"].append({
                            "name": link.get_text(strip=True),
                            "url": full_url
                        })
                    elif any(term in text for term in ["teacher", "facilitator", "lesson plan", "scheme"]):
                        resources["teacher_resources"].append({
                            "name": link.get_text(strip=True),
                            "url": full_url
                        })
                    elif any(term in text for term in ["past question", "past paper", "examination", "exam", "waec", "wassce"]):
                        resources["past_questions"].append({
                            "name": link.get_text(strip=True),
                            "url": full_url
                        })
                    elif any(term in text for term in ["textbook", "book", "combined", "year one", "year two", "year three"]):
                        resources["textbooks"].append({
                            "name": link.get_text(strip=True),
                            "url": full_url
                        })
                    else:
                        # Default unmatched PDFs to textbooks so subject pages with generic labels still work.
                        resources["textbooks"].append({
                            "name": link.get_text(strip=True) or "Subject resource PDF",
                            "url": full_url
                        })
            
            return resources
        
        except Exception as e:
            logger.error(f"❌ Error fetching subject resources: {str(e)}")
            return resources
    
    async def download_resource(
        self, 
        url: str, 
        resource_type: str, 
        year: str,
        subject: str, 
        progress_callback: Optional[callable] = None
    ) -> Optional[str]:
        """
        Download a resource PDF
        Returns: path to downloaded file or None if failed
        """
        session = await self.get_session()

        max_attempts = 3
        for attempt in range(1, max_attempts + 1):
            try:
            # Save into backend/data/site_resources so batch loading can consume site data directly.
                subject_dir = settings.SITE_RESOURCE_DIR / resource_type / year / self._slugify(subject)
                subject_dir.mkdir(parents=True, exist_ok=True)
            
            # Extract filename from URL
                parsed_url = urlparse(url)
                filename = Path(parsed_url.path).name or "resource.pdf"
                filepath = subject_dir / filename
            
            # Don't re-download if already exists
                if filepath.exists():
                    logger.info(f"⏭️  File already exists: {filepath}")
                    return str(filepath)
            
                logger.info(f"⬇️  Downloading: {filename} (attempt {attempt}/{max_attempts})")
            
            # Download with progress tracking
                async with session.stream("GET", url) as response:
                    response.raise_for_status()
                
                    total_size = int(response.headers.get("content-length", 0))
                    downloaded = 0
                
                    with open(filepath, "wb") as f:
                        async for chunk in response.aiter_bytes(chunk_size=8192):
                            if chunk:
                                f.write(chunk)
                                downloaded += len(chunk)
                            
                                if progress_callback and total_size > 0:
                                    progress = (downloaded / total_size) * 100
                                    progress_callback(progress, filename)
            
                logger.info(f"✅ Downloaded: {filename}")
                return str(filepath)
            except Exception as e:
                logger.error(f"❌ Error downloading resource ({attempt}/{max_attempts}): {str(e)}")
                if attempt == max_attempts:
                    return None
                await asyncio.sleep(1.0)
        return None
    
    async def fetch_and_cache_resources(
        self,
        years: Optional[List[str]] = None,
        subjects_filter: Optional[List[str]] = None,
        resource_types: Optional[List[str]] = None
    ) -> Dict:
        """
        Fetch and cache all curriculum resources
        
        Args:
            years: List of years to fetch (e.g., ["year_1", "year_2"])
            subjects_filter: Only fetch specific subjects
            resource_types: Types of resources to fetch ["syllabi", "past_questions", "textbooks"]
        
        Returns: Summary of fetched resources
        """
        if not years:
            years = list(self.YEAR_PAGES.keys())
        if not resource_types:
            resource_types = ["syllabi", "past_questions", "textbooks", "teacher_resources"]
        
        summary = {
            "total_subjects": 0,
            "total_resources": 0,
            "downloaded": 0,
            "failed": 0,
            "by_year": {},
            "by_type": {rt: 0 for rt in resource_types}
        }
        
        try:
            # Get all subjects
            all_subjects = await self.fetch_years_subjects()
            
            for year_key in years:
                if year_key not in all_subjects:
                    continue
                
                year_subjects = all_subjects[year_key]
                summary["by_year"][year_key] = {
                    "subjects": 0,
                    "resources": 0,
                    "downloaded": 0
                }
                
                for subject_info in year_subjects:
                    subject_name = subject_info["name"]
                    subject_url = subject_info["url"]
                    
                    if subjects_filter and subject_name not in subjects_filter:
                        continue
                    
                    logger.info(f"📖 Processing: {subject_name}")
                    summary["total_subjects"] += 1
                    
                    # Get subject resources
                    subject_resources = await self.fetch_subject_resources(subject_url)
                    
                    # Download resources
                    for resource_type in resource_types:
                        if resource_type not in subject_resources:
                            continue
                        
                        for resource in subject_resources[resource_type]:
                            try:
                                filepath = await self.download_resource(
                                    url=resource["url"],
                                    resource_type=resource_type,
                                    year=year_key,
                                    subject=subject_name
                                )
                                
                                if filepath:
                                    summary["downloaded"] += 1
                                    summary["by_type"][resource_type] += 1
                                    summary["by_year"][year_key]["downloaded"] += 1
                                else:
                                    summary["failed"] += 1
                                
                                summary["total_resources"] += 1
                                summary["by_year"][year_key]["resources"] += 1
                            
                            except Exception as e:
                                logger.error(f"❌ Error downloading {resource['name']}: {str(e)}")
                                summary["failed"] += 1
                    
                    summary["by_year"][year_key]["subjects"] += 1
                    
                    # Rate limit requests
                    await asyncio.sleep(1)
            
            logger.info(f"✅ Fetch complete: {summary['downloaded']} resources downloaded")
            return summary
        
        except Exception as e:
            logger.error(f"❌ Error in fetch_and_cache_resources: {str(e)}")
            return summary
        
        finally:
            await self.close_session()

    async def ensure_subject_resources(
        self,
        year_key: str,
        subject_slug: str,
        resource_types: Optional[List[str]] = None,
    ) -> Dict:
        """Download missing resources for one selected year+subject only."""
        if not resource_types:
            resource_types = ["past_questions", "textbooks", "teacher_resources"]

        summary = {
            "year": year_key,
            "subject_slug": subject_slug,
            "resource_types": resource_types,
            "downloaded": 0,
            "existing": 0,
            "failed": 0,
            "resolved_subject": None,
            "status_by_type": {},
        }

        try:
            subject_info = await self._resolve_subject_info(year_key, subject_slug)
            if not subject_info:
                summary["failed"] += 1
                return summary

            subject_name = subject_info.get("name", "")
            subject_url = subject_info.get("url", "")
            summary["resolved_subject"] = subject_name

            subject_resources = await self.fetch_subject_resources(subject_url)
            for resource_type in resource_types:
                subject_dir = settings.SITE_RESOURCE_DIR / resource_type / year_key / subject_slug
                has_existing = subject_dir.exists() and any(subject_dir.rglob("*.pdf"))
                if has_existing:
                    summary["existing"] += 1
                    summary["status_by_type"][resource_type] = "cached"
                    continue
                summary["status_by_type"][resource_type] = "missing"

                for resource in subject_resources.get(resource_type, []):
                    downloaded_path = await self.download_resource(
                        url=resource["url"],
                        resource_type=resource_type,
                        year=year_key,
                        subject=subject_name,
                    )
                    if downloaded_path:
                        summary["downloaded"] += 1
                        summary["status_by_type"][resource_type] = "downloaded"
                    else:
                        summary["failed"] += 1
                        summary["status_by_type"][resource_type] = "failed"
        finally:
            await self.close_session()

        return summary

    def get_subject_resource_status(self, year_key: str, subject_slug: str) -> Dict:
        """Return local cache status for selected subject resources."""
        status = {}
        for resource_type in ["past_questions", "textbooks", "teacher_resources"]:
            subject_dir = settings.SITE_RESOURCE_DIR / resource_type / year_key / subject_slug
            status[resource_type] = {
                "cached": subject_dir.exists() and any(subject_dir.rglob("*.pdf")),
                "path": str(subject_dir),
            }
        return status

