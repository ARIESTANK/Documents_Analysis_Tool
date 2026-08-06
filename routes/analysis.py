"""
Type-aware document analysis.

This wires the previously-unused services/document_types.py +
services/analysis_service.py into the API: given a document that was
uploaded with a document_type (see routes/documents.py), lists which
AI functions apply to it and runs one of them through Gemini with a
prompt built specifically for that type (e.g. "srs" gets requirement
extraction / missing-section detection prompts, "resume" gets skill
extraction / ATS prompts, etc. — see FUNCTION_REGISTRY in
services/document_types.py for the full set per type).
"""
from flask import Blueprint, request, jsonify
from supabase_client import get_client
from services.document_types import get_available_functions
from services.analysis_service import run_analysis
from services.google_key_pool import GoogleApiKeysRateLimited

analysis_bp = Blueprint("analysis", __name__, url_prefix="/api/documents")


def _get_document(client, document_id):
    return (
        client.table("documents")
        .select("id, title, document_type, status")
        .eq("id", document_id)
        .single()
        .execute()
        .data
    )


@analysis_bp.get("/<document_id>/functions")
def list_functions(document_id):
    """Returns the AI functions available for this specific document, based
    on the document_type it was uploaded with (not a type passed in the
    query string) — so the frontend always gets the functions that actually
    match this file."""
    client = get_client()
    doc = _get_document(client, document_id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404
    if not doc.get("document_type"):
        return jsonify({"error": "This document has no document_type on record"}), 400

    return jsonify({
        "document_type": doc["document_type"],
        "functions": get_available_functions(doc["document_type"]),
    })


@analysis_bp.post("/<document_id>/analyze")
def analyze(document_id):
    """
    body: {"function_key": "<key from list_functions() above>"}
    Looks up the document's stored document_type, builds the matching
    Gemini prompt via services.analysis_service.run_analysis, and returns
    the result. Requires the document to already be chunked/embedded
    (status == "ready") since the prompt is grounded in its stored chunks.
    """
    body = request.get_json(force=True) or {}
    function_key = (body.get("function_key") or "").strip()
    if not function_key:
        return jsonify({"error": "function_key is required"}), 400

    client = get_client()
    doc = _get_document(client, document_id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404
    if not doc.get("document_type"):
        return jsonify({"error": "This document has no document_type on record"}), 400
    if doc.get("status") != "ready":
        return jsonify({"error": f"Document is not ready yet (status: {doc.get('status')})"}), 400

    try:
        result = run_analysis(
            document_id=document_id,
            document_title=doc["title"],
            doc_type=doc["document_type"],
            function_key=function_key,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except GoogleApiKeysRateLimited:
        # All 5 keys are cooling down at once — let app.py's global
        # handler turn this into a 429 with a Retry-After header.
        raise
    except RuntimeError as exc:
        # e.g. GOOGLE_API_KEY missing — see services/llm_service.py
        return jsonify({"error": str(exc)}), 500
    except Exception as exc:
        return jsonify({"error": f"Analysis failed: {exc}"}), 500

    # Best-effort persistence so past results survive a refresh. Wrapped in
    # try/except because this assumes a "document_analyses" table
    # (document_id, function_key, output_format, result jsonb, created_at)
    # that may not exist in your schema yet — see note below the code.
    try:
        client.table("document_analyses").insert({
            "document_id": document_id,
            "function_key": function_key,
            "output_format": result["output_format"],
            "result": result["result"],
        }).execute()
    except Exception:
        pass

    return jsonify(result)


@analysis_bp.get("/<document_id>/analyses")
def list_past_analyses(document_id):
    """Optional history endpoint — returns previously-run analyses for this
    document, newest first. Depends on the same document_analyses table."""
    client = get_client()
    try:
        result = (
            client.table("document_analyses")
            .select("*")
            .eq("document_id", document_id)
            .order("created_at", desc=True)
            .execute()
        )
        return jsonify(result.data)
    except Exception:
        return jsonify([])