import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { askQuestion, getChatHistory } from "../api/client.js";
import useTranslatedContent from "../hooks/useTranslatedContent.js";
import { useToast } from "../context/ToastContext.jsx";
import TranslatingOverlay from "./TranslatingOverlay.jsx";
import TypewriterText from "./TypewriterText.jsx";

const SUGGESTIONS = [
  "Summarize this paper",
  "Explain the CNN section",
  "What dataset was used?",
  "What are the main limitations?",
];

export default function ChatPanel({ document, onCitationsUpdate, language }) {
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const messageContents = useMemo(() => messages.map((message) => message.content), [messages]);
  const { content: displayedMessages, translating } = useTranslatedContent(messageContents, language);

  // Messages restored from history render instantly; only replies that
  // arrive during this session get the typewriter reveal.
  const [animateFrom, setAnimateFrom] = useState(0);
  const animatedRef = useRef(new Set());

  useEffect(() => {
    if (!document?.id) return;
    getChatHistory(document.id)
      .then((history) => {
        setMessages(history);
        setAnimateFrom(history.length);
      })
      .catch(() => {});
  }, [document?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (question) => {
    const q = (question ?? input).trim();
    if (!q || sending) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setSending(true);
    try {
      const result = await askQuestion(document.id, q);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.answer, citations: result.citations },
      ]);
      onCitationsUpdate?.(result.citations || []);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong reaching the assistant. Check the backend logs.", citations: [] },
      ]);
      toast.error("Couldn't reach the assistant.");
    } finally {
      setSending(false);
    }
  };

  if (!document) {
    return <PlaceholderPane text="Select a ready paper on the left to start chatting." />;
  }
  if (document.status !== "ready") {
    return <PlaceholderPane text={`This paper is still ${document.status}. Chat will unlock once it's ready.`} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="chat-scroll flex-1 overflow-y-auto px-1 py-3 space-y-4 scroll-smooth">
        {messages.length === 0 && (
          <div className="mb-4">
            <p className="text-sm text-slate mb-2 font-mono">Try asking —</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="btn-press text-xs border border-rule bg-white/50 hover:bg-white/80 hover:border-teal/50 rounded-full px-3 py-1.5 text-ink transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <TranslatingOverlay loading={translating} className="space-y-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex animate-fade-in-up ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm leading-relaxed transition-shadow ${
                m.role === "user"
                  ? "bg-teal text-parchment rounded-br-sm"
                  : "bg-white/70 border border-rule text-ink rounded-bl-sm"
              }`}
            >
              <p className="whitespace-pre-wrap">
                {m.role === "assistant" && i >= animateFrom && !animatedRef.current.has(i) ? (
                  <TypewriterText
                    text={displayedMessages?.[i] ?? m.content}
                    animate
                    onDone={() => animatedRef.current.add(i)}
                  />
                ) : (
                  displayedMessages?.[i] ?? m.content
                )}
              </p>
              {m.citations?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-rule/60">
                  {m.citations.map((c, ci) => (
                    <span
                      key={ci}
                      className="inline-flex items-center gap-1 text-[11px] font-mono bg-amber/15 text-amber border border-amber/30 rounded px-1.5 py-0.5"
                    >
                      <span className="leader-dot" /> p.{c.page} · {c.section}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        </TranslatingOverlay>

        {sending && (
          <div className="flex justify-start animate-fade-in-up">
            <div className="bg-white/70 border border-rule text-slate rounded-lg rounded-bl-sm px-4 py-3 flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1 text-teal">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </span>
              <span className="text-xs font-mono">Reading the paper…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 border-t border-rule pt-3 mt-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about this paper…"
          className="flex-1 border border-rule rounded-md px-3 py-2 text-sm bg-white/70 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
        />
        <button
          type="submit"
          disabled={sending}
          className="btn-press bg-teal hover:bg-tealdark disabled:opacity-50 text-parchment rounded-md px-3 py-2 shadow-sm hover:shadow-md"
        >
          <Send size={16} className={sending ? "animate-pulse" : ""} />
        </button>
      </form>
    </div>
  );
}

function PlaceholderPane({ text }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 animate-fade-in">
      <Sparkles className="text-teal mb-3 animate-float-slow" size={22} />
      <p className="text-sm text-slate max-w-xs">{text}</p>
    </div>
  );
}
