// src/lib/llmchef/useMarkdownParser.ts
import { useMemo } from "react";
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

export interface UniversalBlockData {
  type: "block";
  lang: string | undefined;
  code: string;
  filepath?: string;
}

export type ParsedContent = (string | UniversalBlockData)[];

// Create a MarkdownIt parser instance with desired options
const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
  typographer: false,
});

const sanitizeMarkdownHtml = (html: string): string =>
  DOMPurify.sanitize(html, {
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
  });

export function parseMarkdownContent(
  markdownString: string | null | undefined,
): ParsedContent {
  if (!markdownString) {
    return [];
  }
  try {
    const tokens = md.parse(markdownString, {});
    const result: ParsedContent = [];
    let currentHtmlBuffer = "";
    let index = 0;

    while (index < tokens.length) {
      const token = tokens[index] as any;

      if (token.type === "fence") {
        if (currentHtmlBuffer) {
          result.push(currentHtmlBuffer);
          currentHtmlBuffer = "";
        }
        const fenceInfo = token.info?.trim() || "";
        let lang: string | undefined;
        let filepath: string | undefined;

        if (fenceInfo.includes(":")) {
          const [langPart, ...pathParts] = fenceInfo.split(":");
          lang = langPart || undefined;
          filepath = pathParts.join(":") || undefined;
        } else {
          lang = fenceInfo.split(" ")[0] || undefined;
        }

        result.push({
          type: "block",
          lang,
          code: token.content,
          filepath,
        });
        index++;
      } else {
        const nonFenceTokens: any[] = [];
        while (
          index < tokens.length &&
          (tokens[index] as any).type !== "fence"
        ) {
          nonFenceTokens.push(tokens[index]);
          index++;
        }
        if (nonFenceTokens.length > 0) {
          currentHtmlBuffer += sanitizeMarkdownHtml(
            md.renderer.render(nonFenceTokens, md.options, {})
          );
        }
      }
    }

    if (currentHtmlBuffer) {
      result.push(currentHtmlBuffer);
    }

    return result;
  } catch (error) {
    console.error("Markdown parsing error:", error);
    const safeMarkdownString = String(markdownString ?? "");
    const escapedString = safeMarkdownString
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    return [`<pre>${escapedString}</pre>`];
  }
}

export function useMarkdownParser(
  markdownString: string | null | undefined,
): ParsedContent {
  const parsedContent = useMemo(
    () => parseMarkdownContent(markdownString),
    [markdownString]
  );

  return parsedContent;
}
