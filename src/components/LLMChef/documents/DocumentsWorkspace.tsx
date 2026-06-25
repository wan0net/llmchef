import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpenTextIcon,
  ChartNoAxesCombinedIcon,
  LinkIcon,
  CopyIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileJsonIcon,
  FilePlusIcon,
  FileTextIcon,
  FileVideoIcon,
  FolderIcon,
  FolderPlusIcon,
  HashIcon,
  MessageSquarePlusIcon,
  PaperclipIcon,
  PencilIcon,
  Loader2Icon,
  RefreshCwIcon,
  SaveIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { FilePreviewDialog } from "@/components/LLMChef/file-manager/FilePreviewDialog";
import { FolderSyncConfirmDialog } from "@/components/LLMChef/file-manager/FolderSyncConfirmDialog";
import { createCrea8VfsConnector } from "@/lib/llmchef/crea8-vfs-connector";
import { parseCrea8MarkdownNote } from "@/lib/llmchef/crea8-memory";
import {
  basename,
  dirname,
  joinPath,
  normalizePath,
} from "@/lib/llmchef/file-manager-utils";
import {
  createDirectoryOp,
  deleteItemOp,
  listFilesOp,
  readFileOp,
  renameOp,
  writeFileOp,
} from "@/lib/llmchef/vfs-operations";
import {
  inferFilePreviewDescriptor,
  type FilePreviewDescriptor,
} from "@/lib/llmchef/file-preview";
import { useProjectStore } from "@/store/project.store";
import { useVfsStore } from "@/store/vfs.store";
import { useInputStore } from "@/store/input.store";
import { useUIStateStore } from "@/store/ui.store";
import {
  describeRealFsSyncResult,
  getProjectDirectoryHandleInfo,
  isRealFsSyncSupported,
  pickProjectDirectory,
  planRealFsSyncTwoWay,
  planProjectDirectoryTwoWay,
  syncProjectDirectoryTwoWay,
  type RealFsSyncPlan,
} from "@/lib/llmchef/real-fs-sync";
import type {
  Crea8MemoryNote,
} from "@/types/llmchef/crea8-memory";

type DocumentsWorkspaceProps = {
  currentProjectId: string | null;
  sidebarPortalTarget?: HTMLElement | null;
};

type ActiveDocument =
  | { kind: "crea8"; doc: WorkspaceDocument; note: Crea8MemoryNote }
  | { kind: "file"; doc: WorkspaceDocument; content: string; data: Uint8Array };

type TreeNodeModel<T> = {
  name: string;
  path: string;
  children: TreeNodeModel<T>[];
  item?: T;
};

type WorkspaceDocument = {
  kind: "crea8" | "file";
  name: string;
  path: string;
  type: string;
  size: number;
  updatedAt: Date;
  snippet: string;
  indexText: string;
  wikiLinks: string[];
  terms: string[];
  previewDescriptor: FilePreviewDescriptor;
  memoryNote?: Crea8MemoryNote;
};

const PROJECT_HOME_FILENAME = "Home.md";
const MAX_INDEX_BYTES = 200_000;
const MAX_RETRIEVAL_BYTES = 700_000;
const RETRIEVAL_CHUNK_SIZE = 1_800;
const RETRIEVAL_CHUNK_OVERLAP = 240;
const MAX_RETRIEVAL_CHUNKS = 12;
const MAX_RETRIEVAL_CONTEXT_CHARS = 24_000;
const SNIPPET_LENGTH = 220;
const IGNORED_DOCUMENT_TREE_NAMES = new Set([".git", ".llmchef"]);
const WikiMarkdownPreview = React.lazy(() => import("./WikiMarkdownPreview"));
const MermaidDiagramStudio = React.lazy(() => import("./MermaidDiagramStudio"));

const workspacePathParts = (path: string, rootPath: string): string[] => {
  const normalizedPath = normalizePath(path);
  const normalizedRoot = normalizePath(rootPath);
  const relative =
    normalizedPath === normalizedRoot
      ? ""
      : normalizedPath.startsWith(`${normalizedRoot}/`)
        ? normalizedPath.slice(normalizedRoot.length + 1)
        : normalizedPath.replace(/^\/+/, "");
  return relative.split("/").filter(Boolean);
};

const sortTree = <T,>(node: TreeNodeModel<T>): TreeNodeModel<T> => ({
  ...node,
  children: node.children
    .map(sortTree)
    .sort((first, second) => {
      if (Boolean(first.item) !== Boolean(second.item)) return first.item ? 1 : -1;
      return first.name.localeCompare(second.name);
    }),
});

const buildWorkspaceTree = (
  docs: WorkspaceDocument[],
  rootPath: string,
  rootName: string,
): TreeNodeModel<WorkspaceDocument> => {
  const root: TreeNodeModel<WorkspaceDocument> = {
    name: rootName,
    path: rootPath,
    children: [],
  };

  for (const doc of docs) {
    addTreePath(root, workspacePathParts(doc.path, rootPath), doc);
  }

  return sortTree(root);
};

const addTreePath = <T,>(
  root: TreeNodeModel<T>,
  parts: string[],
  item: T,
): void => {
  let current = root;
  let path = root.path;

  parts.forEach((part, index) => {
    path = joinPath(path, part);
    const isFile = index === parts.length - 1;
    let child = current.children.find((node) => node.name === part);

    if (!child) {
      child = { name: part, path, children: [] };
      current.children.push(child);
    }

    if (isFile) child.item = item;
    current = child;
  });
};

const guessMimeType = (name: string, browserType?: string): string => {
  if (browserType) return browserType;
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "md" || ext === "markdown") return "text/markdown";
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

const isIndexableText = (name: string, mimeType: string): boolean => {
  if (mimeType.startsWith("text/")) return true;
  return [
    "application/json",
    "application/xml",
    "application/yaml",
    "application/x-yaml",
  ].includes(mimeType) || /\.(md|markdown|mmd|txt|json|csv|html?|ya?ml|log|tsx?|jsx?|css)$/i.test(name);
};

const decodeText = (data: Uint8Array): string => new TextDecoder().decode(data);

const queryTerms = (query: string): string[] =>
  Array.from(
    new Set(
      query
        .toLowerCase()
        .match(/[a-z0-9][a-z0-9_-]{1,}/g)
        ?.filter((term) => term.length > 2) ?? [],
    ),
  );

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

const buildRetrievalContext = async (
  docs: WorkspaceDocument[],
  question: string,
  fsInstance: typeof import("@zenfs/core").fs,
): Promise<{ content: string; chunkCount: number }> => {
  const terms = queryTerms(question);
  const scoredChunks: Array<{
    doc: WorkspaceDocument;
    index: number;
    score: number;
    text: string;
  }> = [];

  for (const doc of docs) {
    if (!isIndexableText(doc.name, doc.type)) continue;

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
        `## ${chunk.doc.name}`,
        `Path: ${chunk.doc.path}`,
        `Chunk: ${chunk.index + 1}`,
        "",
        text,
      ].join("\n"),
    );
  }

  const content = [
    "# Selected Project Document Context",
    "",
    "Use these locally selected passages as source context in chat. Cite paths when answering.",
    `Selection hint: ${question}`,
    "",
    ...sections,
  ].join("\n\n---\n\n");

  return { content, chunkCount: sections.length };
};

