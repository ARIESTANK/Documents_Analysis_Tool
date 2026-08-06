from flask import Blueprint, request, jsonify
from supabase_client import get_client
from services.rag_service import get_all_chunks
from services.llm_service import compare_documents

compare_bp = Blueprint("compare", __name__, url_prefix="/api/compare")


@compare_bp.post("")
def compare():
    body = request.get_json(force=True)
    document_ids = (body or {}).get("document_ids", [])
    project_id = (body or {}).get("project_id")
    if len(document_ids) < 2:
        return jsonify({"error": "Select at least 2 documents to compare"}), 400

    client = get_client()
    documents = []
    for doc_id in document_ids:
        doc = client.table("documents").select("title").eq("id", doc_id).single().execute().data
        chunks = get_all_chunks(doc_id)
        documents.append({"title": doc["title"], "chunks": chunks})

    result = compare_documents(documents)

    client.table("comparisons").insert({
        "project_id": project_id,
        "document_ids": document_ids,
        "comparison_table": result.get("rows", []),
        "ai_insight": result.get("insight", ""),
    }).execute()

    return jsonify(result)
