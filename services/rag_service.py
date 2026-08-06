"""
RAG Service
Handles storing chunk embeddings in Supabase and retrieving the top-k most
relevant chunks for a given query via the `match_chunks` Postgres function.
"""
from config import Config
from supabase_client import get_client
from services.embedding_service import embed_texts, embed_query


def store_chunks(document_id: str, chunks: list[dict]):
    """Embeds and inserts all chunks for a document in one batch."""
    if not chunks:
        return
    texts = [c["content"] for c in chunks]
    vectors = embed_texts(texts)

    rows = []
    for chunk, vector in zip(chunks, vectors):
        rows.append({
            "document_id": document_id,
            "chunk_index": chunk["chunk_index"],
            "section_title": chunk.get("section_title"),
            "page_number": chunk.get("page_number"),
            "content": chunk["content"],
            "embedding": vector,
        })

    client = get_client()
    # batch insert in chunks of 100 to stay under payload limits
    for i in range(0, len(rows), 100):
        client.table("chunks").insert(rows[i:i + 100]).execute()


def retrieve_relevant_chunks(document_id: str, query: str, top_k: int = None) -> list[dict]:
    top_k = top_k or Config.TOP_K_RETRIEVAL
    query_vector = embed_query(query)
    client = get_client()
    result = client.rpc("match_chunks", {
        "query_embedding": query_vector,
        "match_document_id": document_id,
        "match_count": top_k,
    }).execute()
    return result.data or []


def get_all_chunks(document_id: str) -> list[dict]:
    client = get_client()
    result = (
        client.table("chunks")
        .select("content, section_title, page_number, chunk_index")
        .eq("document_id", document_id)
        .order("chunk_index")
        .execute()
    )
    return result.data or []
