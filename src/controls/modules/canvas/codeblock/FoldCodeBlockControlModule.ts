// src/controls/modules/canvas/codeblock/FoldCodeBlockControlModule.ts
// NEW FILE
import React from "react";
import { type ControlModule } from "@/types/llmchef/control";
import type { LLMChefModApi } from "@/types/llmchef/modding";
import type { CanvasControlRenderContext } from "@/types/llmchef/canvas/control";
import { FoldCodeBlockControl } from "@/controls/components/canvas/codeblock/FoldCodeBlockControl";

export class FoldCodeBlockControlModule implements ControlModule {
  readonly id = "core-codeblock-fold";

  async initialize(_modApi: LLMChefModApi): Promise<void> {}

  register(modApi: LLMChefModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "codeblock",
      targetSlot: "codeblock-header-actions",
      renderer: (context: CanvasControlRenderContext) => {
        if (
          context.toggleFold === undefined ||
          context.isFolded === undefined
        ) {
          return null;
        }
        return React.createElement(FoldCodeBlockControl, {
          isFolded: context.isFolded,
          toggleFold: context.toggleFold,
        });
      },
    });
  }
  destroy(_modApi: LLMChefModApi): void {}
}
