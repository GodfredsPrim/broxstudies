from langchain_openai import OpenAIEmbeddings
from app.config import settings

def get_embeddings():
    """Get OpenAI embeddings instance"""
    return OpenAIEmbeddings(
        model=settings.EMBEDDING_MODEL,
        api_key=settings.OPENAI_API_KEY
    )

def format_response(data, success=True):
    """Format API response"""
    return {
        "success": success,
        "data": data if success else None,
        "error": None if success else data
    }
