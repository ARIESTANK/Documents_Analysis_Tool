import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.google_key_pool import GoogleApiKeyPool


def test_key_pool_rotates_evenly_and_exposes_failover_order(monkeypatch):
    for name in list(os.environ):
        if name == "GOOGLE_API_KEY" or name.startswith("GOOGLE_API_KEY_"):
            monkeypatch.delenv(name, raising=False)

    monkeypatch.setenv("GOOGLE_API_KEY", "key-0")
    monkeypatch.setenv("GOOGLE_API_KEY_2", "key-2")
    monkeypatch.setenv("GOOGLE_API_KEY_1", "key-1")

    pool = GoogleApiKeyPool()

    assert pool.keys_for_request() == ("key-0", "key-1", "key-2")
    assert pool.keys_for_request() == ("key-1", "key-2", "key-0")
    assert pool.keys_for_request() == ("key-2", "key-0", "key-1")


def test_key_pool_skips_a_key_during_its_rate_limit_cooldown(monkeypatch):
    for name in list(os.environ):
        if name == "GOOGLE_API_KEY" or name.startswith("GOOGLE_API_KEY_"):
            monkeypatch.delenv(name, raising=False)

    monkeypatch.setenv("GOOGLE_API_KEY", "key-0")
    monkeypatch.setenv("GOOGLE_API_KEY_1", "key-1")
    pool = GoogleApiKeyPool()
    pool.mark_rate_limited("key-0", retry_after_seconds=60)

    assert pool.keys_for_request() == ("key-1",)
