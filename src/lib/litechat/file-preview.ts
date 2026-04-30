import { basename } from "./file-manager-utils";
import { isLikelyTextFile } from "./file-extensions";

export type FilePreviewKind =
  | "html"
  | "markdown"
  | "json"
  | "image"
  | "svg"
  | "audio"
  | "video"
  | "code"
  | "text"
  | "unsupported";

export interface FilePreviewInput {
  name?: string | null;
  path?: string | null;
  mimeType?: string | null;
  size?: number | null;
}

export interface FilePreviewDescriptor {
  kind: FilePreviewKind;
  name: string;
  path?: string;
  mimeType: string;
  size: number | null;
  extension: string;
  canPreview: boolean;
  requiresSandbox: boolean;
  reason?: string;
}

export const HTML_PREVIEW_SANDBOX =
  "allow-scripts";

export const HTML_PREVIEW_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "connect-src 'none'",
  "font-src data:",
  "form-action 'none'",
  "frame-src 'none'",
  "img-src data: blob: https: http:",
  "media-src data: blob: https: http:",
  "object-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
].join("; ");

const CODE_EXTENSIONS = new Set([
  ".astro",
  ".bash",
  ".bat",
  ".c",
  ".cmd",
  ".cpp",
  ".cs",
  ".css",
  ".dart",
  ".diff",
  ".go",
  ".h",
  ".hpp",
  ".java",
  ".js",
  ".jsx",
  ".kt",
  ".lua",
  ".php",
  ".pl",
  ".ps1",
  ".py",
  ".rb",
  ".rs",
  ".scss",
  ".sh",
  ".sql",
  ".svelte",
  ".swift",
  ".tf",
  ".ts",
  ".tsx",
  ".vue",
  ".yaml",
  ".yml",
  ".zsh",
]);

const extensionOf = (name: string): string => {
  const lower = name.toLowerCase();
  const dotIndex = lower.lastIndexOf(".");
  if (dotIndex <= 0) return "";
  return lower.slice(dotIndex);
};

export const inferFilePreviewDescriptor = (
  input: FilePreviewInput
): FilePreviewDescriptor => {
  const name = input.name ?? (input.path ? basename(input.path) : "Untitled");
  const path = input.path ?? undefined;
  const mimeType = input.mimeType ?? "";
  const size = input.size ?? null;
  const extension = extensionOf(name);
  const kind = inferPreviewKind(name, mimeType);

  if (kind === "unsupported") {
    return {
      kind,
      name,
      path,
      mimeType,
      size,
      extension,
      canPreview: false,
      requiresSandbox: false,
      reason: "This file type is not previewable yet.",
    };
  }

  return {
    kind,
    name,
    path,
    mimeType,
    size,
    extension,
    canPreview: true,
    requiresSandbox: kind === "html",
  };
};

export const inferPreviewKind = (
  name: string,
  mimeType?: string | null
): FilePreviewKind => {
  const extension = extensionOf(name);
  const mime = mimeType ?? "";

  if (mime === "text/html" || extension === ".html" || extension === ".htm") {
    return "html";
  }
  if (mime === "image/svg+xml" || extension === ".svg") return "svg";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (
    mime === "application/json" ||
    mime.endsWith("+json") ||
    extension === ".json" ||
    extension === ".webmanifest"
  ) {
    return "json";
  }
  if (extension === ".md" || extension === ".markdown" || extension === ".mdx") {
    return "markdown";
  }
  if (CODE_EXTENSIONS.has(extension)) return "code";
  if (isLikelyTextFile(name, mime)) return "text";

  return "unsupported";
};

export const decodePreviewText = (data: Uint8Array | string): string => {
  if (typeof data === "string") return data;
  return new TextDecoder().decode(data);
};

export const createPreviewBlob = (
  data: Uint8Array | string,
  descriptor: FilePreviewDescriptor
): Blob => {
  const type = descriptor.mimeType || mimeTypeForKind(descriptor.kind);
  return new Blob([data], { type });
};

export const buildSandboxedHtmlPreviewDocument = (html: string): string => {
  const hasHtmlShell = /<html[\s>]/i.test(html);
  const csp = `<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttribute(
    HTML_PREVIEW_CSP
  )}">`;

  if (hasHtmlShell) {
    if (/<head[\s>]/i.test(html)) {
      return html.replace(/<head([^>]*)>/i, `<head$1>${csp}`);
    }
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${csp}</head>`);
  }

  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8">',
    csp,
    "</head>",
    "<body>",
    html,
    "</body>",
    "</html>",
  ].join("");
};

const mimeTypeForKind = (kind: FilePreviewKind): string => {
  switch (kind) {
    case "html":
      return "text/html";
    case "markdown":
    case "code":
    case "text":
      return "text/plain";
    case "json":
      return "application/json";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
};

const escapeHtmlAttribute = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};
