import React from "react";
import { type ControlModule } from "@/types/llmchef/control";
import type { LLMChefModApi } from "@/types/llmchef/modding";
import type { CanvasControlRenderContext } from "@/types/llmchef/canvas/control";
import { ZipDownloadControl } from "@/controls/components/canvas/interaction/ZipDownloadControl";

export class ZipDownloadControlModule implements ControlModule {
  readonly id = "core-interaction-zip-download";

  async initialize(_modApi: LLMChefModApi): Promise<void> {}

  register(modApi: LLMChefModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "interaction",
      targetSlot: "header-actions",
      renderer: (context: CanvasControlRenderContext) => {
        if (!context.interactionId || !context.responseContent) {
          return null;
        }
        return React.createElement(ZipDownloadControl, {
          context,
        });
      },
    });
  }
  
  destroy(_modApi: LLMChefModApi): void {}
} 