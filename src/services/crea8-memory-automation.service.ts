import { nanoid } from "nanoid";
import { emitter } from "@/lib/llmchef/event-emitter";
import { APP_VFS_KEY } from "@/lib/llmchef/constants";
import { createMemoryProposal } from "@/lib/llmchef/crea8-memory";
import { createCrea8VfsConnector } from "@/lib/llmchef/crea8-vfs-connector";
import { joinPath } from "@/lib/llmchef/file-manager-utils";
import { initializeFsOp } from "@/lib/llmchef/vfs-operations";
import { useCrea8MemoryStore } from "@/store/crea8-memory.store";
import { useConversationStore } from "@/store/conversation.store";
import { useProjectStore } from "@/store/project.store";
import { useVfsStore } from "@/store/vfs.store";
import { PersistenceService } from "@/services/persistence.service";
import { interactionEvent } from "@/types/llmchef/events/interaction.events";
import type { Interaction } from "@/types/llmchef/interaction";
import type {
  Crea8MemoryProposal,
  Crea8MemoryScope,
} from "@/types/llmchef/crea8-memory";

const AUTO_MEMORY_TYPES = new Set<Interaction["type"]>([
  "message.user_assistant",
  "message.assistant_regen",
]);
const MIN_RESPONSE_LENGTH = 180;
const MAX_CONTENT_LENGTH = 6000;
const MAX_TITLE_LENGTH = 80;
const GLOBAL_DOCUMENTS_ROOT = "/Documents";

const isMemoryWorthProposing = (response: string): boolean => {
  const trimmed = response.trim();
  if (trimmed.length < MIN_RESPONSE_LENGTH) return false;
  if (/^(error|failed|cancelled)\b/i.test(trimmed)) return false;
  return /[.!?]\s/.test(trimmed) || trimmed.includes("\n");
};

const titleFromInteraction = (interaction: Interaction, response: string): string => {
  const promptTitle = interaction.prompt?.content
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  const responseTitle = response
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^#{1,6}\s+/, ""))
    .find(Boolean);
  const rawTitle = promptTitle || responseTitle || "Assistant memory note";
  return rawTitle.length <= MAX_TITLE_LENGTH
    ? rawTitle
    : `${rawTitle.slice(0, MAX_TITLE_LENGTH - 3).trimEnd()}...`;
};

const scopeFromInteraction = (interaction: Interaction): Crea8MemoryScope =>
  interaction.prompt?.metadata?.activeRuleIds?.length ? "reference" : "project";

const slugSegment = (value: string): string =>
  value
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.join("-")
    .slice(0, 80) || "memory";

const taxonomyRootForInteraction = (interaction: Interaction): string => {
  const conversation = useConversationStore
    .getState()
    .getConversationById(interaction.conversationId);
  const project = useProjectStore
    .getState()
    .getProjectById(conversation?.projectId ?? null);
  return joinPath(project?.path ?? GLOBAL_DOCUMENTS_ROOT, "crea8", "Second Brain");
};

const taxonomyPathForMemory = (
  interaction: Interaction,
  scope: Crea8MemoryScope,
  title: string,
): string => {
  const date = new Date().toISOString().slice(0, 10);
  const section = scope === "project" ? "Findings" : "Reference";
  return joinPath(
    taxonomyRootForInteraction(interaction),
    section,
    `${date}-${slugSegment(title)}-${interaction.id.slice(0, 8)}.md`,
  );
};

export class Crea8MemoryAutomationService {
  private static isInitialized = false;

  static initialize(): void {
    if (this.isInitialized) return;
    emitter.on(interactionEvent.completed, ({ interaction, status }) => {
      if (status !== "COMPLETED" || !interaction) return;
      void this.proposeFromInteraction(interaction);
    });
    this.isInitialized = true;
  }

  private static async proposeFromInteraction(interaction: Interaction): Promise<void> {
    if (!AUTO_MEMORY_TYPES.has(interaction.type)) return;
    if (interaction.parentId !== null) return;
    if (typeof interaction.response !== "string") return;

    const response = interaction.response.trim();
    if (!isMemoryWorthProposing(response)) return;

    try {
      const existing = await PersistenceService.loadCrea8MemoryProposals();
      if (
        existing.some(
          (proposal) => proposal.source.interactionId === interaction.id
        )
      ) {
        return;
      }

      await this.writeMemoryFromInteraction(interaction, response);
    } catch (error) {
      console.warn("[Crea8MemoryAutomationService] Auto memory write skipped.", error);
    }
  }

  private static async writeMemoryFromInteraction(
    interaction: Interaction,
    response: string,
  ): Promise<void> {
    const fs =
      useVfsStore.getState().fs ??
      (await initializeFsOp(APP_VFS_KEY));
    if (!fs) throw new Error("App VFS is not available.");

    const conversation = useConversationStore
      .getState()
      .getConversationById(interaction.conversationId);
    const scope = scopeFromInteraction(interaction);
    const title = titleFromInteraction(interaction, response);
    const proposal: Crea8MemoryProposal = {
      id: nanoid(),
      ...createMemoryProposal({
        scope,
        title,
        reason: "Automatically written from assistant response.",
        proposedContent: response.slice(0, MAX_CONTENT_LENGTH),
        source: {
          conversationId: interaction.conversationId,
          interactionId: interaction.id,
          projectId: conversation?.projectId ?? undefined,
        },
        confidence: 0.72,
      }),
    };

    const connector = createCrea8VfsConnector({
      rootPath: taxonomyRootForInteraction(interaction),
      fsInstance: fs,
    });
    const targetNote = await connector.create({
      title: proposal.title,
      content: proposal.proposedContent,
      scope: proposal.scope,
      tags: ["auto-memory", "second-brain"],
      projectId: proposal.source.projectId ?? null,
      skillId: proposal.source.skillId ?? null,
      path: taxonomyPathForMemory(interaction, scope, title),
    });
    const now = new Date();
    const written: Crea8MemoryProposal = {
      ...proposal,
      status: "accepted",
      finalContent: proposal.proposedContent,
      targetNote,
      resolvedAt: now,
      updatedAt: now,
    };

    await PersistenceService.saveCrea8MemoryProposal(written);
    useCrea8MemoryStore.setState((state) => ({
      proposals: [written, ...state.proposals],
    }));
  }
}
