import React from "react";
import { type ControlModule } from "@/types/llmchef/control";
import type { LLMChefModApi } from "@/types/llmchef/modding";
import type { CanvasControlRenderContext } from "@/types/llmchef/canvas/control";
import { SaveCodeBlockToVfsControl } from "@/controls/components/canvas/codeblock/SaveCodeBlockToVfsControl";

export class SaveCodeBlockToVfsControlModule implements ControlModule {
  readonly id = "core-codeblock-save-to-vfs";

  async initialize(): Promise<void> {}

  register(modApi: LLMChefModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "codeblock",
      targetSlot: "codeblock-header-actions",
      renderer: (context: CanvasControlRenderContext) =>
        React.createElement(SaveCodeBlockToVfsControl, {
          interactionId: context.interactionId,
          codeBlockId: context.codeBlockId ?? context.blockId,
          language: context.codeBlockLang,
          codeToSave:
            context.codeBlockEditedContent ?? context.codeBlockContent ?? "",
          filepath: context.codeBlockFilepath,
          disabled:
            !context.codeBlockContent ||
            context.codeBlockContent.trim() === "",
        }),
    });
  }

  destroy(): void {}
}