const iconForPreviewKind = (doc: WorkspaceDocument): React.ReactNode => {
  const className = "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground";
  if (doc.kind === "crea8") return <BookOpenTextIcon className={className} />;
  if (isMermaidDiagramDoc(doc)) return <ChartNoAxesCombinedIcon className={className} />;
  switch (doc.previewDescriptor.kind) {
    case "image":
    case "svg":
      return <FileImageIcon className={className} />;
    case "audio":
      return <FileAudioIcon className={className} />;
    case "video":
      return <FileVideoIcon className={className} />;
    case "json":
      return <FileJsonIcon className={className} />;
    case "code":
    case "html":
      return <FileCodeIcon className={className} />;
    case "markdown":
    case "text":
      return <FileTextIcon className={className} />;
    default:
      return <FileIcon className={className} />;
  }
};

const readCrea8NoteIfPresent = (
  path: string,
  name: string,
  mimeType: string,
  text: string,
): Crea8MemoryNote | undefined => {
  if (!isIndexableText(name, mimeType) || !/\.mdx?$/i.test(name)) return undefined;
  try {
    return parseCrea8MarkdownNote(text, path);
  } catch {
    return undefined;
  }
};

const sha256Hex = async (data: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const bytesToBase64 = (data: Uint8Array): string => {
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let index = 0; index < data.length; index += chunkSize) {
    const chunk = data.slice(index, index + chunkSize);
    chunks.push(String.fromCharCode(...chunk));
  }
  return btoa(chunks.join(""));
};

const filenameStem = (name: string): string =>
  name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9._-]+/gi, "-") || "extract";

const wikiLabelForDoc = (doc: WorkspaceDocument): string =>
  doc.memoryNote?.title ?? doc.name.replace(/\.(md|markdown|mdx)$/i, "");

const isWikiMarkdownDoc = (doc: WorkspaceDocument): boolean =>
  doc.kind === "crea8" || doc.previewDescriptor.kind === "markdown";

const isMermaidDiagramDoc = (doc: WorkspaceDocument): boolean =>
  /\.mmd$/i.test(doc.name);

const defaultMermaidDiagram = (title: string): string =>
  [
    "flowchart TD",
    `    A[${title}] --> B{What needs to happen?}`,
    "    B --> C[Draft diagram]",
    "    B --> D[Review in chat]",
    "    C --> E[Save to project wiki]",
    "    D --> E",
    "",
  ].join("\n");

const isMissingPathError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const code = (error as Error & { code?: string }).code;
  return code === "ENOENT" || /not found|no such file/i.test(error.message);
};

const wikiLinkTargets = (markdown: string): string[] =>
  Array.from(markdown.matchAll(/\[\[([^\]]+)\]\]/g))
    .map((match) => match[1]?.split("|")[0]?.trim())
    .filter((target): target is string => Boolean(target));

const tokenizeWikiText = (text: string): string[] =>
  Array.from(new Set(
    text
      .toLowerCase()
      .match(/[a-z0-9][a-z0-9_-]{2,}/g)
      ?.filter(
        (term) =>
          ![
            "the",
            "and",
            "for",
            "with",
            "from",
            "this",
            "that",
            "wiki",
            "page",
            "project",
          ].includes(term),
      ) ?? [],
  ));

const normalizeWikiLinkLabel = (label: string): string =>
  label.trim().toLowerCase().replace(/\.(md|markdown|mdx)$/i, "");

const buildProjectHomeContent = (workspaceLabel: string): string =>
  [
    `# ${workspaceLabel}`,
    "",
    "This is the human-facing home for the project knowledge base.",
    "",
    "## Start Here",
    "",
    "- [[Wiki/Second Brain/_index]]",
    "- [[Wiki/Second Brain/overview]]",
    "- [[Wiki]]",
    "",
    "## Working Notes",
    "",
    "- Capture durable decisions, findings, and questions as Markdown.",
    "- Keep source files alongside wiki pages so notebook queries can use both.",
    "- Let LLMChef add second-brain memories automatically, then edit them here.",
    "",
  ].join("\n");

const ensureProjectHomePage = async ({
  fsInstance,
  workspaceRoot,
  workspaceLabel,
  projectId,
  connector,
}: {
  fsInstance: typeof import("@zenfs/core").fs;
  workspaceRoot: string;
  workspaceLabel: string;
  projectId: string | null;
  connector: ReturnType<typeof createCrea8VfsConnector>;
}): Promise<string> => {
  const homePath = joinPath(workspaceRoot, PROJECT_HOME_FILENAME);
  try {
    await readFileOp(homePath, { fsInstance, silent: true });
    return homePath;
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
  }

  await createDirectoryOp(joinPath(workspaceRoot, "Wiki"), { fsInstance });
  await createDirectoryOp(joinPath(workspaceRoot, "Wiki", "Second Brain"), {
    fsInstance,
  });
  await connector.create({
    title: workspaceLabel,
    content: buildProjectHomeContent(workspaceLabel),
    scope: projectId ? "project" : "reference",
    tags: ["home", "wiki"],
    projectId,
    path: homePath,
  });
  return homePath;
};

const indexWorkspaceDocument = async (
  path: string,
  name: string,
  mimeType: string,
  fsInstance: typeof import("@zenfs/core").fs,
): Promise<{
	  kind: WorkspaceDocument["kind"];
	  snippet: string;
	  indexText: string;
	  wikiLinks: string[];
	  terms: string[];
	  memoryNote?: Crea8MemoryNote;
	}> => {
  if (!isIndexableText(name, mimeType)) {
    return {
      kind: "file",
      snippet: "",
      indexText: `${name} ${path}`.toLowerCase(),
      wikiLinks: [],
      terms: tokenizeWikiText(`${name} ${path}`),
    };
  }

  try {
    const data = await readFileOp(path, { fsInstance, silent: true });
    const preview = decodeText(data.slice(0, MAX_INDEX_BYTES)).trim();
    const memoryNote = readCrea8NoteIfPresent(path, name, mimeType, preview);
    const indexText = `${name} ${path} ${memoryNote?.title ?? ""} ${
      memoryNote?.content ?? preview
    }`.toLowerCase();
    return {
      kind: memoryNote ? "crea8" : "file",
      snippet: (memoryNote?.content ?? preview).slice(0, SNIPPET_LENGTH),
      indexText,
      wikiLinks: wikiLinkTargets(memoryNote?.content ?? preview).map(normalizeWikiLinkLabel),
      terms: tokenizeWikiText(indexText),
      memoryNote,
    };
  } catch {
    return {
      kind: "file",
      snippet: "",
      indexText: `${name} ${path}`.toLowerCase(),
      wikiLinks: [],
      terms: tokenizeWikiText(`${name} ${path}`),
    };
  }
};

const listWorkspaceDocuments = async (
  path: string,
  fsInstance: typeof import("@zenfs/core").fs,
): Promise<WorkspaceDocument[]> => {
  const entries = await listFilesOp(path, { fsInstance });
  const docs: WorkspaceDocument[] = [];

  for (const entry of entries) {
    if (IGNORED_DOCUMENT_TREE_NAMES.has(entry.name)) continue;
    if (entry.isDirectory) {
      docs.push(...(await listWorkspaceDocuments(entry.path, fsInstance)));
      continue;
    }

    const type = guessMimeType(entry.name);
    const indexed = await indexWorkspaceDocument(
      entry.path,
      entry.name,
      type,
      fsInstance,
    );
    const previewDescriptor = inferFilePreviewDescriptor({
      name: entry.name,
      path: entry.path,
      mimeType: type,
      size: entry.size,
    });

    docs.push({
      kind: indexed.kind,
      name: entry.name,
      path: entry.path,
      type,
      size: entry.size,
      updatedAt: entry.lastModified,
      previewDescriptor,
      ...indexed,
    });
  }

  return docs.sort((first, second) => first.path.localeCompare(second.path));
};

