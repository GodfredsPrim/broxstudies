"""
PDF Processor — extracts text from past-question PDFs and textbooks.
Uses pdfplumber for reliable table + paragraph extraction.
"""

import pdfplumber
from typing import List, Dict


def extract_text_from_pdf(file_path: str) -> str:
    """Extract all text from a PDF file."""
    full_text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n\n"
    return full_text.strip()


def extract_pages(file_path: str) -> List[Dict]:
    """Extract text per page with metadata."""
    pages = []
    with pdfplumber.open(file_path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text and len(text.strip()) > 20:
                pages.append({
                    "page_number": i + 1,
                    "text": text.strip(),
                    "char_count": len(text.strip()),
                })
    return pages


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """
    Split text into overlapping chunks for embedding.
    Tries to split on paragraph boundaries when possible.
    """
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size

        # Try to break on a paragraph boundary
        if end < len(text):
            newline_pos = text.rfind("\n\n", start, end)
            if newline_pos != -1 and newline_pos > start + chunk_size // 2:
                end = newline_pos

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        start = end - overlap if end < len(text) else len(text)

    return chunks
