import { useState } from "react";
import { FileText, CheckCircle2, Loader2, XCircle, Trash2 } from "lucide-react";
import { deleteDocument } from "../api/client.js";
import { useToast } from "../context/ToastContext.jsx";

const STATUS_ICON = {
  ready: <CheckCircle2 size={14} className="text-teal" />,
  processing: <Loader2 size={14} className="text-amber animate-spin" />,
  uploaded: <Loader2 size={14} className="text-amber animate-spin" />,
  failed: <XCircle size={14} className="text-red-600" />,
};

export default function DocumentList({
  documents,
  activeId,
  selectedIds,
  onSelect,
  onToggleCompare,
  onDeleted,
}) {
  const toast = useToast();
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (doc, e) => {
    e.stopPropagation();
    const confirmed = window.confirm(`Delete "${doc.title}"? This can't be undone.`);
    if (!confirmed) return;

    setDeletingId(doc.id);
    try {
      await deleteDocument(doc.id);
      onDeleted?.(doc.id);
      toast.success(`"${doc.title}" deleted`);
    } catch {
      toast.error("Couldn't delete the document.");
    } finally {
      setDeletingId(null);
    }
  };

  if (documents.length === 0) {
    return (
      <p className="text-xs text-slate font-mono px-1 animate-fade-in">
        No papers uploaded yet.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {documents.map((doc, i) => (
        <li
          key={doc.id}
          style={{ "--stagger-index": i + 1 }}
          className={`tab-card stagger-item animate-fade-in-up flex items-center gap-2 rounded-md px-2.5 py-2 cursor-pointer border transition-all duration-200 ${
            activeId === doc.id
              ? "active bg-white/70 border-rule shadow-sm"
              : "border-transparent hover:bg-white/40 hover:translate-x-0.5"
          }`}
        >
          <input
            type="checkbox"
            checked={selectedIds.includes(doc.id)}
            onChange={(e) => {
              e.stopPropagation();
              onToggleCompare(doc.id);
            }}
            onClick={(e) => e.stopPropagation()}
            className="accent-teal"
            title="Select for comparison"
          />
          <div className="flex-1 min-w-0" onClick={() => onSelect(doc.id)}>
            <div className="flex items-center gap-1.5">
              <FileText size={13} className="text-slate shrink-0" />
              <span className="text-sm text-ink truncate">{doc.title}</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {STATUS_ICON[doc.status] || null}
              <span className="text-[11px] font-mono text-slate/80">
                {doc.status === "ready"
                  ? `${doc.page_count} pages`
                  : doc.status}
              </span>
            </div>
          </div>
          <button
            onClick={(e) => handleDelete(doc, e)}
            disabled={deletingId === doc.id}
            aria-label={`Delete ${doc.title}`}
            title="Delete document"
            className="btn-press shrink-0 p-1 rounded-md text-slate/60 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {deletingId === doc.id ? (
              <span className="block w-3.5 h-3.5 border-2 border-slate/40 border-t-slate rounded-full animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
