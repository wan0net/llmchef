// src/controls/modules/canvas/RatingActionControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/llmchef/control";
import type {
  LLMChefModApi,
  CanvasControlRenderContext,
} from "@/types/llmchef/modding";
import { CompactInteractionRating } from "@/components/LLMChef/canvas/interaction/CompactInteractionRating";

export class RatingActionControlModule implements ControlModule {
  readonly id = "core-canvas-rating-action";

  async initialize(_modApi: LLMChefModApi): Promise<void> {}

  register(modApi: LLMChefModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "interaction",
      targetSlot: "actions",
      renderer: (context: CanvasControlRenderContext) => {
        if (!context.interactionId || !context.interaction) {
          return null;
        }
        return React.createElement(CompactInteractionRating, {
          interactionId: context.interactionId,
          currentRating: context.interaction.rating,
        });
      },
    });
  }
  destroy(_modApi: LLMChefModApi): void {}
}
