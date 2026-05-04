import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  FileTextIcon,
  FolderIcon,
  RefreshCwIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { SettingsSection } from "@/components/LLMChef/common/SettingsSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createCrea8VfsConnector } from "@/lib/llmchef/crea8-vfs-connector";
import { joinPath, normalizePath } from "@/lib/llmchef/file-manager-utils";
import { useConversationStore } from "@/store/conversation.store";
import { useCrea8MemoryStore } from "@/store/crea8-memory.store";
import { useProjectStore } from "@/store/project.store";
import { useVfsStore } from "@/store/vfs.store";
import type {
  Crea8MemoryProposal,
  Crea8MemoryProposalStatus,
  Crea8MemorySearchResult,
} from "@/types/llmchef/crea8-memory";

const statusBadgeVariant = (status: Crea8MemoryProposalStatus) => {
  if (status === "accepted") return "default";
  if (status === "rejected") return "secondary";
  return "outline";
};

const proposalContent = (proposal: Crea8MemoryProposal) =>
  proposal.finalContent ?? proposal.proposedContent;

const proposalTimestamp = (proposal: Crea8MemoryProposal) =>
  new Date(proposal.createdAt).getTime();

const sortProposals = (
  first: Crea8MemoryProposal,
  second: Crea8MemoryProposal,
) => {
  const firstPending = first.status === "pending";
  const secondPending = second.status === "pending";

  if (firstPending !== secondPending) return firstPending ? -1 : 1;
  return proposalTimestamp(second) - proposalTimestamp(first);
};

type MemoryTreeNode = {
  name: string;
  path: string;
  children: MemoryTreeNode[];
  result?: Crea8MemorySearchResult;
};

const memoryPathParts = (
  path: string | undefined,
  fallback: string,
  rootPath: string,
): string[] => {
  const normalized = normalizePath(path || fallback);
  const normalizedRoot = normalizePath(rootPath);
  const relative = normalized.startsWith(`${normalizedRoot}/`)
    ? normalized.slice(normalizedRoot.length + 1)
    : normalized.replace(/^\/+/, "");
  return relative.split("/").filter(Boolean);
};

const buildMemoryTree = (
  results: Crea8MemorySearchResult[],
  rootPath: string,
): MemoryTreeNode => {
  const root: MemoryTreeNode = { name: "Second Brain", path: rootPath, children: [] };

  for (const result of results) {
    const parts = memoryPathParts(result.note.path, result.note.title, rootPath);
    let current = root;
    let path = rootPath;

    parts.forEach((part, index) => {
      path = `${path}/${part}`;
      const isFile = index === parts.length - 1;
      let child = current.children.find((node) => node.name === part);

      if (!child) {
        child = { name: part, path, children: [] };
        current.children.push(child);
      }

      if (isFile) child.result = result;
      current = child;
    });
  }

  const sortNode = (node: MemoryTreeNode): MemoryTreeNode => ({
    ...node,
    children: node.children
      .map(sortNode)
      .sort((first, second) => {
        if (Boolean(first.result) !== Boolean(second.result)) {
          return first.result ? 1 : -1;
        }
        return first.name.localeCompare(second.name);
      }),
  });

  return sortNode(root);
};

const MemoryTree: React.FC<{ node: MemoryTreeNode; depth?: number }> = ({
  node,
  depth = 0,
}) => {
  const isFile = Boolean(node.result);
  const label = node.result?.note.title || node.name;

  return (
    <div>
      <div
        className="flex min-w-0 items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {isFile ? (
          <FileTextIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <FolderIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{label}</span>
            {node.result ? (
              <Badge variant="outline" className="h-5 shrink-0 text-[10px]">
                {node.result.scope}
              </Badge>
            ) : null}
          </div>
          {node.result?.snippet ? (
            <p className="line-clamp-2 text-muted-foreground">
              {node.result.snippet}
            </p>
          ) : null}
          {node.result?.note.path ? (
            <p className="truncate text-[10px] text-muted-foreground/80">
              {node.result.note.path}
            </p>
          ) : null}
        </div>
      </div>
      {node.children.map((child) => (
        <MemoryTree key={child.path} node={child} depth={depth + 1} />
      ))}
    </div>
  );
};

