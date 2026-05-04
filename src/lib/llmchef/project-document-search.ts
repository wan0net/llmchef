import { basename, normalizePath } from "@/lib/llmchef/file-manager-utils";
import { inferFilePreviewDescriptor } from "@/lib/llmchef/file-preview";
import { parseCrea8MarkdownNote } from "@/lib/llmchef/crea8-memory";
import { listFilesOp, readFileOp } from "@/lib/llmchef/vfs-operations";

const MAX_INDEX_BYTES = 200_000;
const MAX_RETRIEVAL_BYTES = 700_000;
const RETRIEVAL_CHUNK_SIZE = 1_800;
const RETRIEVAL_CHUNK_OVERLAP = 240;
const MAX_RETRIEVAL_CHUNKS = 10;
const MAX_RETRIEVAL_CONTEXT_CHARS = 18_000;
const SNIPPET_LENGTH = 220;
const IGNORED_DOCUMENT_TREE_NAMES = new Set([".git", ".llmchef", "node_modules"]);

export type ProjectSearchDocument = {
  name: string;
  path: string;
  type: string;
  size: number;
  snippet: string;
  indexText: string;
  kind: "wiki" | "file";
};

export const guessProjectDocumentMimeType = (
  name: string,
  browserType?: string,
): string => {
  if (browserType) return browserType;
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "md" || ext === "markdown" || ext === "mdx") return "text/markdown";
  if (ext === "txt" || ext === "log") return "text/plain";
  if (ext === "json") return "application/json";
  if (ext === "csv") return "text/csv";
  if (ext === "html" || ext === "htm") return "text/html";
  if (ext === "mmd") return "text/plain";
  if (ext === "js" || ext === "ts" || ext === "tsx" || ext === "jsx") {
    return "text/plain";
  }
  return "application/octet-stream";
};

export const isProjectDocumentIndexableText = (
  name: string,
  mimeType: string,
): boolean => {
  if (mimeType.startsWith("text/")) return true;
  return [
    "application/json",
    "application/xml",
    "application/yaml",
    "application/x-yaml",
  ].includes(mimeType) || /\.(md|mdx|markdown|mmd|txt|json|csv|html?|ya?ml|log|tsx?|jsx?|css)$/i.test(name);
};

export const projectDocumentQueryTerms = (query: string): string[] =>
  Array.from(
    new Set(
      query
        .toLowerCase()
        .match(/[a-z0-9][a-z0-9_-]{1,}/g)
        ?.filter((term) => term.length > 2) ?? [],
    ),
  );

const decodeText = (data: Uint8Array): string => new TextDecoder().decode(data);

const scoreText = (text: string, terms: string[]): number => {
  if (terms.length === 0) return 0;
  const haystack = text.toLowerCase();
  return terms.reduce((score, term) => {
    let count = 0;
    let index = haystack.indexOf(term);
    while (index !== -1) {
      count += 1;
      index = haystack.indexOf(term, index + term.length);
    }
    return score + count;
  }, 0);
};

const chunkText = (text: string): string[] => {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const hardEnd = Math.min(normalized.length, start + RETRIEVAL_CHUNK_SIZE);
    const softEnd =
      hardEnd === normalized.length
        ? hardEnd
        : Math.max(
            normalized.lastIndexOf("\n\n", hardEnd),
            normalized.lastIndexOf("\n", hardEnd),
          );
    const end = softEnd > start + RETRIEVAL_CHUNK_SIZE / 2 ? softEnd : hardEnd;
    chunks.push(normalized.slice(start, end).trim());
    if (end >= normalized.length) break;
    start = Math.max(0, end - RETRIEVAL_CHUNK_OVERLAP);
  }
  return chunks.filter(Boolean);
};

const readDocumentIndex = async (
  path: string,
  name: string,
  mimeType: string,
  fsInstance: typeof import("@zenfs/core").fs,
): Promise<Pick<ProjectSearchDocument, "kind" | "snippet" | "indexText">> => {
  if (!isProjectDocumentIndexableText(name, mimeType)) {
    return {
      kind: "file",
      snippet: "",
      indexText: `${name} ${path}`.toLowerCase(),
    };
  }

  try {
    const data = await readFileOp(path, { fsInstance, silent: true });
    const preview = decodeText(data.slice(0, MAX_INDEX_BYTES)).trim();
    let note: ReturnType<typeof parseCrea8MarkdownNote> | undefined;
    if (/\.mdx?$/i.test(name)) {
      try {
        note = parseCrea8MarkdownNote(preview, path);
      } catch {
        note = undefined;
      }
    }
    const body = note?.content ?? preview;
    return {
      kind: note ? "wiki" : "file",
      snippet: body.slice(0, SNIPPET_LENGTH),
      indexText: `${name} ${path} ${note?.title ?? ""} ${body}`.toLowerCase(),
    };
  } catch {
    return {
      kind: "file",
      snippet: "",
      indexText: `${name} ${path}`.toLowerCase(),
    };
  }
};

