import type { ToolCallPart, ToolResultPart } from "ai";

export interface ParsedToolStep {
  call: ToolCallPart;
  result?: ToolResultPart;
}

const parseJsonParts = <T>(
  values: string[] | undefined,
  label: string,
  source: string
): T[] => {
  if (!values?.length) {
    return [];
  }

  return values.flatMap((value, index) => {
    try {
      return [JSON.parse(value) as T];
    } catch (error) {
      console.error(
        `[${source}] Skipping malformed ${label} payload at index ${index}:`,
        error
      );
      return [];
    }
  });
};

export const parseToolCallSteps = (
  toolCallStrings: string[] | undefined,
  toolResultStrings: string[] | undefined,
  source = "parseToolCallSteps"
): ParsedToolStep[] => {
  const calls = parseJsonParts<ToolCallPart>(toolCallStrings, "tool call", source);

  if (calls.length === 0) {
    return [];
  }

  const results = parseJsonParts<ToolResultPart>(
    toolResultStrings,
    "tool result",
    source
  );
  const resultsByCallId = new Map(
    results
      .filter((result) => typeof result.toolCallId === "string" && result.toolCallId.length > 0)
      .map((result) => [result.toolCallId, result] as const)
  );

  return calls.map((call) => ({
    call,
    result: resultsByCallId.get(call.toolCallId),
  }));
};
