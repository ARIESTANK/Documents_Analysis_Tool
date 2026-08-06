"""
services/sdd_analyzer.py

Install dependencies first:
    pip install pdfplumber python-docx PyMuPDF google-generativeai torch torchvision Pillow

Analyzes an SDD/SRS document for standard section coverage. Non-diagram
sections (Introduction, Security, Testing, etc.) are found by text search.
Diagram-bearing sections (Use Case, Class, Sequence, State, Data Design,
System Flow) are found by searching PDF pages for images that visually
match that diagram type via a trained image classifier — not by
text-searching for phrases like "class diagram" — and, for each match,
asks Gemini's vision model to explain what the diagram actually depicts.

Response shape:
{
  "filename": str,
  "coverage_percent": float,
  "sections": [
      {
        "key", "label", "status", "matched_heading", "weight",
        "diagram_explanation": str | None,          # only for diagram-bearing sections
        "diagram_explanation_available": bool,
        "diagram_page": int | None,
        "diagram_confidence": float | None,
      }, ...
  ],
  "advice": [ str, ... ],
  "summary": str,
  "diagram_analysis": { ... raw diagram detection info ... }
}
"""

import io
import os
import re
import base64

from flask import request, jsonify
from services.google_key_pool import google_api_key_pool
from services.llm_service import _rate_limit_delay_seconds

# --- optional imports guarded so app.py doesn't crash if a lib is missing ---
try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    import docx  # python-docx
except ImportError:
    docx = None

try:
    import fitz
except ImportError:
    fitz = None

try:
    import torch
    import torch.nn as nn
    from PIL import Image
    from torchvision import models, transforms
except ImportError:
    torch = None
    nn = None
    Image = None
    models = None
    transforms = None

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None


# ---------------------------------------------------------------------------
# 1. Standard SDD/SRS section definitions
# ---------------------------------------------------------------------------
SDD_SECTIONS = [
    {
        "key": "introduction",
        "label": "Introduction / Purpose & Scope",
        "weight": 5,
        "patterns": [r"\bintroduction\b", r"\bpurpose\b", r"\bscope\b"],
        "advice": "Add an Introduction section stating the document's purpose, scope, and intended audience.",
    },
    {
        "key": "system_overview",
        "label": "System Overview / Design Goals",
        "weight": 6,
        "patterns": [r"system overview", r"design goals?", r"design rationale", r"assumptions"],
        "advice": "Include a System Overview describing design goals, constraints, and key architectural decisions.",
    },
    {
        "key": "system_flow",
        "label": "System Flow",
        "weight": 6,
        "patterns": [
            r"system flow",
            r"workflow",
            r"system workflow",
            r"process flow",
            r"business flow",
            r"execution flow",
            r"system process"
        ],
        "advice": "Include a System Flow section describing the overall workflow of the system from user input to system output.",
    },
    {
        "key": "use_case",
        "label": "Use Case Diagram / Actors",
        "weight": 7,
        "patterns": [r"use[\s-]?case", r"\bactors?\b"],
        "advice": "Include use case diagrams showing actors and their interactions with the system.",
    },
    {
        "key": "class_diagram",
        "label": "Class Diagram / Static Structure",
        "weight": 7,
        "patterns": [r"class diagram", r"class model"],
        "advice": "Add class diagrams to document the static structure of key modules (attributes, methods, relationships).",
    },
    {
        "key": "sequence_diagram",
        "label": "Sequence Diagrams",
        "weight": 9,
        "patterns": [r"sequence diagram", r"interaction diagram", r"message flow"],
        "advice": "Add sequence diagrams for critical flows (e.g., document ingestion, model inference, API request/response).",
    },
    {
        "key": "state_diagram",
        "label": "State / Activity Diagrams",
        "weight": 5,
        "patterns": [r"state diagram", r"activity diagram", r"workflow diagram", r"lifecycle"],
        "advice": "Document component lifecycles with state or activity diagrams (e.g., document status: uploaded → processing → analyzed).",
    },
    {
        "key": "data_design",
        "label": "Data Design (ER Diagram / Schema)",
        "weight": 9,
        "patterns": [r"\ber diagram\b", r"entity[\s-]?relationship", r"database schema", r"data dictionary", r"data model", r"database design"],
        "advice": "Add a Data Design section with an ER diagram, schema definitions, and a data dictionary.",
    },
    {
        "key": "interface_design",
        "label": "Interface Design (API / UI)",
        "weight": 8,
        "patterns": [r"\bapi\b", r"endpoint", r"interface design", r"user interface", r"\bui\b"],
        "advice": "Document API endpoints (request/response formats) and key UI screens or wireframes.",
    },
    {
        "key": "non_functional",
        "label": "Non-Functional Requirements",
        "weight": 8,
        "patterns": [r"performance requirements?", r"scalability", r"reliability", r"availability", r"non[\s-]?functional"],
        "advice": "Add Non-Functional Requirements covering performance, scalability, and reliability targets.",
    },
    {
        "key": "security",
        "label": "Security Design",
        "weight": 9,
        "patterns": [r"\bsecurity\b", r"authentication", r"authorization", r"encryption", r"\bgdpr\b", r"\bhipaa\b", r"\bpii\b"],
        "advice": "Add a Security Design section covering authentication, authorization, encryption, and data privacy compliance.",
    },
    {
        "key": "error_handling",
        "label": "Error Handling & Exceptions",
        "weight": 5,
        "patterns": [r"error handling", r"exception handling", r"fallback", r"retry logic"],
        "advice": "Describe error handling strategy: error codes, exception hierarchy, and fallback behavior.",
    },
    {
        "key": "testing",
        "label": "Testing Considerations",
        "weight": 4,
        "patterns": [r"test plan", r"testing considerations?", r"test scenarios?", r"unit test", r"integration test"],
        "advice": "Add a Testing Considerations section outlining key test scenarios per component.",
    },
]

