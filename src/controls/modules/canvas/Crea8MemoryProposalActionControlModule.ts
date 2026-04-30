import React from "react";
import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { Crea8MemoryProposalActionControl } from "@/controls/components/canvas/Crea8MemoryProposalActionControl";

export class Crea8MemoryProposalActionControlModule implements ControlModule {
  readonly id = "canvas-control-crea8-memory-proposal-action";

  async initialize(): Promise<void> {}

  register(modApi: LiteChatModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "interaction",
      targetSlot: "header-actions",
      renderer: (context: CanvasControlRenderContext) => {
        if (!context.interaction || !context.responseContent?.trim()) {
          return null;
        }

        return React.createElement(Crea8MemoryProposalActionControl, {
          interaction: context.interaction,
          responseContent: context.responseContent,
        });
      },
    });
  }

  destroy(): void {}
}
