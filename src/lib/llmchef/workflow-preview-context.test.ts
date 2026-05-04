import { describe, expect, it } from "vitest";
import type { PromptTemplate } from "@/types/llmchef/prompt-template";
import type { WorkflowTemplate } from "@/types/llmchef/workflow";
import { buildWorkflowPreviewContext } from "./workflow-preview-context";

const makeWorkflow = (): WorkflowTemplate => ({
  id: "wf-1",
  name: "Workflow",
  description: "Preview",
  triggerType: "template",
  triggerRef: "template-trigger",
  steps: [
    { id: "step-1", name: "Analyze", type: "prompt", templateId: "prompt-template" },
    { id: "step-2", name: "Transform", type: "transform" },
    { id: "step-3", name: "Human Review", type: "human-in-the-loop" },
  ],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
});

const templates: PromptTemplate[] = [
  {
    id: "template-trigger",
    name: "Trigger Template",
    description: "Trigger",
    variables: [],
    prompt: "Prompt",
    tags: [],
    isPublic: false,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  {
    id: "prompt-template",
    name: "Prompt Template",
    description: "Step",
    variables: [
      { name: "topic", description: "Topic", type: "string", required: true },
      { name: "count", description: "Count", type: "number", required: true },
      { name: "confirmed", description: "Confirmed", type: "boolean", required: true },
      { name: "items", description: "Items", type: "array", required: true },
    ],
    prompt: "Prompt",
    tags: [],
    isPublic: false,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
];

describe("workflow-preview-context", () => {
  it("builds default fallback context when no workflow is provided", () => {
    const context = buildWorkflowPreviewContext(undefined, undefined, []);

    expect(context.workflow.id).toBe("sample-workflow");
    expect(context.initial_step).toBe("Sample AI response text for validation purposes.");
    expect(context.outputs[1]).toMatchObject({ analysis: "Sample analysis result" });
    expect(context.outputs[2]).toMatchObject({ summary: "Sample summary from step 1" });
  });

  it("builds trigger preview data and raw text when the next step is a transform", () => {
    const context = buildWorkflowPreviewContext(makeWorkflow(), 1, templates);

    expect(context.initial_step).toMatchObject({
      summary: "Sample output from template: Trigger Template",
      extracted_data: "Sample extracted information",
      status: "completed",
    });
    expect(typeof context.outputs[1]).toBe("string");
    expect(context.outputs[1]).toContain("Sample AI response from Analyze");
  });

  it("builds structured prompt outputs from template variables when next step is not a transform", () => {
    const workflow = makeWorkflow();
    workflow.steps[1] = { id: "step-2", name: "Review", type: "human-in-the-loop" };

    const context = buildWorkflowPreviewContext(workflow, 1, templates);

    expect(context.outputs[1]).toEqual({
      topic: "Sample topic",
      count: 42,
      confirmed: true,
      items: ["item1", "item2"],
    });
  });

  it("builds human-in-the-loop preview outputs for prior steps", () => {
    const workflow = makeWorkflow();
    const context = buildWorkflowPreviewContext(workflow, 3, templates);

    expect(context.outputs[2]).toEqual({
      transformed_data: "Sample transformed data",
      step_type: "transform",
      step_name: "Transform",
    });
    expect(context.outputs[3]).toEqual({
      human_input: "Sample human review result",
      approved: true,
      step_type: "human-in-the-loop",
      step_name: "Human Review",
    });
  });
});
