import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckIcon, RefreshCwIcon, TrashIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { SettingsSection } from "@/components/LiteChat/common/SettingsSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createCrea8VfsConnector } from "@/lib/litechat/crea8-vfs-connector";
import { useCrea8MemoryStore } from "@/store/crea8-memory.store";
import { useVfsStore } from "@/store/vfs.store";
import type {
  Crea8MemoryProposal,
  Crea8MemoryProposalStatus,
} from "@/types/litechat/crea8-memory";

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

  const updateDraft = useCallback((proposalId: string, value: string) => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [proposalId]: value,
    }));
  }, []);

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
      if (!fs) {
        return;
      }

      const connector = createCrea8VfsConnector({
        rootPath: "/Memory",
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
    [acceptProposalWithConnector, drafts, fs, withBusyProposal],
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
        title="crea8 Memory"
        description="Review proposed memory notes before writing them to the current VFS workspace."
      >
        <div className="space-y-3">
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
              current VFS workspace so markdown can be written under /Memory.
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
        </div>
      </SettingsSection>
    </div>
  );
};

export const SettingsCrea8Memory = React.memo(SettingsCrea8MemoryComponent);
