import { ListTree, Quote } from "lucide-react";

export default function MarginNotes({ document, citations }) {
  return (
    <div className="h-full overflow-y-auto px-1 py-3 space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-slate mb-2">
          <ListTree size={13} /> Outline
        </p>
        {document?.outline?.length ? (
          <ul className="space-y-1">
            {document.outline.map((item, i) => (
              <li
                key={i}
                className="btn-press text-sm text-ink border-l-2 border-rule pl-2.5 py-0.5 hover:border-amber transition-colors"
              >
                {item.title}
                <span className="text-slate/70 font-mono text-[11px] ml-1.5">p.{item.page}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate">No sections detected yet.</p>
        )}
      </div>

      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-slate mb-2">
          <Quote size={13} /> Margin notes
        </p>
        {citations?.length ? (
          <div className="space-y-2">
            {citations.map((c, i) => (
              <div
                key={i}
                className="border border-amber/30 bg-amber/10 rounded-md px-3 py-2 -rotate-[0.4deg]"
              >
                <p className="text-[11px] font-mono text-amber">
                  p.{c.page} · {c.section}
                </p>
                <p className="text-xs text-ink/80 mt-0.5">Referenced in the last answer</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate">
            Citations from the assistant's answers will pin here as you chat.
          </p>
        )}
      </div>
    </div>
  );
}
