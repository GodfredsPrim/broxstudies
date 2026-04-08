from PyPDF2 import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.config import settings
import os

class PDFProcessor:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            separators=["\n\n", "\n", " ", ""]
        )
    
    async def process_pdf(self, file_path: str, file_type: str, subject: str):
        """Process PDF file and extract text"""
        try:
            reader = PdfReader(file_path)
            num_pages = len(reader.pages)
            
            # Extract text from all pages
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            
            # Split into chunks
            chunks = self.text_splitter.split_text(text)
            
            return {
                "num_pages": num_pages,
                "num_chunks": len(chunks),
                "text": text,
                "chunks": chunks,
                "file_type": file_type,
                "subject": subject
            }
        except Exception as e:
            raise Exception(f"Error processing PDF: {str(e)}")
    
    async def extract_questions_from_pdf(self, file_path: str):
        """Extract question patterns from past questions PDF"""
        result = await self.process_pdf(file_path, "past_question", None)
        chunks = result["chunks"]
        
        # Parse and structure questions
        questions_data = []
        current_question = ""
        
        for chunk in chunks:
            if any(marker in chunk for marker in ["Question", "Q.", "Q:", "1.", "2.", "3."]):
                if current_question:
                    questions_data.append(current_question)
                current_question = chunk
            else:
                current_question += " " + chunk
        
        if current_question:
            questions_data.append(current_question)
        
        return {"questions": questions_data, "count": len(questions_data)}
