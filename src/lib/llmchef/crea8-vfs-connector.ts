import { fs } from "@zenfs/core";
import { nanoid } from "nanoid";
import type {
  Crea8MemoryConnector,
  Crea8MemoryNote,
  Crea8MemoryNoteRef,
  Crea8MemoryScope,
  Crea8MemorySearchQuery,
  Crea8MemorySearchResult,
} from "@/types/llmchef/crea8-memory";
import {
  parseCrea8MarkdownNote,
  serializeCrea8MarkdownNote,
} from "./crea8-memory";
import { joinPath, normalizePath } from "./file-manager-utils";
import { listFilesOp, readFileOp, writeFileOp } from "./vfs-operations";

const BACKEND = "markdown-workspace" as const;
const DEFAULT_ROOT_PATH = "/Memory";
const MAX_FILENAME_BASE_LENGTH = 80;
const EXCERPT_LENGTH = 180;

const SCOPE_DIRECTORIES: Record<Crea8MemoryScope, string> = {
  user: "User",
  project: "Projects",
  decision: "Decisions",
  "work-log": "Work Log",
  skill: "Skills",
  reference: "Reference",
};

export interface Crea8VfsConnectorOptions {
  rootPath?: string;
  fsInstance?: typeof fs;
}

type VfsData = Uint8Array | string;

type ExtendedSearchResult = Crea8MemorySearchResult & {
  title: string;
  excerpt: string;
  updatedAt: Date;
};

export const createCrea8VfsConnector = (
  options: Crea8VfsConnectorOptions = {}
): Crea8MemoryConnector => {
  const rootPath = normalizePath(options.rootPath ?? DEFAULT_ROOT_PATH);
  const fsInstance = options.fsInstance;

  const read = async (ref: Crea8MemoryNoteRef): Promise<Crea8MemoryNote> => {
    if (!ref.path) {
      throw new Error("markdown-workspace memory refs require a path.");
    }

    const path = normalizePath(ref.path);
    const markdown = decodeVfsData(
      await readFileOp(path, { fsInstance, silent: true })
    );
    return parseCrea8MarkdownNote(markdown, path);
  };

  const create = async (
    noteInput: Omit<Crea8MemoryNote, "id" | "createdAt" | "updatedAt">
  ): Promise<Crea8MemoryNoteRef> => {
    const now = new Date();
    const path = normalizePath(
      noteInput.path ?? defaultPathForNote(rootPath, noteInput.scope, noteInput.title)
    );
    const note: Crea8MemoryNote = {
      ...noteInput,
      id: nanoid(),
      path,
      createdAt: now,
      updatedAt: now,
    };

    await writeNote(path, note, fsInstance);
    return toNoteRef(note);
  };

  const update = async (
    ref: Crea8MemoryNoteRef,
    patch: Partial<Crea8MemoryNote>
  ): Promise<Crea8MemoryNoteRef> => {
    const existing = await read(ref);
    const path = normalizePath(patch.path ?? existing.path ?? ref.path ?? "");
    if (!path) {
      throw new Error("markdown-workspace memory refs require a path.");
    }

    const note: Crea8MemoryNote = {
      ...existing,
      ...patch,
      id: existing.id,
      path,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    await writeNote(path, note, fsInstance);
    return toNoteRef(note);
  };

  return {
    id: "crea8-markdown-workspace",
    name: "crea8 Markdown Workspace",
    backend: BACKEND,
    search: async (
      query: Crea8MemorySearchQuery
    ): Promise<Crea8MemorySearchResult[]> => {
      if (query.limit !== undefined && query.limit <= 0) return [];

      const paths = await listMarkdownFiles(rootPath, fsInstance);
      const results: ExtendedSearchResult[] = [];

      for (const path of paths) {
        const note = await readNoteForSearch(path, fsInstance);
        if (!note || !matchesQuery(note, query)) continue;

        results.push(toSearchResult(note, query.text));
        if (query.limit !== undefined && results.length >= query.limit) break;
      }

      return results;
    },
    read,
    create,
    update,
  };
};

const listMarkdownFiles = async (
  path: string,
  fsInstance?: typeof fs
): Promise<string[]> => {
  let entries;
  try {
    entries = await listFilesOp(path, { fsInstance });
  } catch (error) {
    if (isMissingPathError(error)) return [];
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = normalizePath(entry.path);
    if (entry.isDirectory) {
      files.push(...(await listMarkdownFiles(entryPath, fsInstance)));
      continue;
    }

    if (entry.name.toLowerCase().endsWith(".md")) {
      files.push(entryPath);
    }
  }

  return files;
};

const readNoteForSearch = async (
  path: string,
  fsInstance?: typeof fs
): Promise<Crea8MemoryNote | null> => {
  try {
    const markdown = decodeVfsData(
      await readFileOp(path, { fsInstance, silent: true })
    );
    return parseCrea8MarkdownNote(markdown, path);
  } catch {
    return null;
  }
};

const writeNote = async (
  path: string,
  note: Crea8MemoryNote,
  fsInstance?: typeof fs
): Promise<void> => {
  await writeFileOp(path, new TextEncoder().encode(serializeCrea8MarkdownNote(note)), {
    fsInstance,
  });
};

const matchesQuery = (
  note: Crea8MemoryNote,
  query: Crea8MemorySearchQuery
): boolean => {
  if (query.scopes?.length && !query.scopes.includes(note.scope)) return false;
  if (query.projectId !== undefined && note.projectId !== query.projectId) {
    return false;
  }
  if (query.skillId !== undefined && note.skillId !== query.skillId) {
    return false;
  }

  const text = query.text?.trim().toLowerCase();
  if (!text) return true;

  return [
    note.title,
    note.content,
    note.path ?? "",
    ...note.tags,
  ].some((value) => value.toLowerCase().includes(text));
};

const toSearchResult = (
  note: Crea8MemoryNote,
  searchText?: string
): ExtendedSearchResult => {
  const excerpt = buildExcerpt(note.content, searchText);
  return {
    note: toNoteRef(note),
    title: note.title,
    excerpt,
    snippet: excerpt,
    score: 1,
    scope: note.scope,
    tags: note.tags,
    updatedAt: note.updatedAt,
  };
};

const toNoteRef = (note: Crea8MemoryNote): Crea8MemoryNoteRef => ({
  backend: BACKEND,
  id: note.id,
  title: note.title,
  path: note.path,
});

const buildExcerpt = (content: string, searchText?: string): string => {
  const trimmed = content.trim();
  if (!searchText?.trim()) return trimmed.slice(0, EXCERPT_LENGTH);

  const query = searchText.trim().toLowerCase();
  const index = trimmed.toLowerCase().indexOf(query);
  if (index === -1) return trimmed.slice(0, EXCERPT_LENGTH);

  const start = Math.max(0, index - Math.floor((EXCERPT_LENGTH - query.length) / 2));
  return trimmed.slice(start, start + EXCERPT_LENGTH);
};

const defaultPathForNote = (
  rootPath: string,
  scope: Crea8MemoryScope,
  title: string
): string => {
  return joinPath(rootPath, SCOPE_DIRECTORIES[scope], slugMarkdownFilename(title));
};

const slugMarkdownFilename = (title: string): string => {
  const slug = title
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.join("-")
    .slice(0, MAX_FILENAME_BASE_LENGTH);

  return `${slug || "note"}.md`;
};

const decodeVfsData = (data: VfsData): string => {
  if (typeof data === "string") return data;
  return new TextDecoder().decode(data);
};

const isMissingPathError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const code = (error as Error & { code?: string }).code;
  return code === "ENOENT" || /not found|no such file/i.test(error.message);
};
