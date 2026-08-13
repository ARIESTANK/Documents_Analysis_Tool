/**
 * Wraps AI output that can be re-translated on language toggle.
 * Instead of a "Translating…" text string, the existing content dims and
 * blurs slightly while a small spinner sits on top of it — motion instead
 * of a status label.
 */
export default function TranslatingOverlay({ loading, children, className = "" }) {
  return (
    <div className={`content-transition ${loading ? "is-loading" : ""} ${className}`}>
      {loading && (
        <div className="overlay-spinner animate-fade-in">
          <div className="overlay-spinner-ring" />
        </div>
      )}
      {children}
    </div>
  );
}
