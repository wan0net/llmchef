import DOMPurify from "dompurify";

const SANITIZE_OPTIONS = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ["target"],
  FORBID_TAGS: [
    "audio",
    "embed",
    "iframe",
    "img",
    "link",
    "meta",
    "object",
    "source",
    "track",
    "video",
  ],
} as const;

const REQUIRED_REL_TOKENS = ["noopener", "noreferrer"];

const normalizeAnchorRel = (anchor: HTMLAnchorElement) => {
  const relTokens = new Set(
    anchor.rel
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean)
  );

  REQUIRED_REL_TOKENS.forEach((token) => relTokens.add(token));
  anchor.rel = Array.from(relTokens).join(" ");
};

export const sanitizeRichTextHtml = (html: string): string => {
  const sanitized = DOMPurify.sanitize(html, SANITIZE_OPTIONS);

  if (typeof document === "undefined") {
    return sanitized;
  }

  const template = document.createElement("template");
  template.innerHTML = sanitized;

  template.content
    .querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')
    .forEach(normalizeAnchorRel);

  return template.innerHTML;
};
