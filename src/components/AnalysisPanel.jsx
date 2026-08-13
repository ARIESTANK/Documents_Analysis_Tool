import { useEffect, useState } from "react";
import { Sparkles, Loader2, RefreshCcw } from "lucide-react";
import useTranslatedContent from "../hooks/useTranslatedContent.js";
import TranslatingOverlay from "./TranslatingOverlay.jsx";
import { getDocumentFunctions, runDocumentAnalysis } from "../api/client.js";

/**
 * Lists the AI functions available for this document's stored document_type
 * (GET /api/documents/<id>/functions) and runs one on demand
 * (POST /api/documents/<id>/analyze) — see routes/analysis.py +
 * services/analysis_service.py on the backend for how the prompt differs
 * per type.
 */
export default function AnalysisPanel({ document, language }) {
  const [functions, setFunctions] = useState([]);
  const [docType, setDocType] = useState(null);
  const [loadingFunctions, setLoadingFunctions] = useState(false);
  const [functionsError, setFunctionsError] = useState("");

  const [activeKey, setActiveKey] = useState(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [runError, setRunError] = useState("");
  const { content: displayedOutput, translating } = useTranslatedContent(result?.result, language);

  useEffect(() => {
    setFunctions([]);
    setDocType(null);
    setResult(null);
    setActiveKey(null);
    setRunError("");
    setFunctionsError("");

    if (!document?.id) return;

    setLoadingFunctions(true);
    getDocumentFunctions(document.id)
      .then((data) => {
        setDocType(data.document_type);
        setFunctions(data.functions || []);
      })
      .catch((err) => setFunctionsError(err.response?.data?.error || err.message))
      .finally(() => setLoadingFunctions(false));
  }, [document?.id]);

  const runFunction = async (functionKey) => {
    setActiveKey(functionKey);
    setRunning(true);
    setRunError("");
    setResult(null);
    try {
      const data = await runDocumentAnalysis(document.id, functionKey);
      setResult(data);
    } catch (err) {
      setRunError(err.response?.data?.error || err.message);
    } finally {
      setRunning(false);
    }
  };

  if (!document) {
    return <PlaceholderPane text="Select a paper to see its available AI functions." />;
  }
  if (document.status !== "ready") {
    return <PlaceholderPane text={`This paper is still ${document.status}.`} />;
  }

  return (
    <div className="h-full overflow-y-auto px-1 py-3">
      {loadingFunctions ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-rule bg-white/50 rounded-md p-3">
              <div className="skeleton h-3.5 w-1/2 rounded mb-2" />
              <div className="skeleton h-3 w-full rounded" />
            </div>
          ))}
        </div>
      ) : functionsError ? (
        <div className="border border-rust/40 bg-rust/10 text-ink px-3 py-2 rounded-md text-sm">
          {functionsError}
        </div>
      ) : (
        <>
          {docType && (
            <p className="text-xs font-mono uppercase tracking-widest text-amber mb-3">
              {docType.replace(/_/g, " ")}
            </p>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            {functions.map((fn) => (
              <button
                key={fn.key}
                onClick={() => runFunction(fn.key)}
                disabled={running}
                className={`btn-press card-lift text-left border rounded-md p-3 transition-colors disabled:opacity-60 ${
                  activeKey === fn.key
                    ? "border-teal bg-teal/10"
                    : "border-rule bg-white/70 hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-2 text-teal">
                  {running && activeKey === fn.key ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  <span className="text-sm font-medium text-ink">{fn.label}</span>
                </div>
                <p className="mt-2 text-xs text-slate">{fn.instruction}</p>
              </button>
            ))}
          </div>

          {!functions.length && (
            <div className="mt-4 border border-dashed border-rule rounded-lg py-12 text-center text-sm text-slate">
              No AI functions are registered for this document type yet.
            </div>
          )}

          {runError && (
            <div className="mt-4 border border-rust/40 bg-rust/10 text-ink px-3 py-2 rounded-md text-sm">
              {runError}
            </div>
          )}

          {result && (
            <div className="mt-6 border-t border-rule pt-5 animate-fade-in-up">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-base font-semibold text-ink">
                  {functions.find((f) => f.key === result.function_key)?.label || result.function_key}
                </h3>
                <button
                  onClick={() => runFunction(result.function_key)}
                  disabled={running}
                  className="btn-press flex items-center gap-1.5 text-xs border border-rule bg-white/50 hover:bg-white/80 disabled:opacity-50 rounded-md px-3 py-1.5 text-ink transition-colors"
                >
                  <RefreshCcw size={12} className={running ? "animate-spin" : ""} /> Re-run
                </button>
              </div>

              <TranslatingOverlay loading={translating}>
                {result.output_format === "json" ? (
                  <JsonResult data={displayedOutput} />
                ) : (
                  <div className="rounded-md border border-rule bg-white/70 p-3 text-sm text-slate leading-relaxed whitespace-pre-wrap">
                    {displayedOutput}
                  </div>
                )}
              </TranslatingOverlay>
            </div>
          )}

          {running && !result && (
            <div className="mt-6 border-t border-rule pt-5 animate-fade-in-up">
              <div className="flex items-center gap-2 text-teal mb-3">
                <Sparkles size={14} className="animate-pulse-soft" />
                <span className="text-xs font-mono text-slate">Asking Groq…</span>
              </div>
              <div className="grid gap-2">
                <div className="skeleton h-3.5 w-full rounded" />
                <div className="skeleton h-3.5 w-11/12 rounded" />
                <div className="skeleton h-3.5 w-4/5 rounded" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Renders a JSON analysis result as readable key/value blocks instead of
 * a raw dump — falls back to pretty-printed JSON for arrays/nested shapes. */
function JsonResult({ data }) {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return (
      <div className="grid gap-3">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="border border-rule bg-white/70 rounded-md px-3 py-2">
            <p className="text-[11px] font-mono uppercase tracking-widest text-amber mb-1">
              {key.replace(/_/g, " ")}
            </p>
            {typeof value === "string" ? (
              <p className="text-sm text-slate leading-relaxed whitespace-pre-wrap">{value}</p>
            ) : (
              <pre className="text-xs font-mono text-slate whitespace-pre-wrap break-words">
                {JSON.stringify(value, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    );
  }
  return (
    <pre className="text-xs font-mono text-slate whitespace-pre-wrap break-words border border-rule bg-white/70 rounded-md p-3">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function PlaceholderPane({ text }) {
  return (
    <div className="h-full flex items-center justify-center text-center px-6">
      <p className="text-sm text-slate max-w-xs">{text}</p>
    </div>
  );
}
