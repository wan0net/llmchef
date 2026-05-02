import { emitter } from "./event-emitter";
import { vfsEvent } from "@/types/llmchef/events/vfs.events";

export type VfsTimelineOperation = "read" | "write" | "delete";

export interface VfsTimelineRecord {
  id: string;
  operation: VfsTimelineOperation;
  path: string;
  timestamp: string;
}

export interface VfsTimelineSummary {
  reads: number;
  writes: number;
  deletes: number;
  changedPaths: string[];
  deletedPaths: string[];
}

const MAX_RECORDS = 200;
const records: VfsTimelineRecord[] = [];
const listeners = new Set<() => void>();
let installed = false;

const notify = (): void => {
  listeners.forEach((listener) => listener());
};

const addRecord = (operation: VfsTimelineOperation, path: string): void => {
  records.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    operation,
    path,
    timestamp: new Date().toISOString(),
  });
  if (records.length > MAX_RECORDS) records.length = MAX_RECORDS;
  notify();
};

export const installVfsTimeline = (): void => {
  if (installed) return;
  installed = true;

  emitter.on(vfsEvent.fileRead, ({ path }: { path: string }) => addRecord("read", path));
  emitter.on(vfsEvent.fileWritten, ({ path }: { path: string }) => addRecord("write", path));
  emitter.on(vfsEvent.fileDeleted, ({ path }: { path: string }) => addRecord("delete", path));
};

export const getVfsTimelineRecords = (): VfsTimelineRecord[] => [...records];

export const getVfsTimelineSummary = (): VfsTimelineSummary => {
  const changedPaths = new Set<string>();
  const deletedPaths = new Set<string>();
  let reads = 0;
  let writes = 0;
  let deletes = 0;

  for (const record of records) {
    if (record.operation === "read") reads += 1;
    if (record.operation === "write") {
      writes += 1;
      changedPaths.add(record.path);
    }
    if (record.operation === "delete") {
      deletes += 1;
      deletedPaths.add(record.path);
    }
  }

  return {
    reads,
    writes,
    deletes,
    changedPaths: [...changedPaths].sort(),
    deletedPaths: [...deletedPaths].sort(),
  };
};

export const clearVfsTimeline = (): void => {
  records.length = 0;
  notify();
};

export const subscribeVfsTimeline = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
