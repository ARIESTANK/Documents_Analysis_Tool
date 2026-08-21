import { Link } from "react-router-dom";
import { BookMarked, MessageSquare, ScrollText, Scale, ArrowRight } from "lucide-react";

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Ask your papers questions",
    body: "Chat with any uploaded document and get answers grounded in its actual text, with citations back to the page and section.",
    bg: "bg-teal/10",
    ring: "ring-teal/20",
    color: "text-teal",
  },
  {
    icon: ScrollText,
    title: "Instant structured summaries",
    body: "Problem, method, results, limitations, and key contributions — generated automatically so you know if a paper is worth a full read.",
    bg: "bg-amber/10",
    ring: "ring-amber/20",
    color: "text-amber",
  },
  {
    icon: Scale,
    title: "Compare papers side by side",
    body: "Select multiple documents in a workspace and get a structured comparison table plus an AI-written synthesis of how they relate.",
    bg: "bg-rust/10",
    ring: "ring-rust/20",
    color: "text-rust",
  },
];

export default function Landing() {
  return (
    <div className="max-w-7xl mx-auto px-6 relative">
      {/* Soft ambient color blobs behind the hero */}
      <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[420px] -z-10 overflow-hidden">
        <div className="absolute -left-10 top-0 w-72 h-72 rounded-full bg-teal/20 blur-3xl" />
        <div className="absolute right-0 top-10 w-72 h-72 rounded-full bg-amber/20 blur-3xl" />
        <div className="absolute left-1/3 top-24 w-64 h-64 rounded-full bg-rust/10 blur-3xl" />
      </div>

      {/* Hero */}
      <section className="pt-20 pb-16 text-center animate-fade-in-up">
        <div className="inline-flex items-center gap-2 border border-rule bg-white/50 rounded-full px-3.5 py-1.5 mb-6 font-mono text-xs text-slate animate-float-slow">
          <BookMarked size={14} className="text-teal" />
          AI-powered research assistant
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-ink leading-tight max-w-3xl mx-auto">
          Read less. Know more about <span className="brand-gradient">every paper</span>.
        </h1>
        <p className="text-slate text-base sm:text-lg mt-5 max-w-xl mx-auto leading-relaxed">
          Sadan AI organizes your papers into workspaces, then lets you chat with
          them, summarize them, and compare them — all grounded in the actual
          source text.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link
            to="/signup"
            className="btn-press group flex items-center gap-2 bg-teal hover:bg-tealdark text-parchment px-5 py-2.5 rounded-md font-medium transition-colors"
          >
            Get started
            <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
          <Link
            to="/login"
            className="btn-press border border-rule hover:bg-white/60 text-ink px-5 py-2.5 rounded-md font-medium transition-colors"
          >
            Sign in
          </Link>
          
        </div>
      </section>

      {/* QR Code */}
      <section className="pb-20 animate-fade-in-up">
        <div className="border border-rule bg-white/40 rounded-lg p-8 flex flex-col sm:flex-row items-center gap-8">
          <div className="flex-1 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 border border-rule bg-white/60 rounded-full px-3 py-1 mb-4 font-mono text-xs text-slate">
              <BookMarked size={12} className="text-teal" />
              Try it on your phone
            </div>
            <h3 className="font-display text-2xl font-semibold text-ink mb-2">
              Take Sadan AI with you
            </h3>
            <p className="text-sm text-slate leading-relaxed max-w-md">
              Scan the code with your phone's camera to open Sadan AI instantly —
              no typing, no searching. Upload a paper and start chatting with it
              on the go.
            </p>
            <a
              href="https://documents-analysis-tool-me8f.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block font-mono text-xs text-teal mt-3 hover:underline break-all"
            >
              documents-analysis-tool-me8f.vercel.app
            </a>
          </div>
          <div className="shrink-0">
            <img
              src="/asserts/qr-code.png"
              alt="QR code linking to Sadan AI"
              className="w-36 h-36 sm:w-40 sm:h-40 rounded-md border border-rule bg-white p-2"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="grid sm:grid-cols-3 gap-4 pb-24">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className="stagger-item animate-fade-in-up card-lift group border border-rule bg-white/40 rounded-lg p-6"
            style={{ "--stagger-index": i + 1 }}
          >
            <div
              className={`inline-flex items-center justify-center w-11 h-11 rounded-lg ${f.bg} ring-1 ${f.ring} mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}
            >
              <f.icon size={20} className={f.color} />
            </div>
            <h3 className="font-display text-lg font-semibold text-ink mb-2">
              {f.title}
            </h3>
            <p className="text-sm text-slate leading-relaxed">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