const TreeNode = <T,>({
  node,
  selectedKey,
  selectedFolderPath,
  depth = 0,
  label,
  meta,
  snippet,
  icon,
  itemKey,
  onSelect,
  onSelectFolder,
  onCreatePageInFolder,
  onCreateFolderInFolder,
  onToggleSelect,
}: {
  node: TreeNodeModel<T>;
  selectedKey: string | null;
  selectedFolderPath: string | null;
  depth?: number;
  label: (item: T) => string;
  meta?: (item: T) => React.ReactNode;
  snippet?: (item: T) => string | undefined;
  icon?: (item: T) => React.ReactNode;
  itemKey: (item: T) => string;
  onSelect: (item: T) => void;
  onSelectFolder: (path: string) => void;
  onCreatePageInFolder?: (path: string) => void;
  onCreateFolderInFolder?: (path: string) => void;
  onToggleSelect?: (item: T) => void;
}) => {
  const isFile = Boolean(node.item);
  const renderedLabel = node.item ? label(node.item) : node.name;
  const isSelected = node.item
    ? itemKey(node.item) === selectedKey
    : node.path === selectedFolderPath;

  return (
    <div>
      <button
        type="button"
        className={[
          "group flex min-h-9 w-full min-w-0 items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
          isFile ? "hover:bg-muted/60" : "hover:bg-muted/40",
          isSelected ? "bg-primary/10 text-primary" : "",
        ].join(" ")}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => {
          if (node.item) onSelect(node.item);
          else onSelectFolder(node.path);
        }}
      >
        {isFile && node.item ? (
          icon?.(node.item) ?? (
            <FileTextIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <FolderIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{renderedLabel}</span>
            {node.item ? meta?.(node.item) : null}
          </span>
          {node.item && snippet?.(node.item) ? (
            <span className="line-clamp-2 text-muted-foreground">
              {snippet(node.item)}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {node.item ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              aria-label={`Toggle context for ${renderedLabel}`}
              onClick={(event) => {
                event.stopPropagation();
                if (node.item) onToggleSelect?.(node.item);
              }}
            >
              <PaperclipIcon className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                aria-label={`New page in ${renderedLabel}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onCreatePageInFolder?.(node.path);
                }}
              >
                <BookOpenTextIcon className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                aria-label={`New folder in ${renderedLabel}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onCreateFolderInFolder?.(node.path);
                }}
              >
                <FolderPlusIcon className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </span>
      </button>
      {node.children.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          selectedKey={selectedKey}
          selectedFolderPath={selectedFolderPath}
          depth={depth + 1}
          label={label}
          meta={meta}
          snippet={snippet}
          icon={icon}
          itemKey={itemKey}
          onSelect={onSelect}
          onSelectFolder={onSelectFolder}
          onCreatePageInFolder={onCreatePageInFolder}
          onCreateFolderInFolder={onCreateFolderInFolder}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
};

export const DocumentsWorkspace: React.FC<DocumentsWorkspaceProps> = ({
  currentProjectId,
  sidebarPortalTarget,
}) => {
  const fs = useVfsStore((state) => state.fs);
  const vfsLoading = useVfsStore((state) => state.loading);
  const operationLoading = useVfsStore((state) => state.operationLoading);
  const currentProject = useProjectStore((state) =>
    state.getProjectById(currentProjectId),
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [workspaceDocs, setWorkspaceDocs] = useState<WorkspaceDocument[]>([]);
  const [docSearch, setDocSearch] = useState("");
  const [selectedDocPaths, setSelectedDocPaths] = useState<Set<string>>(new Set());
  const [activeFolderPath, setActiveFolderPath] = useState<string | null>(null);
  const [activeDocument, setActiveDocument] = useState<ActiveDocument | null>(null);
  const [draft, setDraft] = useState("");
  const [isEditingCrea8, setIsEditingCrea8] = useState(false);
  const [previewDescriptor, setPreviewDescriptor] =
    useState<FilePreviewDescriptor | null>(null);
  const [previewData, setPreviewData] = useState<Uint8Array | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localFolderName, setLocalFolderName] = useState<string | null>(null);
  const [localFolderStatus, setLocalFolderStatus] = useState<string | null>(null);
  const [syncingLocalFolder, setSyncingLocalFolder] = useState(false);
  const [syncPlan, setSyncPlan] = useState<RealFsSyncPlan | null>(null);
  const [isSyncConfirmOpen, setIsSyncConfirmOpen] = useState(false);
  const [isSyncConfirming, setIsSyncConfirming] = useState(false);
  const pendingSyncRef = useRef<(() => Promise<void>) | null>(null);

  const workspaceRoot = useMemo(
    () => normalizePath(currentProject?.path ?? "/"),
    [currentProject?.path],
  );
  const workspaceLabel = currentProject?.name ?? "Select a project";
  const homePath = useMemo(
    () => joinPath(workspaceRoot, PROJECT_HOME_FILENAME),
    [workspaceRoot],
  );
  const connector = useMemo(
    () =>
      fs
        ? createCrea8VfsConnector({
            rootPath: workspaceRoot,
            fsInstance: fs,
          })
        : null,
    [fs, workspaceRoot],
  );
  const filteredWorkspaceDocs = useMemo(() => {
    const query = docSearch.trim().toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    return workspaceDocs.filter(
      (doc) =>
        terms.length === 0 ||
        terms.every((term) => doc.indexText.includes(term)),
    );
  }, [docSearch, workspaceDocs]);
  const workspaceTree = useMemo(
    () => buildWorkspaceTree(filteredWorkspaceDocs, workspaceRoot, workspaceLabel),
    [filteredWorkspaceDocs, workspaceLabel, workspaceRoot],
  );
  const activeFolderDocs = useMemo(() => {
    const folderPath = normalizePath(activeFolderPath ?? workspaceRoot);
    return workspaceDocs.filter((doc) => dirname(doc.path) === folderPath);
  }, [activeFolderPath, workspaceDocs, workspaceRoot]);
  const selectedDocs = useMemo(
    () => workspaceDocs.filter((doc) => selectedDocPaths.has(doc.path)),
    [workspaceDocs, selectedDocPaths],
  );
  const secondBrainCount = useMemo(
    () =>
      workspaceDocs.filter((doc) =>
        normalizePath(doc.path).startsWith(joinPath(workspaceRoot, "Wiki", "Second Brain")),
      ).length,
    [workspaceDocs, workspaceRoot],
  );
  const busy = loading || importing || vfsLoading || operationLoading;
  const localSyncSupported = isRealFsSyncSupported();

  const configureFolderInput = useCallback((node: HTMLInputElement | null) => {
    folderInputRef.current = node;
    if (!node) return;
    node.setAttribute("webkitdirectory", "");
    node.setAttribute("directory", "");
  }, []);

  const loadDocuments = useCallback(async () => {
    if (!fs || !currentProject) {
      setWorkspaceDocs([]);
      setActiveDocument(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createDirectoryOp(workspaceRoot, { fsInstance: fs });
      const workspaceConnector = createCrea8VfsConnector({
        rootPath: workspaceRoot,
        fsInstance: fs,
      });
      await ensureProjectHomePage({
        fsInstance: fs,
        workspaceRoot,
        workspaceLabel,
        projectId: currentProjectId,
        connector: workspaceConnector,
      });
      setWorkspaceDocs(await listWorkspaceDocuments(workspaceRoot, fs));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load documents.";
      setError(message);
      setWorkspaceDocs([]);
    } finally {
      setLoading(false);
    }
  }, [currentProject, currentProjectId, fs, workspaceLabel, workspaceRoot]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    setActiveFolderPath(workspaceRoot);
  }, [workspaceRoot]);

  useEffect(() => {
    let cancelled = false;
    if (!currentProjectId) {
      setLocalFolderName(null);
      setLocalFolderStatus(null);
      return;
    }

    void getProjectDirectoryHandleInfo(currentProjectId).then((info) => {
      if (cancelled) return;
      setLocalFolderName(info?.name ?? null);
      setLocalFolderStatus(
        info ? `Local folder: ${info.name}` : "No local folder connected",
      );
    });

    return () => {
      cancelled = true;
    };
  }, [currentProjectId]);

  useEffect(() => {
    if (saving) return;
    if (
      activeDocument &&
      !workspaceDocs.some((doc) => doc.path === activeDocument.doc.path)
    ) {
      setActiveDocument(null);
      setDraft("");
      setIsEditingCrea8(false);
    }
  }, [activeDocument, saving, workspaceDocs]);

  const selectWorkspaceDoc = useCallback(
    async (doc: WorkspaceDocument) => {
      if (!fs) return;
      setError(null);
      try {
        const data = await readFileOp(doc.path, { fsInstance: fs, silent: true });
        setActiveFolderPath(dirname(doc.path));
        setPreviewDescriptor(doc.previewDescriptor);
        setPreviewData(data);

        if (doc.kind === "crea8" && doc.memoryNote) {
          setActiveDocument({ kind: "crea8", doc, note: doc.memoryNote });
          setDraft(doc.memoryNote.content);
          setIsEditingCrea8(false);
          return;
        }

        if (isIndexableText(doc.name, doc.type)) {
          const content = decodeText(data);
          setActiveDocument({ kind: "file", doc, content, data });
          setDraft(content);
          setIsEditingCrea8(false);
          return;
        }

        setActiveDocument({ kind: "file", doc, content: "", data });
        setDraft("");
        setIsEditingCrea8(false);
        setIsPreviewOpen(true);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to open document.");
      }
    },
    [fs],
  );

  useEffect(() => {
    if (!fs || workspaceDocs.length === 0) return;
    if (
      activeDocument &&
      workspaceDocs.some((doc) => doc.path === activeDocument.doc.path)
    ) {
      return;
    }

    const homeDoc =
      workspaceDocs.find((doc) => normalizePath(doc.path) === homePath) ??
      workspaceDocs.find((doc) => isWikiMarkdownDoc(doc)) ??
      workspaceDocs[0];
    if (homeDoc) {
      void selectWorkspaceDoc(homeDoc);
    }
  }, [activeDocument, fs, homePath, selectWorkspaceDoc, workspaceDocs]);

  const saveActiveDocument = useCallback(async () => {
    if (!activeDocument || !fs) return;
    setSaving(true);
    setError(null);
    try {
      if (activeDocument.kind === "crea8") {
        if (!connector) return;
        const updatedRef = await connector.update(
          {
            backend: "markdown-workspace",
            id: activeDocument.note.id,
            title: activeDocument.note.title,
            path: activeDocument.doc.path,
          },
          { content: draft },
        );
        const updatedNote = await connector.read(updatedRef);
        setActiveDocument({
          kind: "crea8",
          doc: {
            ...activeDocument.doc,
            name: basename(updatedNote.path ?? activeDocument.doc.path),
            path: updatedNote.path ?? activeDocument.doc.path,
            snippet: updatedNote.content.slice(0, SNIPPET_LENGTH),
            indexText: `${updatedNote.title} ${updatedNote.content}`.toLowerCase(),
            memoryNote: updatedNote,
          },
          note: updatedNote,
        });
        setDraft(updatedNote.content);
        setIsEditingCrea8(false);
      } else if (activeDocument.kind === "file") {
        if (!isIndexableText(activeDocument.doc.name, activeDocument.doc.type)) {
          throw new Error("This file type cannot be edited as text.");
        }
        await writeFileOp(activeDocument.doc.path, draft, { fsInstance: fs });
        setActiveDocument({
          kind: "file",
          doc: activeDocument.doc,
          content: draft,
          data: new TextEncoder().encode(draft),
        });
        if (activeDocument.doc.previewDescriptor.kind === "markdown") {
          setIsEditingCrea8(false);
        }
      }
      await loadDocuments();
      toast.success("Document saved.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save document.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [activeDocument, connector, draft, fs, loadDocuments]);

  const importFiles = useCallback(
    async (files: FileList | null) => {
      if (!fs || !files?.length) return;
      setImporting(true);
      setError(null);
      try {
        for (const file of Array.from(files)) {
          const browserFile = file as File & { webkitRelativePath?: string };
          const relativePath = browserFile.webkitRelativePath || file.name;
          const targetPath = joinPath(workspaceRoot, relativePath);
          await writeFileOp(targetPath, new Uint8Array(await file.arrayBuffer()), {
            fsInstance: fs,
          });
        }
        toast.success(`Imported ${files.length} document${files.length === 1 ? "" : "s"}.`);
        await loadDocuments();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to import documents.";
        setError(message);
        toast.error(message);
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [fs, loadDocuments, workspaceRoot],
  );

  const createCrea8Page = useCallback(async (targetFolder?: string) => {
    if (!connector) return;
    setSaving(true);
    setError(null);
    try {
      const title = currentProject ? `${currentProject.name} note` : "New memory";
      const folderPath = normalizePath(targetFolder ?? activeFolderPath ?? joinPath(workspaceRoot, "Wiki"));
      const ref = await connector.create({
        title,
        content: "",
        scope: currentProjectId ? "project" : "reference",
        tags: [],
        projectId: currentProjectId,
        path: joinPath(folderPath, `page-${Date.now()}.md`),
      });
      const note = await connector.read(ref);
      const path = note.path ?? ref.path ?? workspaceRoot;
      const data = fs
        ? await readFileOp(path, { fsInstance: fs, silent: true })
        : new Uint8Array();
      const name = basename(path);
      const type = guessMimeType(name);
      const indexText = `${note.title} ${note.content} ${path}`.toLowerCase();
      const previewDescriptor = inferFilePreviewDescriptor({
        name,
        path,
        mimeType: type,
        size: data.byteLength,
      });
      setPreviewDescriptor(previewDescriptor);
      setPreviewData(data);
      await loadDocuments();
      setActiveDocument({
        kind: "crea8",
        note,
        doc: {
          kind: "crea8",
          name,
          path,
          type,
          size: data.byteLength,
          updatedAt: note.updatedAt,
          snippet: note.content.slice(0, SNIPPET_LENGTH),
          indexText,
          wikiLinks: wikiLinkTargets(note.content).map(normalizeWikiLinkLabel),
          terms: tokenizeWikiText(indexText),
          previewDescriptor,
          memoryNote: note,
        },
      });
      setDraft(note.content);
      setIsEditingCrea8(true);
      toast.success("Wiki page created.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create wiki page.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [activeFolderPath, connector, currentProject, currentProjectId, fs, loadDocuments, workspaceRoot]);

  const createMermaidDiagram = useCallback(async (targetFolder?: string) => {
    if (!fs || !currentProject) return;
    const title = window.prompt("Diagram name", `${currentProject.name} diagram`);
    const trimmedTitle = title?.trim();
    if (!trimmedTitle) return;

    const safeName =
      trimmedTitle
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "diagram";
    const folderPath = normalizePath(
      targetFolder ?? activeFolderPath ?? joinPath(workspaceRoot, "Diagrams"),
    );
    const targetPath = joinPath(folderPath, `${safeName}-${Date.now()}.mmd`);

    setSaving(true);
    setError(null);
    try {
      await writeFileOp(targetPath, defaultMermaidDiagram(trimmedTitle), {
        fsInstance: fs,
      });
      await loadDocuments();
      const data = await readFileOp(targetPath, { fsInstance: fs, silent: true });
      const name = basename(targetPath);
      const type = guessMimeType(name);
      const content = decodeText(data);
      const previewDescriptor = inferFilePreviewDescriptor({
        name,
        path: targetPath,
        mimeType: type,
        size: data.byteLength,
      });
      setActiveFolderPath(dirname(targetPath));
      setPreviewDescriptor(previewDescriptor);
      setPreviewData(data);
      setActiveDocument({
        kind: "file",
        content,
        data,
        doc: {
          kind: "file",
          name,
          path: targetPath,
          type,
          size: data.byteLength,
          updatedAt: new Date(),
          snippet: content.slice(0, SNIPPET_LENGTH),
          indexText: `${name} ${targetPath} ${content}`.toLowerCase(),
          wikiLinks: [],
          terms: tokenizeWikiText(`${name} ${targetPath} ${content}`),
          previewDescriptor,
        },
      });
      setDraft(content);
      toast.success("Mermaid diagram created.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create diagram.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [activeFolderPath, currentProject, fs, loadDocuments, workspaceRoot]);

  const copyActiveText = useCallback(async () => {
    if (!activeDocument) return;
    const text =
      activeDocument.kind === "crea8" ||
      isIndexableText(activeDocument.doc.name, activeDocument.doc.type)
        ? draft
        : "";
    if (!text.trim()) {
      toast.info("No text available to copy.");
      return;
    }
    await navigator.clipboard.writeText(text);
    toast.success("Text copied.");
  }, [activeDocument, draft]);

  const copyActiveHash = useCallback(async () => {
    if (!previewData) return;
    const hash = await sha256Hex(previewData);
    await navigator.clipboard.writeText(hash);
    toast.success("SHA-256 copied.");
  }, [previewData]);

  const copyActiveBase64 = useCallback(async () => {
    if (!previewData) return;
    await navigator.clipboard.writeText(bytesToBase64(previewData));
    toast.success("Base64 copied.");
  }, [previewData]);

  const saveActiveTextExtract = useCallback(async () => {
    if (!activeDocument || !fs) return;
    const text =
      activeDocument.kind === "crea8" ||
      isIndexableText(activeDocument.doc.name, activeDocument.doc.type)
        ? draft
        : "";
    if (!text.trim()) {
      toast.info("No text available to save.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const targetPath = joinPath(
        workspaceRoot,
        "extracts",
        `${filenameStem(activeDocument.doc.name)}-${Date.now()}.txt`,
      );
      await writeFileOp(targetPath, new TextEncoder().encode(text), {
        fsInstance: fs,
      });
      await loadDocuments();
      toast.success(`Saved extract to ${targetPath}.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save text extract.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [activeDocument, draft, fs, loadDocuments, workspaceRoot]);

  const createCrea8PageFromActive = useCallback(async () => {
    if (!activeDocument || !connector) return;
    const content =
      activeDocument.kind === "crea8" ||
      isIndexableText(activeDocument.doc.name, activeDocument.doc.type)
        ? draft
        : "";
    if (!content.trim()) {
      toast.info("No text available to turn into a wiki page.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const sourceName =
        activeDocument.kind === "crea8"
          ? activeDocument.note.title
          : activeDocument.doc.name;
      const ref = await connector.create({
        title: `${sourceName} extract`,
        content,
        scope: currentProjectId ? "project" : "reference",
        tags: ["extract"],
        projectId: currentProjectId,
        path: joinPath(workspaceRoot, "Wiki", `extract-${Date.now()}.md`),
      });
      const note = await connector.read(ref);
      await loadDocuments();
      toast.success(`Created wiki page: ${note.title}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create wiki page.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [activeDocument, connector, currentProjectId, draft, loadDocuments, workspaceRoot]);

  const toggleDocSelection = useCallback((doc: WorkspaceDocument) => {
    setSelectedDocPaths((current) => {
      const next = new Set(current);
      if (next.has(doc.path)) next.delete(doc.path);
      else next.add(doc.path);
      return next;
    });
  }, []);

  const selectVisibleDocs = useCallback(() => {
    setSelectedDocPaths((current) => {
      const next = new Set(current);
      for (const doc of filteredWorkspaceDocs) {
        next.add(doc.path);
      }
      return next;
    });
  }, [filteredWorkspaceDocs]);

  const clearSelectedDocs = useCallback(() => {
    setSelectedDocPaths(new Set());
  }, []);

  const createFolderAtPath = useCallback(async (parentPath: string) => {
    if (!fs) return;
    const folderName = window.prompt("Folder name");
    const trimmed = folderName?.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    try {
      const targetPath = joinPath(parentPath, trimmed);
      await createDirectoryOp(targetPath, { fsInstance: fs });
      setActiveFolderPath(targetPath);
      await loadDocuments();
      toast.success(`Created folder ${targetPath}.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create folder.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [fs, loadDocuments]);

  const createFolderInActiveFolder = useCallback(async () => {
    await createFolderAtPath(activeFolderPath ?? workspaceRoot);
  }, [activeFolderPath, createFolderAtPath, workspaceRoot]);

  const moveSelectedDocsToActiveFolder = useCallback(async () => {
    if (!fs || selectedDocs.length === 0) return;
    const targetFolder = normalizePath(activeFolderPath ?? workspaceRoot);

    setSaving(true);
    setError(null);
    try {
      for (const doc of selectedDocs) {
        const targetPath = joinPath(targetFolder, basename(doc.path));
        if (normalizePath(doc.path) === targetPath) continue;
        await renameOp(doc.path, targetPath, { fsInstance: fs });
      }
      setSelectedDocPaths(new Set());
      await loadDocuments();
      toast.success(`Moved ${selectedDocs.length} item${selectedDocs.length === 1 ? "" : "s"}.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to move selected items.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [activeFolderPath, fs, loadDocuments, selectedDocs, workspaceRoot]);

  const renameActiveDocument = useCallback(async () => {
    if (!activeDocument || !fs) return;
    const nextName = window.prompt("Rename document", activeDocument.doc.name);
    const trimmed = nextName?.trim();
    if (!trimmed || trimmed === activeDocument.doc.name) return;

    setSaving(true);
    setError(null);
    try {
      const targetPath = joinPath(dirname(activeDocument.doc.path), trimmed);
      await renameOp(activeDocument.doc.path, targetPath, { fsInstance: fs });
      setActiveDocument(null);
      setDraft("");
      setIsEditingCrea8(false);
      await loadDocuments();
      toast.success(`Renamed to ${trimmed}.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to rename document.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [activeDocument, fs, loadDocuments]);

  const deleteActiveDocument = useCallback(async () => {
    if (!activeDocument || !fs) return;
    const confirmed = window.confirm(`Delete ${activeDocument.doc.name}?`);
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    try {
      await deleteItemOp(activeDocument.doc.path, false, { fsInstance: fs });
      setSelectedDocPaths((current) => {
        const next = new Set(current);
        next.delete(activeDocument.doc.path);
        return next;
      });
      setActiveDocument(null);
      setDraft("");
      setIsEditingCrea8(false);
      await loadDocuments();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete document.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [activeDocument, fs, loadDocuments]);

  const deleteSelectedDocuments = useCallback(async () => {
    if (!fs || selectedDocs.length === 0) return;
    const confirmed = window.confirm(
      `Delete ${selectedDocs.length} selected document${selectedDocs.length === 1 ? "" : "s"}?`,
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    try {
      for (const doc of selectedDocs) {
        await deleteItemOp(doc.path, false, { fsInstance: fs });
      }
      setSelectedDocPaths(new Set());
      setActiveDocument(null);
      setDraft("");
      setIsEditingCrea8(false);
      await loadDocuments();
      toast.success(`Deleted ${selectedDocs.length} selected item${selectedDocs.length === 1 ? "" : "s"}.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete selected documents.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [fs, loadDocuments, selectedDocs]);

  const attachSelectedDocumentsToChat = useCallback(async () => {
    if (!fs || selectedDocs.length === 0) return;

    setAsking(true);
    setError(null);
    try {
      const retrieval = await buildRetrievalContext(
        selectedDocs,
        "selected project context",
        fs,
      );
      if (retrieval.chunkCount === 0) {
        throw new Error("No indexable text passages found in the selected docs.");
      }
      const contextSize = new TextEncoder().encode(retrieval.content).byteLength;
      useInputStore.getState().addAttachedFile({
        source: "direct",
        name: "selected-documents-context.md",
        type: "text/markdown",
        size: contextSize,
        contentText: retrieval.content,
      });
      useUIStateStore.getState().setWorkspaceMode("chat");
      toast.success(
        `Attached ${retrieval.chunkCount} passage${retrieval.chunkCount === 1 ? "" : "s"} to chat.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to attach documents.";
      setError(message);
      toast.error(message);
    } finally {
      setAsking(false);
    }
  }, [fs, selectedDocs]);

  const connectLocalFolder = useCallback(async () => {
    if (!currentProjectId || !fs) {
      toast.info("Select a project before connecting a local folder.");
      return;
    }

    setError(null);
    try {
      const handle = await pickProjectDirectory(currentProjectId);
      setLocalFolderName(handle.name);
      setSyncingLocalFolder(true);
      const plan = await planRealFsSyncTwoWay({
        fsInstance: fs,
        vfsPath: workspaceRoot,
        directoryHandle: handle,
      });
      setSyncPlan(plan);
      pendingSyncRef.current = async () => {
        const result = await syncProjectDirectoryTwoWay(
          currentProjectId,
          fs,
          workspaceRoot,
        );
        const message = describeRealFsSyncResult("two-way", result);
        setLocalFolderStatus(message);
        await loadDocuments();
        toast.success(message);
      };
      setIsSyncConfirmOpen(true);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message =
        error instanceof Error ? error.message : "Failed to connect local folder.";
      setLocalFolderStatus(message);
      setError(message);
      toast.error(message);
    } finally {
      setSyncingLocalFolder(false);
    }
  }, [currentProjectId, fs, loadDocuments, workspaceRoot]);

  const syncLocalFolderNow = useCallback(async () => {
    if (!currentProjectId || !fs || !localFolderName) return;

    setError(null);
    setSyncingLocalFolder(true);
    try {
      const plan = await planProjectDirectoryTwoWay(
        currentProjectId,
        fs,
        workspaceRoot,
      );
      setSyncPlan(plan);
      pendingSyncRef.current = async () => {
        const result = await syncProjectDirectoryTwoWay(
          currentProjectId,
          fs,
          workspaceRoot,
        );
        const message = describeRealFsSyncResult("two-way", result);
        setLocalFolderStatus(message);
        await loadDocuments();
        toast.success(message);
      };
      setIsSyncConfirmOpen(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to sync local folder.";
      setLocalFolderStatus(message);
      setError(message);
      toast.error(message);
    } finally {
      setSyncingLocalFolder(false);
    }
  }, [currentProjectId, fs, loadDocuments, localFolderName, workspaceRoot]);

  const handleSyncConfirm = useCallback(async () => {
    if (!pendingSyncRef.current) return;
    setIsSyncConfirming(true);
    try {
      await pendingSyncRef.current();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Sync failed.";
      setLocalFolderStatus(message);
      setError(message);
      toast.error(message);
    } finally {
      setIsSyncConfirming(false);
      setIsSyncConfirmOpen(false);
      pendingSyncRef.current = null;
    }
  }, []);

  const activeTitle =
    activeDocument?.kind === "crea8"
      ? activeDocument.note.title
      : activeDocument
        ? wikiLabelForDoc(activeDocument.doc)
        : undefined;
  const activeIsWikiMarkdown = activeDocument
    ? isWikiMarkdownDoc(activeDocument.doc)
    : false;
  const activeIsMermaidDiagram = activeDocument
    ? isMermaidDiagramDoc(activeDocument.doc)
    : false;
  const isDirty =
    activeDocument?.kind === "crea8"
      ? draft !== activeDocument.note.content
      : activeDocument?.kind === "file" && isIndexableText(activeDocument.doc.name, activeDocument.doc.type)
      ? draft !== activeDocument.content
      : false;
  const activeWikiLinks = useMemo(() => wikiLinkTargets(draft), [draft]);
  const activeBacklinks = useMemo(() => {
    if (!activeDocument) return [];
    const title = normalizeWikiLinkLabel(wikiLabelForDoc(activeDocument.doc));
    const filename = normalizeWikiLinkLabel(activeDocument.doc.name);
    const relativePath = normalizeWikiLinkLabel(
      workspacePathParts(activeDocument.doc.path, workspaceRoot).join("/"),
    );
    const linkNeedles = new Set([
      title,
      filename,
      relativePath,
      activeDocument.doc.path.toLowerCase(),
    ]);
    return workspaceDocs
      .filter((doc) => doc.path !== activeDocument.doc.path)
      .filter((doc) =>
        [...linkNeedles].some(
          (needle) =>
            doc.wikiLinks.includes(needle) || doc.indexText.includes(`[[${needle}]]`),
        ),
      )
      .slice(0, 6);
  }, [activeDocument, workspaceDocs, workspaceRoot]);
  const relatedWikiDocs = useMemo(() => {
    if (!activeDocument) return [];
    const sourceTerms = new Set(
      activeDocument.doc.terms.length > 0
        ? activeDocument.doc.terms
        : tokenizeWikiText(`${wikiLabelForDoc(activeDocument.doc)} ${draft}`),
    );
    if (sourceTerms.size === 0) return [];

    return workspaceDocs
      .filter((doc) => doc.path !== activeDocument.doc.path)
      .map((doc) => {
        const targetTerms = new Set(doc.terms);
        let score = 0;
        for (const term of sourceTerms) {
          if (targetTerms.has(term)) score += 1;
        }
        return { doc, score };
      })
      .filter((item) => item.score > 1)
      .sort((first, second) => second.score - first.score)
      .slice(0, 6)
      .map((item) => item.doc);
  }, [activeDocument, draft, workspaceDocs]);

  const openDocumentByLabel = useCallback(
    (label: string) => {
      const normalized = label.trim().toLowerCase().replace(/\.(md|markdown|mdx)$/i, "");
      const target = workspaceDocs.find((doc) => {
        const docLabel = wikiLabelForDoc(doc).toLowerCase();
        const fileLabel = doc.name
          .replace(/\.(md|markdown|mdx)$/i, "")
          .toLowerCase();
        const relativePath = workspacePathParts(doc.path, workspaceRoot)
          .join("/")
          .replace(/\.(md|markdown|mdx)$/i, "")
          .toLowerCase();
        return (
          docLabel === normalized ||
          fileLabel === normalized ||
          relativePath === normalized
        );
      });
      if (target) {
        void selectWorkspaceDoc(target);
      } else {
        setDocSearch(label);
      }
    },
    [selectWorkspaceDoc, workspaceDocs, workspaceRoot],
  );

  const sidebarPane = (
    <div className="h-full min-h-0 border-r border-border bg-sidebar/40">
      <ScrollArea className="h-full">
        {busy ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2Icon className="h-4 w-4 animate-spin" />
            Loading documents...
          </div>
        ) : (
          <div className="space-y-4 p-2">
            <section>
              <div className="mb-2 space-y-2 px-2">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span className="truncate">Wiki</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant="outline">{filteredWorkspaceDocs.length}</Badge>
                    {secondBrainCount > 0 ? (
                      <Badge variant="secondary">{secondBrainCount} memories</Badge>
                    ) : null}
                    {filteredWorkspaceDocs.length !== workspaceDocs.length ? (
                      <Badge variant="secondary">{workspaceDocs.length} total</Badge>
                    ) : null}
                  </div>
                </div>
                <p className="truncate text-[11px] text-muted-foreground">
                  {currentProject ? workspaceLabel : "Create or select a project to start."}
                </p>
                <div className="relative">
                  <SearchIcon className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={docSearch}
                    onChange={(event) => setDocSearch(event.target.value)}
                    placeholder="Search files and wiki pages"
                    className="h-8 pl-7 text-xs"
                  />
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => void createCrea8Page(activeFolderPath ?? workspaceRoot)}
                    disabled={!currentProject || !fs || saving}
                  >
                    <BookOpenTextIcon className="h-3.5 w-3.5" />
                    Page
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => void createMermaidDiagram(activeFolderPath ?? workspaceRoot)}
                    disabled={!currentProject || !fs || saving}
                  >
                    <ChartNoAxesCombinedIcon className="h-3.5 w-3.5" />
                    Diagram
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => void createFolderInActiveFolder()}
                    disabled={!currentProject || !fs || saving}
                  >
                    <FolderPlusIcon className="h-3.5 w-3.5" />
                    Folder
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={selectVisibleDocs}
                    disabled={!currentProject || filteredWorkspaceDocs.length === 0}
                  >
                    Select results
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => void moveSelectedDocsToActiveFolder()}
                    disabled={!currentProject || !fs || saving || selectedDocs.length === 0}
                  >
                    Move here
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={clearSelectedDocs}
                    disabled={selectedDocPaths.size === 0}
                  >
                    Clear
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-destructive"
                    onClick={() => void deleteSelectedDocuments()}
                    disabled={!currentProject || !fs || saving || selectedDocs.length === 0}
                  >
                    Delete
                  </Button>
                </div>
                {selectedDocs.length > 0 ? (
                  <div className="rounded-md border border-border bg-background/60 p-2 text-xs">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-medium text-muted-foreground">
                        Tagged for chat
                      </span>
                      <Badge variant="secondary">{selectedDocs.length}</Badge>
                    </div>
                    <div className="mb-2 flex flex-wrap gap-1">
                      {selectedDocs.slice(0, 5).map((doc) => (
                        <Badge key={doc.path} variant="outline" className="max-w-40 truncate">
                          {basename(doc.path)}
                        </Badge>
                      ))}
                      {selectedDocs.length > 5 ? (
                        <Badge variant="outline">+{selectedDocs.length - 5}</Badge>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 w-full px-2 text-xs"
                      onClick={() => void attachSelectedDocumentsToChat()}
                      disabled={asking || selectedDocs.length === 0}
                    >
                      <MessageSquarePlusIcon className={asking ? "h-3.5 w-3.5 animate-pulse" : "h-3.5 w-3.5"} />
                      Attach to chat
                    </Button>
                  </div>
                ) : null}
                <div className="rounded-md border border-border bg-background/60 p-2 text-xs">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-medium text-muted-foreground">Sync</span>
                    <Badge variant="outline">
                      {localFolderName ? "local linked" : "local only"}
                    </Badge>
                  </div>
                  <p className="mb-2 line-clamp-2 text-muted-foreground">
                    {localFolderStatus ??
                      "Use Git from the project row, or connect a local folder for browser filesystem sync."}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => void connectLocalFolder()}
                      disabled={!currentProjectId || !fs || syncingLocalFolder || !localSyncSupported}
                    >
                      <FolderPlusIcon className={syncingLocalFolder ? "h-3.5 w-3.5 animate-pulse" : "h-3.5 w-3.5"} />
                      Local
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => void syncLocalFolderNow()}
                      disabled={!currentProjectId || !fs || !localFolderName || syncingLocalFolder}
                    >
                      <RefreshCwIcon className={syncingLocalFolder ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                      Sync
                    </Button>
                  </div>
                </div>
              </div>
              {workspaceDocs.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  {currentProject
                    ? "Import local files into this workspace. Wiki pages are stored as Markdown alongside them."
                    : "Create or select a project first. LLMChef keeps wiki pages, files, memories, and chats inside a project."}
                </p>
              ) : filteredWorkspaceDocs.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  No files or wiki pages match the current view.
                </p>
              ) : (
                <TreeNode
                  node={workspaceTree}
                  selectedKey={activeDocument ? activeDocument.doc.path : null}
                  selectedFolderPath={activeFolderPath}
                  label={wikiLabelForDoc}
                  meta={(doc) =>
                    <>
                      <Badge variant="outline" className="h-5 shrink-0 text-[10px]">
                        {isWikiMarkdownDoc(doc) ? doc.memoryNote?.scope ?? "wiki" : doc.previewDescriptor.kind}
                      </Badge>
                      {selectedDocPaths.has(doc.path) ? (
                        <Badge variant="secondary" className="h-5 shrink-0 text-[10px]">
                          selected
                        </Badge>
                      ) : null}
                    </>
                  }
                  snippet={(doc) => doc.snippet}
                  itemKey={(doc) => doc.path}
                  icon={iconForPreviewKind}
                  onSelect={(doc) => void selectWorkspaceDoc(doc)}
                  onSelectFolder={(path) => {
                    setActiveDocument(null);
                    setDraft("");
                    setActiveFolderPath(path);
                  }}
                  onCreatePageInFolder={(path) => void createCrea8Page(path)}
                  onCreateFolderInFolder={(path) => void createFolderAtPath(path)}
                  onToggleSelect={toggleDocSelection}
                />
              )}
            </section>
          </div>
        )}
      </ScrollArea>
    </div>
  );

  const mainPane = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-col">
        {activeDocument ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0 space-y-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">{activeTitle}</h3>
                  <Badge variant="outline">
                    {activeIsWikiMarkdown
                      ? "wiki"
                      : activeDocument.doc.previewDescriptor.kind}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void renameActiveDocument()}
                  disabled={saving}
                >
                  Rename
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void deleteActiveDocument()}
                  disabled={saving}
                >
                  Delete
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsPreviewOpen(true)}
                  disabled={!previewDescriptor || !previewData}
                >
                  Preview
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void copyActiveText()}
                  disabled={
                    activeDocument.kind === "file" &&
                    !isIndexableText(activeDocument.doc.name, activeDocument.doc.type)
                  }
                >
                  <CopyIcon />
                  Text
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void copyActiveHash()}
                  disabled={!previewData}
                >
                  <HashIcon />
                  SHA-256
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void copyActiveBase64()}
                  disabled={!previewData}
                >
                  <CopyIcon />
                  Base64
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void saveActiveTextExtract()}
                  disabled={
                    saving ||
                    (activeDocument.kind === "file" &&
                      !isIndexableText(activeDocument.doc.name, activeDocument.doc.type))
                  }
                >
                  <FileTextIcon />
                  Save .txt
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void createCrea8PageFromActive()}
                  disabled={
                    saving ||
                    (activeDocument.kind === "file" &&
                      !isIndexableText(activeDocument.doc.name, activeDocument.doc.type))
                  }
                >
                  <BookOpenTextIcon />
                  Extract
                </Button>
                {activeIsWikiMarkdown ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={isEditingCrea8 ? "secondary" : "outline"}
                    onClick={() => setIsEditingCrea8((current) => !current)}
                  >
                    <PencilIcon />
                    {isEditingCrea8 ? "Render" : "Edit"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant={
                    selectedDocPaths.has(activeDocument.doc.path)
                      ? "secondary"
                      : "outline"
                  }
                  onClick={() => toggleDocSelection(activeDocument.doc)}
                >
                  {selectedDocPaths.has(activeDocument.doc.path)
                    ? "Selected"
                    : "Tag for chat"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void saveActiveDocument()}
                  disabled={saving || !isDirty}
                >
                  <SaveIcon className={saving ? "animate-pulse" : ""} />
                  Save
                </Button>
              </div>
            </div>
            <div className="grid gap-2 border-b border-border bg-muted/15 px-4 py-3 text-xs md:grid-cols-3">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-1 font-medium text-muted-foreground">
                  <LinkIcon className="h-3.5 w-3.5" />
                  Links
                </div>
                {activeWikiLinks.length === 0 ? (
                  <p className="text-muted-foreground">No wiki links yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {activeWikiLinks.slice(0, 8).map((link) => (
                      <Button
                        key={link}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 max-w-full px-2 text-[11px]"
                        onClick={() => openDocumentByLabel(link)}
                      >
                        <span className="truncate">{link}</span>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="mb-1 font-medium text-muted-foreground">
                  Backlinks
                </div>
                {activeBacklinks.length === 0 ? (
                  <p className="text-muted-foreground">No backlinks yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {activeBacklinks.map((doc) => (
                      <Button
                        key={doc.path}
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 max-w-full px-2 text-[11px]"
                        onClick={() => void selectWorkspaceDoc(doc)}
                      >
                        <span className="truncate">{wikiLabelForDoc(doc)}</span>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="mb-1 font-medium text-muted-foreground">
                  Related
                </div>
                {relatedWikiDocs.length === 0 ? (
                  <p className="text-muted-foreground">Related pages will appear as the wiki grows.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {relatedWikiDocs.map((doc) => (
                      <Button
                        key={doc.path}
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 max-w-full px-2 text-[11px]"
                        onClick={() => void selectWorkspaceDoc(doc)}
                      >
                        <span className="truncate">{wikiLabelForDoc(doc)}</span>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {activeDocument.kind === "file" &&
            !isIndexableText(activeDocument.doc.name, activeDocument.doc.type) ? (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                Preview is available for {activeDocument.doc.previewDescriptor.kind} files.
              </div>
            ) : activeIsWikiMarkdown && !isEditingCrea8 ? (
              <ScrollArea className="min-h-0 flex-1">
                <div className="mx-auto w-full max-w-4xl px-5 py-5">
                  <div className="mb-5 rounded-md border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {activeDocument.kind === "crea8"
                          ? activeDocument.note.scope
                          : "wiki"}
                      </Badge>
                      {activeDocument.kind === "crea8"
                        ? activeDocument.note.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))
                        : null}
                      {isDirty ? <Badge variant="destructive">unsaved</Badge> : null}
                    </div>
                    <h1 className="mt-3 text-2xl font-semibold tracking-normal text-foreground">
                      {activeDocument.note.title}
                    </h1>
                  </div>
                  <React.Suspense
                    fallback={
                      <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                        Rendering wiki page...
                      </div>
                    }
                  >
                    <WikiMarkdownPreview markdown={draft} />
                  </React.Suspense>
                </div>
              </ScrollArea>
            ) : activeIsMermaidDiagram ? (
              <React.Suspense
                fallback={
                  <div className="flex min-h-40 flex-1 items-center justify-center text-sm text-muted-foreground">
                    Loading diagram studio...
                  </div>
                }
              >
                <MermaidDiagramStudio
                  value={draft}
                  onChange={setDraft}
                  title={activeDocument.doc.name}
                />
              </React.Suspense>
            ) : (
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="min-h-0 flex-1 resize-none rounded-none border-0 bg-background p-4 font-mono text-sm shadow-none focus-visible:ring-0"
              />
            )}
          </>
        ) : (
          <div className="flex h-full flex-col p-6">
            <div className="mb-4 min-w-0">
              <h3 className="truncate text-sm font-semibold">
                {basename(activeFolderPath ?? workspaceRoot) || workspaceLabel}
              </h3>
              <p className="truncate text-xs text-muted-foreground">
                {normalizePath(activeFolderPath ?? workspaceRoot)}
              </p>
            </div>
            {activeFolderDocs.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
                This folder has no direct documents yet.
              </div>
            ) : (
              <div className="grid auto-rows-min gap-2 overflow-y-auto">
                {activeFolderDocs.map((doc) => (
                  <button
                    key={doc.path}
                    type="button"
                    className="flex min-w-0 items-start gap-3 rounded-md border border-border bg-card px-3 py-2 text-left hover:bg-muted/40"
                    onClick={() => void selectWorkspaceDoc(doc)}
                  >
                    {iconForPreviewKind(doc)}
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {wikiLabelForDoc(doc)}
                        </span>
                        <Badge variant="outline" className="h-5 shrink-0 text-[10px]">
                          {isWikiMarkdownDoc(doc) ? "wiki" : doc.previewDescriptor.kind}
                        </Badge>
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {doc.snippet || doc.path}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {sidebarPortalTarget ? createPortal(sidebarPane, sidebarPortalTarget) : null}
      <div className="link42-panel flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">Documents</h2>
          <p className="truncate text-xs text-muted-foreground">
            {workspaceLabel} files and wiki pages, grounded through chat
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => void importFiles(event.currentTarget.files)}
          />
          <input
            ref={configureFolderInput}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => void importFiles(event.currentTarget.files)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void createCrea8Page()}
            disabled={!currentProject || !fs || saving}
          >
            <BookOpenTextIcon className={saving ? "animate-pulse" : ""} />
            Page
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void createMermaidDiagram()}
            disabled={!currentProject || !fs || saving}
          >
            <ChartNoAxesCombinedIcon className={saving ? "animate-pulse" : ""} />
            Diagram
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={!currentProject || !fs || importing}
          >
            <FilePlusIcon className={importing ? "animate-pulse" : ""} />
            Files
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => folderInputRef.current?.click()}
            disabled={!currentProject || !fs || importing}
          >
            <FolderPlusIcon className={importing ? "animate-pulse" : ""} />
            Folder
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void loadDocuments()}
            disabled={busy}
          >
            <RefreshCwIcon className={busy ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {sidebarPortalTarget ? (
        mainPane
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[22rem_minmax(0,1fr)]">
          {sidebarPane}
          {mainPane}
        </div>
      )}
      <FilePreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        descriptor={previewDescriptor}
        data={previewData}
      />
      <FolderSyncConfirmDialog
        isOpen={isSyncConfirmOpen}
        onOpenChange={setIsSyncConfirmOpen}
        plan={syncPlan}
        folderName={localFolderName ?? ""}
        isSubmitting={isSyncConfirming}
        onConfirm={handleSyncConfirm}
      />
    </div>
  );
};
