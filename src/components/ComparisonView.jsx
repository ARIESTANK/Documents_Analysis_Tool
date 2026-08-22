import { useState } from "react";
import { Scale, Loader2 } from "lucide-react";
import { compareDocuments } from "../api/client.js";
import useTranslatedContent from "../hooks/useTranslatedContent.js";
import TranslatingOverlay from "./TranslatingOverlay.jsx";

export default function ComparisonView({ projectId, documents, selectedIds, language }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { content: displayedResult, translating } = useTranslatedContent(result, language);

  const selectedDocs = documents.filter((d) => selectedIds.includes(d.id));
  const titles = selectedDocs.map((d) => d.title);

  const runCompare = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await compareDocuments(projectId, selectedIds);
      setResult(res);
    } catch {
      setError("Comparison failed. Make sure both documents finished processing.");
    } finally {
      setLoading(false);
    }
  };

  if (selectedIds.length < 2) {
    return (
      <PlaceholderPane text="Check the box next to two or more documents in the sidebar to compare them." />
    );
  }

  return (
    <div className="chat-scroll h-full overflow-y-auto px-1 py-3">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-amber mb-1">
            Comparing {selectedDocs.length} documents
          </p>
          <h3 className="font-display text-lg font-semibold text-ink">{titles.join("  ×  ")}</h3>
        </div>
        <button
          onClick={runCompare}
          disabled={loading}
          className="btn-press flex items-center gap-1.5 text-xs bg-teal hover:bg-tealdark disabled:opacity-50 text-parchment rounded-md px-3 py-1.5 shrink-0 transition-colors shadow-sm hover:shadow-md"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Scale size={13} />}
          Run comparison
        </button>
      </div>

      {error && <p className="text-sm text-red-700 mb-3 animate-fade-in-up">{error}</p>}

      {loading && !result && (
        <div className="border border-rule rounded-lg overflow-hidden mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 px-3 py-2.5 border-b border-rule/60 last:border-b-0">
              <div className="skeleton h-3.5 w-24 rounded shrink-0" />
              <div className="skeleton h-3.5 flex-1 rounded" />
              <div className="skeleton h-3.5 flex-1 rounded" />
            </div>
          ))}
        </div>
      )}

      {!displayedResult ? (
        !loading && <PlaceholderPane text='Click "Run comparison" to generate a side-by-side table.' />
      ) : (
        <TranslatingOverlay loading={translating}>
          <div className="overflow-x-auto border border-rule rounded-lg mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/60">
                  <th className="text-left font-mono text-[11px] uppercase tracking-wider text-slate px-3 py-2 border-b border-rule">
                    Criteria
                  </th>
                  {titles.map((t) => (
                    <th
                      key={t}
                      className="text-left font-display font-semibold text-ink px-3 py-2 border-b border-rule"
                    >
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedResult.rows?.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white/30" : "bg-white/10"}>
                    <td className="px-3 py-2 font-medium text-ink align-top border-b border-rule/50">
                      {row.criteria}
                    </td>
                    {titles.map((t) => (
                      <td key={t} className="px-3 py-2 text-ink align-top border-b border-rule/50">
                        {row.values?.[t] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {displayedResult.insight && (
            <div className="border border-amber/40 bg-amber/10 rounded-lg px-4 py-3">
              <p className="text-[11px] font-mono uppercase tracking-widest text-amber mb-1">
                AI Insight
              </p>
              <p className="text-sm text-ink leading-relaxed">{displayedResult.insight}</p>
            </div>
          )}
        </TranslatingOverlay>
      )}
    </div>
  );
}

function PlaceholderPane({ text }) {
  return (
    <div className="h-full flex items-center justify-center text-center px-6">
      <p className="text-sm text-slate max-w-xs">{text}</p>
    </div>
  );
}