FOUND_THRESHOLD = 1
PARTIAL_MIN = 0

# Maps the image classifier's output label -> the SDD_SECTIONS "key" it explains.
# Adjust these to match whatever label strings your trained classifier actually emits.
DIAGRAM_LABEL_TO_SECTION_KEY = {
    "use_case": "use_case",
    "use_case_diagram": "use_case",
    "class_diagram": "class_diagram",
    "class": "class_diagram",
    "sequence": "sequence_diagram",
    "sequence_diagram": "sequence_diagram",
    "state": "state_diagram",
    "state_diagram": "state_diagram",
    "activity": "state_diagram",
    "activity_diagram": "state_diagram",
    "state_activity_diagram": "state_diagram",
    "er_diagram": "data_design",
    "erd": "data_design",
    "data_model": "data_design",
    "system_flow": "system_flow",
    "system_flow_diagram": "system_flow",
    "flowchart": "system_flow",
}

_DIAGRAM_MODEL_CACHE = None
_GEMINI_CLIENTS = {}

GEMINI_MODEL_NAME = os.environ.get("GEMINI_VISION_MODEL", "gemini-1.5-flash")

# Below this, we don't even bother running a page/image through the
# per-image path if it's implausibly small (icons, logos, bullet glyphs
# embedded as raster images, etc. that would just add classifier noise).
MIN_EMBEDDED_IMAGE_DIMENSION = 120


# ---------------------------------------------------------------------------
# Diagram image classifier (torch)
# ---------------------------------------------------------------------------
def _resolve_diagram_model_path():
    candidate_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "model", "newmodel", "dataset", "dataset", "training_code", "runs", "diagram_classifier", "best_model.pt")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "model", "newmodel", "dataset", "dataset", "training_code", "runs", "diagram_classifier", "last_model.pt")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "model", "bext_model.pt")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "model", "best_model.pt")),
    ]
    for candidate in candidate_paths:
        if os.path.exists(candidate):
            return candidate
    return None


