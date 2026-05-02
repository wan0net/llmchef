import type { ControlModule } from "@/types/llmchef/control";
import type { LLMChefModApi } from "@/types/llmchef/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/llmchef/canvas/block-renderer";
import { createLazyBlockRenderer } from "@/controls/components/block-renderers/LazyBlockRenderer";
import React from "react";

const MermaidBlockRenderer = createLazyBlockRenderer<any>(
  () =>
    import("@/components/LLMChef/common/MermaidBlockRenderer").then((module) => ({
      default: module.MermaidBlockRenderer,
    })),
  "Loading diagram renderer...",
);

// Control rule prompt for Mermaid diagrams
export const MERMAID_CONTROL_PROMPT = `LLMChef support MermaidJS diagrams. only valid uncommented diagrams are supported.
For example, if a user asks you a simple explanation on http request, you should use a sequence diagram like so : 
\`\`\`mermaid
sequenceDiagram
    participant Client as "Web Browser"
    participant Server as "Web Server"

    Note over Client,Server: User initiates HTTP request
    Client->>Server: HTTP Request (GET /index.html)
    Server->>Server: Process request
    Server->>Client: HTTP Response (200 OK, HTML content)
    Note over Client,Server: User receives response
\`\`\`

Use Mermaid diagrams for flowcharts, sequence diagrams, class diagrams, state diagrams, ER diagrams, user journey diagrams, and other visual representations. Always use the 'mermaid' language identifier for proper diagram rendering.`;

export class MermaidBlockRendererModule implements ControlModule {
  readonly id = "core-block-renderer-mermaid";
  private unregisterCallback?: () => void;
  private unregisterRuleCallback?: () => void;

  async initialize(): Promise<void> {
    // No initialization needed
  }

  register(modApi: LLMChefModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    const mermaidBlockRenderer: BlockRenderer = {
      id: this.id,
      supportedLanguages: ["mermaid"], // Specifically handles mermaid language
      priority: 10, // Higher priority than fallback renderer
      renderer: (context: BlockRendererContext) => {
        return React.createElement(MermaidBlockRenderer, {
          code: context.code,
          isStreaming: context.isStreaming,
        });
      },
    };

    this.unregisterCallback = modApi.registerBlockRenderer(mermaidBlockRenderer);

    this.unregisterRuleCallback = modApi.registerRule({
      id: `${this.id}-control-rule`,
      name: "Mermaid Diagram Control",
      content: MERMAID_CONTROL_PROMPT,
      description: "Enables AI to generate Mermaid diagrams and flowcharts",
      type: "control",
      alwaysOn: true,
      moduleId: this.id,
    });
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = undefined;
    }
    if (this.unregisterRuleCallback) {
      this.unregisterRuleCallback();
      this.unregisterRuleCallback = undefined;
    }
  }
}
