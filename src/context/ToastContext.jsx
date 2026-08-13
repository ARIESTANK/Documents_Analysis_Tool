import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

const ICONS = {
  success: <CheckCircle2 size={16} className="text-teal shrink-0" />,
  error: <XCircle size={16} className="text-rust shrink-0" />,
  info: <Info size={16} className="text-amber shrink-0" />,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  const push = useCallback(
    (message, type = "info", duration = 3200) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, type, leaving: false }]);
      if (duration) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const toast = {
    success: (msg, d) => push(msg, "success", d),
    error: (msg, d) => push(msg, "error", d),
    info: (msg, d) => push(msg, "info", d),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-xs pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 border border-rule bg-parchment shadow-lg rounded-lg px-4 py-3 ${
              t.leaving ? "animate-toast-out" : "animate-toast-in"
            }`}
          >
            {ICONS[t.type]}
            <p className="text-sm text-ink leading-snug flex-1">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-slate hover:text-ink shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
