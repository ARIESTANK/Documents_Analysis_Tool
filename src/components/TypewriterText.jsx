import { useEffect, useRef, useState } from "react";

/**
 * Reveals `text` a few characters at a time, like the model is "typing" its
 * answer. When `animate` is false the full text renders immediately (used
 * for messages loaded from history, so re-opening a chat doesn't replay it).
 */
export default function TypewriterText({ text, animate = true, speed = 14, onDone }) {
  const [shown, setShown] = useState(animate ? "" : text || "");
  const [done, setDone] = useState(!animate);
  const frameRef = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!animate) {
      setShown(text || "");
      setDone(true);
      return;
    }

    setShown("");
    setDone(false);
    const full = text || "";
    let i = 0;
    let last = performance.now();

    const step = (now) => {
      const elapsed = now - last;
      const charsToAdd = Math.max(1, Math.floor(elapsed / speed));
      if (elapsed >= speed) {
        i = Math.min(full.length, i + charsToAdd);
        setShown(full.slice(0, i));
        last = now;
      }
      if (i < full.length) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        setDone(true);
        doneRef.current?.();
      }
    };

    frameRef.current = requestAnimationFrame(step);
    return () => frameRef.current && cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, animate]);

  return (
    <>
      {shown}
      {!done && <span className="typewriter-caret" />}
    </>
  );
}
