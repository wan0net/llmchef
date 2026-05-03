import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenTextIcon,
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
  Loader2Icon,
  RefreshCwIcon,
  SaveIcon,
  SearchIcon,
  SendIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { FilePreviewDialog } from "@/components/LLMChef/file-manager/FilePreviewDialog";
import { createCrea8VfsConnector } from "@/lib/llmchef/crea8-vfs-connector";
import { parseCrea8MarkdownNote } from "@/lib/llmchef/crea8-memory";
import { basename, joinPath, normalizePath } from "@/lib/llmchef/file-manager-utils";
import {
  createDirectoryOp,
  listFilesOp,
  readFileOp,
  writeFileOp,
} from "@/lib/llmchef/vfs-operations";
import {
  inferFilePreviewDescriptor,
  type FilePreviewDescriptor,
} from "@/lib/llmchef/file-preview";
import { useProjectStore } from "@/store/project.store";
import { useVfsStore } from "@/store/vfs.store";
import type { AttachedFileMetadata } from "@/store/input.store";
import type {
  Crea8MemoryNote,
  Crea8MemoryScope,
} from "@/types/llmchef/crea8-memory";

type DocumentsWorkspaceProps = {
  currentProjectId: string | null;
  onAskDocuments: (
    question: string,
    files: Omit<AttachedFileMetadata, "id">[],
  ) => Promise<void>;
};

type ScopeFilter = "project-current" | "all" | Crea8MemoryScope;
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
  previewDescriptor: FilePreviewDescriptor;
  memoryNote?: Crea8MemoryNote;
};

const GLOBAL_DOCUMENTS_ROOT = "/Documents";
const MAX_INDEX_BYTES = 200_000;
const MAX_RETRIEVAL_BYTES = 700_000;
const RETRIEVAL_CHUNK_SIZE = 1_800;
const RETRIEVAL_CHUNK_OVERLAP = 240;
const MAX_RETRIEVAL_CHUNKS = 12;
const MAX_RETRIEVAL_CONTEXT_CHARS = 24_000;
const SNIPPET_LENGTH = 220;
const FILTERS: { id: ScopeFilter; label: string }[] = [
  { id: "project-current", label: "Current project" },
  { id: "all", label: "All items" },
  { id: "user", label: "User" },
  { id: "project", label: "Projects" },
  { id: "decision", label: "Decisions" },
  { id: "work-log", label: "Work log" },
  { id: "skill", label: "Skills" },
  { id: "reference", label: "Reference" },
];

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

const matchesFilter = (
  doc: WorkspaceDocument,
  filter: ScopeFilter,
  currentProjectId: string | null,
): boolean => {
  if (filter === "all") return true;
  if (filter === "project-current") return true;
  if (doc.kind === "file") return false;
  const note = doc.memoryNote;
  if (!note) return false;
  void currentProjectId;
  return note.scope === filter;
};

const guessMimeType = (name: string, browserType?: string): string => {
  if (browserType) return browserType;
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "md" || ext === "markdown") return "text/markdown";
  if (ext === "txt" || ext === "log") return "text/plain";
  if (ext === "json") return "application/json";
  if (ext === "csv") return "text/csv";
  if (ext === "html" || ext === "htm") return "text/html";
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
  ].includes(mimeType) || /\.(md|markdown|txt|json|csv|html?|ya?ml|log|tsx?|jsx?|css)$/i.test(name);
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
    "# Notebook Retrieval Context",
    "",
    "Use these locally selected passages as source context. Cite paths when answering.",
    `Question: ${question}`,
    "",
    ...sections,
  ].join("\n\n---\n\n");

  return { content, chunkCount: sections.length };
};

