import React, { useCallback, useState } from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { useCrea8MemoryStore } from "@/store/crea8-memory.store";
import type { Interaction } from "@/types/litechat/interaction";
import { BookMarkedIcon } from "lucide-react";
import { toast } from "sonner";

interface Crea8MemoryProposalActionControlProps {
  interaction: Interaction;
  responseContent: string;
}

const FALLBACK_TITLE = "Assistant memory note";
const MAX_TITLE_LENGTH = 80;

const deriveProposalTitle = (content: string): string => {
  const firstLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  const title = firstLine?.replace(/^#{1,6}\s+/, "").trim() || FALLBACK_TITLE;

  if (title.length <= MAX_TITLE_LENGTH) {
    return title;
  }

  return `${title.slice(0, MAX_TITLE_LENGTH - 3).trimEnd()}...`;
};

export const Crea8MemoryProposalActionControl: React.FC<
  Crea8MemoryProposalActionControlProps
> = ({ interaction, responseContent }) => {
  const [isSaving, setIsSaving] = useState(false);
  const trimmedContent = responseContent.trim();

  const handleProposeMemory = useCallback(
    async (event: React.MouseEvent) => {
      event.stopPropagation();

      if (isSaving || trimmedContent.length === 0) {
        return;
      }

      setIsSaving(true);

      try {
        await useCrea8MemoryStore.getState().proposeMemoryUpdate({
          scope: "project",
          title: deriveProposalTitle(trimmedContent),
          reason: "Created from assistant response.",
          proposedContent: trimmedContent,
          source: {
            conversationId: interaction.conversationId,
            interactionId: interaction.id,
          },
          confidence: 0.5,
        });
      } catch (error) {
        console.error("Failed to save memory proposal:", error);
        toast.error("Failed to save memory proposal.");
      } finally {
        setIsSaving(false);
      }
    },
    [interaction.conversationId, interaction.id, isSaving, trimmedContent]
  );

  return (
    <ActionTooltipButton
      tooltipText="Propose as crea8 memory"
      aria-label="Propose as crea8 memory"
      onClick={handleProposeMemory}
      disabled={isSaving}
      icon={<BookMarkedIcon />}
      className="h-5 w-5"
    />
  );
};
