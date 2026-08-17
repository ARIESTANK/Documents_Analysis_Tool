import { useRef, useState } from "react";
import { UploadCloud, Loader2, CheckCircle2 } from "lucide-react";
import { uploadDocument } from "../api/client.js";
import { useToast } from "../context/ToastContext.jsx";

const DOC_CATEGORIES = [
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

export default function UploadZone({ projectId, onUploaded }) {
  const inputRef = useRef(null);
  const toast = useToast();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState("");
  const [error, setError] = useState("");
  const [docCategory, setDocCategory] = useState("textbook");
  const [justDone, setJustDone] = useState(false);

  const handleFiles = async (files) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      toast.error("Only PDF files are supported.");
      return;
    }
    setError("");
    setUploading(true);
    setProgress(0);
    setStageLabel("Uploading file…");

    try {
      const doc = await uploadDocument(projectId, file, docCategory, (pct) => {
        setProgress(pct);
        if (pct >= 100) setStageLabel("Parsing, chunking & embedding…");
      });
      setUploading(false);
      setJustDone(true);
      toast.success(`"${doc.title}" uploaded successfully`);
      setTimeout(() => setJustDone(false), 1400);
      onUploaded(doc);
    } catch (err) {
      const msg = err?.response?.data?.error || "Upload failed. Check the backend logs.";
      setError(msg);
      toast.error(msg);
      setUploading(false);
    } finally {
      setProgress(0);
      setStageLabel("");
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
        dragOver
          ? "border-amber bg-amber/10 scale-[1.01] shadow-inner"
          : justDone
          ? "border-teal bg-teal/10 animate-success-ring"
          : "border-rule bg-white/30"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {uploading ? (
        <div className="py-3 animate-fade-in">
          <Loader2 className="mx-auto mb-3 text-teal animate-spin" size={26} />
          <p className="text-sm font-medium text-ink mb-1 transition-all duration-300">{stageLabel}</p>
          <p className="text-xs font-mono text-slate mb-1">{Math.round(progress)}%</p>
          <div className="w-full bg-rule/40 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="progress-fill h-1.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(progress, 6)}%` }}
            />
          </div>
        </div>
      ) : justDone ? (
        <div className="py-3 animate-pop-in">
          <CheckCircle2 className="mx-auto mb-2 text-teal" size={26} />
          <p className="text-sm font-medium text-ink">Ready — parsing complete</p>
        </div>
      ) : (
        <>
          <UploadCloud
            className={`mx-auto mb-2 text-teal transition-transform duration-300 ${
              dragOver ? "scale-125 -translate-y-1" : ""
            }`}
            size={26}
          />
          <p className="text-sm text-ink mb-1">
            Drag a PDF here, or{" "}
            <button
              onClick={() => inputRef.current?.click()}
              className="text-teal underline underline-offset-2 font-medium hover:text-tealdark transition-colors"
            >
              browse
            </button>
          </p>
          <div className="mt-3 flex flex-col items-center gap-2">
            <label className="text-xs font-mono uppercase tracking-widest text-slate">
              Document category
            </label>
            <select
              value={docCategory}
              onChange={(e) => setDocCategory(e.target.value)}
              className="w-full max-w-xs rounded-md border border-rule bg-white px-3 py-2 text-sm text-ink"
            >
              {DOC_CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate mt-3">One paper at a time · up to 25MB</p>
        </>
      )}
      {error && <p className="text-xs text-red-700 mt-2 animate-fade-in-up">{error}</p>}
    </div>
  );
}
