// src/lib/llmchef/useMarkdownParser.ts
import { useMemo } from "react";
import MarkdownIt from "markdown-it";
import { sanitizeRichTextHtml } from "./render-sanitizer";

export interface UniversalBlockData {
  type: "block";
  lang: string | undefined;
  code: string;
  filepath?: string;
}

export interface MdxComponentData {
  type: "mdx-component";
  component: "Embed" | "File" | "Callout" | "Unsupported";
  props: Record<string, string>;
  children?: string;
  source: string;
}

export type ParsedContent = (string | UniversalBlockData | MdxComponentData)[];

// Create a MarkdownIt parser instance with desired options
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
});

// Open external links in a new tab and mark them for rel normalization.
const defaultLinkOpen = md.renderer.rules.link_open ?? ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const href = token.attrGet("href");
  if (href && /^https?:\/\//.test(href)) {
    token.attrSet("target", "_blank");
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

const parseMdxProps = (rawProps: string): Record<string, string> => {
  const props: Record<string, string> = {};
  for (const match of rawProps.matchAll(/([A-Za-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    props[match[1]] = match[2] ?? match[3] ?? "";
  }
  return props;
};

const parseMdxComponentSource = (source: string): MdxComponentData | null => {
  const trimmed = source.trim();
  const selfClosing = trimmed.match(/^<([A-Z][\w]*)\b([^>]*)\/>$/s);
  if (selfClosing) {
    const componentName = selfClosing[1];
    const component = ["Embed", "File", "Callout"].includes(componentName)
      ? (componentName as MdxComponentData["component"])
      : "Unsupported";
    return {
      type: "mdx-component",
      component,
      props: parseMdxProps(selfClosing[2] ?? ""),
      source,
    };
  }

  const paired = trimmed.match(/^<([A-Z][\w]*)\b([^>]*)>([\s\S]*)<\/\1>$/);
  if (paired) {
    const componentName = paired[1];
    const component = componentName === "Callout" ? "Callout" : "Unsupported";
    return {
      type: "mdx-component",
      component,
      props: parseMdxProps(paired[2] ?? ""),
      children: paired[3]?.trim(),
      source,
    };
  }

  if (/^<[A-Z][\w]*(\s|>|\/)/.test(trimmed)) {
    return {
      type: "mdx-component",
      component: "Unsupported",
      props: {},
      source,
    };
  }

  return null;
};

const splitMdxSegments = (
  markdownString: string,
): Array<{ type: "markdown"; source: string } | MdxComponentData> => {
  const normalized = markdownString.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const segments: Array<{ type: "markdown"; source: string } | MdxComponentData> = [];
  const markdownBuffer: string[] = [];
  let index = 0;
  let fenceMarker: string | null = null;

  const flushMarkdown = () => {
    const source = markdownBuffer.join("\n");
    if (source.trim()) segments.push({ type: "markdown", source });
    markdownBuffer.length = 0;
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);

    if (fenceMarker) {
      markdownBuffer.push(line);
      if (fenceMatch?.[1]?.startsWith(fenceMarker)) {
        fenceMarker = null;
      }
      index++;
      continue;
    }

    if (fenceMatch) {
      fenceMarker = fenceMatch[1][0];
      markdownBuffer.push(line);
      index++;
      continue;
    }

    if (/^<[A-Z][\w]*\b/.test(trimmed)) {
      const blockLines = [line];
      const opening = trimmed.match(/^<([A-Z][\w]*)\b/);
      if (opening && !/\/>\s*$/.test(trimmed) && !new RegExp(`</${opening[1]}>\\s*$`).test(trimmed)) {
        index++;
        while (index < lines.length) {
          blockLines.push(lines[index]);
          if (new RegExp(`</${opening[1]}>\\s*$`).test(lines[index].trim())) break;
          index++;
        }
      }
      const component = parseMdxComponentSource(blockLines.join("\n"));
      if (component) {
        flushMarkdown();
        segments.push(component);
      } else {
        markdownBuffer.push(...blockLines);
      }
    } else {
      markdownBuffer.push(line);
    }
    index++;
  }

  flushMarkdown();
  return segments;
};

const parseMarkdownOnlyContent = (markdownString: string): ParsedContent => {
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
        currentHtmlBuffer += sanitizeRichTextHtml(
          md.renderer.render(nonFenceTokens, md.options, {})
        );
      }
    }
  }

  if (currentHtmlBuffer) {
    result.push(currentHtmlBuffer);
  }

  return result;
};
export function parseMarkdownContent(
  markdownString: string | null | undefined,
): ParsedContent {
  if (!markdownString) {
    return [];
  }
  try {
    const result: ParsedContent = [];
    for (const segment of splitMdxSegments(markdownString)) {
      if (segment.type === "markdown") {
        result.push(...parseMarkdownOnlyContent(segment.source));
      } else {
        result.push(segment);
      }
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
