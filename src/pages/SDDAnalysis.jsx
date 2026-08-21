import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  UploadCloud,
  FileText,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Image as ImageIcon,
  Circle,
  Loader2,
} from "lucide-react";

// Use the same backend base URL as the rest of the app (set via
// VITE_API_BASE_URL) instead of a hardcoded "/api" path — a hardcoded
// path resolves against this Vercel deployment, which has no backend,
// and Vercel's catch-all rewrite returns index.html instead of JSON.
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const API_ENDPOINT = `${API_BASE}/analyze-document`;
const DOCUMENT_TYPES_ENDPOINT = `${API_BASE}/document-types`;

const DOC_TYPE_OPTIONS = [
  { value: "textbook", label: "Textbook" },
  { value: "lecture", label: "Lecture Notes" },
  { value: "research_paper", label: "Research Paper" },
  { value: "srs", label: "SRS Document" },
  { value: "project_report", label: "Project Final Report" },
  { value: "thesis", label: "Thesis" },
  { value: "resume", label: "Resume" },
  { value: "business_report", label: "Business Report" },
  { value: "financial_report", label: "Financial Report" },
  { value: "technical_manual", label: "Technical Manual" },
  { value: "office_letter", label: "Office Letter (ရုံးစာ)" },
];

// Sections that can carry a diagram explanation from the backend.
// Must match DIAGRAM_LABEL_TO_SECTION_KEY's *values* in sdd_analyzer.py.
const DIAGRAM_SECTION_KEYS = new Set([
  "use_case",
  "class_diagram",
  "sequence_diagram",
  "state_diagram",
  "data_design",
  "system_flow",
]);

// The backend responds with one final JSON payload, so there's no live
// progress feed from the server. We show the pipeline as a checklist and
// step it forward on a timer while the request is in flight — each step
// pauses just before the end so it never claims "done" before the real
// response lands.
const PROCESS_STEPS = [
  { key: "upload", label: "Uploading document" },
  { key: "extract", label: "Extracting text" },
  { key: "analyze", label: "Analyzing content" },
  { key: "sections", label: "Matching sections" },
  { key: "finalize", label: "Preparing results" },
];

