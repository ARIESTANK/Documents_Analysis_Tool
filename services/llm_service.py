"""
LLM Service
Wraps calls to Google Gemini (free tier) for: RAG chat answers, summaries,
section explanations, and multi-paper comparisons. Every prompt instructs the
model to only use the provided context and to cite page/section, which keeps
answers grounded.

Uses the current `google-genai` SDK (NOT the old, deprecated
`google-generativeai` package).
"""
import json
import re
from google import genai
from google.genai import types
from config import Config
from services.google_key_pool import google_api_key_pool

_clients: dict[str, genai.Client] = {}


def _mask_key(api_key: str) -> str:
    """Shorten a key for logs: enough to tell keys apart, not enough to leak them."""
    if len(api_key) <= 10:
        return "***"
    return f"{api_key[:6]}...{api_key[-4:]}"


def _get_client(api_key: str) -> genai.Client:
    """Cache one SDK client per key without exposing keys outside this module."""
    if api_key not in _clients:
        _clients[api_key] = genai.Client(api_key=api_key)
    return _clients[api_key]


def _rate_limit_delay_seconds(error: Exception) -> float | None:
    """Extract Gemini's optional RetryInfo delay without depending on SDK internals."""
    if getattr(error, "status_code", None) != 429:
        return None
    match = re.search(r"retry(?:Delay| in).*?(\d+(?:\.\d+)?)s", str(error), re.IGNORECASE)
    return float(match.group(1)) if match else 30


def _complete(system: str, user: str, json_mode: bool = False) -> str:
    config = types.GenerateContentConfig(
        system_instruction=system,
        response_mime_type="application/json" if json_mode else "text/plain",
    )
    last_error = None
    for api_key in google_api_key_pool.keys_for_request():
        print(f"[google-key-pool] using key {_mask_key(api_key)} for Gemini request")
        try:
            response = _get_client(api_key).models.generate_content(
                model=Config.GEMINI_MODEL,
                contents=user,
                config=config,
            )
            return response.text
        except Exception as exc:
            # A rate-limited, exhausted, or temporarily unavailable key should
            # not make the request fail while another key remains available.
            retry_after = _rate_limit_delay_seconds(exc)
            if retry_after is not None:
                google_api_key_pool.mark_rate_limited(api_key, retry_after)
                print(
                    f"[google-key-pool] key {_mask_key(api_key)} rate-limited, "
                    f"cooling down for {retry_after}s"
                )
            else:
                print(f"[google-key-pool] key {_mask_key(api_key)} failed: {exc}")
            last_error = exc

    raise RuntimeError("All configured Google API keys failed") from last_error


def generate(system: str, user: str, json_mode: bool = False) -> str:
    """Public entry point for generic prompt execution (used by analysis_service)."""
    return _complete(system, user, json_mode=json_mode)


def answer_question(question: str, retrieved_chunks: list[dict]) -> dict:
    """RAG chat answer. retrieved_chunks: [{content, page_number, section_title}, ...]"""
    context = "\n\n".join(
        f"[Chunk {i+1} | page {c['page_number']} | section: {c['section_title']}]\n{c['content']}"
        for i, c in enumerate(retrieved_chunks)
    )
    system = (
        "You are a research assistant answering questions about a specific academic paper. "
        "Only use the provided excerpts as your source of truth — never invent facts not present "
        "in them. If the excerpts don't contain the answer, say so plainly."
    )
    user = f"Paper excerpts:\n{context}\n\nQuestion: {question}"
    text = _complete(system, user)
    citations = [
        {"page": c["page_number"], "section": c["section_title"]}
        for c in retrieved_chunks
    ]
    return {"answer": text, "citations": citations}


def explain_section(section_title: str, section_text: str) -> str:
    system = (
        "You are a research assistant that explains dense academic text in plain, "
        "accessible language, using a helpful analogy where useful, without oversimplifying "
        "the technical substance."
    )
    user = f"Explain the following section ('{section_title}') in plain language:\n\n{section_text}"
    return _complete(system, user)


def generate_summary(document_title: str, chunks: list[dict]) -> dict:
    """Structured summary: problem / method / results / limitations / contributions."""
    context = "\n\n".join(c["content"] for c in chunks)
    system = (
        "You summarize academic papers into a strict JSON object with keys: "
        '"problem", "method", "results", "limitations", "key_contributions". '
        "Each value should be 1-3 concise sentences."
    )
    user = f"Paper title: {document_title}\n\nPaper content:\n{context[:20000]}"
    raw = _complete(system, user, json_mode=True)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "problem": raw, "method": "", "results": "",
            "limitations": "", "key_contributions": "",
        }


def compare_documents(documents: list[dict]) -> dict:
    """
    documents: [{"title": ..., "chunks": [...]}]
    Returns: {"rows": [{"criteria": ..., "values": {title: value, ...}}], "insight": "..."}
    """
    doc_blocks = []
    for doc in documents:
        text = " ".join(c["content"] for c in doc["chunks"])[:12000]
        doc_blocks.append(f"### {doc['title']}\n{text}")
    combined = "\n\n".join(doc_blocks)
    titles = [d["title"] for d in documents]

    system = (
        "You compare multiple academic papers and respond with a JSON object shaped as: "
        '{"rows": [{"criteria": "Dataset", "values": {"<paper title>": "...", ...}}, ...], '
        '"insight": "one short paragraph comparing trade-offs"}. '
        "Cover criteria such as Dataset, Model/Method, Key Metric or Accuracy, Strength, Limitation, "
        "Best Use Case. Use the exact paper titles provided as keys in 'values'."
    )
    user = f"Papers to compare: {titles}\n\n{combined}"
    raw = _complete(system, user, json_mode=True)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"rows": [], "insight": raw}