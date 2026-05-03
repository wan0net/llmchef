import { emitter } from "@/lib/llmchef/event-emitter";
import { useCrea8MemoryStore } from "@/store/crea8-memory.store";
import { useConversationStore } from "@/store/conversation.store";
import { PersistenceService } from "@/services/persistence.service";
import { interactionEvent } from "@/types/llmchef/events/interaction.events";
import type { Interaction } from "@/types/llmchef/interaction";
import type { Crea8MemoryScope } from "@/types/llmchef/crea8-memory";

const AUTO_MEMORY_TYPES = new Set<Interaction["type"]>([
  "message.user_assistant",
  "message.assistant_regen",
]);
const MIN_RESPONSE_LENGTH = 180;
const MAX_CONTENT_LENGTH = 6000;
const MAX_TITLE_LENGTH = 80;

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

      await useCrea8MemoryStore.getState().proposeMemoryUpdate({
        scope: scopeFromInteraction(interaction),
        title: titleFromInteraction(interaction, response),
        reason: "Automatically proposed from assistant response.",
        proposedContent: response.slice(0, MAX_CONTENT_LENGTH),
        source: {
          conversationId: interaction.conversationId,
          interactionId: interaction.id,
          projectId:
            useConversationStore
              .getState()
              .getConversationById(interaction.conversationId)?.projectId ??
            undefined,
        },
        confidence: 0.6,
        notify: false,
      });
    } catch (error) {
      console.warn("[Crea8MemoryAutomationService] Auto memory proposal skipped.", error);
    }
  }
}