export default function SDDAnalyzer() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState("textbook");
  const [documentTypes, setDocumentTypes] = useState(DOC_TYPE_OPTIONS);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [stepIndex, setStepIndex] = useState(-1);
  const inputRef = useRef(null);
  const stepTimerRef = useRef(null);

  useEffect(() => {
    const loadDocumentTypes = async () => {
      try {
        const res = await fetch(DOCUMENT_TYPES_ENDPOINT);
        if (res.ok) {
          const data = await res.json();
          setDocumentTypes(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadDocumentTypes();
  }, []);

  const handleFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setFile(fileList[0]);
    setResult(null);
    setError("");
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  // Advance one step at a time on a timer. Stops one step short of the end
  // so the checklist never shows "finalize" done before the response
  // actually arrives — the finally block below completes it for real.
  const startStepProgress = () => {
    setStepIndex(0);
    clearInterval(stepTimerRef.current);
    stepTimerRef.current = setInterval(() => {
      setStepIndex((prev) => {
        const next = prev + 1;
        if (next >= PROCESS_STEPS.length - 1) {
          clearInterval(stepTimerRef.current);
          return PROCESS_STEPS.length - 1;
        }
        return next;
      });
    }, 900);
  };

  const stopStepProgress = (completed) => {
    clearInterval(stepTimerRef.current);
    setStepIndex(completed ? PROCESS_STEPS.length : -1);
  };

  useEffect(() => () => clearInterval(stepTimerRef.current), []);

  const onSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    startStepProgress();
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", docType);
      const res = await fetch(API_ENDPOINT, { method: "POST", body: formData });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();
      setResult(data);
      stopStepProgress(true);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Could not reach the backend. Is Flask running on :5000?"
          : err.message
      );
      stopStepProgress(false);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError("");
    setStepIndex(-1);
    clearInterval(stepTimerRef.current);
    if (inputRef.current) inputRef.current.value = "";
  };

  const sections = Array.isArray(result?.sections) ? result.sections : [];
  const clampedPct =
    typeof result?.coverage_percent === "number"
      ? Math.min(100, Math.max(0, result.coverage_percent))
      : null;
  const foundSections = sections.filter((s) => s.status === "found");
  const partialSections = sections.filter((s) => s.status === "partial");
  const missingSections = sections.filter((s) => s.status === "missing");

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <button
        onClick={() => navigate("/")}
        className="btn-press flex items-center gap-1.5 text-slate hover:text-ink text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back to projects
      </button>

      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-amber mb-1">
            Document intelligence
          </p>
          <h1 className="font-display text-3xl font-semibold text-ink">
            Document-Type AI Assistant
          </h1>
          <p className="text-slate text-sm mt-2 max-w-xl">
            Upload a PDF and pick the document category to activate the right AI pipeline for summaries, requirements, research analysis, and more.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 border border-rust/40 bg-rust/10 text-ink px-4 py-3 rounded-md text-sm animate-fade-in-up">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-[360px_1fr] gap-5">
        <div className="border border-rule bg-white/40 rounded-lg p-5">
          <h2 className="font-display text-lg font-semibold text-ink mb-4">
            Step 1: Upload PDF
          </h2>

          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={`border border-dashed rounded-md py-10 px-4 text-center cursor-pointer transition-all duration-200 ${
              dragActive ? "border-teal bg-teal/10 scale-[1.01] shadow-inner" : "border-rule hover:bg-white/60"
            }`}
          >
            <UploadCloud
              size={26}
              className={`mx-auto text-teal mb-3 transition-transform duration-300 ${dragActive ? "scale-125 -translate-y-1" : ""}`}
            />
            <p className="text-sm text-slate">
              <span className="text-ink font-medium">Click to upload</span> or drag a file here
            </p>
            <p className="text-xs font-mono text-slate/70 mt-1">PDF, DOCX, or TXT</p>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {file && (
            <div className="flex items-center gap-2 mt-4 border border-rule bg-white/60 rounded-md px-3 py-2 animate-scale-in">
              <FileText size={16} className="text-teal shrink-0" />
              <span className="font-mono text-xs text-ink truncate flex-1">{file.name}</span>
              <button onClick={reset} className="text-slate hover:text-ink shrink-0 transition-transform duration-200 hover:rotate-90" aria-label="Remove file">
                <X size={14} />
              </button>
            </div>
          )}

          <button
            onClick={onSubmit}
            disabled={!file || loading}
            className="btn-press w-full mt-5 bg-teal hover:bg-tealdark disabled:opacity-40 disabled:cursor-not-allowed text-parchment px-4 py-2.5 rounded-md font-medium transition-colors shadow-sm hover:shadow-md flex items-center justify-center gap-2"
          >
            {loading && (
              <span className="flex items-center gap-1">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </span>
            )}
            {loading ? "Analyzing…" : "Analyze document"}
          </button>
        </div>

        <div className="border border-rule bg-white/40 rounded-lg p-5 flex flex-col min-h-[420px] xl:h-[calc(100vh-220px)] min-w-0">
          <h2 className="font-display text-lg font-semibold text-ink mb-4 shrink-0">
            Analysis result
          </h2>

          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            {!result && !loading && (
              <div className="h-full flex items-center justify-center text-center px-6">
                <p className="text-sm text-slate max-w-xs">
                  Upload a document and click "Analyze document" to see its coverage breakdown here.
                </p>
              </div>
            )}

            {loading && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-ink">Processing</span>
                    <span className="text-xs font-mono text-teal">
                      Step {Math.min(stepIndex + 1, PROCESS_STEPS.length)} of {PROCESS_STEPS.length}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-rule/30 overflow-hidden">
                    <div
                      className="progress-fill h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${(Math.min(stepIndex + 1, PROCESS_STEPS.length) / PROCESS_STEPS.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <ul className="grid gap-2">
                  {PROCESS_STEPS.map((step, i) => {
                    const isDone = i < stepIndex;
                    const isActive = i === stepIndex;
                    return (
                      <li
                        key={step.key}
                        className={`flex items-center gap-2.5 border rounded-md px-3 py-2 transition-colors ${
                          isDone
                            ? "border-teal/30 bg-teal/10"
                            : isActive
                            ? "border-amber/40 bg-amber/10"
                            : "border-rule bg-white/40"
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 size={15} className="text-teal shrink-0" />
                        ) : isActive ? (
                          <Loader2 size={15} className="text-amber shrink-0 animate-spin" />
                        ) : (
                          <Circle size={15} className="text-slate/40 shrink-0" />
                        )}
                        <span
                          className={`text-sm ${
                            isDone ? "text-ink" : isActive ? "text-ink font-medium" : "text-slate/70"
                          }`}
                        >
                          {step.label}
                          {isDone && <span className="text-xs text-teal font-mono ml-2">done</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {result && (
              <div className="animate-fade-in-up">
                <p className="text-sm text-slate mb-4">
                  File: <span className="font-medium text-ink">{result.filename}</span>
                </p>

                {result.summary && (
                  <div className="rounded-md border border-rule bg-white/70 p-3 text-sm text-slate leading-relaxed">
                    {result.summary}
                  </div>
                )}

                {Array.isArray(result.advice) && result.advice.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {result.advice.map((tip, idx) => (
                      <li key={idx} className="text-sm text-slate">• {tip}</li>
                    ))}
                  </ul>
                )}

                {clampedPct !== null && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-ink">Coverage</span>
                      <span className="text-sm font-mono font-semibold text-teal">
                        {clampedPct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-rule/30 overflow-hidden">
                      <div
                        className="progress-fill h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${clampedPct}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate font-mono">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-teal" /> {foundSections.length} found
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertTriangle size={12} className="text-amber" /> {partialSections.length} partial
                      </span>
                      <span className="flex items-center gap-1">
                        <XCircle size={12} className="text-rust" /> {missingSections.length} missing
                      </span>
                    </div>
                  </div>
                )}

                {sections.length > 0 && (
                  <div className="mt-5 grid gap-2 pb-2">
                    {sections.map((section, si) => {
                      const isFound = section.status === "found";
                      const isPartial = section.status === "partial";
                      const Icon = isFound ? CheckCircle2 : isPartial ? AlertTriangle : XCircle;
                      const colorClass = isFound ? "text-teal" : isPartial ? "text-amber" : "text-rust";
                      const isDiagramSection = DIAGRAM_SECTION_KEYS.has(section.key);

                      return (
                        <div
                          key={section.key}
                          style={{ "--stagger-index": si + 1 }}
                          className="stagger-item animate-fade-in-up flex items-start gap-2.5 border border-rule bg-white/60 hover:bg-white/90 transition-colors rounded-md px-3 py-2"
                        >
                          <Icon size={15} className={`${colorClass} shrink-0 mt-0.5`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-ink font-medium">{section.label}</p>

                            {section.matched_heading ? (
                              <p className="text-xs text-slate mt-0.5 truncate">
                                Matched: "{section.matched_heading}"
                              </p>
                            ) : !section.matched_heading && section.status !== "found" ? (
                              <p className="text-xs text-slate/70 mt-0.5">
                                Not found in document
                              </p>
                            ) : (
                              <p className="text-xs text-slate mt-0.5 truncate">
                                Found in the document, but no specific heading matched.
                              </p>
                            )}

                            {/* Diagram explanation block — only for sections that can have a diagram */}
                            {isDiagramSection && (
                              <div className="mt-2 rounded-md bg-white/70 border border-rule/60 px-2.5 py-2">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <ImageIcon size={12} className="text-teal shrink-0" />
                                  <p className="text-[11px] font-mono uppercase tracking-wide text-teal">
                                    {section.diagram_explanation
                                      ? `Diagram found — page ${section.diagram_page}${
                                          typeof section.diagram_confidence === "number"
                                            ? ` (${Math.round(section.diagram_confidence * 100)}% confidence)`
                                            : ""
                                        }`
                                      : "Diagram check"}
                                  </p>
                                </div>

                                {section.diagram_explanation ? (
                                  <p className="text-xs text-slate leading-relaxed">
                                    {section.diagram_explanation}
                                  </p>
                                ) : section.diagram_explanation_available === false &&
                                  section.diagram_explanation_reason ? (
                                  <p className="text-xs text-slate/70 italic">
                                    Diagram not explained: {section.diagram_explanation_reason}
                                  </p>
                                ) : (
                                  <p className="text-xs text-slate/70 italic">
                                    No diagram detected for this section.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}