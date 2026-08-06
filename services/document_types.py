"""Registry of document-type-specific AI analysis functions."""

DOCUMENT_TYPE_OPTIONS = [
    {"value": "textbook", "label": "Textbook", "description": "Summaries, concept explanations, quizzes, and flashcards."},
    {"value": "lecture", "label": "Lecture Notes", "description": "Lecture summaries, key concepts, and study aids."},
    {"value": "research_paper", "label": "Research Paper", "description": "Abstracts, methodologies, datasets, and gap detection."},
    {"value": "srs", "label": "SRS Document", "description": "Requirements extraction, analysis, and test case generation."},
    {"value": "project_report", "label": "Project Final Report", "description": "Executive summary, milestone review, and recommendations."},
    {"value": "thesis", "label": "Thesis", "description": "Chapter summaries, contributions, and literature gap analysis."},
    {"value": "resume", "label": "Resume", "description": "Skill extraction, experience summaries, and ATS guidance."},
    {"value": "business_report", "label": "Business Report", "description": "Executive insight, KPI extraction, and recommendations."},
    {"value": "financial_report", "label": "Financial Report", "description": "Revenue, expense, ratio, and risk analysis."},
    {"value": "technical_manual", "label": "Technical Manual", "description": "Setup guidance, troubleshooting, and dependency extraction."},
]

