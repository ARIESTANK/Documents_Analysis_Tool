import { useEffect, useState } from "react";
import { translateContent } from "../api/client.js";

/** Keep source data in English and translate only the visible UI result. */
export default function useTranslatedContent(content, language) {
  const [translated, setTranslated] = useState(content);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (content == null || language === "English") {
      setTranslated(content);
      setTranslating(false);
      return () => { cancelled = true; };
    }

    setTranslating(true);
    translateContent(content, language)
      .then((value) => { if (!cancelled) setTranslated(value); })
      .catch(() => { if (!cancelled) setTranslated(content); })
      .finally(() => { if (!cancelled) setTranslating(false); });

    return () => { cancelled = true; };
  }, [content, language]);

  return { content: translated, translating };
}
