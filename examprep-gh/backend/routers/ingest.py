"""
Ingest Router — upload and process PDF past-question papers / textbooks.
"""

from fastapi import APIRouter, HTTPException
from models.schemas import IngestRequest
from services.pdf_processor import extract_text_from_pdf, chunk_text
from services.embeddings import store_chunks_with_embeddings

router = APIRouter(tags=["Ingest"])


@router.post("/upload")
async def ingest_pdf(req: IngestRequest):
    """
    Process a PDF file:
    1. Extract text via pdfplumber
    2. Chunk text with overlap
    3. Generate embeddings and store in Supabase (pgvector)
    """
    try:
        # Step 1 — Extract
        raw_text = extract_text_from_pdf(req.file_path)
        if not raw_text:
            raise HTTPException(
                status_code=400,
                detail="Could not extract text from the provided PDF.",
            )

        # Step 2 — Chunk
        chunks = chunk_text(raw_text, chunk_size=1000, overlap=200)

        # Step 3 — Embed & Store
        stored = store_chunks_with_embeddings(
            chunks=chunks,
            subject=req.subject,
            topic=req.topic,
        )

        return {
            "status": "success",
            "message": f"Ingested {stored} chunks from '{req.file_path}'",
            "subject": req.subject,
            "topic": req.topic,
            "total_chunks": stored,
            "total_characters": len(raw_text),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
