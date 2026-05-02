import type {
  Crea8MemoryConnector,
  Crea8MemoryProposal,
} from "@/types/llmchef/crea8-memory";

export const applyMemoryProposalToConnector = async (input: {
  proposal: Crea8MemoryProposal;
  connector: Crea8MemoryConnector;
  finalContent?: string;
  now?: Date;
}): Promise<Crea8MemoryProposal> => {
  const { proposal, connector } = input;
  const content =
    input.finalContent?.trim() ||
    proposal.finalContent?.trim() ||
    proposal.proposedContent.trim();

  if (!content) throw new Error("Memory proposal content cannot be empty.");

  const now = input.now ?? new Date();
  const targetNote = proposal.targetNote
    ? await connector.update(proposal.targetNote, {
        title: proposal.title,
        content,
        scope: proposal.scope,
        projectId: proposal.source.projectId ?? null,
        skillId: proposal.source.skillId ?? null,
      })
    : await connector.create({
        title: proposal.title,
        content,
        scope: proposal.scope,
        tags: [],
        projectId: proposal.source.projectId ?? null,
        skillId: proposal.source.skillId ?? null,
      });

  return {
    ...proposal,
    status: "accepted",
    finalContent: content,
    targetNote,
    resolvedAt: now,
    updatedAt: now,
  };
};