const SettingsCrea8MemoryComponent: React.FC = () => {
  const {
    proposals,
    loading,
    error,
    loadProposals,
    resolveProposal,
    acceptProposalWithConnector,
    deleteProposal,
  } = useCrea8MemoryStore();
  const {
    fs,
    vfsKey,
    configuredVfsKey,
    loading: vfsLoading,
    operationLoading,
    error: vfsError,
  } = useVfsStore();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);
  const [memoryResults, setMemoryResults] = useState<Crea8MemorySearchResult[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const selectedItemId = useConversationStore((state) => state.selectedItemId);
  const selectedItemType = useConversationStore((state) => state.selectedItemType);
  const getConversationById = useConversationStore((state) => state.getConversationById);
  const getProjectById = useProjectStore((state) => state.getProjectById);
  const currentProjectId =
    selectedItemType === "project"
      ? selectedItemId
      : selectedItemType === "conversation" && selectedItemId
        ? getConversationById(selectedItemId)?.projectId ?? null
        : null;
  const currentProject = getProjectById(currentProjectId);
  const memoryRootPath = currentProject
    ? joinPath(currentProject.path, "Wiki", "Second Brain")
    : null;

  useEffect(() => {
    void loadProposals();
  }, [loadProposals]);

  useEffect(() => {
    setDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };

      for (const proposal of proposals) {
        if (nextDrafts[proposal.id] === undefined) {
          nextDrafts[proposal.id] = proposalContent(proposal);
        }
      }

      return nextDrafts;
    });
  }, [proposals]);

  const counts = useMemo(
    () =>
      proposals.reduce(
        (acc, proposal) => {
          if (proposal.status === "pending") acc.pending += 1;
          if (proposal.status === "accepted") acc.accepted += 1;
          if (proposal.status === "rejected") acc.rejected += 1;
          return acc;
        },
        { pending: 0, accepted: 0, rejected: 0 },
      ),
    [proposals],
  );

  const sortedProposals = useMemo(
    () => [...proposals].sort(sortProposals),
    [proposals],
  );
  const memoryTree = useMemo(
    () => buildMemoryTree(memoryResults, memoryRootPath ?? "/"),
    [memoryResults, memoryRootPath],
  );

  const updateDraft = useCallback((proposalId: string, value: string) => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [proposalId]: value,
    }));
  }, []);

  const loadMemoryTree = useCallback(async () => {
    if (!fs || !memoryRootPath) {
      setMemoryResults([]);
      return;
    }

    setMemoryLoading(true);
    setMemoryError(null);
    try {
      const connector = createCrea8VfsConnector({
        rootPath: memoryRootPath,
        fsInstance: fs,
      });
      setMemoryResults(await connector.search({ text: "", limit: 500 }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load memory tree.";
      setMemoryError(message);
      setMemoryResults([]);
    } finally {
      setMemoryLoading(false);
    }
  }, [fs, memoryRootPath]);

  useEffect(() => {
    void loadMemoryTree();
  }, [loadMemoryTree]);

  const withBusyProposal = useCallback(
    async (proposalId: string, action: () => Promise<void>, message: string) => {
      setBusyProposalId(proposalId);
      try {
        await action();
      } catch (error) {
        console.error(message, error);
        toast.error(message);
      } finally {
        setBusyProposalId(null);
      }
    },
    [],
  );

  const acceptProposal = useCallback(
    async (proposal: Crea8MemoryProposal) => {
      const proposalProject = proposal.source.projectId
        ? getProjectById(proposal.source.projectId)
        : null;
      const rootPath = proposalProject
        ? joinPath(proposalProject.path, "Wiki", "Second Brain")
        : memoryRootPath;
      if (!fs || !rootPath) {
        return;
      }

      const connector = createCrea8VfsConnector({
        rootPath,
        fsInstance: fs,
      });

      await withBusyProposal(
        proposal.id,
        () =>
          acceptProposalWithConnector(
            proposal.id,
            connector,
            drafts[proposal.id] ?? proposalContent(proposal),
          ),
        "Failed to accept memory proposal.",
      );
    },
    [acceptProposalWithConnector, drafts, fs, getProjectById, memoryRootPath, withBusyProposal],
  );

  const rejectProposal = useCallback(
    async (proposal: Crea8MemoryProposal) => {
      await withBusyProposal(
        proposal.id,
        () =>
          resolveProposal(
            proposal.id,
            "rejected",
            drafts[proposal.id] ?? proposalContent(proposal),
          ),
        "Failed to reject memory proposal.",
      );
    },
    [drafts, resolveProposal, withBusyProposal],
  );

  const removeProposal = useCallback(
    async (proposal: Crea8MemoryProposal) => {
      await withBusyProposal(
        proposal.id,
        () => deleteProposal(proposal.id),
        "Failed to delete memory proposal.",
      );
    },
    [deleteProposal, withBusyProposal],
  );

  const vfsAvailable = Boolean(fs);
  const vfsBusy = vfsLoading || operationLoading;

  return (
    <div className="space-y-4 p-1">
      <SettingsSection
        title="Wiki Memory"
        description="Review proposed memory notes before writing them to the current wiki workspace."
      >
        <Tabs defaultValue="proposals" className="space-y-3">
          <TabsList>
            <TabsTrigger value="proposals">Proposals</TabsTrigger>
            <TabsTrigger value="tree">Knowledge Base</TabsTrigger>
          </TabsList>

          <TabsContent value="proposals" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">Pending {counts.pending}</Badge>
                <Badge variant="secondary">Accepted {counts.accepted}</Badge>
                <Badge variant="secondary">Rejected {counts.rejected}</Badge>
                {configuredVfsKey || vfsKey ? (
                  <span className="text-xs text-muted-foreground">
                    Workspace: {configuredVfsKey ?? vfsKey}
                  </span>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void loadProposals()}
                disabled={loading}
              >
                <RefreshCwIcon />
                Refresh
              </Button>
            </div>

            {!vfsAvailable ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-muted-foreground">
                No VFS workspace is available. Accepting a proposal needs the
                current project workspace so Markdown can be written under its wiki.
              </p>
            ) : null}

            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}

            {vfsError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                VFS error: {vfsError}
              </p>
            ) : null}

            {loading ? (
              <p className="text-sm text-muted-foreground">
                Loading memory proposals...
              </p>
            ) : null}

            {!loading && sortedProposals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No memory proposals yet.
              </p>
            ) : null}

            <div className="space-y-3">
              {sortedProposals.map((proposal) => {
                const isPending = proposal.status === "pending";
                const isBusy = busyProposalId === proposal.id;
                const draft = drafts[proposal.id] ?? proposalContent(proposal);

                return (
                  <div
                    key={proposal.id}
                    className="space-y-3 rounded-md border bg-card p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={statusBadgeVariant(proposal.status)}>
                            {proposal.status}
                          </Badge>
                          <Badge variant="outline">{proposal.scope}</Badge>
                          <h4 className="truncate text-sm font-medium">
                            {proposal.title}
                          </h4>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {proposal.reason}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {isPending ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void acceptProposal(proposal)}
                              disabled={!vfsAvailable || vfsBusy || isBusy}
                            >
                              <CheckIcon />
                              Accept
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void rejectProposal(proposal)}
                              disabled={isBusy}
                            >
                              <XIcon />
                              Reject
                            </Button>
                          </>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void removeProposal(proposal)}
                          disabled={isBusy}
                        >
                          <TrashIcon />
                          Delete
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      {proposal.source.conversationId ? (
                        <span>Conversation: {proposal.source.conversationId}</span>
                      ) : null}
                      {proposal.source.interactionId ? (
                        <span>Interaction: {proposal.source.interactionId}</span>
                      ) : null}
                      {proposal.targetNote?.path ? (
                        <span>Target: {proposal.targetNote.path}</span>
                      ) : null}
                    </div>

                    <Textarea
                      value={draft}
                      onChange={(event) =>
                        updateDraft(proposal.id, event.target.value)
                      }
                      readOnly={!isPending}
                      className="min-h-36 resize-y text-xs"
                    />
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="tree" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Notes {memoryResults.length}</Badge>
                <span className="text-xs text-muted-foreground">
                  Markdown memory tree for the current project
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void loadMemoryTree()}
                disabled={memoryLoading || vfsBusy}
              >
                <RefreshCwIcon className={memoryLoading ? "animate-spin" : ""} />
                Refresh
              </Button>
            </div>

            {memoryError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {memoryError}
              </p>
            ) : null}

            {!vfsAvailable ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-muted-foreground">
                No VFS workspace is available.
              </p>
            ) : null}
            {vfsAvailable && !currentProject ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-muted-foreground">
                Select a project to view its second brain tree.
              </p>
            ) : null}

            <ScrollArea className="h-[28rem] rounded-md border bg-background/50">
              {memoryLoading ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Loading memory tree...
                </p>
              ) : memoryResults.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  No accepted memory notes yet.
                </p>
              ) : (
                <div className="p-2">
                  <MemoryTree node={memoryTree} />
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SettingsSection>
    </div>
  );
};

export const SettingsCrea8Memory = React.memo(SettingsCrea8MemoryComponent);
