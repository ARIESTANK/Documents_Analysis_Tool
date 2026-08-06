import os
import sys
import tempfile

import fitz

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.sdd_analyzer import analyze_sdd


def test_analyze_sdd_returns_expected_shape():
    text = """
    Introduction
    Purpose and Scope

    System Overview
    Design Goals

    Architecture
    Technology Stack
    """

    result = analyze_sdd(text)

    assert result["filename"] == "document.txt"
    assert "coverage_percent" in result
    assert "sections" in result
    assert "advice" in result
    assert "summary" in result
    assert isinstance(result["sections"], list)


def test_analyze_sdd_includes_diagram_analysis_for_pdf():
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as handle:
        temp_path = handle.name

    try:
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((72, 72), "Introduction\nPurpose and Scope")
        doc.save(temp_path)
        doc.close()

        result = analyze_sdd(file_path=temp_path, filename="sample.pdf")

        assert "diagram_analysis" in result
        assert "present" in result["diagram_analysis"]
        assert isinstance(result["diagram_analysis"]["present"], bool)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
