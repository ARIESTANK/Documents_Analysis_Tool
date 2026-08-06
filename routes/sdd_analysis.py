import os
import tempfile

from flask import Blueprint, request, jsonify

from services.sdd_analyzer import analyze_sdd
from services.document_types import get_document_types, get_available_functions
from services.google_key_pool import GoogleApiKeysRateLimited

sdd_analysis_bp = Blueprint("sdd_analysis", __name__, url_prefix="/api")


@sdd_analysis_bp.get("/document-types")
def document_types():
    return jsonify(get_document_types())


@sdd_analysis_bp.get("/document-types/<doc_type>/functions")
def document_type_functions(doc_type):
    return jsonify(get_available_functions(doc_type))


@sdd_analysis_bp.post("/analyze-document")
def analyze_document():
    if "file" not in request.files:
        return jsonify({"error": "No file part in request"}), 400

    uploaded = request.files["file"]
    if uploaded.filename == "":
        return jsonify({"error": "No file selected"}), 400

    doc_type = (request.form.get("document_type") or "").strip()
    if not doc_type:
        return jsonify({"error": "document_type is required"}), 400

    filename = uploaded.filename
    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".pdf", ".docx", ".doc", ".txt"):
        return jsonify({"error": f"Unsupported file type: {ext}"}), 400

    # mkstemp gives us a path + fd; close the fd immediately so nothing
    # else holds the file open when we (or Werkzeug) write to it — avoids
    # WinError 32 on Windows, where a second handle can't open a locked file.
    fd, temp_path = tempfile.mkstemp(suffix=ext)
    os.close(fd)

    try:
        uploaded.save(temp_path)
        result = analyze_sdd(file_path=temp_path, filename=filename)
        result["document_type"] = doc_type
        result["available_functions"] = get_available_functions(doc_type)
        return jsonify(result)
    except GoogleApiKeysRateLimited:
        # All 5 keys are cooling down at once — let app.py's global
        # handler turn this into a 429 with a Retry-After header.
        raise
    except RuntimeError as exc:
        print(str(exc))
        return jsonify({"error": str(exc)}), 500
    except Exception as exc:
        print(str(exc))
        return jsonify({"error": f"Analysis failed: {str(exc)}"}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)