"""
Analysis Service
================
Given a document and a requested function_key, looks up the function's
definition in the document-type registry, builds a grounded prompt from the
document's chunks, calls Gemini, and returns a structured result.

This is the one place that turns "textbook + generate_quiz" or
"srs + missing_section_detection" into an actual model call — the registry
supplies *what* to ask, this module handles *how* to ask it.
"""
import json
from services.document_types import get_function_def
from services.rag_service import get_all_chunks
from services.llm_service import generate

MAX_CONTEXT_CHARS = 24000


def _build_context(document_id: str) -> str:
    chunks = get_all_chunks(document_id)
    text = "\n\n".join(c["content"] for c in chunks)
    return text[:MAX_CONTEXT_CHARS]


def run_analysis(document_id: str, document_title: str, doc_type: str, function_key: str) -> dict:
    fn_def = get_function_def(doc_type, function_key)
    if fn_def is None:
        raise ValueError(f"Unknown function '{function_key}' for document type '{doc_type}'")
    if fn_def.get("requires_multi_doc"):
        raise ValueError(fn_def["instruction"])  # explains to use the Compare tab instead

    context = _build_context(document_id)
    output_format = fn_def["output_format"]

    system_parts = [
        f"You are an expert analyst reviewing a document of type '{doc_type}'.",
        fn_def["instruction"],
        "Base your answer only on the provided document content — do not invent information "
        "that isn't supported by it.",
    ]
    if output_format == "json":
        system_parts.append(
            "Respond with ONLY a valid JSON object shaped as follows (no markdown fences, "
            f"no preamble): {fn_def.get('schema_hint', '')}"
        )
    system = " ".join(system_parts)
    user = f"Document title: {document_title}\n\nDocument content:\n{context}"

    raw = generate(system, user, json_mode=(output_format == "json"))

    if output_format == "json":
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = {"raw": raw, "parse_error": True}
        return {"function_key": function_key, "output_format": "json", "result": parsed}

    return {"function_key": function_key, "output_format": "text", "result": raw}