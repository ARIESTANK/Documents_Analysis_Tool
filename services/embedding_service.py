"""
Embedding Service
Uses a local sentence-transformers model (BGE-small by default) so no
external embedding API key is required. Model downloads once on first run.
"""
from functools import lru_cache
from config import Config


@lru_cache(maxsize=1)
def _get_model():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(Config.EMBEDDING_MODEL)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of strings. BGE models recommend a query instruction prefix
    for queries but not for stored passages — see embed_query() below."""
    model = _get_model()
    vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return vectors.tolist()


def embed_query(query: str) -> list[float]:
    """BGE models perform better on retrieval when queries are prefixed."""
    instruction = "Represent this sentence for searching relevant passages: "
    model = _get_model()
    vector = model.encode([instruction + query], normalize_embeddings=True, show_progress_bar=False)
    return vector[0].tolist()
