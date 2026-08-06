from flask import Blueprint, request, jsonify
from supabase_client import get_client
from services.rag_service import retrieve_relevant_chunks
from services.llm_service import answer_question, explain_section

chat_bp = Blueprint("chat", __name__, url_prefix="/api/chat")


@chat_bp.post("/<document_id>/ask")
def ask(document_id):
    body = request.get_json(force=True)
    question = (body or {}).get("question", "").strip()
    if not question:
        return jsonify({"error": "question is required"}), 400

    client = get_client()
    client.table("chat_messages").insert({
        "document_id": document_id, "role": "user", "content": question,
    }).execute()

    relevant_chunks = retrieve_relevant_chunks(document_id, question)
    result = answer_question(question, relevant_chunks)

    client.table("chat_messages").insert({
        "document_id": document_id,
        "role": "assistant",
        "content": result["answer"],
        "citations": result["citations"],
    }).execute()

    return jsonify(result)


@chat_bp.post("/<document_id>/explain-section")
def explain(document_id):
    body = request.get_json(force=True)
    section_title = (body or {}).get("section_title", "")
    section_text = (body or {}).get("section_text", "")
    if not section_text:
        return jsonify({"error": "section_text is required"}), 400

    explanation = explain_section(section_title, section_text)
    return jsonify({"section_title": section_title, "explanation": explanation})


@chat_bp.get("/<document_id>/history")
def history(document_id):
    client = get_client()
    result = (
        client.table("chat_messages")
        .select("*")
        .eq("document_id", document_id)
        .order("created_at")
        .execute()
    )
    return jsonify(result.data)
