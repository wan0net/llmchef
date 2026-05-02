import React, { useMemo, useState, useSyncExternalStore } from "react";
import { ClockIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clearVfsTimeline,
  getVfsTimelineRecords,
  getVfsTimelineSummary,
  subscribeVfsTimeline,
} from "@/lib/llmchef/vfs-timeline";

const emptyRecords: ReturnType<typeof getVfsTimelineRecords> = [];

const formatTime = (timestamp: string): string => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return timestamp;
  }
};

export const VfsTimelinePanel: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const records = useSyncExternalStore(
    subscribeVfsTimeline,
    getVfsTimelineRecords,
    () => emptyRecords,
  );
  const summary = useMemo(getVfsTimelineSummary, [records]);
  const recentRecords = records.slice(0, 8);

  return (
    <div className="border-t bg-muted/20 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-2 font-medium"
          onClick={() => setExpanded((value) => !value)}
        >
          <ClockIcon className="h-3.5 w-3.5" />
          VFS timeline
          <span className="text-muted-foreground">
            {summary.writes} writes · {summary.deletes} deletes · {summary.reads} reads
          </span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            {summary.changedPaths.length} changed paths · {summary.deletedPaths.length} deleted paths
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearVfsTimeline}
            disabled={records.length === 0}
          >
            <Trash2Icon className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded border bg-background/60">
            {recentRecords.length === 0 ? (
              <p className="p-2 text-muted-foreground">No VFS activity recorded this session.</p>
            ) : (
              recentRecords.map((record) => (
                <div key={record.id} className="grid grid-cols-[4.5rem_4rem_minmax(0,1fr)] gap-2 border-t px-2 py-1 first:border-t-0">
                  <span className="text-muted-foreground">{formatTime(record.timestamp)}</span>
                  <span className="font-medium">{record.operation}</span>
                  <span className="truncate font-mono text-muted-foreground">{record.path}</span>
                </div>
              ))
            )}
          </div>
          <div className="rounded border bg-background/60 p-2">
            <p className="font-medium">Session diff summary</p>
            <p className="mt-1 truncate font-mono text-muted-foreground">
              Changed: {summary.changedPaths.slice(0, 5).join(", ") || "none"}
            </p>
            <p className="mt-1 truncate font-mono text-muted-foreground">
              Deleted: {summary.deletedPaths.slice(0, 5).join(", ") || "none"}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};
