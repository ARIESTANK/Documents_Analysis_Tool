import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MessageSquare, ScrollText, Scale, Wand2 } from "lucide-react";
import { getProject, getDocumentStatus } from "../api/client.js";
import UploadZone from "../components/UploadZone.jsx";
import DocumentList from "../components/DocumentList.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import SummaryPanel from "../components/SummaryPanel.jsx";
import ComparisonView from "../components/ComparisonView.jsx";
import PDFViewer from "../components/PdfViewer.jsx";
import AnalysisPanel from "../components/AnalysisPanel.jsx";

const TABS = [
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "summary", label: "Summary", icon: ScrollText },
  { key: "analyze", label: "Analyze", icon: Wand2 },
  { key: "compare", label: "Compare", icon: Scale },
];

export default function ProjectView() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [tab, setTab] = useState("chat");
  const [citations, setCitations] = useState([]);
  const [language, setLanguage] = useState("English");

  const refresh = useCallback(() => {
    getProject(projectId).then((data) => {
      setProject(data.project);
      setDocuments(data.documents || []);
      if (!activeId && data.documents?.length) setActiveId(data.documents[0].id);
    });
  }, [projectId, activeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Keep a document selected (e.g. after deleting the active one) whenever
  // one is available.
  useEffect(() => {
    if (!activeId && documents.length) setActiveId(documents[0].id);
  }, [activeId, documents]);

  // Poll status for any document still processing
  useEffect(() => {
    const processing = documents.filter((d) => d.status === "processing" || d.status === "uploaded");
    if (processing.length === 0) return;
    const interval = setInterval(() => {
      Promise.all(processing.map((d) => getDocumentStatus(d.id))).then((updates) => {
        setDocuments((prev) =>
          prev.map((doc) => {
            const u = updates.find((x) => x.id === doc.id);
            return u ? { ...doc, ...u } : doc;
          })
        );
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [documents]);

  const activeDoc = documents.find((d) => d.id === activeId) || null;

  const toggleCompare = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="max-w-8xl mx-auto px-4 sm:px-6 py-6">
      <Link
        to="/"
        className="flex items-center gap-1.5 text-sm text-slate hover:text-ink mb-4 transition-colors w-fit group"
      >
        <ArrowLeft size={14} className="transition-transform duration-200 group-hover:-translate-x-1" /> All projects
      </Link>
      <h1 className="font-display text-2xl font-semibold text-ink mb-6 break-words animate-fade-in-up">
        {project?.name || <span className="skeleton inline-block h-7 w-48 rounded align-middle" />}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5 min-w-0">
        {/* Left: papers */}
        <aside className="space-y-4 min-w-0">
          <UploadZone
            projectId={projectId}
            onUploaded={(doc) => {
              setDocuments((prev) => [doc, ...prev]);
              setActiveId(doc.id);
            }}
          />
          <div className="border border-rule bg-white/30 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-rule bg-white/40">
              <p className="text-[11px] font-mono uppercase tracking-widest text-slate">
                Papers
              </p>
              {documents.length > 0 && (
                <span className="text-[10px] font-mono text-slate/80 bg-white/70 border border-rule rounded-full px-1.5 py-0.5 leading-none">
                  {documents.length}
                </span>
              )}
            </div>
            {/*
              Cap the list so it scrolls internally once it outgrows the
              sidebar, instead of pushing the whole page taller. lg:max-h ties
              it loosely to the center panel's viewport-relative height.
            */}
            <div className="p-2 max-h-72 lg:max-h-[calc(100vh-360px)] lg:min-h-[160px] overflow-y-auto">
              <DocumentList
                documents={documents}
                activeId={activeId}
                selectedIds={selectedIds}
                onSelect={setActiveId}
                onToggleCompare={toggleCompare}
                onDeleted={(deletedId) => {
                  setDocuments((prev) => prev.filter((d) => d.id !== deletedId));
                  setSelectedIds((prev) => prev.filter((id) => id !== deletedId));
                  setActiveId((prev) => (prev === deletedId ? null : prev));
                }}
              />
            </div>
          </div>
        </aside>

        {/* Center: document preview + AI workspace */}
        {/*
          min-h-[560px] alone has no ceiling — as chat/summary content grows,
          the section (and the whole page) grows with it instead of the
          panels scrolling internally. Capping height to the viewport (minus
          room for the header above) gives min-h-0 children something real
          to scroll within.
        */}
        <section className="border border-rule bg-white/30 rounded-xl h-[calc(100vh-200px)] min-h-[560px] overflow-hidden shadow-sm min-w-0">
          {/*
            Both the preview pane and the workspace pane get a real, bounded
            height at every breakpoint (not just `xl`) via grid-rows-2 /
            h-full, so each one scrolls internally instead of the whole page
            growing taller. The 2-column split kicks in at `xl`.
          */}
          <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] grid-rows-2 xl:grid-rows-1 h-full min-w-0 min-h-0">
            <div className="border-b xl:border-b-0 xl:border-r border-rule bg-gradient-to-br from-white/80 to-white/50 p-4 flex flex-col min-w-0 min-h-0">
              <div className="mb-3 flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[11px] font-mono uppercase tracking-widest text-slate mb-1">
                    Document preview
                  </p>
                  <h2 className="font-display text-lg font-semibold text-ink truncate">
                    {activeDoc?.title || "Select a document"}
                  </h2>
                </div>
                <div className="shrink-0 rounded-full border border-rule bg-white/80 px-2.5 py-1 text-[11px] font-mono text-slate transition-colors">
                  {activeDoc?.status === "processing" || activeDoc?.status === "uploaded" ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse-soft" />
                      {activeDoc.status}
                    </span>
                  ) : (
                    activeDoc?.status || "ready"
                  )}
                </div>
              </div>
              <div className="flex-1 rounded-lg border border-rule overflow-hidden min-h-0">
                {activeDoc?.pdf_url ? (
                  <PDFViewer file={activeDoc.pdf_url} />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate">
                    No PDF Selected
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col bg-white/60 min-w-0 min-h-0">
              <div className="flex border-b border-rule bg-white/70 overflow-x-auto items-center">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium -mb-px whitespace-nowrap transition-colors ${
                      tab === key
                        ? "text-ink"
                        : "text-slate hover:text-ink"
                    }`}
                  >
                    <Icon
                      size={15}
                      className={`transition-transform duration-200 ${tab === key ? "scale-110" : ""}`}
                    />
                    {label}
                    {tab === key && (
                      <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-teal rounded-full animate-scale-in" />
                    )}
                  </button>
                ))}
                <button
                  onClick={() => setLanguage((current) => current === "English" ? "Burmese" : "English")}
                  className="btn-press ml-auto mr-2 shrink-0 rounded-md border border-rule bg-white/80 hover:bg-white px-2.5 py-1 text-xs font-medium text-ink transition-colors"
                  title="Toggle AI output language"
                >
                  {language === "English" ? "🇲🇲 မြန်မာ" : "EN English"}
                </button>
              </div>
              {/*
                No overflow/scroll here — each panel below (Chat, Summary,
                Analyze, Compare) owns its own internal scroll container so
                things like Chat's input bar can stay pinned. Letting this
                wrapper also scroll caused nested/double scrollbars and let
                the page grow tall instead of scrolling in place.
              */}
              <div key={tab} className="flex-1 min-h-0 animate-fade-in-up">
                {tab === "chat" && (
                  <ChatPanel document={activeDoc} onCitationsUpdate={setCitations} language={language} />
                )}
                {tab === "summary" && <SummaryPanel document={activeDoc} language={language} />}
                {tab === "analyze" && <AnalysisPanel document={activeDoc} language={language} />}
                {tab === "compare" && (
                  <ComparisonView
                    projectId={projectId}
                    documents={documents}
                    selectedIds={selectedIds}
                    language={language}
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}