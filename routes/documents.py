import os
import uuid
from flask import Blueprint, request, jsonify, g, send_from_directory
from supabase_client import get_client
from services.pdf_processor import process_pdf
from services.rag_service import store_chunks
from services.document_types import get_document_types
from auth import require_auth
from config import Config

documents_bp = Blueprint("documents", __name__, url_prefix="/api/documents")

STORAGE_BUCKET = "papers"

_VALID_DOC_TYPES = {opt["value"] for opt in get_document_types()}


def _local_dir_for(project_id):
    path = os.path.join(Config.UPLOAD_FOLDER, project_id)
    os.makedirs(path, exist_ok=True)
    return path


@documents_bp.post("/upload")
@require_auth
def upload_document():
    """
    multipart/form-data: file=<pdf>, project_id=<uuid>, document_type=<one of
    services.document_types.DOCUMENT_TYPE_OPTIONS values, e.g. "srs", "resume">
    Synchronous pipeline for demo purposes: parse -> chunk -> embed -> store.
    For production, move process_and_index() into a background job/queue.

    document_type is stored on the document row so that later analysis calls
    (see routes/analysis.py) know which prompt/function registry to use —
    see services/document_types.py and services/analysis_service.py.

    The file is uploaded to Supabase Storage (source of truth) AND saved to
    the local UPLOAD_FOLDER, so the PDF viewer can always display it via
    /api/documents/<id>/file regardless of the storage bucket's visibility.
    """
    project_id = request.form.get("project_id")
    file = request.files.get("file")
    document_type = (request.form.get("document_type") or "").strip()

    if not project_id or not file:
        return jsonify({"error": "project_id and file are required"}), 400
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported"}), 400
    if not document_type:
        return jsonify({"error": "document_type is required"}), 400
    if document_type not in _VALID_DOC_TYPES:
        return jsonify({
            "error": f"Unknown document_type '{document_type}'. "
                     f"Valid options: {sorted(_VALID_DOC_TYPES)}"
        }), 400

    client = get_client()

    # Confirm the project belongs to the requesting user before accepting the upload.
    owned = (
        client.table("projects")
        .select("id")
        .eq("id", project_id)
        .eq("user_id", g.user.id)
        .single()
        .execute()
    )
    if not owned.data:
        return jsonify({"error": "Project not found"}), 404

    pdf_bytes = file.read()
    doc_id = str(uuid.uuid4())
    safe_name = f"{doc_id}_{file.filename}"

    # 1. Save to Supabase Storage (primary, durable copy)
    storage_path = f"{project_id}/{safe_name}"
    client.storage.from_(STORAGE_BUCKET).upload(storage_path, pdf_bytes, {
        "content-type": "application/pdf",
    })

    # 2. Also save to the local uploads folder for fast/direct display
    local_dir = _local_dir_for(project_id)
    local_path = os.path.join(local_dir, safe_name)
    with open(local_path, "wb") as f:
        f.write(pdf_bytes)

    doc_row = client.table("documents").insert({
        "id": doc_id,
        "project_id": project_id,
        "title": file.filename.rsplit(".", 1)[0],
        "filename": file.filename,
        "storage_path": storage_path,
        "local_path": local_path,
        "document_type": document_type,
        "status": "processing",
    }).execute().data[0]

    try:
        result = process_pdf(pdf_bytes)
        store_chunks(doc_row["id"], result["chunks"])
        client.table("documents").update({
            "status": "ready",
            "page_count": result["page_count"],
            "outline": result["outline"],
        }).eq("id", doc_row["id"]).execute()
        doc_row.update({
            "status": "ready",
            "page_count": result["page_count"],
            "outline": result["outline"],
        })
    except Exception as exc:
        client.table("documents").update({"status": "failed"}).eq("id", doc_row["id"]).execute()
        return jsonify({"error": f"Processing failed: {exc}", "document": doc_row}), 500

    doc_row["pdf_url"] = f"/api/documents/{doc_row['id']}/file"
    return jsonify(doc_row), 201


@documents_bp.get("/<document_id>/file")
def serve_document_file(document_id):
    """Serves the locally-stored copy of the PDF for the viewer component."""
    client = get_client()
    result = (
        client.table("documents")
        .select("local_path, filename")
        .eq("id", document_id)
        .single()
        .execute()
    )
    doc = result.data
    if not doc or not doc.get("local_path") or not os.path.exists(doc["local_path"]):
        return jsonify({"error": "File not available locally"}), 404

    directory, filename = os.path.split(doc["local_path"])
    return send_from_directory(directory, filename, mimetype="application/pdf")


@documents_bp.get("/<document_id>")
def get_document(document_id):
    client = get_client()

    result = (
        client.table("documents")
        .select("*")
        .eq("id", document_id)
        .single()
        .execute()
    )
    document = result.data
    if document.get("local_path"):
        document["pdf_url"] = f"/api/documents/{document_id}/file"
    else:
        document["pdf_url"] = (
            client.storage.from_(STORAGE_BUCKET).get_public_url(document["storage_path"])
        )
    return jsonify(document)


@documents_bp.get("/<document_id>/status")
def document_status(document_id):
    """Lightweight endpoint for the frontend to poll during processing."""
    client = get_client()
    result = (
        client.table("documents")
        .select("id, status, page_count, outline")
        .eq("id", document_id)
        .single()
        .execute()
    )
    return jsonify(result.data)


@documents_bp.delete("/<document_id>")
@require_auth
def delete_document(document_id):
    client = get_client()

    doc = (
        client.table("documents")
        .select("local_path")
        .eq("id", document_id)
        .single()
        .execute()
        .data
    )
    if doc and doc.get("local_path") and os.path.exists(doc["local_path"]):
        try:
            os.remove(doc["local_path"])
        except OSError:
            pass

    client.table("documents").delete().eq("id", document_id).execute()
    return jsonify({"success": True})