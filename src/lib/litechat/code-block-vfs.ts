import { basename } from "./file-manager-utils";

export interface CodeBlockVfsPathInput {
  filepath?: string | null;
  language?: string | null;
  interactionId?: string | null;
  blockId?: string | null;
}

const GENERATED_DIR = "/Generated";

const EXTENSION_BY_LANGUAGE: Record<string, string> = {
  bash: ".sh",
  c: ".c",
  cpp: ".cpp",
  cs: ".cs",
  css: ".css",
  diff: ".diff",
  go: ".go",
  html: ".html",
  java: ".java",
  javascript: ".js",
  js: ".js",
  json: ".json",
  jsx: ".jsx",
  markdown: ".md",
  md: ".md",
  php: ".php",
  py: ".py",
  python: ".py",
  rb: ".rb",
  rs: ".rs",
  rust: ".rs",
  sh: ".sh",
  sql: ".sql",
  svelte: ".svelte",
  ts: ".ts",
  tsx: ".tsx",
  typescript: ".ts",
  xml: ".xml",
  yaml: ".yaml",
  yml: ".yml",
};

const MIME_BY_EXTENSION: Record<string, string> = {
  ".css": "text/css",
  ".diff": "text/plain",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".jsx": "text/javascript",
  ".md": "text/markdown",
  ".py": "text/x-python",
  ".sh": "application/x-sh",
  ".sql": "application/sql",
  ".svg": "image/svg+xml",
  ".ts": "text/typescript",
  ".tsx": "text/typescript",
  ".xml": "application/xml",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
};

export const buildCodeBlockVfsPath = ({
  filepath,
  language,
  interactionId,
  blockId,
}: CodeBlockVfsPathInput): string => {
  const candidate = sanitizePath(filepath);
  if (candidate) return candidate;

  const suffix = sanitizeFilename(blockId || interactionId || Date.now().toString());
  return `${GENERATED_DIR}/code-${suffix}${extensionForLanguage(language)}`;
};

export const mimeTypeForCodeBlock = (
  language?: string | null,
  path?: string | null
): string => {
  const extension = extensionOf(path ? basename(path) : "");
  if (extension && MIME_BY_EXTENSION[extension]) return MIME_BY_EXTENSION[extension];

  const languageExtension = extensionForLanguage(language);
  return MIME_BY_EXTENSION[languageExtension] ?? "text/plain";
};

export const extensionForLanguage = (language?: string | null): string => {
  if (!language) return ".txt";
  return EXTENSION_BY_LANGUAGE[language.toLowerCase()] ?? ".txt";
};

const sanitizePath = (filepath?: string | null): string | null => {
  const raw = filepath?.trim();
  if (!raw) return null;

  const normalized = raw
    .replace(/\0/g, "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "");

  const segments = normalized
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      segment === "." || segment === ".." ? "_" : sanitizeFilename(segment)
    );

  if (segments.length === 0) return null;

  const path = `/${segments.join("/")}`;
  return raw.startsWith("/") ? path : `${GENERATED_DIR}${path}`;
};

const sanitizeFilename = (value: string): string => {
  const cleaned = value
    .trim()
    .replace(/\0/g, "")
    .replace(/[<>:"|?*]/g, "-")
    .replace(/\s+/g, "-");

  return cleaned || "block";
};

const extensionOf = (name: string): string => {
  const lower = name.toLowerCase();
  const dotIndex = lower.lastIndexOf(".");
  if (dotIndex <= 0) return "";
  return lower.slice(dotIndex);
};
