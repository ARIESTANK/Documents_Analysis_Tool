import { Link } from "react-router-dom";
import { BookMarked, MessageSquare, ScrollText, Scale, ArrowRight } from "lucide-react";

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Ask your papers questions",
    body: "Chat with any uploaded document and get answers grounded in its actual text, with citations back to the page and section.",
  },
  {
    icon: ScrollText,
    title: "Instant structured summaries",
    body: "Problem, method, results, limitations, and key contributions — generated automatically so you know if a paper is worth a full read.",
  },
  {
    icon: Scale,
    title: "Compare papers side by side",
    body: "Select multiple documents in a workspace and get a structured comparison table plus an AI-written synthesis of how they relate.",
  },
];

export default function Landing() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      {/* Hero */}
      <section className="pt-20 pb-16 text-center animate-fade-in-up">
        <div className="inline-flex items-center gap-2 border border-rule bg-white/50 rounded-full px-3.5 py-1.5 mb-6 font-mono text-xs text-slate animate-float-slow">
          <BookMarked size={14} className="text-teal" />
          AI-powered research assistant
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-ink leading-tight max-w-3xl mx-auto">
          Read less. Know more about every paper.
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

      {/* Features */}
      <section className="grid sm:grid-cols-3 gap-4 pb-24">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className="stagger-item animate-fade-in-up card-lift group border border-rule bg-white/40 rounded-lg p-6"
            style={{ "--stagger-index": i + 1 }}
          >
            <f.icon
              size={22}
              className="text-teal mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3"
            />
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
