"""Gemini-backed translation for generated application content."""

import json

from services.llm_service import generate


def translate_content(content, target_language: str):
    """Translate strings in a JSON-compatible value while preserving its shape."""
    if target_language == "English":
        return content

    system = (
        "Translate all human-readable string values in the supplied JSON into Burmese "
        "(Myanmar Unicode). Preserve the JSON structure, keys, numbers, IDs, URLs, "
        "citations, and proper nouns. Return only valid JSON."
    )
    raw = generate(system, json.dumps({"content": content}, ensure_ascii=False), json_mode=True)
    try:
        return json.loads(raw)["content"]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        raise RuntimeError("Gemini returned an invalid translation") from exc
