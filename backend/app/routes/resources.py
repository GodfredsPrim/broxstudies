from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict
import logging
import asyncio

from app.services.curriculum_fetcher import CurriculumResourceFetcher
from app.services.batch_loader import BatchLoader

logger = logging.getLogger(__name__)
router = APIRouter()

# Global state for resource fetching
class FetchState:
    def __init__(self):
        self.is_fetching = False
        self.progress = 0
        self.status = "idle"
        self.message = ""
        self.results = None

fetch_state = FetchState()


class ResourceFetchRequest(BaseModel):
    """Request to fetch curriculum resources"""
    years: Optional[List[str]] = None  # ["year_1", "year_2"]
    subjects: Optional[List[str]] = None  # Specific subjects to fetch
    resource_types: Optional[List[str]] = None  # ["syllabi", "past_questions", "textbooks"]
    auto_process: bool = True  # Auto-process PDFs after downloading


@router.post("/fetch-curriculum-resources")
async def fetch_curriculum_resources(request: ResourceFetchRequest, background_tasks: BackgroundTasks):
    """
    Fetch curriculum resources from Ministry of Education Ghana website
    Runs in background and returns immediately
    """
    if fetch_state.is_fetching:
        raise HTTPException(
            status_code=409,
            detail="Resource fetching already in progress"
        )
    
    # Start background task
    background_tasks.add_task(
        _background_fetch_resources,
        request.years,
        request.subjects,
        request.resource_types,
        request.auto_process
    )
    
    fetch_state.is_fetching = True
    fetch_state.status = "starting"
    fetch_state.message = "Initializing resource fetch..."
    
    return {
        "status": "fetching",
        "message": "Resource fetch started in background"
    }


@router.get("/fetch-curriculum-resources/status")
async def get_fetch_status():
    """Get status of curriculum resource fetching"""
    return {
        "is_fetching": fetch_state.is_fetching,
        "status": fetch_state.status,
        "progress": fetch_state.progress,
        "message": fetch_state.message,
        "results": fetch_state.results
    }


@router.get("/available-resources")
async def get_available_resources() -> Dict:
    """
    Get list of available subjects and years from Ministry of Education site
    (without downloading)
    """
    try:
        fetcher = CurriculumResourceFetcher()
        subjects_by_year = await fetcher.fetch_years_subjects()
        
        return {
            "status": "success",
            "data": subjects_by_year,
            "available_years": list(subjects_by_year.keys()),
            "total_subjects_by_year": {
                year: len(subjects)
                for year, subjects in subjects_by_year.items()
            }
        }
    
    except Exception as e:
        logger.error(f"Error fetching available resources: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching resources: {str(e)}"
        )


@router.post("/fetch-curriculum-resources/cancel")
async def cancel_fetch():
    """Cancel ongoing resource fetch"""
    if fetch_state.is_fetching:
        fetch_state.is_fetching = False
        fetch_state.status = "cancelled"
        fetch_state.message = "Fetch cancelled by user"
        return {"status": "cancelled"}
    
    return {"status": "not_fetching"}


async def _background_fetch_resources(
    years: Optional[List[str]],
    subjects: Optional[List[str]],
    resource_types: Optional[List[str]],
    auto_process: bool
):
    """Background task to fetch and process curriculum resources"""
    try:
        fetcher = CurriculumResourceFetcher()
        batch_loader = BatchLoader()
        
        fetch_state.status = "fetching"
        fetch_state.message = "Fetching available subjects and resources..."
        
        # Fetch resources
        summary = await fetcher.fetch_and_cache_resources(
            years=years or ["year_1", "year_2"],
            subjects_filter=subjects,
            resource_types=resource_types
        )
        
        fetch_state.progress = 50
        fetch_state.message = f"Downloaded {summary['downloaded']} resources"
        
        # Auto-process if requested
        if auto_process:
            fetch_state.status = "processing"
            fetch_state.message = "Processing downloaded PDFs..."
            
            # Process all newly downloaded PDFs
            from app.config import settings
            process_results = await batch_loader.load_all_documents(
                data_dir=settings.SITE_RESOURCE_DIR,
                selective=False,
            )
            
            fetch_state.progress = 100
            fetch_state.message = f"Processing complete"
            fetch_state.results = {
                "fetch_summary": summary,
                "processing_results": process_results
            }
        else:
            fetch_state.progress = 100
            fetch_state.results = {"fetch_summary": summary}
        
        fetch_state.status = "complete"
        logger.info(f"✅ Resource fetch complete: {summary}")
    
    except Exception as e:
        logger.error(f"❌ Error in background fetch: {str(e)}")
        fetch_state.status = "error"
        fetch_state.message = f"Error: {str(e)}"
        fetch_state.results = {"error": str(e)}
    
    finally:
        fetch_state.is_fetching = False

