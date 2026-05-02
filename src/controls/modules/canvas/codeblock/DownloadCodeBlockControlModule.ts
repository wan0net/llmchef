// src/controls/modules/canvas/codeblock/DownloadCodeBlockControlModule.ts
import React from "react";
import { type ControlModule } from "@/types/llmchef/control";
import type { LLMChefModApi } from "@/types/llmchef/modding";
import type { CanvasControlRenderContext } from "@/types/llmchef/canvas/control";
import { DownloadCodeBlockControl } from "@/controls/components/canvas/codeblock/DownloadCodeBlockControl";

export class DownloadCodeBlockControlModule implements ControlModule {
  readonly id = "core-codeblock-download";

  async initialize(_modApi: LLMChefModApi): Promise<void> {}

  register(modApi: LLMChefModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "codeblock",
      targetSlot: "codeblock-header-actions",
      renderer: (context: CanvasControlRenderContext) =>
        React.createElement(DownloadCodeBlockControl, {
          interactionId: context.interactionId,
          codeBlockId: context.codeBlockId,
          language: context.codeBlockLang,
          codeToDownload: context.codeBlockContent ?? "",
          filepath: context.codeBlockFilepath,
          disabled: !context.codeBlockContent || context.codeBlockContent.trim() === "",
        }),
    });
  }
  
  destroy(_modApi: LLMChefModApi): void {}
} 