import React from "react";
import type { ControlModule } from "@/types/llmchef/control";
import type { LLMChefModApi } from "@/types/llmchef/modding";
import type { CanvasControlRenderContext } from "@/types/llmchef/canvas/control";
import { ActionTooltipButton } from "@/components/LLMChef/common/ActionTooltipButton";
import { ArrowUpIcon } from "lucide-react";
import { useInteractionStore } from "@/store/interaction.store";
import { toast } from "sonner";

export class PromoteInteractionControlModule implements ControlModule {
  readonly id = "canvas-control-promote-interaction";

  async initialize(_modApi: LLMChefModApi): Promise<void> {}

  register(modApi: LLMChefModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "interaction",
      targetSlot: "header-actions", // Appears in the header actions
      renderer: (context: CanvasControlRenderContext) => {
        if (!context.interactionId || !context.interaction) {
          return null;
        }

        const currentInteraction = context.interaction;
        
        // Only show for child interactions (race/regen results)
        if (currentInteraction.parentId === null) {
          return null;
        }

        const promoteChild = useInteractionStore.getState().promoteChildToParent;
        
        const handlePromote = async () => {
          try {
            await promoteChild(currentInteraction.id, currentInteraction.parentId!);
            toast.success('Interaction promoted to main conversation');
          } catch (error) {
            console.error('Failed to promote interaction:', error);
            toast.error('Failed to promote interaction');
          }
        };
        
        return React.createElement(ActionTooltipButton, {
          icon: React.createElement(ArrowUpIcon),
          tooltipText: "Use in Main History",
          onClick: handlePromote,
          className: "text-green-600 hover:text-green-700"
        });
      },
    });
  }

  destroy(_modApi: LLMChefModApi): void {}
} 