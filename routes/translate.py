from flask import Blueprint, jsonify, request

from services.translation_service import translate_content


translate_bp = Blueprint("translate", __name__, url_prefix="/api/translate")


@translate_bp.post("")
def translate():
    payload = request.get_json(silent=True) or {}
    if "content" not in payload:
        return jsonify({"error": "content is required"}), 400

    target_language = payload.get("target_language", "Burmese")
    if target_language not in {"English", "Burmese"}:
        return jsonify({"error": "target_language must be English or Burmese"}), 400

    try:
        return jsonify({"content": translate_content(payload["content"], target_language)})
    except Exception as exc:
        return jsonify({"error": f"Translation failed: {exc}"}), 502
