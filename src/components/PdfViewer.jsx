import { Document, Page, pdfjs } from "react-pdf";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Loader2, FileWarning } from "lucide-react";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;

export default function PDFViewer({ file }) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  // Multiplier on top of "fit to container width" — not an absolute px
  // scale — so the page never forces the layout to overflow.
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef(null);

  // pdf.js's worker takes ownership of (transfers/detaches) any ArrayBuffer
  // handed to it, so re-using the same buffer on a later render throws
  // "Cannot perform Construct on a detached ArrayBuffer". Passing the URL
  // directly and only memoizing on identity avoids that.
  const fileProp = useMemo(() => (file ? file : null), [file]);

  // Switching documents with a stale page number silently renders nothing
  // (or the wrong page) if the new file has fewer pages. Reset on file change.
  useEffect(() => {
    setPageNumber(1);
    setPageInput("1");
    setError(null);
  }, [fileProp]);

  useEffect(() => {
    setPageInput(String(pageNumber));
  }, [pageNumber]);

  // Measure the available width so the page scales to fit instead of
  // pushing its parent grid/flex track wider than intended.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pageWidth = useMemo(() => {
    if (!containerWidth) return undefined;
    return Math.max(200, (containerWidth - 32) * zoom);
  }, [containerWidth, zoom]);

  const goToPage = useCallback(
    (n) => {
      if (!numPages) return;
      const clamped = Math.min(Math.max(1, n), numPages);
      setPageNumber(clamped);
    },
    [numPages]
  );

  const goPrev = useCallback(() => goToPage(pageNumber - 1), [goToPage, pageNumber]);
  const goNext = useCallback(() => goToPage(pageNumber + 1), [goToPage, pageNumber]);

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)));
  const resetZoom = () => setZoom(1);

  const submitPageInput = () => {
    const n = parseInt(pageInput, 10);
    if (Number.isFinite(n)) goToPage(n);
    else setPageInput(String(pageNumber));
  };

  // Left/right arrow keys page through the doc when the viewer has focus,
  // without hijacking arrow keys used elsewhere on the page.
  const handleKeyDown = (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "ArrowLeft") goPrev();
    if (e.key === "ArrowRight") goNext();
  };

  const atFirstPage = pageNumber <= 1;
  const atLastPage = numPages > 0 && pageNumber >= numPages;

  return (
    <div
      className="flex flex-col h-full min-w-0 outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap px-2.5 py-2 border-b border-rule bg-white/70">
        <div className="flex items-center gap-1">
          <button
            onClick={goPrev}
            disabled={atFirstPage}
            aria-label="Previous page"
            className="btn-press p-1.5 rounded-md border border-rule bg-white/80 text-ink disabled:opacity-35 disabled:cursor-not-allowed hover:enabled:bg-white transition-colors"
          >
            <ChevronLeft size={14} />
          </button>

          <div className="flex items-center gap-1 text-xs font-mono text-slate px-1">
            <input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ""))}
              onBlur={submitPageInput}
              onKeyDown={(e) => e.key === "Enter" && submitPageInput()}
              inputMode="numeric"
              aria-label="Page number"
              className="w-9 text-center rounded border border-rule bg-white py-0.5 text-ink"
            />
            <span>/ {numPages || "—"}</span>
          </div>

          <button
            onClick={goNext}
            disabled={atLastPage}
            aria-label="Next page"
            className="btn-press p-1.5 rounded-md border border-rule bg-white/80 text-ink disabled:opacity-35 disabled:cursor-not-allowed hover:enabled:bg-white transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            className="btn-press p-1.5 rounded-md border border-rule bg-white/80 text-ink disabled:opacity-35 disabled:cursor-not-allowed hover:enabled:bg-white transition-colors"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={resetZoom}
            title="Reset zoom"
            className="btn-press text-xs font-mono text-slate w-12 text-center tabular-nums hover:text-ink transition-colors"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            className="btn-press p-1.5 rounded-md border border-rule bg-white/80 text-ink disabled:opacity-35 disabled:cursor-not-allowed hover:enabled:bg-white transition-colors"
          >
            <ZoomIn size={14} />
          </button>
          {zoom !== 1 && (
            <button
              onClick={resetZoom}
              aria-label="Reset zoom to fit"
              className="btn-press p-1.5 rounded-md border border-rule bg-white/80 text-slate hover:text-ink hover:bg-white transition-colors"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Page surface — a slightly recessed canvas so the white page reads
          like paper on a desk, rather than blending into the panel bg. */}
      <div
        ref={containerRef}
        className="overflow-auto flex-1 min-w-0 min-h-0 bg-rule/10"
      >
        <div className="flex justify-center py-4 px-2 min-h-full">
          {error ? (
            <div className="flex flex-col items-center justify-center gap-2 text-red-700 p-6 text-center">
              <FileWarning size={22} />
              <p className="text-sm">Failed to load PDF</p>
              <p className="text-xs text-slate font-mono">{error}</p>
            </div>
          ) : (
            <Document
              file={fileProp}
              onLoadSuccess={({ numPages }) => {
                setError(null);
                setNumPages(numPages);
              }}
              onLoadError={(err) => {
                console.error("react-pdf error:", err);
                setError(err.message);
              }}
              loading={
                <div className="flex flex-col items-center gap-2 text-slate p-8">
                  <Loader2 size={20} className="animate-spin text-teal" />
                  <p className="text-xs font-mono">Loading document…</p>
                </div>
              }
              noData={<div className="text-sm text-slate p-8">No file selected.</div>}
              error={null}
            >
              {numPages > 0 && pageWidth && (
                <Page
                  pageNumber={pageNumber}
                  width={pageWidth}
                  className="shadow-md"
                  loading={
                    <div className="flex items-center justify-center gap-2 text-slate p-8">
                      <Loader2 size={16} className="animate-spin text-teal" />
                      <p className="text-xs font-mono">Rendering page…</p>
                    </div>
                  }
                />
              )}
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}