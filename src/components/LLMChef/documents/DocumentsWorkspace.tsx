import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FilePlusIcon,
  FileTextIcon,
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
import { createCrea8VfsConnector } from "@/lib/llmchef/crea8-vfs-connector";
import { basename, joinPath } from "@/lib/llmchef/file-manager-utils";
import { listFilesOp, readFileOp, writeFileOp } from "@/lib/llmchef/vfs-operations";
import { useVfsStore } from "@/store/vfs.store";
import type { AttachedFileMetadata } from "@/store/input.store";
import type {
  Crea8MemoryNote,
  Crea8MemoryNoteRef,
  Crea8MemorySearchResult,
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
  | { kind: "memory"; note: Crea8MemoryNote }
  | { kind: "notebook"; doc: NotebookDocument; content: string };

type TreeNodeModel<T> = {
  name: string;
  path: string;
  children: TreeNodeModel<T>[];
  item?: T;
};

type NotebookDocument = {
  name: string;
  path: string;
  type: string;
  size: number;
  updatedAt: Date;
  snippet: string;
  indexText: string;
};

const NOTEBOOK_ROOT = "/Documents/Imports";
const MAX_INDEX_BYTES = 200_000;
const MAX_RETRIEVAL_BYTES = 700_000;
const RETRIEVAL_CHUNK_SIZE = 1_800;
const RETRIEVAL_CHUNK_OVERLAP = 240;
const MAX_RETRIEVAL_CHUNKS = 12;
const MAX_RETRIEVAL_CONTEXT_CHARS = 24_000;
const SNIPPET_LENGTH = 220;
const FILTERS: { id: ScopeFilter; label: string }[] = [
  { id: "project-current", label: "Current project" },
  { id: "all", label: "All memory" },
  { id: "user", label: "User" },
  { id: "project", label: "Projects" },
  { id: "decision", label: "Decisions" },
  { id: "work-log", label: "Work log" },
  { id: "skill", label: "Skills" },
  { id: "reference", label: "Reference" },
];

const memoryPathParts = (path: string | undefined, fallback: string): string[] => {
  const normalized = (path || fallback).replace(/^\/+/, "");
  const withoutRoot = normalized.replace(/^Memory\/?/, "");
  return withoutRoot.split("/").filter(Boolean);
};

const notebookPathParts = (path: string): string[] => {
  const normalized = path.replace(/^\/+/, "");
  const withoutRoot = normalized.replace(/^Documents\/Imports\/?/, "");
  return withoutRoot.split("/").filter(Boolean);
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

const buildMemoryTree = (
  results: Crea8MemorySearchResult[],
): TreeNodeModel<Crea8MemorySearchResult> => {
  const root: TreeNodeModel<Crea8MemorySearchResult> = {
    name: "Memory",
    path: "/Memory",
    children: [],
  };

  for (const result of results) {
    addTreePath(root, memoryPathParts(result.note.path, result.note.title), result);
  }

  return sortTree(root);
};

const buildNotebookTree = (
  docs: NotebookDocument[],
): TreeNodeModel<NotebookDocument> => {
  const root: TreeNodeModel<NotebookDocument> = {
    name: "Imports",
    path: NOTEBOOK_ROOT,
    children: [],
  };

  for (const doc of docs) {
    addTreePath(root, notebookPathParts(doc.path), doc);
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
  note: Crea8MemoryNote,
  filter: ScopeFilter,
  currentProjectId: string | null,
): boolean => {
  if (filter === "all") return true;
  if (filter === "project-current") {
    return currentProjectId ? note.projectId === currentProjectId : true;
  }
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
  docs: NotebookDocument[],
  question: string,
  fsInstance: typeof import("@zenfs/core").fs,
): Promise<{ content: string; chunkCount: number }> => {
  const terms = queryTerms(question);
  const scoredChunks: Array<{
    doc: NotebookDocument;
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

const indexNotebookDocument = async (
  path: string,
  name: string,
  mimeType: string,
  fsInstance: typeof import("@zenfs/core").fs,
): Promise<{ snippet: string; indexText: string }> => {
  if (!isIndexableText(name, mimeType)) {
    return { snippet: "", indexText: `${name} ${path}`.toLowerCase() };
  }

  try {
    const data = await readFileOp(path, { fsInstance, silent: true });
    const preview = decodeText(data.slice(0, MAX_INDEX_BYTES)).trim();
    return {
      snippet: preview.slice(0, SNIPPET_LENGTH),
      indexText: `${name} ${path} ${preview}`.toLowerCase(),
    };
  } catch {
    return { snippet: "", indexText: `${name} ${path}`.toLowerCase() };
  }
};

const listNotebookDocuments = async (
  path: string,
  fsInstance: typeof import("@zenfs/core").fs,
): Promise<NotebookDocument[]> => {
  const entries = await listFilesOp(path, { fsInstance });
  const docs: NotebookDocument[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) {
      docs.push(...(await listNotebookDocuments(entry.path, fsInstance)));
      continue;
    }

    const type = guessMimeType(entry.name);
    const indexed = await indexNotebookDocument(
      entry.path,
      entry.name,
      type,
      fsInstance,
    );

    docs.push({
      name: entry.name,
      path: entry.path,
      type,
      size: entry.size,
      updatedAt: entry.lastModified,
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
  itemKey,
  onSelect,
}: {
  node: TreeNodeModel<T>;
  selectedKey: string | null;
  depth?: number;
  label: (item: T) => string;
  meta?: (item: T) => React.ReactNode;
  snippet?: (item: T) => string | undefined;
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
        {isFile ? (
          <FileTextIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [filter, setFilter] = useState<ScopeFilter>("project-current");
  const [memoryResults, setMemoryResults] = useState<Crea8MemorySearchResult[]>([]);
  const [notebookDocs, setNotebookDocs] = useState<NotebookDocument[]>([]);
  const [docSearch, setDocSearch] = useState("");
  const [selectedDocPaths, setSelectedDocPaths] = useState<Set<string>>(new Set());
  const [activeDocument, setActiveDocument] = useState<ActiveDocument | null>(null);
  const [draft, setDraft] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connector = useMemo(
    () =>
      fs
        ? createCrea8VfsConnector({
            rootPath: "/Memory",
            fsInstance: fs,
          })
        : null,
    [fs],
  );
  const memoryTree = useMemo(() => buildMemoryTree(memoryResults), [memoryResults]);
  const filteredNotebookDocs = useMemo(() => {
    const query = docSearch.trim().toLowerCase();
    if (!query) return notebookDocs;
    const terms = query.split(/\s+/).filter(Boolean);
    return notebookDocs.filter((doc) =>
      terms.every((term) => doc.indexText.includes(term)),
    );
  }, [docSearch, notebookDocs]);
  const notebookTree = useMemo(
    () => buildNotebookTree(filteredNotebookDocs),
    [filteredNotebookDocs],
  );
  const selectedDocs = useMemo(
    () => notebookDocs.filter((doc) => selectedDocPaths.has(doc.path)),
    [notebookDocs, selectedDocPaths],
  );
  const busy = loading || importing || vfsLoading || operationLoading;

  const configureFolderInput = useCallback((node: HTMLInputElement | null) => {
    folderInputRef.current = node;
    if (!node) return;
    node.setAttribute("webkitdirectory", "");
    node.setAttribute("directory", "");
  }, []);

  const loadDocuments = useCallback(async () => {
    if (!fs || !connector) {
      setMemoryResults([]);
      setNotebookDocs([]);
      setActiveDocument(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const found = await connector.search({ text: "", limit: 1000 });
      const notes = await Promise.all(
        found.map(async (result) => ({
          result,
          note: await connector.read(result.note),
        })),
      );
      setMemoryResults(
        notes
          .filter(({ note }) => matchesFilter(note, filter, currentProjectId))
          .map(({ result }) => result),
      );
      setNotebookDocs(await listNotebookDocuments(NOTEBOOK_ROOT, fs));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load documents.";
      setError(message);
      setMemoryResults([]);
      setNotebookDocs([]);
    } finally {
      setLoading(false);
    }
  }, [connector, currentProjectId, filter, fs]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (
      activeDocument?.kind === "memory" &&
      !memoryResults.some((result) => result.note.id === activeDocument.note.id)
    ) {
      setActiveDocument(null);
      setDraft("");
    }
    if (
      activeDocument?.kind === "notebook" &&
      !notebookDocs.some((doc) => doc.path === activeDocument.doc.path)
    ) {
      setActiveDocument(null);
      setDraft("");
    }
  }, [activeDocument, memoryResults, notebookDocs]);

  const selectMemoryNote = useCallback(
    async (ref: Crea8MemoryNoteRef) => {
      if (!connector) return;
      setError(null);
      try {
        const note = await connector.read(ref);
        setActiveDocument({ kind: "memory", note });
        setDraft(note.content);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to open note.");
      }
    },
    [connector],
  );

  const selectNotebookDoc = useCallback(
    async (doc: NotebookDocument) => {
      if (!fs) return;
      setError(null);
      try {
        const content = decodeText(
          await readFileOp(doc.path, { fsInstance: fs, silent: true }),
        );
        setActiveDocument({ kind: "notebook", doc, content });
        setDraft(content);
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
      if (activeDocument.kind === "memory") {
        if (!connector) return;
        const updatedRef = await connector.update(
          {
            backend: "markdown-workspace",
            id: activeDocument.note.id,
            title: activeDocument.note.title,
            path: activeDocument.note.path,
          },
          { content: draft },
        );
        const updatedNote = await connector.read(updatedRef);
        setActiveDocument({ kind: "memory", note: updatedNote });
        setDraft(updatedNote.content);
      } else {
        await writeFileOp(activeDocument.doc.path, draft, { fsInstance: fs });
        setActiveDocument({
          kind: "notebook",
          doc: activeDocument.doc,
          content: draft,
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
          const targetPath = joinPath(NOTEBOOK_ROOT, relativePath);
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
    [fs, loadDocuments],
  );

  const toggleDocSelection = useCallback((doc: NotebookDocument) => {
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
      for (const doc of filteredNotebookDocs) {
        next.add(doc.path);
      }
      return next;
    });
  }, [filteredNotebookDocs]);

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
    activeDocument?.kind === "memory"
      ? activeDocument.note.title
      : activeDocument?.doc.name;
  const activePath =
    activeDocument?.kind === "memory"
      ? activeDocument.note.path
      : activeDocument?.doc.path;
  const isDirty =
    activeDocument?.kind === "memory"
      ? draft !== activeDocument.note.content
      : activeDocument?.kind === "notebook"
      ? draft !== activeDocument.content
      : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="link42-panel flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">Documents</h2>
          <p className="truncate text-xs text-muted-foreground">
            Memory notes, imported docs, and notebook questions grounded in selected files
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
                  <div className="mb-1 flex items-center justify-between px-2 text-xs font-medium text-muted-foreground">
                    <span>Knowledge base</span>
                    <Badge variant="outline">{memoryResults.length}</Badge>
                  </div>
                  {memoryResults.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-muted-foreground">
                      No memory notes found for this view.
                    </p>
                  ) : (
                    <TreeNode
                      node={memoryTree}
                      selectedKey={
                        activeDocument?.kind === "memory"
                          ? activeDocument.note.id
                          : null
                      }
                      label={(result) => result.note.title}
                      meta={(result) => (
                        <Badge variant="outline" className="h-5 shrink-0 text-[10px]">
                          {result.scope}
                        </Badge>
                      )}
                      snippet={(result) => result.snippet}
                      itemKey={(result) => result.note.id}
                      onSelect={(result) => void selectMemoryNote(result.note)}
                    />
                  )}
                </section>

                <section>
                  <div className="mb-2 space-y-2 px-2">
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <span>Imported docs</span>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline">{filteredNotebookDocs.length}</Badge>
                        {filteredNotebookDocs.length !== notebookDocs.length ? (
                          <Badge variant="secondary">{notebookDocs.length} total</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="relative">
                      <SearchIcon className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={docSearch}
                        onChange={(event) => setDocSearch(event.target.value)}
                        placeholder="Search imported docs"
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
                        disabled={filteredNotebookDocs.length === 0}
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
                  {notebookDocs.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-muted-foreground">
                      Import local files to query them from chat.
                    </p>
                  ) : filteredNotebookDocs.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-muted-foreground">
                      No imported docs match the current search.
                    </p>
                  ) : (
                    <TreeNode
                      node={notebookTree}
                      selectedKey={
                        activeDocument?.kind === "notebook"
                          ? activeDocument.doc.path
                          : null
                      }
                      label={(doc) => doc.name}
                      meta={(doc) =>
                        selectedDocPaths.has(doc.path) ? (
                          <Badge variant="secondary" className="h-5 shrink-0 text-[10px]">
                            selected
                          </Badge>
                        ) : null
                      }
                      snippet={(doc) => doc.snippet}
                      itemKey={(doc) => doc.path}
                      onSelect={(doc) => void selectNotebookDoc(doc)}
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
                      <Badge variant="outline">{activeDocument.kind}</Badge>
                    </div>
                    {activePath ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {activePath}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {activeDocument.kind === "notebook" ? (
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
                    ) : null}
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
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="min-h-0 flex-1 resize-none rounded-none border-0 bg-background p-4 font-mono text-sm shadow-none focus-visible:ring-0"
                />
              </>
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                Select a memory note or imported document from the tree.
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
                placeholder="Ask a question grounded in the selected imported docs"
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
    </div>
  );
};