const iconForPreviewKind = (doc: WorkspaceDocument): React.ReactNode => {
  const className = "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground";
  if (doc.kind === "crea8") return <BookOpenTextIcon className={className} />;
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

const indexWorkspaceDocument = async (
  path: string,
  name: string,
  mimeType: string,
  fsInstance: typeof import("@zenfs/core").fs,
): Promise<{
  kind: WorkspaceDocument["kind"];
  snippet: string;
  indexText: string;
  memoryNote?: Crea8MemoryNote;
}> => {
  if (!isIndexableText(name, mimeType)) {
    return {
      kind: "file",
      snippet: "",
      indexText: `${name} ${path}`.toLowerCase(),
    };
  }

  try {
    const data = await readFileOp(path, { fsInstance, silent: true });
    const preview = decodeText(data.slice(0, MAX_INDEX_BYTES)).trim();
    const memoryNote = readCrea8NoteIfPresent(path, name, mimeType, preview);
    return {
      kind: memoryNote ? "crea8" : "file",
      snippet: (memoryNote?.content ?? preview).slice(0, SNIPPET_LENGTH),
      indexText: `${name} ${path} ${memoryNote?.title ?? ""} ${
        memoryNote?.content ?? preview
      }`.toLowerCase(),
      memoryNote,
    };
  } catch {
    return {
      kind: "file",
      snippet: "",
      indexText: `${name} ${path}`.toLowerCase(),
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
  depth = 0,
  label,
  meta,
  snippet,
  icon,
  itemKey,
  onSelect,
}: {
  node: TreeNodeModel<T>;
  selectedKey: string | null;
  depth?: number;
  label: (item: T) => string;
  meta?: (item: T) => React.ReactNode;
  snippet?: (item: T) => string | undefined;
  icon?: (item: T) => React.ReactNode;
  itemKey: (item: T) => string;
  onSelect: (item: T) => void;
}) => {
  const isFile = Boolean(node.item);
  const renderedLabel = node.item ? label(node.item) : node.name;
  const isSelected = node.item ? itemKey(node.item) === selectedKey : false;

  return (
    <div>
      <button
        type="button"
        className={[
          "flex min-h-9 w-full min-w-0 items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
          isFile ? "hover:bg-muted/60" : "cursor-default",
          isSelected ? "bg-primary/10 text-primary" : "",
        ].join(" ")}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => {
          if (node.item) onSelect(node.item);
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
      </button>
      {node.children.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          selectedKey={selectedKey}
          depth={depth + 1}
          label={label}
          meta={meta}
          snippet={snippet}
          icon={icon}
          itemKey={itemKey}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};

export const DocumentsWorkspace: React.FC<DocumentsWorkspaceProps> = ({
  currentProjectId,
  onAskDocuments,
}) => {
  const fs = useVfsStore((state) => state.fs);
  const vfsLoading = useVfsStore((state) => state.loading);
  const operationLoading = useVfsStore((state) => state.operationLoading);
  const currentProject = useProjectStore((state) =>
    state.getProjectById(currentProjectId),
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [filter, setFilter] = useState<ScopeFilter>("project-current");
  const [workspaceDocs, setWorkspaceDocs] = useState<WorkspaceDocument[]>([]);
  const [docSearch, setDocSearch] = useState("");
  const [selectedDocPaths, setSelectedDocPaths] = useState<Set<string>>(new Set());
  const [activeDocument, setActiveDocument] = useState<ActiveDocument | null>(null);
  const [draft, setDraft] = useState("");
  const [previewDescriptor, setPreviewDescriptor] =
    useState<FilePreviewDescriptor | null>(null);
  const [previewData, setPreviewData] = useState<Uint8Array | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workspaceRoot = useMemo(
    () => normalizePath(currentProject?.path ?? GLOBAL_DOCUMENTS_ROOT),
    [currentProject?.path],
  );
  const workspaceLabel = currentProject?.name ?? "Global documents";
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
    return workspaceDocs.filter((doc) =>
      matchesFilter(doc, filter, currentProjectId) &&
      (terms.length === 0 || terms.every((term) => doc.indexText.includes(term))),
    );
  }, [currentProjectId, docSearch, filter, workspaceDocs]);
  const workspaceTree = useMemo(
    () => buildWorkspaceTree(filteredWorkspaceDocs, workspaceRoot, workspaceLabel),
    [filteredWorkspaceDocs, workspaceLabel, workspaceRoot],
  );
  const selectedDocs = useMemo(
    () => workspaceDocs.filter((doc) => selectedDocPaths.has(doc.path)),
    [workspaceDocs, selectedDocPaths],
  );
  const busy = loading || importing || vfsLoading || operationLoading;

  const configureFolderInput = useCallback((node: HTMLInputElement | null) => {
    folderInputRef.current = node;
    if (!node) return;
    node.setAttribute("webkitdirectory", "");
    node.setAttribute("directory", "");
  }, []);

  const loadDocuments = useCallback(async () => {
    if (!fs) {
      setWorkspaceDocs([]);
      setActiveDocument(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createDirectoryOp(workspaceRoot, { fsInstance: fs });
      setWorkspaceDocs(await listWorkspaceDocuments(workspaceRoot, fs));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load documents.";
      setError(message);
      setWorkspaceDocs([]);
    } finally {
      setLoading(false);
    }
  }, [fs, workspaceRoot]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (
      activeDocument &&
      !workspaceDocs.some((doc) => doc.path === activeDocument.doc.path)
    ) {
      setActiveDocument(null);
      setDraft("");
    }
  }, [activeDocument, workspaceDocs]);

  const selectWorkspaceDoc = useCallback(
    async (doc: WorkspaceDocument) => {
      if (!fs) return;
      setError(null);
      try {
        const data = await readFileOp(doc.path, { fsInstance: fs, silent: true });
        setPreviewDescriptor(doc.previewDescriptor);
        setPreviewData(data);

        if (doc.kind === "crea8" && doc.memoryNote) {
          setActiveDocument({ kind: "crea8", doc, note: doc.memoryNote });
          setDraft(doc.memoryNote.content);
          return;
        }

        if (isIndexableText(doc.name, doc.type)) {
          const content = decodeText(data);
          setActiveDocument({ kind: "file", doc, content, data });
          setDraft(content);
          return;
        }

        setActiveDocument({ kind: "file", doc, content: "", data });
        setDraft("");
        setIsPreviewOpen(true);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to open document.");
      }
    },
    [fs],
  );

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

  const createCrea8Page = useCallback(async () => {
    if (!connector) return;
    setSaving(true);
    setError(null);
    try {
      const title = currentProject ? `${currentProject.name} note` : "New memory";
      const ref = await connector.create({
        title,
        content: "",
        scope: currentProjectId ? "project" : "reference",
        tags: [],
        projectId: currentProjectId,
        path: joinPath(workspaceRoot, "crea8", `memory-${Date.now()}.md`),
      });
      const note = await connector.read(ref);
      const path = note.path ?? ref.path ?? workspaceRoot;
      const data = fs
        ? await readFileOp(path, { fsInstance: fs, silent: true })
        : new Uint8Array();
      const name = basename(path);
      const type = guessMimeType(name);
      const previewDescriptor = inferFilePreviewDescriptor({
        name,
        path,
        mimeType: type,
        size: data.byteLength,
      });
      setPreviewDescriptor(previewDescriptor);
      setPreviewData(data);
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
          indexText: `${note.title} ${note.content}`.toLowerCase(),
          previewDescriptor,
          memoryNote: note,
        },
      });
      setDraft(note.content);
      await loadDocuments();
      toast.success("crea8 page created.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create crea8 page.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [connector, currentProject, currentProjectId, fs, loadDocuments, workspaceRoot]);

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

  const askSelectedDocuments = useCallback(async () => {
    const trimmedQuestion = question.trim();
    if (!fs || !trimmedQuestion || selectedDocs.length === 0) return;

    setAsking(true);
    setError(null);
    try {
      const retrieval = await buildRetrievalContext(
        selectedDocs,
        trimmedQuestion,
        fs,
      );
      if (retrieval.chunkCount === 0) {
        throw new Error("No indexable text passages found in the selected docs.");
      }
      const contextSize = new TextEncoder().encode(retrieval.content).byteLength;
      await onAskDocuments(
        [
          "Answer using the attached notebook retrieval context.",
          "Cite source paths from the context when possible.",
          "",
          trimmedQuestion,
        ].join("\n"),
        [
          {
            source: "direct",
            name: "notebook-context.md",
            type: "text/markdown",
            size: contextSize,
            contentText: retrieval.content,
          },
        ],
      );
      toast.success(
        `Notebook context built from ${retrieval.chunkCount} passage${
          retrieval.chunkCount === 1 ? "" : "s"
        }.`,
      );
      setQuestion("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to ask documents.";
      setError(message);
      toast.error(message);
    } finally {
      setAsking(false);
    }
  }, [fs, onAskDocuments, question, selectedDocs]);

  const activeTitle =
    activeDocument?.kind === "crea8"
      ? activeDocument.note.title
      : activeDocument?.doc.name;
  const activePath =
    activeDocument?.doc.path;
  const isDirty =
    activeDocument?.kind === "crea8"
      ? draft !== activeDocument.note.content
      : activeDocument?.kind === "file" && isIndexableText(activeDocument.doc.name, activeDocument.doc.type)
      ? draft !== activeDocument.content
      : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="link42-panel flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">Documents</h2>
          <p className="truncate text-xs text-muted-foreground">
            {workspaceLabel} files, crea8 pages, and notebook questions grounded locally
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={filter === item.id ? "secondary" : "outline"}
              onClick={() => setFilter(item.id)}
              disabled={item.id === "project-current" && !currentProjectId}
            >
              {item.label}
            </Button>
          ))}
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
            disabled={!fs || saving}
          >
            <BookOpenTextIcon className={saving ? "animate-pulse" : ""} />
            Crea8
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={!fs || importing}
          >
            <FilePlusIcon className={importing ? "animate-pulse" : ""} />
            Files
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => folderInputRef.current?.click()}
            disabled={!fs || importing}
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

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="min-h-0 border-r border-border bg-sidebar/40">
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
                      <span>{workspaceLabel}</span>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline">{filteredWorkspaceDocs.length}</Badge>
                        {filteredWorkspaceDocs.length !== workspaceDocs.length ? (
                          <Badge variant="secondary">{workspaceDocs.length} total</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="relative">
                      <SearchIcon className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={docSearch}
                        onChange={(event) => setDocSearch(event.target.value)}
                        placeholder="Search files and crea8 pages"
                        className="h-8 pl-7 text-xs"
                      />
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={selectVisibleDocs}
                        disabled={filteredWorkspaceDocs.length === 0}
                      >
                        Select results
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
                    </div>
                  </div>
                  {workspaceDocs.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-muted-foreground">
                      Import local files into this workspace. crea8 markdown pages will appear alongside them.
                    </p>
                  ) : filteredWorkspaceDocs.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-muted-foreground">
                      No files or crea8 pages match the current view.
                    </p>
                  ) : (
                    <TreeNode
                      node={workspaceTree}
                      selectedKey={
                        activeDocument
                          ? activeDocument.doc.path
                          : null
                      }
                      label={(doc) => doc.memoryNote?.title ?? doc.name}
                      meta={(doc) =>
                        <>
                          <Badge variant="outline" className="h-5 shrink-0 text-[10px]">
                            {doc.kind === "crea8" ? doc.memoryNote?.scope ?? "crea8" : doc.previewDescriptor.kind}
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
                    />
                  )}
                </section>
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]">
          <div className="flex min-h-0 flex-col">
            {activeDocument ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">{activeTitle}</h3>
                      <Badge variant="outline">
                        {activeDocument.kind === "crea8"
                          ? "crea8"
                          : activeDocument.doc.previewDescriptor.kind}
                      </Badge>
                    </div>
                    {activePath ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {activePath}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
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
                      variant={
                        selectedDocPaths.has(activeDocument.doc.path)
                          ? "secondary"
                          : "outline"
                      }
                      onClick={() => toggleDocSelection(activeDocument.doc)}
                    >
                      {selectedDocPaths.has(activeDocument.doc.path)
                        ? "Selected"
                        : "Use in query"}
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
                {activeDocument.kind === "file" &&
                !isIndexableText(activeDocument.doc.name, activeDocument.doc.type) ? (
                  <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                    Preview is available for {activeDocument.doc.previewDescriptor.kind} files.
                  </div>
                ) : (
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    className="min-h-0 flex-1 resize-none rounded-none border-0 bg-background p-4 font-mono text-sm shadow-none focus-visible:ring-0"
                  />
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                Select a crea8 page or file from the workspace tree.
              </div>
            )}
          </div>

          <div className="border-t border-border bg-card p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Notebook query
              </span>
              {selectedDocs.length === 0 ? (
                <Badge variant="outline">No docs selected</Badge>
              ) : (
                selectedDocs.slice(0, 4).map((doc) => (
                  <Badge key={doc.path} variant="secondary" className="max-w-40 truncate">
                    {basename(doc.path)}
                  </Badge>
                ))
              )}
              {selectedDocs.length > 4 ? (
                <Badge variant="outline">+{selectedDocs.length - 4}</Badge>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask a question grounded in selected files and crea8 pages"
                className="min-h-20 resize-y text-sm"
              />
              <Button
                type="button"
                className="self-end"
                onClick={() => void askSelectedDocuments()}
                disabled={asking || selectedDocs.length === 0 || !question.trim()}
              >
                <SendIcon className={asking ? "animate-pulse" : ""} />
                Ask
              </Button>
            </div>
          </div>
        </div>
      </div>
      <FilePreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        descriptor={previewDescriptor}
        data={previewData}
      />
    </div>
  );
};
