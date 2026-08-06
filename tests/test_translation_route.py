import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app


def test_translate_returns_translated_content(monkeypatch):
    monkeypatch.setattr("routes.translate.translate_content", lambda content, language: {"text": "မြန်မာ"})
    client = create_app().test_client()

    response = client.post("/api/translate", json={"content": {"text": "English"}, "target_language": "Burmese"})

    assert response.status_code == 200
    assert response.get_json() == {"content": {"text": "မြန်မာ"}}


def test_translate_rejects_an_invalid_language():
    client = create_app().test_client()

    response = client.post("/api/translate", json={"content": "Hello", "target_language": "French"})

    assert response.status_code == 400
