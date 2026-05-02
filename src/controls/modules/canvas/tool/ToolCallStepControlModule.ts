import React from "react";
import { type ControlModule } from "@/types/llmchef/control";
import type { LLMChefModApi } from "@/types/llmchef/modding";
import type { CanvasControlRenderContext } from "@/types/llmchef/canvas/control";
import { ToolCallStepControl } from "@/controls/components/canvas/tool/ToolCallStepControl";

export class ToolCallStepControlModule implements ControlModule {
  readonly id = "core-tool-call-step-display";

  async initialize(_modApi: LLMChefModApi): Promise<void> {}

  register(modApi: LLMChefModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "tool-call-step",
      targetSlot: "tool-call-content",
      renderer: (context: CanvasControlRenderContext) => {
        if (!context.interactionId || !context.toolCall) {
          console.warn(
            "[ToolCallStepControlModule] Missing interactionId or toolCall in context"
          );
          return null;
        }
        return React.createElement(ToolCallStepControl, {
          interactionId: context.interactionId,
          toolCall: context.toolCall,
          toolResult: context.toolResult, // This can be undefined if result is not yet available
        });
      },
    });
  }

  destroy(_modApi: LLMChefModApi): void {}
} 