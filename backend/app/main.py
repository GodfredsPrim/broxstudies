from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
import logging
from pathlib import Path
import asyncio

from app.config import settings
from app.routes import questions, uploads, analysis, resources
from app.services.batch_loader import BatchLoader

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global loading state
class LoadingState:
    def __init__(self):
        self.is_loading = False
        self.total_files = 0
        self.loaded_files = 0
        self.current_file = ""
        self.percentage = 0
        self.current_category = ""
        self.results = None

loading_state = LoadingState()

# Background task for loading documents
async def background_load_documents(app):
    """Load documents in background without blocking startup"""
    try:
        batch_loader = BatchLoader()
        load_results = await batch_loader.load_all_documents(settings.DATA_DIR, loading_state)
        
        logger.info("📚 Document Loading Summary:")
        logger.info(f"  Syllabi: {load_results['syllabi']['successful']}/{load_results['syllabi']['total_files']} loaded")
        logger.info(f"  Past Questions: {load_results['past_questions']['successful']}/{load_results['past_questions']['total_files']} loaded")
        logger.info(f"  Textbooks: {load_results['textbooks']['successful']}/{load_results['textbooks']['total_files']} loaded")
        
        loading_state.is_loading = False
        loading_state.results = load_results
        app.state.load_results = load_results
        logger.info("✅ Background document loading complete!")
    except Exception as e:
        logger.error(f"⚠️  Error during auto-loading: {str(e)}")
        logger.info("Application continuing without pre-loaded documents")
        loading_state.is_loading = False

# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 Starting Ghana SHS AI Question Generator")
    
    # Auto-load documents in background if enabled
    if settings.AUTO_LOAD_ON_STARTUP:
        loading_state.is_loading = True
        asyncio.create_task(background_load_documents(app))
        logger.info("📥 Document loading started in background...")
    
    yield
    # Shutdown
    logger.info("🛑 Shutting down application")

app = FastAPI(
    title="Ghana SHS AI Question Generator",
    description="Generate exam questions based on syllabi, past questions, and textbooks using AI and RAG",
    version="0.1.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(uploads.router, prefix="/api/uploads", tags=["uploads"])
app.include_router(questions.router, prefix="/api/questions", tags=["questions"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(resources.router, prefix="/api/resources", tags=["resources"])

@app.get("/")
async def root():
    return {
        "message": "Ghana SHS AI Question Generator API",
        "version": "0.1.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/api/status/documents")
async def get_document_status():
    """Get status of loaded documents"""
    if hasattr(app.state, 'load_results'):
        return {
            "status": "loaded",
            "documents": app.state.load_results
        }
    return {
        "status": "not_loaded",
        "message": "Documents not loaded. Auto-loading may be disabled or in progress."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
