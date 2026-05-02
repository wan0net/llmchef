// src/controls/modules/example/index.tsx
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/llmchef/control";
import { type LLMChefModApi } from "@/types/llmchef/modding";
import type { CanvasControlRenderContext } from "@/types/llmchef/canvas/control"; // Corrected import
import { ExampleCanvasControlComponent } from "./example-canvas-control";

export class ExampleCanvasControlModule implements ControlModule {
  readonly id = "example-canvas-control-module";

  async initialize(_modApi: LLMChefModApi): Promise<void> {
    // Initialization logic if needed
  }

  register(modApi: LLMChefModApi): void {
    modApi.registerCanvasControl({
      id: "example-canvas-action",
      type: "interaction",
      targetSlot: "actions",
      renderer: (
        context: CanvasControlRenderContext // Added type for context
      ) => React.createElement(ExampleCanvasControlComponent, { context }),
    });
  }

  destroy(_modApi: LLMChefModApi): void {
    // Cleanup logic if needed
  }
}
