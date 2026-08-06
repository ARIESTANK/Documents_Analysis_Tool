from flask import Blueprint, jsonify, send_file
from supabase_client import get_client
from services.rag_service import get_all_chunks
from services.llm_service import generate_summary
from services.pdf_export import build_summary_pdf

summary_bp = Blueprint("summary", __name__, url_prefix="/api/summary")


@summary_bp.post("/<document_id>/generate")
def generate(document_id):
    client = get_client()
    doc = client.table("documents").select("title").eq("id", document_id).single().execute().data
    if not doc:
        return jsonify({"error": "document not found"}), 404

    chunks = get_all_chunks(document_id)
    if not chunks:
        return jsonify({"error": "document has no processed content yet"}), 400

    summary = generate_summary(doc["title"], chunks)

    client.table("summaries").insert({
        "document_id": document_id,
        "problem": summary.get("problem", ""),
        "method": summary.get("method", ""),
        "results": summary.get("results", ""),
        "limitations": summary.get("limitations", ""),
        "key_contributions": summary.get("key_contributions", ""),
    }).execute()

    return jsonify(summary)


@summary_bp.get("/<document_id>")
def get_latest_summary(document_id):
    client = get_client()
    result = (
        client.table("summaries")
        .select("*")
        .eq("document_id", document_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return jsonify(result.data[0] if result.data else None)


@summary_bp.get("/<document_id>/export")
def export_summary_pdf(document_id):
    """Powers the Export button in SummaryPanel.jsx — builds a styled PDF
    from the most recently generated summary and returns it as a download."""
    client = get_client()
    doc = client.table("documents").select("title").eq("id", document_id).single().execute().data
    if not doc:
        return jsonify({"error": "document not found"}), 404

    result = (
        client.table("summaries")
        .select("*")
        .eq("document_id", document_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        return jsonify({"error": "No summary has been generated for this document yet"}), 400

    summary = result.data[0]
    pdf_buffer = build_summary_pdf(doc["title"], summary)

    safe_title = "".join(c if c.isalnum() or c in " -_" else "" for c in (doc["title"] or "summary")).strip()
    download_name = f"{safe_title or 'summary'} - Summary.pdf"

    return send_file(
        pdf_buffer,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=download_name,
    )