FUNCTION_REGISTRY = {
    "textbook": [
        {"key": "summarize_chapters", "label": "Summarize chapters", "instruction": "Create a concise chapter-by-chapter summary of the textbook content.", "output_format": "text"},
        {"key": "explain_concepts", "label": "Explain concepts", "instruction": "Explain the most important concepts in simple, educational language.", "output_format": "text"},
        {"key": "generate_quiz", "label": "Generate quiz", "instruction": "Generate a short quiz with questions and answers based on the chapter content.", "output_format": "json"},
        {"key": "generate_flashcards", "label": "Generate flashcards", "instruction": "Create flashcard-style question and answer pairs from the text.", "output_format": "json"},
        {"key": "extract_definitions", "label": "Extract definitions", "instruction": "Extract key terms and definitions mentioned in the document.", "output_format": "json"},
    ],
    "lecture": [
        {"key": "summarize_lecture", "label": "Summarize lecture", "instruction": "Summarize the lecture notes into a concise set of learning points.", "output_format": "text"},
        {"key": "extract_key_concepts", "label": "Extract key concepts", "instruction": "List the core concepts and their explanations.", "output_format": "json"},
        {"key": "generate_quiz", "label": "Generate quiz", "instruction": "Generate a short quiz from the lecture content.", "output_format": "json"},
        {"key": "generate_flashcards", "label": "Generate flashcards", "instruction": "Create flashcards for the key lecture points.", "output_format": "json"},
    ],
    "research_paper": [
        {"key": "abstract_summary", "label": "Abstract summary", "instruction": "Summarize the paper's abstract and the central claim in plain language.", "output_format": "text"},
        {"key": "methodology_extraction", "label": "Methodology extraction", "instruction": "Extract the methodology, model, and experimental approach described in the paper.", "output_format": "json"},
        {"key": "dataset_extraction", "label": "Dataset extraction", "instruction": "Extract the datasets, benchmarks, and evaluation sources referenced in the paper.", "output_format": "json"},
        {"key": "result_analysis", "label": "Result analysis", "instruction": "Summarize the main results, metrics, and takeaways from the paper.", "output_format": "text"},
        {"key": "research_gap_detection", "label": "Research gap detection", "instruction": "Identify likely gaps, limitations, or open questions in the paper.", "output_format": "text"},
        {"key": "paper_comparison", "label": "Paper comparison", "instruction": "Compare the paper against common baseline or prior work themes if present.", "output_format": "text"},
    ],
    "srs": [
        {"key": "requirement_extraction", "label": "Requirement extraction", "instruction": "Extract the functional and business requirements described in the document.", "output_format": "json"},
        {"key": "functional_requirement_analysis", "label": "Functional requirement analysis", "instruction": "Analyze the functional requirements and summarize their intent and dependencies.", "output_format": "text"},
        {"key": "non_functional_requirement_analysis", "label": "Non-functional requirement analysis", "instruction": "Summarize the non-functional requirements such as performance, scalability, security, and reliability.", "output_format": "text"},
        {"key": "missing_section_detection", "label": "Missing section detection", "instruction": "Review the document for missing SRS sections and highlight them clearly.", "output_format": "text"},
        {"key": "uml_diagram_coverage", "label": "UML diagram coverage", "instruction": "Check whether the document covers relevant UML and workflow diagrams.", "output_format": "text"},
        {"key": "generate_test_cases", "label": "Generate test cases", "instruction": "Generate a set of high-value test cases based on the documented requirements.", "output_format": "json"},
    ],
    "project_report": [
        {"key": "executive_summary", "label": "Executive summary", "instruction": "Produce an executive summary of the project report.", "output_format": "text"},
        {"key": "milestone_analysis", "label": "Milestone analysis", "instruction": "Summarize milestones, progress, and deliverables from the report.", "output_format": "text"},
        {"key": "risk_assessment", "label": "Risk assessment", "instruction": "Identify risks, blockers, and mitigation recommendations.", "output_format": "text"},
        {"key": "stakeholder_summary", "label": "Stakeholder summary", "instruction": "Summarize stakeholder concerns, roles, and impact from the document.", "output_format": "text"},
    ],
    "thesis": [
        {"key": "thesis_overview", "label": "Thesis overview", "instruction": "Create a concise overview of the thesis topic, goal, and contribution.", "output_format": "text"},
        {"key": "chapter_summary", "label": "Chapter summary", "instruction": "Summarize each chapter or major section in order.", "output_format": "text"},
        {"key": "contribution_summary", "label": "Contribution summary", "instruction": "Extract the main contributions and novelty of the thesis.", "output_format": "text"},
        {"key": "literature_gap", "label": "Literature gap", "instruction": "Identify the research gap and its importance.", "output_format": "text"},
    ],
    "resume": [
        {"key": "skill_extraction", "label": "Skill extraction", "instruction": "Extract technical and professional skills from the resume.", "output_format": "json"},
        {"key": "experience_summary", "label": "Experience summary", "instruction": "Summarize the experience and accomplishments in a concise profile.", "output_format": "text"},
        {"key": "ats_recommendations", "label": "ATS recommendations", "instruction": "Suggest improvements for ATS readability and keyword coverage.", "output_format": "text"},
    ],
    "business_report": [
        {"key": "executive_summary", "label": "Executive summary", "instruction": "Draft an executive summary focused on the main evidence and outcomes.", "output_format": "text"},
        {"key": "kpi_extraction", "label": "KPI extraction", "instruction": "Extract the KPIs, metrics, and performance signals from the report.", "output_format": "json"},
        {"key": "recommendations", "label": "Recommendations", "instruction": "Generate practical business recommendations from the report.", "output_format": "text"},
    ],
    "financial_report": [
        {"key": "revenue_analysis", "label": "Revenue analysis", "instruction": "Summarize revenue drivers and trends in the financial report.", "output_format": "text"},
        {"key": "expense_analysis", "label": "Expense analysis", "instruction": "Summarize major expenses, cost drivers, and anomalies.", "output_format": "text"},
        {"key": "ratio_analysis", "label": "Ratio analysis", "instruction": "Highlight key financial ratios and what they suggest.", "output_format": "text"},
        {"key": "risk_assessment", "label": "Risk assessment", "instruction": "Identify financial and operational risks highlighted in the report.", "output_format": "text"},
    ],
    "technical_manual": [
        {"key": "setup_summary", "label": "Setup summary", "instruction": "Summarize the setup and installation steps in the manual.", "output_format": "text"},
        {"key": "troubleshooting_steps", "label": "Troubleshooting steps", "instruction": "Extract troubleshooting guidance and likely remedies.", "output_format": "json"},
        {"key": "component_explanation", "label": "Component explanation", "instruction": "Explain the main components and how they relate to each other.", "output_format": "text"},
        {"key": "dependency_extraction", "label": "Dependency extraction", "instruction": "Extract dependencies, prerequisites, and required tools.", "output_format": "json"},
    ],
}


def get_document_types():
    return DOCUMENT_TYPE_OPTIONS


def get_available_functions(doc_type: str):
    return FUNCTION_REGISTRY.get(doc_type, [])


def get_function_def(doc_type: str, function_key: str):
    for fn in get_available_functions(doc_type):
        if fn["key"] == function_key:
            return fn
    return None
