"""
Thin wrapper around the Supabase Python client.
Import `get_client()` anywhere you need DB access.
"""
from supabase import create_client, Client
from config import Config

_client: Client = None


def get_client() -> Client:
    global _client
    if _client is None:
        if not Config.SUPABASE_URL or not Config.SUPABASE_SERVICE_KEY:
            raise RuntimeError(
                "SUPABASE_URL / SUPABASE_SERVICE_KEY are not set. "
                "Copy backend/.env.example to backend/.env and fill in your project keys."
            )
        _client = create_client(Config.SUPABASE_URL, Config.SUPABASE_SERVICE_KEY)
    return _client
