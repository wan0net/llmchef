import type { fs as FsType } from "@zenfs/core";
import { db } from "@/lib/llmchef/db";
import { joinPath, normalizePath } from "./file-manager-utils";
import * as VfsOps from "./vfs-operations";

export type FileSystemDirectoryHandleLike = {
  kind: "directory";
  name: string;
  entries: () => AsyncIterableIterator<[string, FileSystemHandleLike]>;
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<FileSystemDirectoryHandleLike>;
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<FileSystemFileHandleLike>;
  queryPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
};

type FileSystemFileHandleLike = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{
    write: (data: BufferSource | Blob | string) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

type FileSystemHandleLike = FileSystemDirectoryHandleLike | FileSystemFileHandleLike;

export type RealFsSyncDirection = "import" | "export" | "two-way";

export interface RealFsSyncResult {
  filesImported: number;
  filesExported: number;
  directoriesCreated: number;
  filesSkipped: number;
}

export interface RealFsSyncOptions {
  fsInstance: typeof FsType;
  vfsPath: string;
  directoryHandle: FileSystemDirectoryHandleLike;
}

const IGNORED_NAMES = new Set([
  ".DS_Store",
  ".env",
  ".env.local",
  ".git",
  ".llmchef",
  "node_modules",
]);
const PROJECT_DIRECTORY_HANDLE_PREFIX = "projectDirectoryHandle:";

export const isRealFsSyncSupported = (): boolean =>
  typeof window !== "undefined" && "showDirectoryPicker" in window;

export const shouldIgnoreRealFsEntry = (name: string): boolean =>
  IGNORED_NAMES.has(name);

export const pickRealDirectory = async (
  id = "llmchef-vfs-sync"
): Promise<FileSystemDirectoryHandleLike> => {
  if (!isRealFsSyncSupported()) {
    throw new Error("Folder sync requires a browser with File System Access API support.");
  }

  const picker = (window as any).showDirectoryPicker as (options: {
    mode: "readwrite";
    id: string;
  }) => Promise<FileSystemDirectoryHandleLike>;

  const directoryHandle = await picker({
    mode: "readwrite",
    id,
  });

  await ensureReadWritePermission(directoryHandle);
  return directoryHandle;
};

export const getProjectDirectoryHandleInfo = async (
  projectId: string
): Promise<{ name: string; savedAt: string } | null> => {
  const record = await db.appState.get(`${PROJECT_DIRECTORY_HANDLE_PREFIX}${projectId}`);
  const value = record?.value;
  if (!value?.handle) return null;
  return {
    name: value.name || value.handle.name || "Local folder",
    savedAt: value.savedAt || new Date().toISOString(),
  };
};

export const saveProjectDirectoryHandle = async (
  projectId: string,
  directoryHandle: FileSystemDirectoryHandleLike
): Promise<void> => {
  await db.appState.put({
    key: `${PROJECT_DIRECTORY_HANDLE_PREFIX}${projectId}`,
    value: {
      handle: directoryHandle,
      name: directoryHandle.name,
      savedAt: new Date().toISOString(),
    },
  });
};

export const loadProjectDirectoryHandle = async (
  projectId: string
): Promise<FileSystemDirectoryHandleLike | null> => {
  const record = await db.appState.get(`${PROJECT_DIRECTORY_HANDLE_PREFIX}${projectId}`);
  return record?.value?.handle ?? null;
};

export const pickProjectDirectory = async (
  projectId: string
): Promise<FileSystemDirectoryHandleLike> => {
  const directoryHandle = await pickRealDirectory(`llmchef-project-${projectId}`);
  await saveProjectDirectoryHandle(projectId, directoryHandle);
  return directoryHandle;
};

export const syncProjectDirectoryTwoWay = async (
  projectId: string,
  fsInstance: typeof FsType
): Promise<RealFsSyncResult> => {
  const directoryHandle = await loadProjectDirectoryHandle(projectId);
  if (!directoryHandle) {
    throw new Error("No local project folder is connected.");
  }
  await ensureReadWritePermission(directoryHandle);
  return syncRealDirectoryTwoWay({
    fsInstance,
    vfsPath: "/",
    directoryHandle,
  });
};

export const syncRealDirectoryToVfs = async (
  options: RealFsSyncOptions
): Promise<RealFsSyncResult> => {
  const result = createEmptyResult();
  await importDirectory(options.directoryHandle, normalizePath(options.vfsPath), options.fsInstance, result);
  return result;
};

export const syncVfsToRealDirectory = async (
  options: RealFsSyncOptions
): Promise<RealFsSyncResult> => {
  const result = createEmptyResult();
  await exportDirectory(normalizePath(options.vfsPath), options.directoryHandle, options.fsInstance, result);
  return result;
};

export const syncRealDirectoryTwoWay = async (
  options: RealFsSyncOptions
): Promise<RealFsSyncResult> => {
  const imported = await syncRealDirectoryToVfs(options);
  const exported = await syncVfsToRealDirectory(options);

  return {
    filesImported: imported.filesImported,
    filesExported: exported.filesExported,
    directoriesCreated: imported.directoriesCreated + exported.directoriesCreated,
    filesSkipped: imported.filesSkipped + exported.filesSkipped,
  };
};

const createEmptyResult = (): RealFsSyncResult => ({
  filesImported: 0,
  filesExported: 0,
  directoriesCreated: 0,
  filesSkipped: 0,
});

export const ensureReadWritePermission = async (
  directoryHandle: FileSystemDirectoryHandleLike
): Promise<void> => {
  const descriptor = { mode: "readwrite" as const };
  const current = await directoryHandle.queryPermission?.(descriptor);
  if (current === "granted" || !directoryHandle.requestPermission) return;

  const requested = await directoryHandle.requestPermission(descriptor);
  if (requested !== "granted") {
    throw new Error("Read/write permission was not granted for the selected folder.");
  }
};

const importDirectory = async (
  directoryHandle: FileSystemDirectoryHandleLike,
  targetVfsPath: string,
  fsInstance: typeof FsType,
  result: RealFsSyncResult
): Promise<void> => {
  await VfsOps.createDirectoryOp(targetVfsPath, { fsInstance });

  for await (const [name, handle] of directoryHandle.entries()) {
    if (shouldIgnoreRealFsEntry(name)) {
      result.filesSkipped++;
      continue;
    }

    const childVfsPath = joinPath(targetVfsPath, name);
    if (handle.kind === "directory") {
      result.directoriesCreated++;
      await importDirectory(handle, childVfsPath, fsInstance, result);
      continue;
    }

    const file = await handle.getFile();
    if (await isVfsFileNewerOrEqual(childVfsPath, file.lastModified, fsInstance)) {
      result.filesSkipped++;
      continue;
    }

    const data = new Uint8Array(await file.arrayBuffer());
    await VfsOps.writeFileOp(childVfsPath, data, { fsInstance });
    result.filesImported++;
  }
};

const exportDirectory = async (
  sourceVfsPath: string,
  directoryHandle: FileSystemDirectoryHandleLike,
  fsInstance: typeof FsType,
  result: RealFsSyncResult
): Promise<void> => {
  const entries = await VfsOps.listFilesOp(sourceVfsPath, { fsInstance });

  for (const entry of entries) {
    if (shouldIgnoreRealFsEntry(entry.name)) {
      result.filesSkipped++;
      continue;
    }

    if (entry.isDirectory) {
      const childDir = await directoryHandle.getDirectoryHandle(entry.name, {
        create: true,
      });
      result.directoriesCreated++;
      await exportDirectory(entry.path, childDir, fsInstance, result);
      continue;
    }

    const existingFileHandle = await getExistingRealFileHandle(directoryHandle, entry.name);
    if (
      existingFileHandle &&
      (await isRealFileNewerOrEqual(existingFileHandle, entry.lastModified.getTime()))
    ) {
      result.filesSkipped++;
      continue;
    }

    const fileHandle = await directoryHandle.getFileHandle(entry.name, {
      create: true,
    });
    const data = await VfsOps.readFileOp(entry.path, {
      fsInstance,
      silent: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
    result.filesExported++;
  }
};

const getExistingRealFileHandle = async (
  directoryHandle: FileSystemDirectoryHandleLike,
  name: string
): Promise<FileSystemFileHandleLike | null> => {
  try {
    return await directoryHandle.getFileHandle(name);
  } catch {
    return null;
  }
};

const isVfsFileNewerOrEqual = async (
  path: string,
  realFileLastModified: number,
  fsInstance: typeof FsType
): Promise<boolean> => {
  try {
    const stat = await fsInstance.promises.stat(path);
    return !stat.isDirectory() && stat.mtime.getTime() >= realFileLastModified;
  } catch (error) {
    if (error instanceof Error && (error as any).code === "ENOENT") return false;
    throw error;
  }
};

const isRealFileNewerOrEqual = async (
  fileHandle: FileSystemFileHandleLike,
  vfsLastModified: number
): Promise<boolean> => {
  try {
    const file = await fileHandle.getFile();
    return file.lastModified >= vfsLastModified;
  } catch {
    return false;
  }
};

export const describeRealFsSyncResult = (
  direction: RealFsSyncDirection,
  result: RealFsSyncResult
): string => {
  const action = direction === "import" ? "Import" : direction === "export" ? "Export" : "Sync";
  const changed = result.filesImported + result.filesExported;
  const parts = [
    `${changed} file${changed === 1 ? "" : "s"} changed`,
    `${result.filesSkipped} skipped`,
  ];

  return `${action} complete: ${parts.join(", ")}.`;
};
