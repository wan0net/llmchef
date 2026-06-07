import { describe, expect, it, vi } from "vitest";
import { parseToolCallSteps } from "./tool-call-steps";

describe("parseToolCallSteps", () => {
  it("matches tool results by toolCallId", () => {
    const steps = parseToolCallSteps(
      [
        JSON.stringify({
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "read_file",
          input: { path: "README.md" },
        }),
      ],
      [
        JSON.stringify({
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "read_file",
          output: "ok",
        }),
      ],
      "tool-call-steps.test"
    );

    expect(steps).toHaveLength(1);
    expect(steps[0]?.call.toolCallId).toBe("call-1");
    expect(steps[0]?.result?.toolCallId).toBe("call-1");
  });

  it("skips malformed payloads instead of throwing", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const steps = parseToolCallSteps(
      ['{"toolCallId":"call-1","toolName":"read_file","input":{}}', "not json"],
      ["bad result payload"],
      "tool-call-steps.test"
    );

    expect(steps).toHaveLength(1);
    expect(steps[0]?.call.toolCallId).toBe("call-1");
    expect(steps[0]?.result).toBeUndefined();
    expect(consoleError).toHaveBeenCalledTimes(2);

    consoleError.mockRestore();
  });
});
