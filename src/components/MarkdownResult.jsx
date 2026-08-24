import { useMemo } from "react";

/**
 * Renders a markdown-ish text result (the kind Groq returns for "text"
 * output_format functions — headings, bold/italic, nested bullets or
 * numbered lists, inline code, and the occasional `$...$` LaTeX snippet)
 * as readable, sectioned UI instead of one long whitespace-pre-wrap blob.
 *
 * Deliberately dependency-free (no react-markdown/remark) — the shape of
 * this output is predictable enough that a small line-based parser covers
 * it, and it keeps styling fully in our own hands so it matches the rest
 * of the app (parchment/ink/teal/amber tokens, font-display headings).
 */
export default function MarkdownResult({ text }) {
  const sections = useMemo(() => groupIntoSections(parseMarkdown(text || "")), [text]);

  if (!sections.length) {
    return <p className="text-sm text-slate/70 italic">No content.</p>;
  }

  return (
    <div className="grid gap-3">
      {sections.map((section, i) => (
        <div
          key={i}
          style={{ "--stagger-index": i + 1 }}
          className="tab-card active stagger-item animate-fade-in-up border border-rule bg-white/70 rounded-lg px-4 py-3"
        >
          {section.heading && (
            <p className="text-[11px] font-mono uppercase tracking-widest text-amber mb-2 flex items-center gap-1.5">
              <span className="leader-dot shrink-0" />
              <span className="font-display text-sm normal-case tracking-normal text-ink">
                {section.heading}
              </span>
            </p>
          )}
          <div className="grid gap-2.5">{renderBlocks(section.blocks)}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Chat-flavored variant: same parser, no section cards / amber eyebrows —
 * just headings, lists, bold/italic/code/math sized to sit inside a
 * message bubble. Used for assistant replies once they're done streaming.
 */
export function CompactMarkdown({ text, className = "" }) {
  const blocks = useMemo(() => parseMarkdown(text || ""), [text]);
  if (!blocks.length) return null;
  return <div className={`grid gap-1.5 ${className}`}>{renderBlocks(blocks)}</div>;
}

/* ---------------------------- block parsing ---------------------------- */

const HEADING_RE = /^(#{1,4})\s+(.*)$/;
const UL_RE = /^(\s*)[-*]\s+(.*)$/;
const OL_RE = /^(\s*)(\d+)\.\s+(.*)$/;

function parseMarkdown(raw) {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paraBuffer = [];
  let i = 0;

  const flushPara = () => {
    if (paraBuffer.length) {
      blocks.push({ type: "p", text: paraBuffer.join(" ").trim() });
      paraBuffer = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      flushPara();
      i++;
      continue;
    }

    const h = line.match(HEADING_RE);
    if (h) {
      flushPara();
      blocks.push({ type: "h", level: h[1].length, text: h[2].trim() });
      i++;
      continue;
    }

    if (UL_RE.test(line) || OL_RE.test(line)) {
      flushPara();
      const { node, next } = parseList(lines, i);
      blocks.push(node);
      i = next;
      continue;
    }

    paraBuffer.push(line.trim());
    i++;
  }
  flushPara();
  return blocks;
}

function parseList(lines, start) {
  const firstUl = lines[start].match(UL_RE);
  const firstOl = lines[start].match(OL_RE);
  const baseIndent = (firstUl || firstOl)[1].length;
  const ordered = !!firstOl;
  const items = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const ulM = line.match(UL_RE);
    const olM = line.match(OL_RE);
    const m = ulM || olM;
    if (!m) break;

    const indent = m[1].length;
    if (indent < baseIndent) break;

    if (indent > baseIndent) {
      const { node, next } = parseList(lines, i);
      if (items.length) items[items.length - 1].children = node;
      i = next;
      continue;
    }

    items.push({ text: (ulM ? ulM[2] : olM[3]).trim(), children: null });
    i++;
  }

  return { node: { type: "list", ordered, items }, next: i };
}

/** Bundles blocks under the nearest h1–h3 into a "section" (h4+ becomes an
 * inline subheading inside the current section instead of splitting it). */
function groupIntoSections(blocks) {
  const sections = [];
  let current = { heading: null, blocks: [] };
  let started = false;

  for (const b of blocks) {
    if (b.type === "h" && b.level <= 3) {
      if (started) sections.push(current);
      current = { heading: stripMd(b.text), blocks: [] };
      started = true;
    } else if (b.type === "h") {
      current.blocks.push({ type: "subheading", text: b.text });
      started = true;
    } else {
      current.blocks.push(b);
      started = true;
    }
  }
  if (started) sections.push(current);
  return sections;
}

/* --------------------------------- render -------------------------------- */

function renderBlocks(blocks) {
  return blocks.map((block, i) => {
    if (block.type === "h" || block.type === "subheading") {
      const level = block.level ?? 4;
      const cls =
        level <= 2
          ? "text-sm font-semibold text-ink mt-1"
          : "text-sm font-semibold text-teal mt-1";
      return (
        <p key={i} className={cls}>
          {renderInline(block.text)}
        </p>
      );
    }
    if (block.type === "p") {
      return (
        <p key={i} className="text-sm text-ink leading-relaxed">
          {renderInline(block.text)}
        </p>
      );
    }
    if (block.type === "list") {
      return <ListBlock key={i} node={block} />;
    }
    return null;
  });
}

function ListBlock({ node, level = 0 }) {
  const Tag = node.ordered ? "ol" : "ul";
  return (
    <Tag
      className={`${node.ordered ? "list-decimal" : "list-disc"} ${
        level === 0 ? "pl-5" : "pl-5 mt-1"
      } space-y-1.5 marker:text-amber/70 marker:font-mono`}
    >
      {node.items.map((item, i) => (
        <li key={i} className="text-sm text-ink leading-relaxed">
          {renderInline(item.text)}
          {item.children && <ListBlock node={item.children} level={level + 1} />}
        </li>
      ))}
    </Tag>
  );
}

/* --------------------------------- inline -------------------------------- */

const INLINE_RE = /(\*\*[^*]+\*\*|\$[^$]+\$|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;

function renderInline(text) {
  if (!text) return null;
  const parts = text.split(INLINE_RE).filter((p) => p !== "");
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 3) {
      return (
        <strong key={i} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("$") && part.endsWith("$") && part.length > 1) {
      return <MathSpan key={i} raw={part.slice(1, -1)} />;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code
          key={i}
          className="font-mono text-[12.5px] bg-rust/10 border border-rust/25 text-rust rounded px-1.5 py-0.5"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (
      (part.startsWith("*") && part.endsWith("*") && part.length > 1) ||
      (part.startsWith("_") && part.endsWith("_") && part.length > 1)
    ) {
      return (
        <em key={i} className="italic text-slate">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

/** `$...$` snippets are rendered as a monospace pill rather than real
 * LaTeX (no KaTeX in this project) — `\text{...}` gets unwrapped so plain
 * words like `\text{minsup}` read as "minsup" instead of raw TeX. */
function MathSpan({ raw }) {
  const cleaned = raw.replace(/\\text\{([^}]*)\}/g, "$1").trim();
  return (
    <code className="font-mono text-[12.5px] bg-teal/10 border border-teal/30 text-tealdark rounded px-1.5 py-0.5 whitespace-nowrap">
      {cleaned}
    </code>
  );
}

function stripMd(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\$([^$]+)\$/g, (_, inner) => inner.replace(/\\text\{([^}]*)\}/g, "$1"))
    .trim();
}
