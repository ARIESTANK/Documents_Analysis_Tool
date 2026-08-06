import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
    EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "384"))

    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "./uploads")
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH_MB", "25")) * 1024 * 1024

    CHUNK_SIZE_TOKENS = 450
    CHUNK_OVERLAP_TOKENS = 70
    TOP_K_RETRIEVAL = 6

    @classmethod
    def google_api_keys(cls) -> tuple[str, ...]:
        """Return configured Gemini keys in their deterministic pool order.

        ``GOOGLE_API_KEY`` remains the primary/backwards-compatible setting;
        optional ``GOOGLE_API_KEY_1``, ``GOOGLE_API_KEY_2``, etc. extend the
        pool. Reading the environment here (rather than only at import time)
        also keeps test and worker configuration predictable.
        """
        keys = [os.getenv("GOOGLE_API_KEY", "").strip()]
        numbered = sorted(
            (
                (int(name.rsplit("_", 1)[1]), value.strip())
                for name, value in os.environ.items()
                if name.startswith("GOOGLE_API_KEY_")
                and name.rsplit("_", 1)[1].isdigit()
            ),
            key=lambda item: item[0],
        )
        keys.extend(value for _, value in numbered)
        # Ignore blank and duplicate values so no request is spent on them.
        return tuple(dict.fromkeys(key for key in keys if key))

    @classmethod
    def validate(cls):
        missing = []
        if not cls.SUPABASE_URL:
            missing.append("SUPABASE_URL")
        if not cls.SUPABASE_SERVICE_KEY:
            missing.append("SUPABASE_SERVICE_KEY")
        if not cls.google_api_keys():
            missing.append("GOOGLE_API_KEY")
        return missing