from fastapi import APIRouter, HTTPException, Query
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from app.services.book_library import BookLibraryService

router = APIRouter()
service = BookLibraryService()


class BookItemResponse(BaseModel):
    id: str
    title: str
    author: str
    category: str
    rating: float
    description: str
    pages: Optional[int] = None
    isbn: Optional[str] = None
    publication_year: Optional[str] = None
    cover_url: Optional[str] = None
    source: Optional[str] = None


class BookQuizRequest(BaseModel):
    book_id: str
    num_questions: Optional[int] = 4


class BookQuizQuestionResponse(BaseModel):
    question: str
    type: str
    options: Optional[List[str]] = None
    answer: Optional[str] = None


class BookQuizResponse(BaseModel):
    book_id: str
    title: str
    questions: List[BookQuizQuestionResponse]
    source: Optional[str] = None


@router.get("/search", response_model=List[BookItemResponse])
async def search_books(query: Optional[str] = Query(None, description="Search term for the book library"), category: Optional[str] = Query("all", description="Book category filter")):
    try:
        return await service.search_books(query=query, category=category or "all")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{book_id:path}", response_model=BookItemResponse)
async def get_book(book_id: str):
    book = await service.get_book(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@router.post("/quiz", response_model=BookQuizResponse)
async def create_book_quiz(request: BookQuizRequest):
    try:
        return await service.generate_quiz(request.book_id, num_questions=request.num_questions or 4)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