def _load_diagram_classifier():
    global _DIAGRAM_MODEL_CACHE
    if _DIAGRAM_MODEL_CACHE is not None:
        return _DIAGRAM_MODEL_CACHE

    if torch is None or nn is None or models is None or transforms is None or Image is None:
        _DIAGRAM_MODEL_CACHE = {"available": False, "reason": "torch/torchvision/Pillow not available"}
        return _DIAGRAM_MODEL_CACHE

    model_path = _resolve_diagram_model_path()
    if not model_path:
        _DIAGRAM_MODEL_CACHE = {"available": False, "reason": "diagram classifier checkpoint not found"}
        return _DIAGRAM_MODEL_CACHE

    try:
        checkpoint = torch.load(model_path, map_location="cpu", weights_only=False)
        class_to_idx = checkpoint.get("class_to_idx", {})
        idx_to_class = {index: label for label, index in class_to_idx.items()}

        arch = checkpoint.get("arch", "resnet18")
        img_size = checkpoint.get("img_size", 224)
        if arch == "resnet18":
            model = models.resnet18(weights=None)
            model.fc = nn.Linear(model.fc.in_features, len(class_to_idx))
        elif arch == "efficientnet_b0":
            model = models.efficientnet_b0(weights=None)
            model.classifier[1] = nn.Linear(model.classifier[1].in_features, len(class_to_idx))
        else:
            raise ValueError(f"Unsupported architecture: {arch}")

        model.load_state_dict(checkpoint["model_state_dict"], strict=True)
        model.eval()

        # NOTE: img_size must match what the checkpoint was actually trained
        # with (train.py's --img_size), not a hardcoded 224 — mismatching
        # this silently degrades accuracy instead of erroring.
        image_transform = transforms.Compose([
            transforms.Resize((img_size, img_size)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])

        _DIAGRAM_MODEL_CACHE = {
            "available": True,
            "model": model,
            "idx_to_class": idx_to_class,
            "transform": image_transform,
            "model_path": model_path,
            "img_size": img_size,
        }
    except Exception as exc:
        _DIAGRAM_MODEL_CACHE = {"available": False, "reason": f"failed to load classifier: {exc}"}

    return _DIAGRAM_MODEL_CACHE


# ---------------------------------------------------------------------------
# Gemini vision explanation
# ---------------------------------------------------------------------------
def _get_gemini_client(api_key):
    """Return a cached current-SDK client for an individual API key."""
    if genai is None:
        raise RuntimeError("google-genai is not installed")
    if api_key not in _GEMINI_CLIENTS:
        _GEMINI_CLIENTS[api_key] = genai.Client(api_key=api_key)
    return _GEMINI_CLIENTS[api_key]


def _explain_diagram_image(image_bytes, section_label, diagram_label, confidence):
    """Ask Gemini's vision model to explain what a detected diagram shows."""
    prompt = (
        f"This image is a diagram extracted from a Software Design Document. An "
        f"automated classifier detected a '{diagram_label}' diagram here with "
        f"{confidence * 100:.0f}% confidence, matching the '{section_label}' "
        f"section of an SDD.\n\n"
        f"Look at the image and, in 2-4 sentences, explain what this diagram "
        f"actually depicts: the key elements shown (e.g. actors, classes, "
        f"states, entities, steps) and how they relate to each other. "
        f"If the image does not actually look like a '{diagram_label}' "
        f"diagram, say so plainly and describe what it looks like instead. "
        f"Respond with plain text only, no markdown headers or bullet points."
    )

    last_error = None
    try:
        api_keys = google_api_key_pool.keys_for_request()
    except RuntimeError as exc:
        return {"available": False, "explanation": None, "reason": str(exc)}

    for api_key in api_keys:
        try:
            response = _get_gemini_client(api_key).models.generate_content(
                model=GEMINI_MODEL_NAME,
                contents=[prompt, types.Part.from_bytes(data=image_bytes, mime_type="image/png")],
                config=types.GenerateContentConfig(max_output_tokens=400, temperature=0.2),
            )
            text = (response.text or "").strip()
            if text:
                return {"available": True, "explanation": text, "reason": None}
            last_error = RuntimeError("Gemini returned an empty response")
        except Exception as exc:
            retry_after = _rate_limit_delay_seconds(exc)
            if retry_after is not None:
                google_api_key_pool.mark_rate_limited(api_key, retry_after)
            last_error = exc

    return {"available": False, "explanation": None, "reason": f"All Gemini keys failed: {last_error}"}


def _classify_image(classifier, pil_image):
    """Run the classifier on a single PIL image, return (label, confidence)."""
    tensor = classifier["transform"](pil_image.convert("RGB")).unsqueeze(0)
    with torch.no_grad():
        logits = classifier["model"](tensor)
        probs = torch.softmax(logits, dim=1).squeeze(0)
    confidence, index = probs.max(dim=0)
    label = classifier["idx_to_class"].get(index.item(), "unknown")
    return label, round(float(confidence.item()), 4)


def _iter_page_candidate_images(fitz_doc, page, page_number):
    """
    Yield (image_bytes_png, pil_image, source) candidates to classify for a
    page. Prefers embedded raster images (these are what the classifier was
    actually trained on: isolated diagrams, no surrounding body text) and
    only falls back to a full-page render when the page has no embedded
    images at all (e.g. a vector-drawn diagram with no raster source, or a
    scanned page).
    """
    embedded = page.get_images(full=True)
    yielded_any = False

    for img_info in embedded:
        xref = img_info[0]
        try:
            base = fitz_doc.extract_image(xref)
        except Exception:
            continue
        img_bytes = base.get("image")
        if not img_bytes:
            continue
        try:
            pil_image = Image.open(io.BytesIO(img_bytes))
        except Exception:
            continue
        w, h = pil_image.size
        if w < MIN_EMBEDDED_IMAGE_DIMENSION or h < MIN_EMBEDDED_IMAGE_DIMENSION:
            continue  # skip tiny icons/bullets/logos
        # normalize to PNG bytes for consistency (Gemini call, caching, etc.)
        buf = io.BytesIO()
        pil_image.convert("RGB").save(buf, format="PNG")
        yielded_any = True
        yield buf.getvalue(), pil_image, "embedded_image"

    if not yielded_any:
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        img_bytes = pix.tobytes("png")
        pil_image = Image.open(io.BytesIO(img_bytes))
        yield img_bytes, pil_image, "full_page_fallback"


def _analyze_pdf_for_diagrams(filepath):
    """Render PDF pages to images, classify them, and explain any diagrams found via Gemini."""
    classifier = _load_diagram_classifier()
    if not classifier.get("available"):
        return {
            "present": False,
            "detected_diagram_types": [],
            "page_predictions": [],
            "explanations_by_section": {},
            "best_hit_per_section": {},
            "reason": classifier.get("reason", "classifier unavailable"),
        }

    if fitz is None:
        return {
            "present": False,
            "detected_diagram_types": [],
            "page_predictions": [],
            "explanations_by_section": {},
            "best_hit_per_section": {},
            "reason": "PyMuPDF is not installed",
        }

    try:
        doc = fitz.open(filepath)
    except Exception as exc:
        return {
            "present": False,
            "detected_diagram_types": [],
            "page_predictions": [],
            "explanations_by_section": {},
            "best_hit_per_section": {},
            "reason": f"unable to open PDF: {exc}",
        }

    predictions = []
    detected_types = []
    # section_key -> best {confidence, image_bytes, diagram_label, page} seen so far
    best_hit_per_section = {}

    try:
        for page_number, page in enumerate(doc, start=1):
            try:
                for image_bytes, pil_image, source in _iter_page_candidate_images(doc, page, page_number):
                    label, confidence_value = _classify_image(classifier, pil_image)
                    predictions.append({
                        "page": page_number,
                        "label": label,
                        "confidence": confidence_value,
                        "source": source,
                    })

                    if confidence_value >= 0.65 and label != "unknown":
                        detected_types.append(label)

                    if label != "unknown":
                        section_key = DIAGRAM_LABEL_TO_SECTION_KEY.get(label)
                        if section_key:
                            current_best = best_hit_per_section.get(section_key)
                            if current_best is None or confidence_value > current_best["confidence"]:
                                best_hit_per_section[section_key] = {
                                    "confidence": confidence_value,
                                    "image_bytes": image_bytes,
                                    "diagram_label": label,
                                    "page": page_number,
                                }
            except Exception:
                continue
    finally:
        doc.close()

    # Generate a Gemini explanation for the strongest diagram match per section
    # (skip low-confidence hits — they're still used for section status below,
    # but aren't worth a vision API call).
    explanations_by_section = {}
    section_label_by_key = {s["key"]: s["label"] for s in SDD_SECTIONS}
    for section_key, hit in best_hit_per_section.items():
        if hit["confidence"] < 0.65:
            continue
        section_label = section_label_by_key.get(section_key, section_key)
        vision_result = _explain_diagram_image(
            hit["image_bytes"], section_label, hit["diagram_label"], hit["confidence"]
        )
        explanations_by_section[section_key] = {
            "page": hit["page"],
            "diagram_label": hit["diagram_label"],
            "confidence": hit["confidence"],
            "explanation": vision_result["explanation"],
            "explanation_available": vision_result["available"],
            "explanation_reason": vision_result["reason"],
        }

    return {
        "present": bool(detected_types),
        "detected_diagram_types": detected_types,
        "page_predictions": predictions,
        "explanations_by_section": explanations_by_section,
        "best_hit_per_section": {
            key: {"confidence": hit["confidence"], "page": hit["page"], "diagram_label": hit["diagram_label"]}
            for key, hit in best_hit_per_section.items()
        },
        "model_path": classifier.get("model_path"),
    }


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------
def _extract_text(filepath, filename):
    ext = os.path.splitext(filename)[1].lower()

    if ext == ".pdf":
        if pdfplumber is not None:
            text_parts = []
            with pdfplumber.open(filepath) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text() or ""
                    text_parts.append(page_text)
            return "\n".join(text_parts)

        if fitz is None:
            raise RuntimeError("pdfplumber and PyMuPDF are not installed. Run: pip install pdfplumber or pip install PyMuPDF")

        text_parts = []
        with fitz.open(filepath) as pdf:
            for page in pdf:
                text_parts.append(page.get_text())
        return "\n".join(text_parts)

    if ext in (".docx", ".doc"):
        if docx is None:
            raise RuntimeError("python-docx is not installed. Run: pip install python-docx")
        d = docx.Document(filepath)
        return "\n".join(p.text for p in d.paragraphs)

    if ext == ".txt":
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

    raise ValueError(f"Unsupported file type: {ext}")


def _find_matching_heading(text_lines, pattern):
    regex = re.compile(pattern, re.IGNORECASE)
    for line in text_lines:
        stripped = line.strip()
        if not stripped or len(stripped) > 90:
            continue
        if regex.search(stripped):
            return stripped
    return None


DIAGRAM_FOUND_CONFIDENCE = 0.65
DIAGRAM_PARTIAL_CONFIDENCE = 0.5


def _analyze_text(text, diagram_hits=None):
    """Determine section coverage.

    Non-diagram sections (Introduction, Security, Testing, etc.) are found
    by searching the document TEXT for their standard headings/terms.

    Diagram-bearing sections (Use Case, Class, Sequence, State, Data Design,
    System Flow) are found ONLY by searching for PAGES whose *image* matches
    that diagram type — via the trained image classifier in
    `_analyze_pdf_for_diagrams` — never by text-searching for the phrase
    "class diagram" etc. `diagram_hits` is the `best_hit_per_section` map
    produced there: {section_key: {confidence, page, diagram_label}}. A
    caption mentioning a diagram does not count; only an actual matching
    diagram image does. When `diagram_hits` is None or empty (e.g. the
    uploaded file isn't a PDF, so there are no page images to search), these
    sections are reported as "missing" — there is no text fallback.
    """
    lines = text.splitlines()
    lower_text = text.lower()
    diagram_section_keys = set(DIAGRAM_LABEL_TO_SECTION_KEY.values())
    diagram_hits = diagram_hits or {}

    sections_result = []
    total_weight = 0
    earned_weight = 0
    missing_labels = []

    for section in SDD_SECTIONS:
        total_weight += section["weight"]
        is_diagram_section = section["key"] in diagram_section_keys
        matched_heading = None

        if is_diagram_section:
            hit = diagram_hits.get(section["key"])
            confidence = hit["confidence"] if hit else 0.0
            if confidence >= DIAGRAM_FOUND_CONFIDENCE:
                status = "found"
                earned_weight += section["weight"]
                matched_heading = (
                    f"Similar '{hit['diagram_label']}' diagram found on page "
                    f"{hit['page']} ({confidence * 100:.0f}% match)"
                )
            elif confidence >= DIAGRAM_PARTIAL_CONFIDENCE:
                status = "partial"
                earned_weight += section["weight"] * 0.6
                matched_heading = (
                    f"Possible '{hit['diagram_label']}' diagram on page "
                    f"{hit['page']} ({confidence * 100:.0f}% match, below the "
                    f"{DIAGRAM_FOUND_CONFIDENCE * 100:.0f}% confidence needed)"
                )
            else:
                status = "missing"
        else:
            match_count = sum(
                1 for p in section["patterns"] if re.search(p, lower_text, re.IGNORECASE)
            )
            if match_count >= FOUND_THRESHOLD:
                status = "found" if match_count > 1 else "partial"
                earned_weight += section["weight"] if status == "found" else section["weight"] * 0.6
            else:
                status = "missing"

            if status != "missing":
                for pattern in section["patterns"]:
                    matched_heading = _find_matching_heading(lines, pattern)
                    if matched_heading:
                        break

        sections_result.append({
            "key": section["key"],
            "label": section["label"],
            "status": status,
            "matched_heading": matched_heading,
            "weight": section["weight"],
            "detection_method": "diagram_similarity" if is_diagram_section else "text_search",
        })

        if status != "found":
            missing_labels.append(section)

    coverage_percent = round((earned_weight / total_weight) * 100, 1) if total_weight else 0.0

    missing_labels.sort(key=lambda s: s["weight"], reverse=True)
    advice = [s["advice"] for s in missing_labels[:8]]

    if coverage_percent >=65:
        summary = "Strong coverage. The document follows standard SDD structure closely; remaining gaps are minor."
    elif coverage_percent >= 40:
        summary = "Moderate coverage. Core sections are present, but several important design areas need more detail."
    elif coverage_percent >= 25:
        summary = "Partial coverage. Significant structural gaps found against standard SDD conventions."
    else:
        summary = "Low coverage. This document is missing most of the sections expected in a standard SDD."

    return coverage_percent, sections_result, advice, summary


# ---------------------------------------------------------------------------
# Public entrypoint
# ---------------------------------------------------------------------------
def analyze_sdd(text=None, filename="document.txt", file_path=None):
    """Analyze document text or a file path and return the frontend-friendly payload."""
    if file_path is not None:
        filename = filename or os.path.basename(file_path)
        text = _extract_text(file_path, filename)
    elif text is None:
        raise ValueError("Either text or file_path must be provided")

    if not text or not text.strip():
        raise ValueError("Could not extract any text from the document")

    diagram_analysis = {
        "present": False,
        "detected_diagram_types": [],
        "page_predictions": [],
        "explanations_by_section": {},
        "best_hit_per_section": {},
        "reason": "no PDF provided",
    }
    is_pdf = file_path is not None and os.path.splitext(filename or "")[1].lower() == ".pdf"
    if is_pdf:
        diagram_analysis = _analyze_pdf_for_diagrams(file_path)

    # For PDFs, diagram-bearing sections are judged by image similarity
    # (best_hit_per_section) instead of text search; for non-PDFs there are
    # no page images to compare, so pass None and those sections fall back
    # to text search inside _analyze_text.
    diagram_hits = diagram_analysis.get("best_hit_per_section") if is_pdf else None
    coverage_percent, sections_result, advice, summary = _analyze_text(text, diagram_hits=diagram_hits)

    # Attach diagram explanations onto their matching sections
    explanations_by_section = diagram_analysis.get("explanations_by_section", {})
    diagram_section_keys = set(DIAGRAM_LABEL_TO_SECTION_KEY.values())
    for section in sections_result:
        if section["key"] not in diagram_section_keys:
            continue
        hit = explanations_by_section.get(section["key"])
        if hit:
            section["diagram_explanation"] = hit["explanation"]
            section["diagram_explanation_available"] = hit["explanation_available"]
            section["diagram_explanation_reason"] = hit["explanation_reason"]
            section["diagram_page"] = hit["page"]
            section["diagram_confidence"] = hit["confidence"]
        else:
            section["diagram_explanation"] = None
            section["diagram_explanation_available"] = False
            section["diagram_explanation_reason"] = None
            section["diagram_page"] = None
            section["diagram_confidence"] = None

    return {
        "filename": filename,
        "coverage_percent": coverage_percent,
        "sections": sections_result,
        "advice": advice,
        "summary": summary,
        "diagram_analysis": diagram_analysis,
    }


def register_document_analysis_route(app, upload_dir="/tmp/doc_uploads"):
    """Optional: register directly on a Flask app instead of using the blueprint file."""
    os.makedirs(upload_dir, exist_ok=True)

    @app.route("/api/analyze-document", methods=["POST"])
    def analyze_document():
        if "file" not in request.files:
            return jsonify({"error": "No file part in request"}), 400

        uploaded = request.files["file"]
        if uploaded.filename == "":
            return jsonify({"error": "No file selected"}), 400

        filename = uploaded.filename
        ext = os.path.splitext(filename)[1].lower()
        if ext not in (".pdf", ".docx", ".doc", ".txt"):
            return jsonify({"error": f"Unsupported file type: {ext}"}), 400

        temp_path = os.path.join(upload_dir, filename)
        uploaded.save(temp_path)

        try:
            result = analyze_sdd(file_path=temp_path, filename=filename)
            return jsonify(result)
        except RuntimeError as e:
            return jsonify({"error": str(e)}), 500
        except Exception as e:
            return jsonify({"error": f"Analysis failed: {str(e)}"}), 500
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    return analyze_document