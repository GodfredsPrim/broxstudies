"""
Embeddings Service — generates and stores OpenAI embeddings in Supabase (pgvector).

NOTE: This module uses the *OpenAI* API exclusively for embeddings
(text-embedding-3-small). Question generation uses DeepSeek — see
services/question_generator.py.
"""

import os
from typing import List, Dict
from openai import OpenAI
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# OpenAI client — used ONLY for embeddings (text-embedding-3-small)
embedding_client = OpenAI(api_key=OPENAI_API_KEY)


def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def generate_embedding(text: str) -> List[float]:
    """Generate an embedding vector for a chunk of text."""
    response = embedding_client.embeddings.create(
        input=text,
        model="text-embedding-3-small",
    )
    return response.data[0].embedding


def store_chunks_with_embeddings(
    chunks: List[str],
    subject: str,
    topic: str,
) -> int:
    """
    Generate embeddings for each chunk and store in Supabase.
    Returns the number of chunks stored.
    """
    supabase = get_supabase()
    rows = []

    for chunk in chunks:
        embedding = generate_embedding(chunk)
        rows.append({
            "content": chunk,
            "subject": subject,
            "topic": topic,
            "embedding": embedding,
        })

    if rows:
        supabase.table("documents").insert(rows).execute()

    return len(rows)


def search_similar(query: str, subject: str, limit: int = 5) -> List[Dict]:
    """
    Semantic search — find the most relevant chunks for a query.
    Uses Supabase RPC (match_documents) which wraps pgvector cosine similarity.
    """
    embedding = generate_embedding(query)
    supabase = get_supabase()

    result = supabase.rpc(
        "match_documents",
        {
            "query_embedding": embedding,
            "match_count": limit,
            "filter_subject": subject,
        },
    ).execute()

    return result.data if result.data else []
