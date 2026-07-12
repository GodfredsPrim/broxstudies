from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends
from pathlib import Path
import logging
import uuid
from app.services.pdf_processor import PDFProcessor
from app.services.batch_loader import BatchLoader
from app.services.rag_engine import RAGEngine
import os
from app.config import settings
from app.models import AuthUser
from app.routes.auth import require_active_subscription

router = APIRouter()
pdf_processor = PDFProcessor()
batch_loader = BatchLoader()
rag_engine = RAGEngine()
logger = logging.getLogger(__name__)
MAX_PDF_BYTES = 10 * 1024 * 1024


async def _read_limited(upload: UploadFile, limit: int) -> bytes:
    content = await upload.read(limit + 1)
    if len(content) > limit:
        raise HTTPException(status_code=413, detail="PDF exceeds the 10 MB limit")
    return content

@router.post("/pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    file_type: str = None,
    subject: str = None,
    current_user: AuthUser = Depends(require_active_subscription),
):
    """Upload a PDF file (syllabus, past questions, or textbook)"""
    try:
        original_name = Path(file.filename or "upload.pdf").name
        if not original_name.lower().endswith('.pdf') or file.content_type not in (None, "", "application/pdf", "application/octet-stream"):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")

        # Save file
        safe_name = f"{current_user.id}-{uuid.uuid4().hex}.pdf"
        file_path = settings.PDF_UPLOAD_DIR / safe_name
        content = await _read_limited(file, MAX_PDF_BYTES)
        if not content.startswith(b"%PDF-"):
            raise HTTPException(status_code=400, detail="The uploaded file is not a valid PDF")
        
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Process PDF
        result = await pdf_processor.process_pdf(file_path, file_type, subject)
        
        # Add to vector store if subject provided
        if subject:
            await rag_engine.add_documents(result["chunks"], subject)
        
        return {
            "filename": original_name,
            "file_type": file_type,
            "subject": subject,
            "pages": result.get("num_pages"),
            "chunks": result.get("num_chunks"),
            "status": "processed"
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("PDF upload processing failed")
        raise HTTPException(status_code=500, detail="Unable to process the uploaded PDF")

@router.get("/status")
async def upload_status(current_user: AuthUser = Depends(require_active_subscription)):
    """Get status of uploaded files"""
    files = []
    if os.path.exists(settings.PDF_UPLOAD_DIR):
        files = [f for f in os.listdir(settings.PDF_UPLOAD_DIR) if f.endswith('.pdf')]
    
    return {
        "total_files": len(files),
        "files": files,
    }

@router.post("/load-deferred")
async def load_deferred_documents(
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(require_active_subscription),
):
    """Load past questions and textbooks on-demand (lazy loading).
    
    This endpoint allows students to fetch additional documents after the app starts,
    improving initial startup time.
    """
    if not settings.LAZY_LOAD:
        return {"status": "not_needed", "message": "Lazy loading is not enabled"}
    
    background_tasks.add_task(batch_loader.load_remaining_documents, settings.DATA_DIR)
    return {
        "status": "loading",
        "message": "Past questions and textbooks are loading in the background",
        "info": "Check /api/status/documents for loading progress"
    }