export const listProjectSearchDocuments = async (
  path: string,
  fsInstance: typeof import("@zenfs/core").fs,
): Promise<ProjectSearchDocument[]> => {
  const normalizedRoot = normalizePath(path);
  const entries = await listFilesOp(normalizedRoot, { fsInstance });
  const docs: ProjectSearchDocument[] = [];

  for (const entry of entries) {
    if (IGNORED_DOCUMENT_TREE_NAMES.has(entry.name)) continue;
    if (entry.isDirectory) {
      docs.push(...(await listProjectSearchDocuments(entry.path, fsInstance)));
      continue;
    }

    const type = guessProjectDocumentMimeType(entry.name);
    const previewDescriptor = inferFilePreviewDescriptor({
      name: entry.name,
      path: entry.path,
      mimeType: type,
      size: entry.size,
    });
    if (!isProjectDocumentIndexableText(entry.name, type)) {
      if (!["image", "audio", "video", "svg", "pdf"].includes(previewDescriptor.kind)) {
        continue;
      }
    }
    const indexed = await readDocumentIndex(entry.path, entry.name, type, fsInstance);
    docs.push({
      name: entry.name,
      path: entry.path,
      type,
      size: entry.size,
      ...indexed,
    });
  }

  return docs.sort((first, second) => first.path.localeCompare(second.path));
};

export const buildProjectDocumentSearchContext = async ({
  projectPath,
  query,
  fsInstance,
}: {
  projectPath: string;
  query: string;
  fsInstance: typeof import("@zenfs/core").fs;
}): Promise<{ content: string; chunkCount: number; docCount: number }> => {
  const docs = await listProjectSearchDocuments(projectPath, fsInstance);
  const terms = projectDocumentQueryTerms(query);
  const scoredChunks: Array<{
    doc: ProjectSearchDocument;
    index: number;
    score: number;
    text: string;
  }> = [];

  for (const doc of docs) {
    if (!isProjectDocumentIndexableText(doc.name, doc.type)) continue;

    const bytes = await readFileOp(doc.path, { fsInstance, silent: true });
    const text = decodeText(bytes.slice(0, MAX_RETRIEVAL_BYTES));
    const chunks = chunkText(text);
    const metadataScore = scoreText(`${doc.name} ${doc.path}`, terms) * 3;
    chunks.forEach((chunk, index) => {
      scoredChunks.push({
        doc,
        index,
        score: scoreText(chunk, terms) + metadataScore,
        text: chunk,
      });
    });
  }

  const sorted = scoredChunks
    .sort((first, second) => second.score - first.score)
    .slice(0, MAX_RETRIEVAL_CHUNKS);
  const chosen =
    sorted.some((chunk) => chunk.score > 0) || terms.length === 0
      ? sorted
      : scoredChunks.slice(0, Math.min(scoredChunks.length, MAX_RETRIEVAL_CHUNKS));

  let remaining = MAX_RETRIEVAL_CONTEXT_CHARS;
  const sections: string[] = [];
  for (const chunk of chosen) {
    if (remaining <= 0) break;
    const text = chunk.text.slice(0, remaining);
    remaining -= text.length;
    sections.push(
      [
        `## ${basename(chunk.doc.path)}`,
        `Path: ${chunk.doc.path}`,
        `Kind: ${chunk.doc.kind}`,
        `Chunk: ${chunk.index + 1}`,
        "",
        text,
      ].join("\n"),
    );
  }

  const content = [
    "# Project Document Search Context",
    "",
    "This is an automatic first-pass search over the current project's local wiki pages and files.",
    "Use it before guessing. Prefer explicitly attached/tagged documents when they are present. Cite paths when answering.",
    `Query: ${query}`,
    `Indexed documents: ${docs.length}`,
    "",
    ...sections,
  ].join("\n\n---\n\n");

  return {
    content,
    chunkCount: sections.length,
    docCount: docs.length,
  };
};
