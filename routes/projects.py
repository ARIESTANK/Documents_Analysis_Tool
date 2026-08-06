from flask import Blueprint, request, jsonify, g
from supabase_client import get_client
from auth import require_auth

projects_bp = Blueprint("projects", __name__, url_prefix="/api/projects")
STORAGE_BUCKET = "papers"


@projects_bp.get("")
@require_auth
def list_projects():
    client = get_client()
    result = (
        client.table("projects")
        .select("*")
        .eq("user_id", g.user.id)
        .order("created_at", desc=True)
        .execute()
    )
    return jsonify(result.data)


@projects_bp.post("")
@require_auth
def create_project():
    body = request.get_json(force=True)
    name = (body or {}).get("name", "").strip()
    description = (body or {}).get("description", "")
    if not name:
        return jsonify({"error": "Project name is required"}), 400

    client = get_client()
    result = client.table("projects").insert({
        "user_id": g.user.id,
        "name": name,
        "description": description,
    }).execute()
    return jsonify(result.data[0]), 201


@projects_bp.get("/<project_id>")
@require_auth
def get_project(project_id):
    client = get_client()

    project = (
        client.table("projects")
        .select("*")
        .eq("id", project_id)
        .eq("user_id", g.user.id)
        .single()
        .execute()
    )
    if not project.data:
        return jsonify({"error": "Project not found"}), 404

    documents_result = (
        client.table("documents")
        .select("*")
        .eq("project_id", project_id)
        .execute()
    )
    documents = []
    for doc in documents_result.data or []:
        doc = dict(doc)
        storage_path = doc.get("storage_path", "")

        # Prefer the locally-served copy (works regardless of bucket
        # visibility); fall back to the Supabase Storage public URL.
        if doc.get("local_path"):
            doc["pdf_url"] = f"/api/documents/{doc['id']}/file"
        else:
            try:
                url_result = client.storage.from_(STORAGE_BUCKET).get_public_url(storage_path)
                pdf_url = url_result if isinstance(url_result, str) else (
                    url_result.get("publicUrl") or url_result.get("publicURL", "")
                )
            except Exception as e:
                print(f"[storage] Failed to get URL for {storage_path}: {e}")
                pdf_url = None
            doc["pdf_url"] = pdf_url

        documents.append(doc)

    return jsonify({"project": project.data, "documents": documents})


@projects_bp.delete("/<project_id>")
@require_auth
def delete_project(project_id):
    client = get_client()
    client.table("projects").delete().eq("id", project_id).eq("user_id", g.user.id).execute()
    return jsonify({"success": True})
