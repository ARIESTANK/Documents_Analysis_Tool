"""Thread-safe, round-robin Google API key selection and rate-limit cooldowns."""

import time
from threading import Lock

from config import Config


class GoogleApiKeysRateLimited(RuntimeError):
    def __init__(self, retry_after_seconds: float):
        self.retry_after_seconds = max(1, int(retry_after_seconds))
        super().__init__(
            f"All configured Google API keys are rate-limited. Retry in about {self.retry_after_seconds} seconds."
        )


class GoogleApiKeyPool:
    """Distribute calls evenly and provide every other key for failover."""

    def __init__(self):
        self._next_index = 0
        self._lock = Lock()
        self._cooldowns: dict[str, float] = {}

    def keys_for_request(self) -> tuple[str, ...]:
        """Return a rotated key order; the first key changes for every call."""
        keys = Config.google_api_keys()
        if not keys:
            raise RuntimeError("No Google API keys are configured")

        with self._lock:
            start = self._next_index % len(keys)
            self._next_index = (start + 1) % len(keys)
            ordered_keys = keys[start:] + keys[:start]
            now = time.monotonic()
            available_keys = tuple(
                key for key in ordered_keys if self._cooldowns.get(key, 0) <= now
            )
            if available_keys:
                return available_keys

            retry_after = min(self._cooldowns[key] - now for key in ordered_keys)
            raise GoogleApiKeysRateLimited(retry_after)

    def mark_rate_limited(self, api_key: str, retry_after_seconds: float = 30) -> None:
        """Temporarily remove a key after a Gemini 429 response."""
        with self._lock:
            self._cooldowns[api_key] = max(
                self._cooldowns.get(api_key, 0),
                time.monotonic() + max(1, retry_after_seconds),
            )


google_api_key_pool = GoogleApiKeyPool()
