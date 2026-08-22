import { useEffect, useState } from "react";
import { FileDown, RefreshCcw, Loader2 } from "lucide-react";
import { generateSummary, getSummary } from "../api/client.js";
import api from "../api/client.js";
import useTranslatedContent from "../hooks/useTranslatedContent.js";
import { useToast } from "../context/ToastContext.jsx";
import TranslatingOverlay from "./TranslatingOverlay.jsx";

const SECTIONS = [
  { key: "problem", label: "Problem" },
  { key: "method", label: "Method" },
  { key: "results", label: "Results" },
  { key: "limitations", label: "Limitations" },
  { key: "key_contributions", label: "Key Contributions" },
];

export default function SummaryPanel({ document, language }) {
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const { content: displayedSummary, translating } = useTranslatedContent(summary, language);

  useEffect(() => {
    if (!document?.id) return;
    setInitialLoad(true);
    getSummary(document.id)
      .then(setSummary)
      .finally(() => setInitialLoad(false));
  }, [document?.id]);

  const runGenerate = async () => {
    setLoading(true);
    try {
      const result = await generateSummary(document.id);
      setSummary(result);
      toast.success("Summary generated");
    } catch {
      toast.error("Couldn't generate the summary.");
    } finally {
      setLoading(false);
    }
  };

  const runExport = async () => {
    setExporting(true);
    setExportError("");
    try {
      const res = await api.get(`/summary/${document.id}/export`, {
        responseType: "blob",
      });
      const blob = res.data;

      // Pull the filename the backend chose (Content-Disposition) instead
      // of hardcoding one, so it matches send_file's download_name.
      const disposition = res.headers["content-disposition"] || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || `${document.title || "summary"}.pdf`;

      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = filename;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  if (!document) return <PlaceholderPane text="Select a paper to generate its summary." />;
  if (document.status !== "ready")
    return <PlaceholderPane text={`This paper is still ${document.status}.`} />;

  return (
    <div className="chat-scroll h-full overflow-y-auto px-1 py-3">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h3 className="font-display text-lg font-semibold text-ink truncate min-w-0">
          {document.title}
        </h3>
        <div className="flex gap-2 flex-wrap shrink-0">
          <button
            onClick={runGenerate}
            disabled={loading}
            className="btn-press flex items-center gap-1.5 text-xs bg-teal hover:bg-tealdark disabled:opacity-50 text-parchment rounded-md px-3 py-1.5 transition-colors shadow-sm hover:shadow-md"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
            {summary ? "Regenerate" : "Generate summary"}
          </button>
          {summary && (
            <button
              onClick={runExport}
              disabled={exporting}
              className="btn-press flex items-center gap-1.5 text-xs border border-rule bg-white/50 hover:bg-white/80 disabled:opacity-50 rounded-md px-3 py-1.5 text-ink transition-colors"
            >
              {exporting ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
              {exporting ? "Exporting…" : "Export"}
            </button>
          )}
        </div>
      </div>

      {exportError && (
        <div className="mb-4 border border-rust/40 bg-rust/10 text-ink px-3 py-2 rounded-md text-xs">
          {exportError}
        </div>
      )}

      {initialLoad || loading ? (
        <div className="grid gap-3">
          {SECTIONS.map(({ key }) => (
            <div key={key} className="border border-rule bg-white/50 rounded-lg px-4 py-3">
              <div className="skeleton h-3 w-24 rounded mb-2" />
              <div className="skeleton h-3.5 w-full rounded mb-1.5" />
              <div className="skeleton h-3.5 w-4/5 rounded" />
            </div>
          ))}
        </div>
      ) : !summary ? (
        <PlaceholderPane text='No summary yet — click "Generate summary" above.' />
      ) : (
        <TranslatingOverlay loading={translating} className="grid gap-3">
          {SECTIONS.map(({ key, label }, i) => (
            <div
              key={key}
              style={{ "--stagger-index": i + 1 }}
              className="tab-card active stagger-item animate-fade-in-up border border-rule bg-white/50 rounded-lg px-4 py-3 transition-shadow hover:shadow-sm"
            >
              <p className="text-[11px] font-mono uppercase tracking-widest text-amber mb-1">
                {label}
              </p>
              <p className="text-sm text-ink leading-relaxed">{displayedSummary?.[key] || "—"}</p>
            </div>
          ))}
        </TranslatingOverlay>
      )}
    </div>
  );
}

function PlaceholderPane({ text }) {
  return (
    <div className="h-full flex items-center justify-center text-center px-6 animate-fade-in">
      <p className="text-sm text-slate max-w-xs">{text}</p>
    </div>
  );
}
