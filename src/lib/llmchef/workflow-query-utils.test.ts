import { describe, expect, it } from "vitest";
import type { WorkflowRun } from "@/types/llmchef/workflow";
import {
  buildWorkflowTransformContext,
  resolveJsonPath,
  resolveWorkflowMappingValue,
  validateJsonQuery,
} from "./workflow-query-utils";

const makeRun = (): WorkflowRun => ({
  runId: "run-1",
  conversationId: "conv-1",
  mainInteractionId: "interaction-1",
  status: "running",
  currentStepIndex: 1,
  startedAt: new Date().toISOString(),
  template: {
    id: "wf-1",
    name: "Workflow",
    description: "Sample",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: [
      { id: "step-trigger", name: "Trigger", type: "prompt" },
      { id: "step-a", name: "Step A", type: "prompt" },
      { id: "step-b", name: "Step B", type: "transform" },
    ],
  },
  stepOutputs: {
    trigger: { kind: "trigger-output" },
    "step-a": { nested: { value: 42 }, items: [["zero", "one"]] },
  },
});

describe("workflow-query-utils", () => {
  it("resolves nested object paths and multidimensional array indexes safely", () => {
    const value = resolveJsonPath(
      {
        outputs: [
          { nested: { value: 42 }, items: [["zero", "one"]] },
        ],
      },
      "$.outputs[0].items[0][1]",
    );

    expect(value).toBe("one");
    expect(resolveJsonPath({ ok: true }, "$.__proto__.polluted")).toBeUndefined();
  });

  it("validates static values and JSONPath expressions against context", () => {
    expect(validateJsonQuery('"hello"', {})).toEqual({
      isValid: true,
      result: "hello",
    });

    expect(validateJsonQuery("$.data.value", { data: { value: 7 } })).toEqual({
      isValid: true,
      result: 7,
    });

    expect(
      validateJsonQuery('"hello"', {}, { allowStaticValues: false }),
    ).toMatchObject({
      isValid: false,
      error: 'Query must start with "$."',
    });

    expect(validateJsonQuery("bad.path", {})).toMatchObject({
      isValid: false,
    });
  });

  it("builds transform context with trigger output at outputs[0] and prior steps after it", () => {
    const run = makeRun();
    const context = buildWorkflowTransformContext(run, 2);

    expect(context.workflow).toBe(run.template);
    expect(context.initial_step).toEqual({ kind: "trigger-output" });
    expect(context.outputs[0]).toEqual({ kind: "trigger-output" });
    expect(context.outputs[1]).toBeUndefined();
    expect(context.outputs[2]).toEqual({ nested: { value: 42 }, items: [["zero", "one"]] });
  });

  it("resolves workflow mapping values for static literals and JSONPath queries", () => {
    const context = {
      outputs: [{ result: { score: 99 } }],
    };

    expect(resolveWorkflowMappingValue(context, '"text"')).toBe("text");
    expect(resolveWorkflowMappingValue(context, "true")).toBe(true);
    expect(resolveWorkflowMappingValue(context, "12")).toBe(12);
    expect(resolveWorkflowMappingValue(context, "$.outputs[0].result.score")).toBe(99);
  });
});
