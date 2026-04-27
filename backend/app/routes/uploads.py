from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from app.services.pdf_processor import PDFProcessor
from app.services.batch_loader import BatchLoader
from app.services.rag_engine import RAGEngine
import os
from app.config import settings

router = APIRouter()
pdf_processor = PDFProcessor()
batch_loader = BatchLoader()
rag_engine = RAGEngine()

@router.post("/pdf")
async def upload_pdf(file: UploadFile = File(...), file_type: str = None, subject: str = None):
    """Upload a PDF file (syllabus, past questions, or textbook)"""
    try:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
        # Save file
        file_path = os.path.join(settings.PDF_UPLOAD_DIR, file.filename)
        content = await file.read()
        
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Process PDF
        result = await pdf_processor.process_pdf(file_path, file_type, subject)
        
        # Add to vector store if subject provided
        if subject:
            await rag_engine.add_documents(result["chunks"], subject)
        
        return {
            "filename": file.filename,
            "file_type": file_type,
            "subject": subject,
            "pages": result.get("num_pages"),
            "chunks": result.get("num_chunks"),
            "status": "processed"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def upload_status():
    """Get status of uploaded files"""
    files = []
    if os.path.exists(settings.PDF_UPLOAD_DIR):
        files = [f for f in os.listdir(settings.PDF_UPLOAD_DIR) if f.endswith('.pdf')]
    
    return {
        "total_files": len(files),
        "files": files,
        "upload_directory": str(settings.PDF_UPLOAD_DIR)
    }

@router.post("/load-deferred")
async def load_deferred_documents(background_tasks: BackgroundTasks):
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
