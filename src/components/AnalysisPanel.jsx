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
    <div className="chat-scroll h-full overflow-y-auto px-1 py-3">
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

/** Renders a JSON analysis result as readable, human-friendly UI instead of
 * a raw dump. Fully recursive — objects, arrays, and nested combinations of
 * both are all turned into cards/lists/badges, so nothing ever falls back
 * to a printed JSON blob. */
function JsonResult({ data }) {
  return <ValueBlock value={data} topLevel />;
}

const PRIORITY_STYLES = {
  high: "text-rust bg-rust/10 border-rust/30",
  medium: "text-amber bg-amber/10 border-amber/30",
  low: "text-teal bg-teal/10 border-teal/30",
};

function fieldLabel(key) {
  return key.replace(/_/g, " ");
}

/** A single primitive value (string/number/boolean/null) rendered as text. */
function Primitive({ value }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-sm text-slate/60 italic">—</span>;
  }
  if (typeof value === "boolean") {
    return (
      <span
        className={`text-[11px] font-mono uppercase tracking-wide rounded-full px-2 py-0.5 border ${
          value ? "text-teal bg-teal/10 border-teal/30" : "text-slate bg-slate/10 border-rule"
        }`}
      >
        {value ? "Yes" : "No"}
      </span>
    );
  }
  return <span className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{String(value)}</span>;
}

/** A small pill for short tag-like fields (id, priority, severity, status…). */
function Tag({ label, value }) {
  const lower = String(value).toLowerCase();
  const priorityClass = PRIORITY_STYLES[lower];
  return (
    <span
      className={`text-[10px] font-mono uppercase tracking-wide rounded-full px-2 py-0.5 border ${
        priorityClass || "text-teal bg-teal/10 border-teal/30"
      }`}
      title={fieldLabel(label)}
    >
      {String(value)}
    </span>
  );
}

/** Object rendered as a card: short fields become tags up top, the longest
 * text field (usually "description"/"text"/"summary") becomes the headline,
 * and anything else nested renders recursively underneath. */
function ObjectCard({ obj }) {
  const entries = Object.entries(obj);

  // Pick the "headline" field: the longest plain string value, preferring
  // common names when there's a tie or nothing obviously longer.
  const preferredNames = ["description", "text", "summary", "content", "title", "name"];
  let headlineKey = null;
  for (const name of preferredNames) {
    if (typeof obj[name] === "string" && obj[name]) {
      headlineKey = name;
      break;
    }
  }
  if (!headlineKey) {
    let longest = 0;
    for (const [k, v] of entries) {
      if (typeof v === "string" && v.length > longest) {
        longest = v.length;
        headlineKey = k;
      }
    }
  }

  const tagEntries = entries.filter(
    ([k, v]) => k !== headlineKey && (typeof v === "string" || typeof v === "number") && String(v).length <= 24
  );
  const restEntries = entries.filter(
    ([k]) => k !== headlineKey && !tagEntries.some(([tk]) => tk === k)
  );

  return (
    <div className="border border-rule bg-parchment/40 rounded-md px-3 py-2">
      {tagEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {tagEntries.map(([k, v]) => (
            <Tag key={k} label={k} value={v} />
          ))}
        </div>
      )}
      {headlineKey && (
        <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{obj[headlineKey]}</p>
      )}
      {restEntries.length > 0 && (
        <div className="grid gap-2 mt-2 pt-2 border-t border-rule/60">
          {restEntries.map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate/70 mb-0.5">
                {fieldLabel(k)}
              </p>
              <ValueBlock value={v} />
            </div>
          ))}
        </div>
      )}
      {!headlineKey && tagEntries.length === 0 && restEntries.length === 0 && (
        <p className="text-sm text-slate/60 italic">Empty</p>
      )}
    </div>
  );
}

function ValueBlock({ value, topLevel = false }) {
  // Top-level object -> one section per key, each with its own labeled card.
  if (topLevel && value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <p className="text-sm text-slate/70 italic">No results.</p>;
    }
    return (
      <div className="grid gap-3">
        {entries.map(([key, val]) => (
          <div key={key} className="border border-rule bg-white/70 rounded-md px-3 py-2">
            <p className="text-[11px] font-mono uppercase tracking-widest text-amber mb-1.5">
              {fieldLabel(key)}
            </p>
            <ValueBlock value={val} />
          </div>
        ))}
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <p className="text-sm text-slate/70 italic">None</p>;
    }
    // List of plain strings/numbers -> simple bullet list.
    if (value.every((item) => typeof item === "string" || typeof item === "number")) {
      return (
        <ul className="list-disc pl-4 space-y-1">
          {value.map((item, i) => (
            <li key={i} className="text-sm text-slate leading-relaxed whitespace-pre-wrap">
              {String(item)}
            </li>
          ))}
        </ul>
      );
    }
    // List of objects -> a card per item.
    return (
      <div className="grid gap-2">
        {value.map((item, i) =>
          item && typeof item === "object" && !Array.isArray(item) ? (
            <ObjectCard key={i} obj={item} />
          ) : (
            <div key={i} className="border border-rule bg-parchment/40 rounded-md px-3 py-2">
              <ValueBlock value={item} />
            </div>
          )
        )}
      </div>
    );
  }

  if (value && typeof value === "object") {
    return <ObjectCard obj={value} />;
  }

  return <Primitive value={value} />;
}

function PlaceholderPane({ text }) {
  return (
    <div className="h-full flex items-center justify-center text-center px-6">
      <p className="text-sm text-slate max-w-xs">{text}</p>
    </div>
  );
}
