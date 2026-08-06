"""
PDF Processor
- Extracts text per page with PyMuPDF
- Falls back to OCR (pytesseract) for image-only pages
- Cleans headers/footers/reference clutter
- Detects section headings (Abstract, Introduction, Methods, Results, ...)
- Splits into overlapping, section-aware chunks ready for embedding
"""
import re
import io
import fitz  # PyMuPDF
from config import Config

SECTION_PATTERNS = [
    r"abstract", r"introduction", r"related work", r"background",
    r"method(ology)?", r"materials and methods", r"proposed (approach|method|model)",
    r"experiment(s)?", r"result(s)?", r"discussion", r"evaluation",
    r"conclusion(s)?", r"limitations", r"future work", r"references",
]
SECTION_RE = re.compile(
    r"^\s*(\d{1,2}[\.\)]?\s*)?(" + "|".join(SECTION_PATTERNS) + r")\s*$",
    re.IGNORECASE,
)


def extract_pages(pdf_bytes: bytes):
    """Returns a list of {page_number, text} using text extraction, with OCR fallback."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for i, page in enumerate(doc):
        text = page.get_text("text").strip()
        if len(text) < 30:  # likely a scanned/image page — try OCR
            text = _ocr_page(page)
        pages.append({"page_number": i + 1, "text": text})
    doc.close()
    return pages


def _ocr_page(page) -> str:
    try:
        import pytesseract
        from PIL import Image

        pix = page.get_pixmap(dpi=200)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        return pytesseract.image_to_string(img).strip()
    except Exception:
        # OCR engine not installed / available — skip gracefully
        return ""


def clean_text(text: str) -> str:
    lines = text.split("\n")
    cleaned = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if re.fullmatch(r"\d{1,4}", stripped):          # bare page numbers
            continue
        if re.fullmatch(r"page\s*\d+(\s*of\s*\d+)?", stripped, re.IGNORECASE):
            continue
        cleaned.append(stripped)
    text = " ".join(cleaned)
    text = re.sub(r"-\s+", "", text)          # de-hyphenate broken words
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text


def detect_outline(pages: list) -> list:
    """Very lightweight heading detector: scans short standalone lines against SECTION_RE."""
    outline = []
    for page in pages:
        for raw_line in page["text"].split("\n"):
            line = raw_line.strip()
            if 2 <= len(line) <= 60 and SECTION_RE.match(line):
                outline.append({"title": line.title(), "page": page["page_number"]})
    # de-duplicate consecutive repeats
    deduped = []
    seen = set()
    for item in outline:
        key = item["title"].lower()
        if key not in seen:
            deduped.append(item)
            seen.add(key)
    return deduped


def _current_section(outline: list, page_number: int) -> str:
    section = "Body"
    for item in outline:
        if item["page"] <= page_number:
            section = item["title"]
        else:
            break
    return section


def chunk_document(pages: list, outline: list) -> list:
    """
    Token-approximate chunking (word-count based, ~4 chars/token heuristic)
    aligned loosely to section boundaries, with overlap for retrieval quality.
    """
    chunk_size = Config.CHUNK_SIZE_TOKENS
    overlap = Config.CHUNK_OVERLAP_TOKENS

    full_words = []
    for page in pages:
        cleaned = clean_text(page["text"])
        for word in cleaned.split(" "):
            if word:
                full_words.append((word, page["page_number"]))

    chunks = []
    i = 0
    idx = 0
    while i < len(full_words):
        window = full_words[i:i + chunk_size]
        if not window:
            break
        content = " ".join(w for w, _ in window)
        start_page = window[0][1]
        section_title = _current_section(outline, start_page)
        chunks.append({
            "chunk_index": idx,
            "content": content,
            "page_number": start_page,
            "section_title": section_title,
        })
        idx += 1
        i += max(chunk_size - overlap, 1)
    return chunks


def process_pdf(pdf_bytes: bytes) -> dict:
    """Full pipeline: parse -> clean -> outline -> chunk. Returns everything the caller needs."""
    pages = extract_pages(pdf_bytes)
    outline = detect_outline(pages)
    chunks = chunk_document(pages, outline)
    return {
        "page_count": len(pages),
        "outline": outline,
        "chunks": chunks,
    }
