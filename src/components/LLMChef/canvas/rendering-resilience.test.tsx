import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  interactions: [] as Array<{
    id: string;
    metadata?: {
      toolCalls?: string[];
      toolResults?: string[];
    };
  }>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("zustand/react/shallow", () => ({
  useShallow: <T,>(selector: T) => selector,
}));

vi.mock("@/store/control.store", () => ({
  useControlRegistryStore: <T,>(selector: (state: { canvasControls: Record<string, never> }) => T) =>
    selector({ canvasControls: {} }),
}));

vi.mock("@/store/settings.store", () => ({
  useSettingsStore: <T,>(selector: (state: { enableStreamingMarkdown: boolean }) => T) =>
    selector({ enableStreamingMarkdown: true }),
}));

vi.mock("@/store/interaction.store", () => ({
  useInteractionStore: <T,>(
    selector: (state: { interactions: typeof mockState.interactions }) => T
  ) => selector({ interactions: mockState.interactions }),
}));

vi.mock("@/components/LLMChef/common/UniversalBlockRenderer", () => ({
  UniversalBlockRenderer: ({ code }: { code: string }) => (
    <pre data-testid="code-block">{code}</pre>
  ),
}));

vi.mock("@/components/LLMChef/canvas/SelectionDetector", () => ({
  SelectionDetector: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/LLMChef/common/ImageBlockRenderer", () => ({
  ImageBlockRenderer: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

vi.mock("@/components/LLMChef/common/ActionTooltipButton", () => ({
  ActionTooltipButton: ({ "aria-label": ariaLabel }: { "aria-label": string }) => (
    <button aria-label={ariaLabel} type="button" />
  ),
}));

import { StreamingContentView } from "./StreamingContentView";
import { AssistantResponse } from "./interaction/AssistantResponse";

const malformedToolCalls = [
  JSON.stringify({
    type: "tool-call",
    toolCallId: "call-valid",
    toolName: "read_file",
    input: { path: "README.md" },
  }),
  "not valid json",
];

const malformedToolResults = ["{ definitely not json"];

const renderComponent = (component: React.ReactElement) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(component);
  });

  return { container, root };
};

const unmount = ({ container, root }: { container: HTMLDivElement; root: Root }) => {
  act(() => {
    root.unmount();
  });
  container.remove();
};

describe("rendering resilience", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockState.interactions = [];
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("keeps AssistantResponse renderable when stored tool payload JSON is malformed", () => {
    const rendered = renderComponent(
      <AssistantResponse
        interactionId="assistant-malformed-json"
        response="Assistant response survived"
        toolCalls={malformedToolCalls}
        toolResults={malformedToolResults}
        reasoning={undefined}
        isError={false}
        errorMessage={undefined}
        isFolded={false}
        toggleFold={vi.fn()}
      />
    );

    expect(rendered.container.textContent).toContain("Assistant response survived");
    expect(consoleError).toHaveBeenCalled();

    unmount(rendered);
  });

  it("keeps StreamingContentView renderable when stored tool payload JSON is malformed", () => {
    mockState.interactions = [
      {
        id: "streaming-malformed-json",
        metadata: {
          toolCalls: malformedToolCalls,
          toolResults: malformedToolResults,
        },
      },
    ];

    const rendered = renderComponent(
      <StreamingContentView
        interactionId="streaming-malformed-json"
        markdownContent="Streaming response survived"
      />
    );

    expect(rendered.container.textContent).toContain("Streaming response survived");
    expect(consoleError).toHaveBeenCalled();

    unmount(rendered);
  });

  it("normalizes rendered target blank links with noopener and noreferrer rel tokens", () => {
    const rendered = renderComponent(
      <AssistantResponse
        interactionId="target-blank-link"
        response={'[Example](https://example.com)'}
        toolCalls={undefined}
        toolResults={undefined}
        reasoning={undefined}
        isError={false}
        errorMessage={undefined}
        isFolded={false}
        toggleFold={vi.fn()}
      />
    );

    const link = rendered.container.querySelector<HTMLAnchorElement>(
      'a[target="_blank"]'
    );

    expect(link).not.toBeNull();
    expect(link?.rel.split(/\s+/)).toEqual(
      expect.arrayContaining(["noopener", "noreferrer"])
    );

    unmount(rendered);
  });
});
